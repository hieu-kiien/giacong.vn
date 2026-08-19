import assert from "node:assert/strict";
import { chromium } from "playwright";

const origin = requiredEnv("STAGING_ORIGIN").replace(/\/$/, "");
const accessHeaders = {
  "CF-Access-Client-Id": requiredEnv("CLOUDFLARE_ACCESS_CLIENT_ID"),
  "CF-Access-Client-Secret": requiredEnv("CLOUDFLARE_ACCESS_CLIENT_SECRET"),
};

const routes = [
  "/",
  "/san-pham",
  "/san-pham/bot-gao-lut-xay-min",
  "/gui-yeu-cau",
  "/thue-gia-cong/say-thuc-pham-say",
  "/tin-tuc",
];

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    extraHTTPHeaders: accessHeaders,
    viewport: { width: 1440, height: 900 },
  });
  try {
    for (const route of routes) {
      const page = await context.newPage();
      try {
        await gotoForAudit(page, route);

        const audit = await page.evaluate(() => {
          const text = (element) => (element.textContent ?? "").replace(/\s+/g, " ").trim();
          const isHidden = (element) => {
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display === "none"
              || style.visibility === "hidden"
              || Number(style.opacity) === 0
              || rect.width === 0
              || rect.height === 0;
          };
          const hasName = (element) => {
            const ariaLabel = element.getAttribute("aria-label")?.trim();
            if (ariaLabel) return true;
            const labelledBy = element.getAttribute("aria-labelledby")?.trim();
            if (labelledBy) {
              const labelText = labelledBy
                .split(/\s+/)
                .map((id) => document.getElementById(id))
                .filter(Boolean)
                .map((node) => text(node))
                .join(" ")
                .trim();
              if (labelText) return true;
            }
            const title = element.getAttribute("title")?.trim();
            if (title) return true;
            if (text(element)) return true;
            const imageAlt = [...element.querySelectorAll("img[alt]")]
              .map((image) => image.getAttribute("alt")?.trim() ?? "")
              .join(" ")
              .trim();
            return Boolean(imageAlt);
          };

          const ids = [...document.querySelectorAll("[id]")]
            .map((element) => element.id)
            .filter(Boolean);
          const idCounts = ids.reduce((counts, id) => {
            counts.set(id, (counts.get(id) ?? 0) + 1);
            return counts;
          }, new Map());
          const duplicateIds = [...idCounts.entries()]
            .filter(([, count]) => count > 1)
            .map(([id, count]) => `${id} (${count})`);

          const controls = [...document.querySelectorAll("input, select, textarea")]
            .filter((element) => {
              if (element instanceof HTMLInputElement) {
                return !["hidden", "button", "submit", "reset", "image"].includes(element.type);
              }
              return true;
            })
            .filter((element) => !element.disabled && !isHidden(element));

          const unlabeledControls = controls
            .filter((element) => {
              if ("labels" in element && element.labels?.length) return false;
              if (element.getAttribute("aria-label")?.trim()) return false;
              if (element.getAttribute("aria-labelledby")?.trim()) return false;
              return false === Boolean(element.getAttribute("title")?.trim());
            })
            .map((element) => `${element.tagName.toLowerCase()}#${element.id || "(no-id)"}[name=${element.getAttribute("name") || ""}]`);

          const namelessButtons = [...document.querySelectorAll("button, input[type='button'], input[type='submit'], input[type='reset']")]
            .filter((element) => !isHidden(element))
            .filter((element) => {
              if (element instanceof HTMLInputElement && element.value.trim()) return false;
              return !hasName(element);
            })
            .map((element) => `${element.tagName.toLowerCase()}#${element.id || "(no-id)"}`);

          const namelessLinks = [...document.querySelectorAll("a[href]")]
            .filter((element) => !isHidden(element))
            .filter((element) => !hasName(element))
            .map((element) => element.getAttribute("href") ?? "(no-href)");

          const imagesMissingAlt = [...document.querySelectorAll("img:not([alt])")]
            .filter((element) => !isHidden(element))
            .map((element) => element.getAttribute("src") ?? "(no-src)");

          return {
            duplicateIds,
            h1Count: document.querySelectorAll("h1").length,
            htmlLang: document.documentElement.lang.trim(),
            imagesMissingAlt,
            mainCount: document.querySelectorAll("main, [role='main']").length,
            namelessButtons,
            namelessLinks,
            title: document.title.trim(),
            unlabeledControls,
          };
        });

        assert.equal(audit.htmlLang, "vi", `${route}: root language must be Vietnamese`);
        assert.ok(audit.title.length > 0, `${route}: document title must not be empty`);
        assert.equal(audit.mainCount, 1, `${route}: expected exactly one main landmark`);
        assert.ok(audit.h1Count >= 1, `${route}: page must expose an h1`);
        assert.deepEqual(audit.duplicateIds, [], `${route}: duplicate DOM ids`);
        assert.deepEqual(audit.imagesMissingAlt, [], `${route}: visible images without alt attributes`);
        assert.deepEqual(audit.unlabeledControls, [], `${route}: visible form controls without labels`);
        assert.deepEqual(audit.namelessButtons, [], `${route}: visible buttons without accessible names`);
        assert.deepEqual(audit.namelessLinks, [], `${route}: visible links without accessible names`);

        const focus = await verifyKeyboardFocus(page);
        assert.ok(focus.focused, `${route}: Tab did not reach a visible interactive control`);
        assert.ok(focus.focusVisible, `${route}: keyboard focus did not match :focus-visible`);
        assert.ok(focus.hasIndicator, `${route}: keyboard focus has no visible outline/box-shadow indicator`);

        console.log(`${route}: accessibility semantics and keyboard focus passed.`);
      } finally {
        await page.close();
      }
    }
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}

