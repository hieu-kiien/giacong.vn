import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const exceptionUrl = new URL("security/npm-audit-exceptions.json", root);
const lockUrl = new URL("package-lock.json", root);
const blockingSeverities = new Set(["high", "critical"]);

export async function evaluateProductionAudit({ audit, policy, lock, now = new Date() }) {
  validatePolicy(policy);
  validateContextLocks(policy.contextLocks, lock);

  const vulnerabilities = audit?.vulnerabilities ?? {};
  const exceptions = new Map(
    policy.exceptions.map((entry) => [`${entry.package}:${entry.advisory}:${entry.node}`, entry]),
  );
  const directFindings = collectDirectBlockingFindings(vulnerabilities);
  const failures = [];
  const accepted = [];

  for (const finding of directFindings) {
    const key = `${finding.package}:${finding.advisory}:${finding.node}`;
    const exception = exceptions.get(key);
    if (!exception) {
      failures.push(`${finding.package} ${finding.advisory} at ${finding.node} has no exact exception`);
      continue;
    }

    const installed = lock?.packages?.[finding.node]?.version;
    if (installed !== exception.version) {
      failures.push(
        `${finding.package} ${finding.advisory} expected ${exception.node}@${exception.version}, found ${installed ?? "missing"}`,
      );
      continue;
    }

    if (isExpired(exception.expiresOn, now)) {
      failures.push(`${finding.package} ${finding.advisory} exception expired on ${exception.expiresOn}`);
      continue;
    }

    accepted.push({ ...finding, expiresOn: exception.expiresOn, reason: exception.reason });
  }

  for (const [packageName, vulnerability] of Object.entries(vulnerabilities)) {
    if (!blockingSeverities.has(vulnerability?.severity)) continue;
    const closure = collectBlockingAdvisories(packageName, vulnerabilities);
    if (closure.length === 0) {
      failures.push(`${packageName} is ${vulnerability.severity} but has no resolvable high/critical advisory closure`);
      continue;
    }

    for (const finding of closure) {
      const covered = accepted.some(
        (entry) => entry.package === finding.package
          && entry.advisory === finding.advisory
          && entry.node === finding.node,
      );
      if (!covered) {
        failures.push(
          `${packageName} remains ${vulnerability.severity} through unaccepted ${finding.package} ${finding.advisory} at ${finding.node}`,
        );
      }
    }
  }

  const activeKeys = new Set(directFindings.map((finding) => `${finding.package}:${finding.advisory}:${finding.node}`));
  const staleExceptions = policy.exceptions.filter(
    (entry) => !activeKeys.has(`${entry.package}:${entry.advisory}:${entry.node}`),
  );

  return {
    accepted,
    failures: [...new Set(failures)],
    staleExceptions,
    metadata: audit?.metadata?.vulnerabilities ?? {},
  };
}

export function collectDirectBlockingFindings(vulnerabilities) {
  const findings = [];
  for (const [packageName, vulnerability] of Object.entries(vulnerabilities ?? {})) {
    const nodes = Array.isArray(vulnerability?.nodes) ? vulnerability.nodes : [];
    const advisories = (Array.isArray(vulnerability?.via) ? vulnerability.via : [])
      .filter((entry) => typeof entry === "object" && entry !== null)
      .filter((entry) => blockingSeverities.has(entry.severity))
      .map((entry) => ({
        advisory: advisoryId(entry.url),
        severity: entry.severity,
      }));

    for (const advisory of advisories) {
      if (!advisory.advisory) {
        findings.push({
          advisory: `UNPARSEABLE:${packageName}`,
          package: packageName,
          node: nodes[0] ?? "(missing-node)",
          severity: advisory.severity,
        });
        continue;
      }
      for (const node of nodes) {
        findings.push({
          advisory: advisory.advisory,
          package: packageName,
          node,
          severity: advisory.severity,
        });
      }
    }
  }
  return uniqueFindings(findings);
}

export function collectBlockingAdvisories(packageName, vulnerabilities, seen = new Set()) {
  if (seen.has(packageName)) return [];
  const vulnerability = vulnerabilities?.[packageName];
  if (!vulnerability) return [];
  const nextSeen = new Set(seen).add(packageName);
  const findings = [];
  const nodes = Array.isArray(vulnerability.nodes) ? vulnerability.nodes : [];

  for (const via of Array.isArray(vulnerability.via) ? vulnerability.via : []) {
    if (typeof via === "string") {
      findings.push(...collectBlockingAdvisories(via, vulnerabilities, nextSeen));
      continue;
    }
    if (!via || typeof via !== "object" || !blockingSeverities.has(via.severity)) continue;
    const id = advisoryId(via.url);
    if (!id) continue;
    for (const node of nodes) {
      findings.push({ advisory: id, package: packageName, node, severity: via.severity });
    }
  }

  return uniqueFindings(findings);
}

