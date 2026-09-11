import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = readCommand("git", ["rev-parse", "--show-toplevel"])?.trim() ?? null;
const PACKAGE_PATH = join(APP_ROOT, "package.json");
const packageJson = readJson(PACKAGE_PATH) ?? {};
const packageScripts = packageJson.scripts ?? {};
const requiredProjectFiles = ["package.json", "package-lock.json", "AGENTS.md", "CLAUDE.md", "tsconfig.json", "wrangler.jsonc"];
const requiredDocs = [
  "docs/CLOUDFLARE_NATIVE_V1_PLAN.md",
  "docs/CLOUDFLARE_CURRENT_STATE.md",
  "docs/CLOUDFLARE_ADMIN_WRITE_CONTRACT.md",
  "docs/CLOUDFLARE_DEPLOYMENT.md",
  "docs/AI_ADMIN_SKILL_GUIDE.md",
  "docs/ASTRA_AUDIT_HANDOFF.md",
  "docs/PRODUCTION_ACCEPTANCE_CHECKLIST.md",
  "docs/RELEASE_READINESS_AUDIT.md",
];
const requiredScripts = [
  "test:admin",
  "test:contact",
  "test:catalog",
  "lint",
  "typecheck",
  "build",
  "cf:build:staging",
  "qa:admin-history",
  "qa:astra-preflight",
];
const generatedCandidates = [".next", ".open-next", ".runtime", ".wrangler", "public/captured-pages"];

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function readCommand(command, args) {
  try {
    return execFileSync(command, args, {
      cwd: APP_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
    });
  } catch {
    return null;
  }
}

