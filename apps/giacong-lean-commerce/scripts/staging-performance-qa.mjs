import assert from "node:assert/strict";
import { chromium } from "playwright";

const origin = requiredEnv("STAGING_ORIGIN").replace(/\/$/, "");
const accessHeaders = {
  "CF-Access-Client-Id": requiredEnv("CLOUDFLARE_ACCESS_CLIENT_ID"),
  "CF-Access-Client-Secret": requiredEnv("CLOUDFLARE_ACCESS_CLIENT_SECRET"),
};

// These are deliberately anti-regression / "poor boundary" budgets, not a claim
// that field Core Web Vitals are good. Field p75 RUM/CrUX remains a separate launch gate.
const budgets = {
  lcpMs: 4000,
  cls: 0.25,
  ttfbMs: 2500,
  domContentLoadedMs: 8000,
};

const routes = [
  "/",
  "/san-pham",
  "/san-pham/bot-gao-lut-xay-min",
  "/tin-tuc",
];

const browser = await chromium.launch({ headless: true });
try {
  for (const route of routes) {
    const context = await browser.newContext({
      extraHTTPHeaders: accessHeaders,
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
    });

    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    try {
      await installPerformanceObservers(page);
      await applyMobileLikeLabConditions(cdp);

      const response = await page.goto(`${origin}${route}`, {
        waitUntil: "load",
        timeout: 30000,
      });
      assert.ok(response && response.status() < 400, `${route}: HTTP ${response?.status() ?? "no response"}`);

      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => undefined);
      await page.waitForTimeout(2500);

      const metrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType("navigation")[0];
        const qa = globalThis.__GIACONG_PERF_QA__ ?? { lcp: 0, cls: 0 };
        return {
          cls: Number(qa.cls ?? 0),
          lcpMs: Number(qa.lcp ?? 0),
          ttfbMs: navigation ? navigation.responseStart - navigation.startTime : NaN,
          domContentLoadedMs: navigation ? navigation.domContentLoadedEventEnd - navigation.startTime : NaN,
        };
      });

      assert.ok(Number.isFinite(metrics.lcpMs) && metrics.lcpMs > 0, `${route}: LCP metric was not observed`);
      assert.ok(Number.isFinite(metrics.cls) && metrics.cls >= 0, `${route}: CLS metric was not observed`);
      assert.ok(Number.isFinite(metrics.ttfbMs) && metrics.ttfbMs >= 0, `${route}: TTFB metric was not observed`);
      assert.ok(
        Number.isFinite(metrics.domContentLoadedMs) && metrics.domContentLoadedMs > 0,
        `${route}: DOMContentLoaded metric was not observed`,
      );

      assert.ok(
        metrics.lcpMs <= budgets.lcpMs,
        `${route}: lab LCP ${round(metrics.lcpMs)}ms exceeds ${budgets.lcpMs}ms poor-boundary budget`,
      );
      assert.ok(
        metrics.cls <= budgets.cls,
        `${route}: lab CLS ${metrics.cls.toFixed(3)} exceeds ${budgets.cls} poor-boundary budget`,
      );
      assert.ok(
        metrics.ttfbMs <= budgets.ttfbMs,
        `${route}: lab TTFB ${round(metrics.ttfbMs)}ms exceeds ${budgets.ttfbMs}ms guardrail`,
      );
      assert.ok(
        metrics.domContentLoadedMs <= budgets.domContentLoadedMs,
        `${route}: lab DOMContentLoaded ${round(metrics.domContentLoadedMs)}ms exceeds ${budgets.domContentLoadedMs}ms guardrail`,
      );

      console.log(
        `${route}: LCP=${round(metrics.lcpMs)}ms CLS=${metrics.cls.toFixed(3)} TTFB=${round(metrics.ttfbMs)}ms DCL=${round(metrics.domContentLoadedMs)}ms`,
      );
    } finally {
      await cdp.detach().catch(() => undefined);
      await page.close();
      await context.close();
    }
  }
} finally {
  await browser.close();
}

console.log("Staging performance lab anti-regression budgets passed.");

async function installPerformanceObservers(page) {
  await page.addInitScript(() => {
    globalThis.__GIACONG_PERF_QA__ = { lcp: 0, cls: 0 };

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          globalThis.__GIACONG_PERF_QA__.lcp = Math.max(
            globalThis.__GIACONG_PERF_QA__.lcp,
            entry.startTime,
          );
        }
      }).observe({ type: "largest-contentful-paint", buffered: true });
    } catch {
      // The assertion after navigation fails closed when the browser does not expose LCP.
    }

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            globalThis.__GIACONG_PERF_QA__.cls += entry.value;
          }
        }
      }).observe({ type: "layout-shift", buffered: true });
    } catch {
      // CLS defaults to zero; navigation/browser support is additionally covered by the CI image.
    }
  });
}

async function applyMobileLikeLabConditions(cdp) {
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: 200 * 1024,
    uploadThroughput: 94 * 1024,
    connectionType: "cellular4g",
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for staging performance QA.`);
  return value;
}

function round(value) {
  return Math.round(value);
}