export function validateContextLocks(contextLocks, lock) {
  if (!Array.isArray(contextLocks) || contextLocks.length === 0) {
    throw new Error("npm audit exception policy must declare contextLocks");
  }
  for (const entry of contextLocks) {
    const installed = lock?.packages?.[entry.node]?.version;
    if (installed !== entry.version) {
      throw new Error(
        `audit exception context changed: ${entry.package} expected ${entry.node}@${entry.version}, found ${installed ?? "missing"}`,
      );
    }
  }
}

function validatePolicy(policy) {
  if (policy?.schemaVersion !== 1) throw new Error("unsupported npm audit exception policy schema");
  if (!Array.isArray(policy.exceptions)) throw new Error("npm audit exception policy requires exceptions[]");
  const keys = new Set();
  for (const entry of policy.exceptions) {
    if (!/^GHSA-[a-z0-9-]+$/i.test(entry.advisory ?? "")) {
      throw new Error(`invalid npm audit advisory id: ${entry.advisory ?? "missing"}`);
    }
    if (!entry.package || !entry.node || !entry.version || !/^\d{4}-\d{2}-\d{2}$/.test(entry.expiresOn ?? "")) {
      throw new Error(`invalid npm audit exception metadata for ${entry.advisory}`);
    }
    if (typeof entry.reason !== "string" || entry.reason.trim().length < 40) {
      throw new Error(`npm audit exception ${entry.advisory} requires a substantive reason`);
    }
    const key = `${entry.package}:${entry.advisory}:${entry.node}`;
    if (keys.has(key)) throw new Error(`duplicate npm audit exception: ${key}`);
    keys.add(key);
  }
}

function isExpired(expiresOn, now) {
  const expiry = new Date(`${expiresOn}T23:59:59.999Z`);
  return Number.isNaN(expiry.valueOf()) || now.valueOf() > expiry.valueOf();
}

function advisoryId(url) {
  if (typeof url !== "string") return null;
  return /\b(GHSA-[a-z0-9-]+)\b/i.exec(url)?.[1]?.toUpperCase() ?? null;
}

function uniqueFindings(findings) {
  const seen = new Set();
  return findings.filter((finding) => {
    const key = `${finding.package}:${finding.advisory}:${finding.node}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function run() {
  const [policy, lock] = await Promise.all([
    readJson(exceptionUrl),
    readJson(lockUrl),
  ]);
  const audit = runNpmAudit();
  const result = await evaluateProductionAudit({ audit, policy, lock });

  const counts = result.metadata;
  console.log(
    `Production audit: ${counts.critical ?? 0} critical, ${counts.high ?? 0} high, ${counts.moderate ?? 0} moderate, ${counts.low ?? 0} low.`,
  );

  for (const entry of result.accepted) {
    console.warn(
      `TEMPORARY EXCEPTION ${entry.advisory} ${entry.package} at ${entry.node}; expires ${entry.expiresOn}. ${entry.reason}`,
    );
  }
  for (const entry of result.staleExceptions) {
    console.warn(`STALE EXCEPTION ${entry.advisory} for ${entry.package} is no longer active; remove it when convenient.`);
  }

  if (result.failures.length > 0) {
    for (const failure of result.failures) console.error(`BLOCKED: ${failure}`);
    process.exitCode = 1;
    return;
  }

  console.log("Production dependency audit passed: every high/critical finding is either absent or covered by an exact, non-expired exception.");
}

function runNpmAudit() {
  const executable = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(executable, ["audit", "--omit=dev", "--json"], {
    cwd: fileURLToPath(root),
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (!result.stdout?.trim()) {
    throw new Error(`npm audit returned no JSON output: ${result.stderr || `exit ${result.status}`}`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`npm audit returned invalid JSON: ${error.message}\n${result.stdout.slice(0, 1000)}`);
  }
}

async function readJson(url) {
  return JSON.parse(await readFile(url, "utf8"));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL(`file://${process.argv[1]}`))) {
  await run();
}
