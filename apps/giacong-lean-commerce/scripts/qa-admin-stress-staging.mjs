// Controlled, authenticated, read-only staging stress check for the admin
// navigation/resource-limit incident. It deliberately refuses non-staging
// hosts and rejects every mutating browser request.
import process from "node:process";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { hasRenderedAdminFailure } from "./qa-admin-staging-helpers.mjs";

const MAX_CONCURRENCY = 4;
const MAX_ROUNDS = 10;
const DEFAULT_CONCURRENCY = 2;
const DEFAULT_ROUNDS = 2;
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const ADMIN_ROUTES = [
  "/admin",
  "/admin/noi-dung",
  "/admin/thiet-ke",
  "/admin/san-pham",
  "/admin/dich-vu",
  "/admin/tin-tuc",
  "/admin/dieu-huong",
  "/admin/yeu-cau",
  "/admin/thanh-vien",
  "/admin/audit",
];

const baseUrl = (process.env.QA_ADMIN_STRESS_BASE_URL ?? "https://admin-staging.kienhieu.id.vn").replace(/\/$/, "");
const storageStatePath = process.env.QA_ADMIN_STORAGE_STATE?.trim();

function blocked(message) {
  console.error(`ADMIN STRESS BLOCKED: ${message}`);
  process.exit(2);
}

function boundedInteger(name, fallback, maximum) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    blocked(`${name} must be an integer between 1 and ${maximum}.`);
  }
  return value;
}

let parsedBaseUrl;
try {
  parsedBaseUrl = new URL(baseUrl);
} catch {
  blocked("QA_ADMIN_STRESS_BASE_URL must be a valid URL.");
}
if (parsedBaseUrl.protocol !== "https:" || parsedBaseUrl.hostname !== "admin-staging.kienhieu.id.vn") {
  blocked("the stress runner only permits HTTPS admin-staging.kienhieu.id.vn.");
}
if (!storageStatePath) {
  blocked("set QA_ADMIN_STORAGE_STATE to an authenticated Access storage state.");
}

const storageState = resolve(storageStatePath);
try {
  await access(storageState);
} catch {
  blocked(`storage state was not found at ${storageState}.`);
}

const concurrency = boundedInteger("QA_ADMIN_STRESS_CONCURRENCY", DEFAULT_CONCURRENCY, MAX_CONCURRENCY);
const rounds = boundedInteger("QA_ADMIN_STRESS_ROUNDS", DEFAULT_ROUNDS, MAX_ROUNDS);

function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}

async function runWorker(browser, round, worker) {
  let context;
  const results = [];
  try {
    context = await browser.newContext({ storageState });
    const page = await context.newPage();
    const pageIssues = [];
    page.on("pageerror", (error) => pageIssues.push(`pageerror: ${error.message}`));
    page.on("request", (request) => {
      if (MUTATING_METHODS.has(request.method())) {
        pageIssues.push(`unexpected mutation request: ${request.method()} ${request.url()}`);
      }
    });
    page.on("console", (message) => {
      if (!["error", "warning"].includes(message.type())) return;
      const url = message.location().url || "";
      if (url.startsWith(baseUrl)) pageIssues.push(`${message.type()}: ${message.text()}`);
    });

    for (const route of ADMIN_ROUTES) {
      const issueStart = pageIssues.length;
      const startedAt = performance.now();
      let status = 0;
      let bodyText = "";
      let rendered = false;
      let navigationError = "";
      try {
        const response = await page.goto(`${baseUrl}${route}`, {
          waitUntil: "domcontentloaded",
          timeout: 45_000,
        });
        status = response?.status() ?? 0;
        rendered = await page.locator("h1").first().waitFor({ state: "visible", timeout: 15_000 })
          .then(() => true)
          .catch(() => false);
        bodyText = await page.locator("body").innerText().catch(() => "");
      } catch (error) {
        navigationError = errorText(error);
      }
      const routeIssues = pageIssues.slice(issueStart);
      const resourceLimit = /Worker exceeded resource limits|\b1102\b/i.test(bodyText);
      const renderedFailure = hasRenderedAdminFailure(bodyText);
      const ok = status === 200 && rendered && !resourceLimit && !renderedFailure && !navigationError && routeIssues.length === 0;
      results.push({
        round,
        worker,
        route,
        ok,
        status,
        elapsedMs: Math.round(performance.now() - startedAt),
        resourceLimit,
        rendered,
        navigationError,
        issues: routeIssues,
      });
    }
  } catch (error) {
    results.push({
      round,
      worker,
      route: "<worker>",
      ok: false,
      status: 0,
      elapsedMs: 0,
      resourceLimit: false,
      rendered: false,
      navigationError: errorText(error),
      issues: [],
    });
  } finally {
    await context?.close().catch(() => undefined);
  }
  return results;
}

const browser = await chromium.launch();
const results = [];
try {
  for (let round = 1; round <= rounds; round += 1) {
    const roundResults = await Promise.all(
      Array.from({ length: concurrency }, (_, index) => runWorker(browser, round, index + 1)),
    );
    results.push(...roundResults.flat());
  }
} finally {
  await browser.close();
}

const failures = results.filter((result) => !result.ok);
const summary = {
  baseUrl,
  rounds,
  concurrency,
  routesPerWorker: ADMIN_ROUTES.length,
  checks: results.length,
  failures: failures.length,
  resourceLimitFailures: failures.filter((result) => result.resourceLimit).length,
  unexpectedMutationFailures: failures.filter((result) => result.issues.some((issue) => issue.startsWith("unexpected mutation request:"))).length,
};
console.log(JSON.stringify({ summary, failures }, null, 2));
if (failures.length) {
  console.error(`ADMIN STRESS FAILED: ${failures.length} check(s)`);
  process.exitCode = 1;
} else {
  console.log("ADMIN STRESS PASSED");
}