console.log("Staging accessibility acceptance passed.");

async function gotoForAudit(page, route) {
  const maxAttempts = 3;
  const target = `${origin}${route}`;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await page.goto(target, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      const status = response?.status() ?? 0;
      if (response && status < 400) {
        await page.locator("body").waitFor({ state: "visible", timeout: 10000 });
        return response;
      }
      const transient = [502, 503, 504].includes(status);
      if (!transient || attempt === maxAttempts) {
        assert.ok(response && status < 400, `${route}: HTTP ${response?.status() ?? "no response"}`);
      }
      console.log(`${route}: transient HTTP ${status} on accessibility navigation attempt ${attempt}/${maxAttempts}; retrying.`);
    } catch (error) {
      const timeout = error instanceof Error && error.name === "TimeoutError";
      if (!timeout || attempt === maxAttempts) throw error;
      console.log(`${route}: navigation timeout on accessibility attempt ${attempt}/${maxAttempts}; retrying.`);
    }
    await page.waitForTimeout(2000);
  }
  throw new Error(`${route}: accessibility navigation exhausted without a usable response.`);
}

async function verifyKeyboardFocus(page) {
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press("Tab");
    const state = await page.evaluate(() => {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement) || active === document.body) {
        return { focused: false, focusVisible: false, hasIndicator: false };
      }
      const rect = active.getBoundingClientRect();
      const style = getComputedStyle(active);
      const focused = rect.width > 0
        && rect.height > 0
        && style.display !== "none"
        && style.visibility !== "hidden";
      const outlineVisible = style.outlineStyle !== "none"
        && style.outlineWidth !== "0px"
        && style.outlineColor !== "transparent";
      const shadowVisible = style.boxShadow !== "none";
      return {
        focused,
        focusVisible: active.matches(":focus-visible"),
        hasIndicator: outlineVisible || shadowVisible,
      };
    });
    if (state.focused) return state;
  }
  return { focused: false, focusVisible: false, hasIndicator: false };
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for staging accessibility QA.`);
  return value;
}
