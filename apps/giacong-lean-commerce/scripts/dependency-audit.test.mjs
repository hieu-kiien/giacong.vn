import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { evaluateProductionAudit } from "./audit-production-dependencies.mjs";

const root = new URL("../", import.meta.url);
const workflowUrl = new URL("../../../.github/workflows/ci-cloudflare.yml", import.meta.url);

const [packageJson, policy, lock] = await Promise.all([
  readJson(new URL("package.json", root)),
  readJson(new URL("security/npm-audit-exceptions.json", root)),
  readJson(new URL("package-lock.json", root)),
]);

function knownAudit() {
  const advisory = (url, severity = "high") => ({ severity, url });
  return {
    vulnerabilities: {
      nanoid: {
        severity: "high",
        via: [advisory("https://github.com/advisories/GHSA-2v37-7h3g-55p8")],
        nodes: ["node_modules/nanoid"],
      },
      postcss: {
        severity: "high",
        via: [
          advisory("https://github.com/advisories/GHSA-qx2v-qp2m-jg93", "moderate"),
          advisory("https://github.com/advisories/GHSA-6g55-p6wh-862q"),
          advisory("https://github.com/advisories/GHSA-fxqj-rqcc-2cmp", "moderate"),
          advisory("https://github.com/advisories/GHSA-r28c-9q8g-f849"),
          "nanoid",
        ],
        nodes: ["node_modules/next/node_modules/postcss"],
      },
      sharp: {
        severity: "high",
        via: [advisory("https://github.com/advisories/GHSA-f88m-g3jw-g9cj")],
        nodes: ["node_modules/sharp"],
      },
      next: {
        severity: "high",
        via: ["postcss", "sharp"],
        nodes: ["node_modules/next"],
      },
    },
    metadata: {
      vulnerabilities: { critical: 0, high: 4, moderate: 0, low: 0, total: 4 },
    },
  };
}

test("production audit runs the policy-aware gate and keeps CLI tooling out of the runtime tree", () => {
  assert.equal(packageJson.scripts["audit:prod"], "node scripts/audit-production-dependencies.mjs");
  assert.equal(packageJson.dependencies.shadcn, undefined);
  assert.equal(packageJson.devDependencies.shadcn, "^4.1.0");
  assert.equal(packageJson.overrides.nanoid, "3.3.16");
});

test("temporary exceptions are exact GHSA/package/node/version entries with a short review horizon", () => {
  assert.equal(policy.schemaVersion, 1);
  assert.deepEqual(
    policy.exceptions.map((entry) => entry.advisory).sort(),
    [
      "GHSA-2V37-7H3G-55P8",
      "GHSA-6G55-P6WH-862Q",
      "GHSA-F88M-G3JW-G9CJ",
      "GHSA-R28C-9Q8G-F849",
    ].sort(),
  );
  for (const entry of policy.exceptions) {
    assert.equal(entry.expiresOn, "2026-09-15");
    assert.ok(entry.package && entry.node && entry.version);
    assert.ok(entry.reason.length >= 40);
  }
});

test("known high findings pass only through the exact non-expired exception closure", async () => {
  const result = await evaluateProductionAudit({
    audit: knownAudit(),
    policy,
    lock,
    now: new Date("2026-08-18T00:00:00Z"),
  });

  assert.deepEqual(result.failures, []);
  assert.equal(result.accepted.length, 4);
});

test("a new high advisory is blocked even when it affects an already-audited dependency graph", async () => {
  const audit = knownAudit();
  audit.vulnerabilities.postcss.via.push({
    severity: "high",
    url: "https://github.com/advisories/GHSA-aaaa-bbbb-cccc",
  });

  const result = await evaluateProductionAudit({
    audit,
    policy,
    lock,
    now: new Date("2026-08-18T00:00:00Z"),
  });

  assert.ok(result.failures.some((failure) => failure.includes("GHSA-AAAA-BBBB-CCCC")));
});

test("active exceptions fail closed after their review date", async () => {
  const result = await evaluateProductionAudit({
    audit: knownAudit(),
    policy,
    lock,
    now: new Date("2026-09-16T00:00:00Z"),
  });

  assert.ok(result.failures.some((failure) => failure.includes("exception expired")));
});

test("dependency graph drift invalidates the exception context before advisory evaluation", async () => {
  const changedLock = structuredClone(lock);
  changedLock.packages["node_modules/next"].version = "16.2.13";

  await assert.rejects(
    () => evaluateProductionAudit({
      audit: knownAudit(),
      policy,
      lock: changedLock,
      now: new Date("2026-08-18T00:00:00Z"),
    }),
    /audit exception context changed: next/,
  );
});

test("CI audits production dependencies before running the application quality suite", async () => {
  const workflow = await readFile(workflowUrl, "utf8");
  const install = "run: npm ci";
  const audit = "run: npm run audit:prod";
  const checks = "run: npm run check";

  assert.match(workflow, /name: Audit production dependencies/);
  assert.doesNotMatch(workflow, /Inspect production audit JSON/);
  assert.ok(workflow.includes(install));
  assert.ok(workflow.includes(audit));
  assert.ok(workflow.includes(checks));
  assert.ok(workflow.indexOf(install) < workflow.indexOf(audit));
  assert.ok(workflow.indexOf(audit) < workflow.indexOf(checks));
});

async function readJson(url) {
  return JSON.parse(await readFile(url, "utf8"));
}