function run(command, args) {
  const invocation = process.platform === "win32" && command.toLowerCase().endsWith(".cmd")
    ? { command: process.env.ComSpec ?? "cmd.exe", args: ["/d", "/s", "/c", [command, ...args].join(" ")] }
    : { command, args };
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: APP_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  return {
    code: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function parsePorcelain(statusOutput) {
  return statusOutput
    .split("\0")
    .filter(Boolean)
    .map((entry) => ({ code: entry.slice(0, 2), path: entry.slice(3) }));
}

function isTrackedEnvironmentPath(path) {
  return /(^|[\\/])\.env(?:$|(?:\.[^.\\/]+)*\.local$)/i.test(path);
}

function directoryStats(path) {
  if (!existsSync(path)) return { exists: false, files: 0, bytes: 0 };
  let files = 0;
  let bytes = 0;
  const visit = (currentPath) => {
    for (const entry of readdirSync(currentPath, { withFileTypes: true })) {
      const entryPath = join(currentPath, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
      } else if (entry.isFile()) {
        files += 1;
        try {
          bytes += lstatSync(entryPath).size;
        } catch {
          // A concurrently changing generated file is still safe to report.
        }
      }
    }
  };
  visit(path);
  return { exists: true, files, bytes };
}

function isIgnored(path) {
  return run("git", ["check-ignore", "-q", "--", path]).code === 0;
}

function findExtraneousDependencies() {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = run(npmCommand, ["ls", "--depth=0", "--json"]);
  const parsed = readJsonFromText(result.stdout);
  if (!parsed) return { commandExit: result.code, names: [], unreadable: true };
  const names = Object.entries(parsed.dependencies ?? {})
    .filter(([, dependency]) => dependency?.extraneous === true)
    .map(([name]) => name)
    .sort();
  return { commandExit: result.code, names, unreadable: false };
}

function readJsonFromText(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const statusResult = run("git", ["status", "--porcelain=v1", "-z"]);
const statusEntries = parsePorcelain(statusResult.stdout);
const trackedEntries = statusEntries.filter(({ code }) => code !== "??");
const stagedEntries = statusEntries.filter(({ code }) => code[0] !== " " && code !== "??");
const trackedFiles = (readCommand("git", ["ls-files", "-z"]) ?? "").split("\0").filter(Boolean);
const trackedEnvironmentPaths = trackedFiles.filter(isTrackedEnvironmentPath);
const diffCheck = run("git", ["diff", "--check"]);
const stagedDiffCheck = run("git", ["diff", "--cached", "--check"]);
const extraneous = findExtraneousDependencies();
const missingDocs = requiredDocs.filter((path) => !existsSync(join(APP_ROOT, path)));
const missingProjectFiles = requiredProjectFiles.filter((path) => !existsSync(join(APP_ROOT, path)));
const missingScripts = requiredScripts.filter((name) => typeof packageScripts[name] !== "string");
const generated = Object.fromEntries(generatedCandidates.map((path) => [path, { ...directoryStats(join(APP_ROOT, path)), ignored: isIgnored(path) }]));
const envFilesPresent = [".env", ".env.local", ".env.example"].filter((name) => existsSync(join(APP_ROOT, name)));
const branch = readCommand("git", ["branch", "--show-current"])?.trim() || "(detached)";
const head = readCommand("git", ["rev-parse", "--short", "HEAD"])?.trim() || "unknown";
const npmVersion = run(process.platform === "win32" ? "npm.cmd" : "npm", ["--version"]).stdout.trim() || "unknown";
const nodeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
const minimumNode = Number.parseInt(String(packageJson.engines?.node ?? "").replace(/[^0-9]/g, ""), 10) || null;

const blockers = [
  ...(REPO_ROOT ? [] : ["Không xác định được Git repository root."]),
  ...(missingProjectFiles.length > 0 ? [`Thiếu file project bắt buộc: ${missingProjectFiles.join(", ")}`] : []),
  ...(missingDocs.length > 0 ? [`Thiếu tài liệu bắt buộc: ${missingDocs.join(", ")}`] : []),
  ...(missingScripts.length > 0 ? [`Thiếu npm script bắt buộc: ${missingScripts.join(", ")}`] : []),
  ...(trackedEnvironmentPaths.length > 0 ? ["Có đường dẫn .env đang xuất hiện trong git status; cần xử lý trước khi Astra đọc/commit."] : []),
  ...(diffCheck.code !== 0 || stagedDiffCheck.code !== 0 ? ["git diff --check phát hiện whitespace error; cần sửa trước khi commit."] : []),
  ...(minimumNode !== null && nodeMajor < minimumNode ? [`Node ${process.versions.node} thấp hơn engine yêu cầu ${packageJson.engines.node}.`] : []),
];

const report = {
  generatedAt: new Date().toISOString(),
  appRoot: APP_ROOT,
  repoRoot: REPO_ROOT,
  branch,
  head,
  runtime: { node: process.versions.node, npm: npmVersion, requiredNode: packageJson.engines?.node ?? null },
  git: {
    statusExit: statusResult.code,
    dirty: statusEntries.length > 0,
    totalEntries: statusEntries.length,
    trackedModified: trackedEntries.length,
    staged: stagedEntries.length,
    untracked: statusEntries.filter(({ code }) => code === "??").length,
    trackedEnvironmentPaths,
    diffCheckExit: diffCheck.code,
    stagedDiffCheckExit: stagedDiffCheck.code,
  },
  requiredDocs: { missing: missingDocs, checked: requiredDocs },
  requiredProjectFiles: { missing: missingProjectFiles, checked: requiredProjectFiles },
  requiredScripts: { missing: missingScripts, checked: requiredScripts },
  generated,
  envFilesPresent,
  dependencies: { npmLsExit: extraneous.commandExit, extraneous: extraneous.names, unreadable: extraneous.unreadable },
  blockers,
  warnings: [
    ...(statusEntries.length > 0 ? ["Worktree đang dirty; Astra phải phân biệt thay đổi có sẵn và thay đổi của vòng review."] : []),
    ...(extraneous.names.length > 0 ? [`Dependency extraneous cần xác minh bằng clean install: ${extraneous.names.join(", ")}.`] : []),
    ...(Object.values(generated).some(({ exists, ignored }) => exists && !ignored) ? ["Có generated artifact không nằm trong .gitignore; không tự động xóa."] : []),
  ],
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log("ASTRA AUDIT PREFLIGHT (read-only)");
  console.log(`App: ${report.appRoot}`);
  console.log(`Git: ${report.branch} @ ${report.head} | dirty=${report.git.dirty} | tracked=${report.git.trackedModified} | staged=${report.git.staged} | untracked=${report.git.untracked}`);
  console.log(`Runtime: Node ${report.runtime.node} | npm ${report.runtime.npm} | engine ${report.runtime.requiredNode ?? "not declared"}`);
  console.log(`Project files: ${requiredProjectFiles.length - missingProjectFiles.length}/${requiredProjectFiles.length} required files present`);
  console.log(`Docs: ${requiredDocs.length - missingDocs.length}/${requiredDocs.length} required files present`);
  console.log(`Scripts: ${requiredScripts.length - missingScripts.length}/${requiredScripts.length} required commands present`);
  console.log(`Diff check: unstaged=${diffCheck.code === 0 ? "pass" : "fail"} | staged=${stagedDiffCheck.code === 0 ? "pass" : "fail"}`);
  console.log(`Dependencies: ${extraneous.names.length === 0 ? "clean at depth 0" : `extraneous ${extraneous.names.join(", ")}`}`);
  console.log(`Generated artifacts: ${Object.entries(generated).filter(([, value]) => value.exists).map(([path, value]) => `${path} (${value.files} files)`).join(", ") || "none"}`);
  if (envFilesPresent.length > 0) console.log(`Environment filenames present (values not read): ${envFilesPresent.join(", ")}`);
  for (const warning of report.warnings) console.log(`WARN: ${warning}`);
  for (const blocker of blockers) console.log(`BLOCKER: ${blocker}`);
  console.log(blockers.length === 0 ? "PREFLIGHT READY: Astra may begin read-only review." : "PREFLIGHT BLOCKED: resolve the items above before review.");
}

process.exitCode = blockers.length === 0 ? 0 : 1;
