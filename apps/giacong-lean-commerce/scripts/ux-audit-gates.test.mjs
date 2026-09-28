import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { evaluateScrollMotionAudit, evaluateUxAudit } from "./ux-audit-gates.mjs";

function cleanAudit(overrides = {}) {
  return {
    baseUrl: "https://giacong.test",
    routes: [{
      name: "catalog-mobile",
      status: 200,
      actions: [{ id: "open-menu", pass: true }],
      consoleErrors: [],
      pageErrors: [],
      notes: [],
      network: { badResponses: [], failedRequests: [], blockedMutations: [] },
      inspection: { horizontalOverflow: false },
      accessibility: { axe: { available: true, violations: [] } },
    }],
    responsiveSweep: [{
      viewport: { width: 390, height: 844 },
      status: 200,
      horizontalOverflow: false,
      errors: [],
      console: [],
      pageErrors: [],
      network: { badResponses: [], failedRequests: [], blockedMutations: [] },
    }],
    ...overrides,
  };
}

test("passes only when route actions, runtime, network, layout, and accessibility gates pass", () => {
  assert.deepEqual(evaluateUxAudit(cleanAudit()), {
    status: "passed",
    exitCode: 0,
    failures: [],
    incomplete: [],
  });
});

test("fails for first-party HTTP errors, failed actions, page errors, overflow, and serious axe violations", () => {
  const audit = cleanAudit({
    routes: [{
      ...cleanAudit().routes[0],
      actions: [{ id: "open-menu", pass: false }],
      pageErrors: ["uncaught TypeError"],
      network: {
        badResponses: [{ status: 404, url: "https://giacong.test/assets/product.jpg" }],
        failedRequests: [],
        blockedMutations: [],
      },
      inspection: { horizontalOverflow: true },
      accessibility: { axe: { available: true, violations: [{ id: "contrast", impact: "serious" }] } },
    }],
  });

  const result = evaluateUxAudit(audit);
  assert.equal(result.status, "failed");
  assert.equal(result.exitCode, 1);
  assert.deepEqual(result.failures.map(({ code }) => code), [
    "failed-action",
    "page-error",
    "first-party-http-error",
    "horizontal-overflow",
    "serious-accessibility-violation",
  ]);
});

test("marks missing axe evidence incomplete and does not fail for unrelated third-party 404s", () => {
  const audit = cleanAudit({
    routes: [{
      ...cleanAudit().routes[0],
      network: {
        badResponses: [{ status: 404, url: "https://analytics.example/pixel" }],
        failedRequests: [],
        blockedMutations: [],
      },
      accessibility: { axe: { available: false, error: "CDN unavailable" } },
    }],
  });

  const result = evaluateUxAudit(audit);
  assert.equal(result.status, "incomplete");
  assert.equal(result.exitCode, 2);
  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.incomplete.map(({ code }) => code), ["axe-unavailable"]);
});

test("does not count canceled Next RSC navigation or Cloudflare RUM as app request failures", () => {
  const audit = cleanAudit({
    routes: [{
      ...cleanAudit().routes[0],
      network: {
        badResponses: [],
        blockedMutations: [],
        failedRequests: [
          { method: "GET", url: "https://giacong.test/san-pham?_rsc=abc", failure: "net::ERR_ABORTED" },
          { method: "POST", url: "https://giacong.test/cdn-cgi/rum?ray=abc", failure: "net::ERR_ABORTED" },
        ],
      },
    }],
  });

  assert.equal(evaluateUxAudit(audit).status, "passed");

  audit.routes[0].network.failedRequests.push({
    method: "GET",
    url: "https://giacong.test/images/product.webp",
    failure: "net::ERR_ABORTED",
  });
  assert.equal(evaluateUxAudit(audit).status, "failed", "an aborted first-party asset remains a failure");
});

test("small mobile viewports verify lazy loading without requiring decorative reveal motion", () => {
  const result = evaluateScrollMotionAudit({
    smallViewport: true,
    before: { animateCount: 16, animatedCount: 0, loadedImageCount: 13 },
    during: { sample: [{ opacity: "1" }] },
    bottom: { animateCount: 16, animatedCount: 0, loadedImageCount: 40, sample: [{ opacity: "1" }] },
  });

  assert.deepEqual(result, { lazyLoaded: true, mode: "small-viewport-motion-suppressed", pass: true, revealVerified: true });
});

test("reveal-enabled viewports require both an observed reveal and lazy loading", () => {
  const passing = evaluateScrollMotionAudit({
    smallViewport: false,
    before: { animateCount: 16, animatedCount: 0, loadedImageCount: 13 },
    during: { sample: [{ opacity: "1" }, { opacity: "0.6" }] },
    bottom: { animateCount: 16, animatedCount: 12, loadedImageCount: 40 },
  });
  const failing = evaluateScrollMotionAudit({
    smallViewport: false,
    before: { animateCount: 16, animatedCount: 0, loadedImageCount: 13 },
    during: { sample: [{ opacity: "1" }] },
    bottom: { animateCount: 16, animatedCount: 0, loadedImageCount: 40 },
  });

  assert.equal(passing.pass, true);
  assert.equal(passing.revealVerified, true);
  assert.equal(failing.pass, false);
  assert.equal(failing.lazyLoaded, true);
});

test("the UX audit CLI uses the verdict as its process exit code", async () => {
  const source = await readFile(new URL("./ux-audit-pilot.mjs", import.meta.url), "utf8");

  assert.match(source, /import \{[^}]*evaluateUxAudit[^}]*\} from "\.\/ux-audit-gates\.mjs"/);
  assert.match(source, /process\.exitCode = verdict\.exitCode/);
  assert.doesNotMatch(source, /process\.exit\(0\)/);
});

test("the mobile menu audit waits for client hydration before clicking its trigger", async () => {
  const source = await readFile(new URL("./ux-audit-pilot.mjs", import.meta.url), "utf8");

  assert.match(source, /#main-menu button\.clone-toggle/);
  assert.match(source, /waitFor\(\{ state: "attached", timeout: [\d_]+ \}\)/);
  assert.match(source, /menuEnhanced/);
});

test("the UX audit snapshots web vitals before screenshots, scrolls, and other user actions", async () => {
  const source = await readFile(new URL("./ux-audit-pilot.mjs", import.meta.url), "utf8");

  assert.match(source, /result\.vitalsAtLoad = await readWebVitals\(page\)/);
  assert.match(source, /if \(result\.vitalsAtLoad\) inspection\.vitals = result\.vitalsAtLoad/);
});

test("browser console evidence records source location for tracing third-party warnings", async () => {
  const source = await readFile(new URL("./ux-audit-pilot.mjs", import.meta.url), "utf8");

  assert.match(source, /const location = message\.location\(\)/);
  assert.match(source, /source: location\.url/);
  assert.match(source, /line: location\.lineNumber/);
});
