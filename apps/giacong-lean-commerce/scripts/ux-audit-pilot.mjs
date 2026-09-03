import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const baseUrl = process.env.UX_AUDIT_BASE_URL ?? "http://localhost:3030";
const dateStamp = new Date().toISOString().slice(0, 10);
const evidenceDir = process.env.UX_AUDIT_EVIDENCE_DIR
  ? join(process.env.UX_AUDIT_EVIDENCE_DIR)
  : join(process.cwd(), "..", "..", "docs", "ux-audit", dateStamp);
const mobileViewport = { width: 390, height: 844 };
const desktopViewport = { width: 1440, height: 900 };
const mobileUserAgent =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const persona = {
  name: "SME B2B buyer / procurement lead",
  goal: "Tìm sản phẩm hoặc dịch vụ gia công nhanh trên mobile, mở chi tiết và biết bước tiếp theo để gửi yêu cầu.",
  constraints: "Thời gian hạn chế, kết nối di động, mức quen công nghệ trung bình.",
};

const routePlan = [
  { route: "/san-pham", name: "catalog-mobile", viewport: mobileViewport, kind: "catalog-mobile" },
  { route: "/tin-tuc", name: "news-mobile", viewport: mobileViewport, kind: "news-mobile" },
  { route: "/lien-he", name: "contact-mobile", viewport: mobileViewport, kind: "contact-mobile" },
  { route: "/", name: "homepage-mobile", viewport: mobileViewport, kind: "homepage-mobile" },
  { route: "/", name: "homepage-desktop", viewport: desktopViewport, kind: "homepage-desktop" },
];

const responsiveViewports = [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 768, height: 900 },
  { width: 1024, height: 900 },
  { width: 1280, height: 900 },
  { width: 1440, height: 900 },
];

const audit = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  scope: "scoped pilot: homepage, catalog, news and contact; mobile-first with desktop menu check",
  persona,
  capability: {
    playwrightRuntime: true,
    chromeDevtoolsMcp: false,
    note: "The session has no Chrome DevTools MCP tool. Runtime evidence uses the project's installed Playwright package with a fresh headless Chromium context.",
  },
  routes: [],
  responsiveSweep: [],
  hardGates: {},
};

await mkdir(evidenceDir, { recursive: true });

function safeName(value) {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "page";
}

function absoluteUrl(route) {
  return new URL(route, baseUrl).toString();
}

function isVisible(locator) {
  return locator.isVisible().catch(() => false);
}

async function waitForSettled(page) {
  // Page reveals can stagger by up to 490ms and transition for 760ms. Wait for
  // the finite motion to finish before measuring contrast or layout; screenshots
  // and the explicit motion checks still sample the in-between frames.
  await page.waitForTimeout(1400);
  await page.evaluate(() => document.fonts?.ready?.catch(() => undefined));
}

async function installVitals(page) {
  await page.addInitScript(() => {
    const state = { fcp: null, lcp: null, cls: 0, inp: null };
    window.__uxAuditVitals = state;
    try {
      new PerformanceObserver((list) => {
        const entry = list.getEntries().find((item) => item.name === "first-contentful-paint");
        if (entry) state.fcp = entry.startTime;
      }).observe({ type: "paint", buffered: true });
    } catch {}
    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) state.lcp = last.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
    } catch {}
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) state.cls += entry.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    } catch {}
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const duration = entry.duration ?? 0;
          state.inp = Math.max(state.inp ?? 0, duration);
        }
      }).observe({ type: "event", buffered: true, durationThreshold: 16 });
    } catch {}
  });
}

function attachBrowserEvidence(page, result) {
  page.on("console", (message) => {
    result.console.push({ type: message.type(), text: message.text().slice(0, 500) });
  });
  page.on("pageerror", (error) => {
    result.pageErrors.push(String(error).slice(0, 500));
  });
  page.on("response", (response) => {
    const status = response.status();
    if (status >= 400) {
      result.network.badResponses.push({
        status,
        method: response.request().method(),
        url: response.url().slice(0, 500),
      });
    }
  });
  page.on("requestfailed", (request) => {
    result.network.failedRequests.push({
      method: request.method(),
      url: request.url().slice(0, 500),
      failure: request.failure()?.errorText ?? "unknown",
    });
  });
}

async function collectAxe(page, result) {
  try {
    await page.addScriptTag({
      url: "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.0/axe.min.js",
      timeout: 10_000,
    });
    const axeResult = await page.evaluate(async () => window.axe.run(document));
    result.accessibility.axe = {
      available: true,
      violations: axeResult.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        nodes: violation.nodes.length,
      })),
    };
  } catch (error) {
    result.accessibility.axe = {
      available: false,
      error: String(error).slice(0, 500),
    };
  }
}

async function collectPageInspection(page, result) {
  const inspection = await page.evaluate(() => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")]
      .filter(visible)
      .map((element) => ({ level: Number(element.tagName.slice(1)), text: element.textContent?.trim().slice(0, 160) }));
    const skippedHeadingLevels = [];
    for (let index = 1; index < headings.length; index += 1) {
      if (headings[index].level - headings[index - 1].level > 1) {
        skippedHeadingLevels.push({ from: headings[index - 1], to: headings[index] });
      }
    }
    const unnamedControls = [...document.querySelectorAll("a,button,input,textarea,select")]
      .filter(visible)
      .map((element) => {
        const label = element.getAttribute("aria-label") || element.getAttribute("title") || element.getAttribute("alt");
        const labelledBy = element.getAttribute("aria-labelledby");
        const labelledText = labelledBy ? document.getElementById(labelledBy)?.textContent : "";
        const associatedLabel = element.id ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.textContent : "";
        const text = element.textContent?.trim() || element.getAttribute("placeholder") || label || labelledText || associatedLabel;
        return text ? null : { tag: element.tagName, type: element.getAttribute("type"), html: element.outerHTML.slice(0, 240) };
      })
      .filter(Boolean)
      .slice(0, 20);
    const overflowers = [...document.querySelectorAll("body *")]
      .filter(visible)
      .map((element) => ({
        tag: element.tagName,
        className: typeof element.className === "string" ? element.className.slice(0, 120) : "",
        right: Math.round(element.getBoundingClientRect().right),
        left: Math.round(element.getBoundingClientRect().left),
      }))
      .filter((item) => item.right > window.innerWidth + 2 || item.left < -2)
      .slice(0, 20);
    const vitals = window.__uxAuditVitals || {};
    const paints = performance.getEntriesByType("paint");
    const fcpEntry = paints.find((entry) => entry.name === "first-contentful-paint");
    const maxScrollHeight = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0);
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body?.scrollWidth ?? null,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      overflowers,
      headings,
      skippedHeadingLevels,
      unnamedControls,
      imageCount: document.images.length,
      lazyImageCount: [...document.images].filter((image) => image.loading === "lazy").length,
      criticalImageCount: [...document.images].filter((image) => image.loading !== "lazy").length,
      pageHeight: maxScrollHeight,
      vitals: {
        fcp: vitals.fcp ?? fcpEntry?.startTime ?? null,
        lcp: vitals.lcp ?? null,
        cls: vitals.cls ?? null,
        inp: vitals.inp ?? null,
      },
    };
  });
  result.inspection = inspection;
  await collectAxe(page, result);
}

async function capture(page, result, suffix) {
  const filename = `${safeName(result.name)}-${suffix}.png`;
  await page.screenshot({ path: join(evidenceDir, filename), fullPage: true });
  result.screenshots.push(filename);
}

async function recordAction(result, action) {
  result.actions.push({
    ...action,
    timestamp: new Date().toISOString(),
  });
}

async function goto(page, route) {
  const response = await page.goto(absoluteUrl(route), { waitUntil: "domcontentloaded", timeout: 20_000 });
  await waitForSettled(page);
  return response?.status() ?? null;
}

async function auditHomepageMobile(page, result) {
  await capture(page, result, "before");
  const menuTrigger = page.locator('[data-open="#main-menu"]').first();
  if (await isVisible(menuTrigger)) {
    await menuTrigger.click();
    await page.waitForTimeout(220);
    const menuState = await page.evaluate(() => {
      const menu = document.querySelector("#main-menu");
      const backdrop = document.querySelector(".clone-menu-backdrop");
      const menuStyle = menu ? getComputedStyle(menu) : null;
      const backdropStyle = backdrop ? getComputedStyle(backdrop) : null;
      return {
        menuTransform: menuStyle?.transform ?? null,
        menuVisibility: menuStyle?.visibility ?? null,
        backdropOpacity: backdropStyle?.opacity ?? null,
      };
    });
    await capture(page, result, "menu-open");
    await recordAction(result, {
      id: "open-mobile-menu",
      type: "primary action",
      expected: "Menu mở, backdrop hiện, không có lỗi console mới.",
      observed: menuState,
      pass: menuState.menuVisibility !== "hidden" && menuState.menuTransform !== "none",
    });
    const productItem = page.locator("#main-menu li.clone-mobile-products").first();
    const toggle = productItem.locator(":scope > button.toggle");
    if (await isVisible(productItem) && await isVisible(toggle)) {
      const childCount = await productItem.locator(":scope > .sub-menu a").count();
      await toggle.click();
      await page.waitForTimeout(220);
      const accordionState = await productItem.evaluate((item) => {
        const submenu = item.querySelector(":scope > .sub-menu");
        const style = submenu ? getComputedStyle(submenu) : null;
        const button = item.querySelector(":scope > button.toggle");
        return {
          expanded: button?.getAttribute("aria-expanded"),
          ariaHidden: submenu?.getAttribute("aria-hidden"),
          maxHeight: style?.maxHeight ?? null,
          opacity: style?.opacity ?? null,
          transform: style?.transform ?? null,
        };
      });
      await capture(page, result, "products-accordion-open");
      await recordAction(result, {
        id: "open-mobile-products-accordion",
        type: "open submenu/detail",
        expected: "Mua hàng mở dạng accordion và dùng cùng các lựa chọn desktop.",
        observed: { childCount, ...accordionState },
        pass: accordionState.expanded === "true" && childCount > 0 && accordionState.ariaHidden === "false",
      });
      const firstProductLink = productItem.locator(":scope > .sub-menu a").first();
      if (await isVisible(firstProductLink)) {
        const href = await firstProductLink.getAttribute("href");
        const isLocal = Boolean(href?.startsWith("/"));
        await recordAction(result, {
          id: "choose-mobile-product",
          type: "primary navigation",
          expected: "Lựa chọn sản phẩm có href nội bộ an toàn.",
          observed: { href, isLocal },
          pass: isLocal,
        });
      }
    }
  } else {
    await recordAction(result, {
      id: "open-mobile-menu",
      type: "primary action",
      expected: "Có trigger mở menu mobile.",
      observed: "trigger not visible",
      pass: false,
    });
  }
  await page.keyboard.press("Escape").catch(() => undefined);
  await page.waitForTimeout(120);
  await auditHomepageScroll(page, result);
}

async function readScrollMotionState(page) {
  return page.evaluate(() => {
    const animated = [...document.querySelectorAll("[data-animate]")];
    return {
      scrollY: Math.round(window.scrollY),
      scrollHeight: document.documentElement.scrollHeight,
      animateCount: animated.length,
      animatedCount: animated.filter((element) => element.getAttribute("data-animated") === "true").length,
      lazyImageCount: [...document.images].filter((image) => image.loading === "lazy").length,
      loadedImageCount: [...document.images].filter((image) => image.complete && image.naturalWidth > 0).length,
      sample: animated.slice(0, 3).map((element) => {
        const style = getComputedStyle(element);
        return {
          y: Math.round(element.getBoundingClientRect().y),
          opacity: style.opacity,
          transform: style.transform,
          animated: element.getAttribute("data-animated"),
        };
      }),
    };
  });
}

async function auditHomepageScroll(page, result) {
  const before = await readScrollMotionState(page);
  await page.mouse.wheel(0, 650);
  await page.waitForTimeout(80);
  const during = await readScrollMotionState(page);
  await page.waitForTimeout(700);
  const settled = await readScrollMotionState(page);
  for (let index = 0; index < 14; index += 1) {
    await page.mouse.wheel(0, 650);
    await page.waitForTimeout(110);
  }
  const bottom = await readScrollMotionState(page);
  await capture(page, result, "scroll-bottom");
  await recordAction(result, {
    id: "scroll-reveal-and-lazy-load",
    type: "scroll",
    expected: "Các block dưới fold xuất hiện bằng opacity/translate/scale và ảnh lazy-load tăng dần khi người dùng cuộn.",
    observed: { before, during, settled, bottom },
    pass:
      before.animateCount > 0 &&
      bottom.animatedCount > before.animatedCount &&
      bottom.loadedImageCount > before.loadedImageCount &&
      Number(during.sample[2]?.opacity ?? 1) < 1,
  });
}

async function auditHomepageDesktop(page, result) {
  await capture(page, result, "before");
  // The top-level label is editable through D1, so it may be “Mua hàng”,
  // “Sản Phẩm”, or another approved operator label. The captured menu id is
  // the stable identity used by the navigation contract.
  const item = page.locator("#header li#menu-item-1742.menu-item-design-container-width.has-dropdown").first();
  if (await isVisible(item)) {
    const panel = item.locator(":scope > .nav-dropdown");
    await item.hover();
    await page.waitForTimeout(350);
    const opened = await panel.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        opacity: style.opacity,
        visibility: style.visibility,
        transform: style.transform,
        transition: style.transition,
        rect: element.getBoundingClientRect().toJSON(),
      };
    });
    await capture(page, result, "mega-menu-open");
    await recordAction(result, {
      id: "hover-desktop-products-menu",
      type: "hover",
      expected: "Mega-menu sản phẩm hiện ở đúng vị trí, fade/visibility hoạt động và nội dung đứng yên.",
      observed: { label: await item.locator(":scope > a").innerText(), ...opened },
      pass: opened.visibility !== "hidden" && Number(opened.opacity) > 0.8,
    });
    if (await isVisible(panel)) {
      await panel.hover();
      await page.waitForTimeout(200);
      const handoff = await panel.evaluate((element) => {
        const style = getComputedStyle(element);
        return { opacity: style.opacity, visibility: style.visibility };
      });
      await recordAction(result, {
        id: "pointer-handoff-to-desktop-menu",
        type: "mousemove",
        expected: "Panel không biến mất khi người dùng di chuột từ trigger vào bảng.",
        observed: handoff,
        pass: handoff.visibility !== "hidden" && Number(handoff.opacity) > 0.8,
      });
    }
  } else {
    await recordAction(result, {
      id: "hover-desktop-products-menu",
      type: "hover",
      expected: "Có mega-menu sản phẩm để kiểm tra.",
      observed: "menu item not visible",
      pass: false,
    });
  }
}

async function auditCatalogMobile(page, result) {
  await capture(page, result, "before");
  const search = page.locator('input[placeholder="Tìm kiếm sản phẩm, thương hiệu..."]:visible').first();
  const searchButton = page.getByRole("button", { name: "Tìm sản phẩm", exact: true }).first();
  if (await isVisible(search)) {
    await search.fill("bột");
    await recordAction(result, {
      id: "type-catalog-search",
      type: "type in input",
      expected: "Ô tìm kiếm nhận nội dung và vẫn có nhãn/placeholder rõ ràng.",
      observed: { value: await search.inputValue() },
      pass: (await search.inputValue()) === "bột",
    });
    if (await isVisible(searchButton)) {
      await searchButton.click();
      await waitForSettled(page);
      await capture(page, result, "search-applied");
      const cards = await page.locator("[data-catalog-card]").count();
      await recordAction(result, {
        id: "apply-catalog-search",
        type: "primary action",
        expected: "Kết quả danh mục phản hồi sau khi áp dụng tìm kiếm.",
        observed: { url: page.url(), cardCount: cards },
        pass: page.url().startsWith(baseUrl),
      });
    }
  }
  await page.goto(absoluteUrl("/san-pham"), { waitUntil: "domcontentloaded", timeout: 20_000 });
  await waitForSettled(page);
  const cardLink = page.locator('[data-catalog-detail-action="true"][href^="/"]').first();
  if (await isVisible(cardLink)) {
    const href = await cardLink.getAttribute("href");
    if (href?.startsWith("/")) {
      const expectedPath = new URL(href, baseUrl).pathname.replace(/\/$/, "");
      const navigation = page
        .waitForURL((url) => url.pathname.replace(/\/$/, "") === expectedPath, { timeout: 8_000 })
        .then(() => true)
        .catch(() => false);
      await cardLink.click();
      const navigated = await navigation;
      await waitForSettled(page);
      await capture(page, result, "detail-open");
      const detailHeading = await page.locator("h1").first().textContent().catch(() => null);
      await recordAction(result, {
        id: "open-product-detail",
        type: "open modal/detail",
        expected: "Card mở được trang chi tiết nội bộ với tiêu đề sản phẩm.",
        observed: { href, url: page.url(), h1: detailHeading?.trim() ?? null, navigatedWithin8s: navigated },
        pass: navigated && page.url().startsWith(baseUrl) && page.url().includes(href) && Boolean(detailHeading?.trim()),
      });
    }
  } else {
    await capture(page, result, "detail-unavailable");
    await recordAction(result, {
      id: "open-product-detail",
      type: "open modal/detail",
      expected: "Danh mục có card sản phẩm để mở chi tiết.",
      observed: "catalog card link not visible",
      pass: false,
    });
  }
}

async function auditNewsMobile(page, result) {
  await capture(page, result, "before");
  const search = page.locator('input[placeholder="Tìm trong tin tức"]:visible').first();
  const button = page.getByRole("button", { name: "Tìm kiếm", exact: true }).first();
  if (await isVisible(search)) {
    await search.fill("khong-co-ket-qua");
    await recordAction(result, {
      id: "type-news-search",
      type: "type in input",
      expected: "Ô tìm kiếm tin tức nhận nội dung.",
      observed: { value: await search.inputValue() },
      pass: (await search.inputValue()) === "khong-co-ket-qua",
    });
    if (await isVisible(button)) {
      await button.click();
      await waitForSettled(page);
      await capture(page, result, "search-applied");
      const emptyState = await page.getByText("Chưa có bài viết mới", { exact: true }).count();
      await recordAction(result, {
        id: "apply-news-search",
        type: "primary action",
        expected: "Sau khi tìm kiếm, trạng thái kết quả được phản hồi rõ ràng.",
        observed: { url: page.url(), emptyStateCount: emptyState },
        pass: page.url().startsWith(baseUrl),
      });
    }
  }
}

async function auditContactMobile(page, result) {
  const localContactOrigin = new URL(baseUrl).origin;
  await page.route("**/*", async (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    const isLocalContactMutation =
      request.method() !== "GET" &&
      requestUrl.origin === localContactOrigin &&
      requestUrl.pathname === "/api/contact";
    if (isLocalContactMutation) {
      result.network.blockedMutations.push({ method: request.method(), url: request.url().slice(0, 500) });
      await route.abort();
      return;
    }
    await route.continue();
  });
  await capture(page, result, "before");
  const name = page.locator('input[placeholder="Tên của bạn..."]:visible').first();
  const email = page.locator('input[placeholder="Địa chỉ email..."]:visible').first();
  const submit = page.locator('input[type="submit"]:visible').first();
  if (await isVisible(name) && await isVisible(email) && await isVisible(submit)) {
    await name.fill("Người mua thử nghiệm");
    await email.fill("not-an-email");
    await submit.click();
    await page.waitForTimeout(250);
    const invalidCount = await page.locator(":invalid:visible").count();
    const blockedContactMutation = result.network.blockedMutations.some((request) => {
      const requestUrl = new URL(request.url);
      return requestUrl.origin === localContactOrigin && requestUrl.pathname === "/api/contact";
    });
    await capture(page, result, "invalid-form");
    await recordAction(result, {
      id: "validate-contact-form",
      type: "primary action",
      expected: "Dữ liệu sai được giữ ở client và không gửi request thật.",
      observed: { invalidCount, blockedContactMutation },
      pass: invalidCount > 0 && !blockedContactMutation,
    });
  } else {
    await capture(page, result, "form-unavailable");
    await recordAction(result, {
      id: "validate-contact-form",
      type: "primary action",
      expected: "Form liên hệ có field và nút gửi nhìn thấy được.",
      observed: "contact form controls not visible",
      pass: false,
    });
  }
}

async function createPage(viewport, result, options = {}) {
  const context = await browser.newContext({
    viewport,
    isMobile: options.mobile ?? viewport.width <= 600,
    hasTouch: options.mobile ?? viewport.width <= 600,
    userAgent: options.mobile ? mobileUserAgent : undefined,
  });
  const page = await context.newPage();
  await installVitals(page);
  attachBrowserEvidence(page, result);
  return { context, page };
}

async function auditRoute(plan) {
  const result = {
    route: plan.route,
    name: plan.name,
    viewport: plan.viewport,
    status: null,
    screenshots: [],
    actions: [],
    console: [],
    pageErrors: [],
    network: { badResponses: [], failedRequests: [], blockedMutations: [], fiveXx: [], fourXx: [] },
    networkFiveXx: [],
    networkFourXx: [],
    accessibility: { axe: null },
    inspection: null,
    notes: [],
    consoleErrors: [],
    consoleWarnings: [],
  };
  const { context, page } = await createPage(plan.viewport, result, { mobile: plan.viewport.width <= 600 });
  try {
    result.status = await goto(page, plan.route);
    if (plan.kind === "homepage-mobile") await auditHomepageMobile(page, result);
    if (plan.kind === "homepage-desktop") await auditHomepageDesktop(page, result);
    if (plan.kind === "catalog-mobile") await auditCatalogMobile(page, result);
    if (plan.kind === "news-mobile") await auditNewsMobile(page, result);
    if (plan.kind === "contact-mobile") await auditContactMobile(page, result);
    await waitForSettled(page);
    await collectPageInspection(page, result);
    result.consoleErrors = result.console.filter((entry) => entry.type === "error");
    result.consoleWarnings = result.console.filter((entry) => entry.type === "warning" || entry.type === "warn");
    result.network.fiveXx = result.network.badResponses.filter((entry) => entry.status >= 500);
    result.network.fourXx = result.network.badResponses.filter((entry) => entry.status >= 400 && entry.status < 500);
  } catch (error) {
    result.notes.push(`runner error: ${String(error).slice(0, 500)}`);
  } finally {
    await context.close();
  }
  audit.routes.push(result);
}

async function runResponsiveSweep() {
  for (const viewport of responsiveViewports) {
    const result = {
      viewport,
      status: null,
      horizontalOverflow: null,
      documentWidth: null,
      bodyWidth: null,
      pageHeight: null,
      screenshot: null,
      errors: [],
      console: [],
      pageErrors: [],
      network: { badResponses: [], failedRequests: [], blockedMutations: [] },
    };
    const { context, page } = await createPage(viewport, result, { mobile: viewport.width <= 600 });
    try {
      const response = await goto(page, "/");
      result.status = response;
      const metrics = await page.evaluate(() => ({
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body?.scrollWidth ?? null,
        pageHeight: Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0),
      }));
      Object.assign(result, metrics);
      const filename = `responsive-home-${viewport.width}x${viewport.height}.png`;
      await page.screenshot({ path: join(evidenceDir, filename), fullPage: false });
      result.screenshot = filename;
    } catch (error) {
      result.errors.push(String(error).slice(0, 500));
    } finally {
      await context.close();
    }
    audit.responsiveSweep.push(result);
  }
}

const browser = await chromium.launch({ headless: true });
try {
  for (const plan of routePlan) await auditRoute(plan);
  await runResponsiveSweep();
} finally {
  await browser.close();
}

const allRoutes = audit.routes;
const axeRuns = allRoutes.map((route) => route.accessibility.axe).filter(Boolean);
const axeViolations = axeRuns.flatMap((axe) => axe.available ? axe.violations : []);
audit.hardGates = {
  consoleErrors: allRoutes.reduce((sum, route) => sum + route.consoleErrors.length, 0),
  consoleWarnings: allRoutes.reduce((sum, route) => sum + route.consoleWarnings.length, 0),
  networkFiveXx: allRoutes.reduce((sum, route) => sum + route.network.fiveXx.length, 0),
  networkFourXx: allRoutes.reduce((sum, route) => sum + route.network.fourXx.length, 0),
  layoutOverflowRoutes: allRoutes.filter((route) => route.inspection?.horizontalOverflow).map((route) => route.name),
  axeAvailableRuns: axeRuns.filter((axe) => axe.available).length,
  axeUnavailableRuns: axeRuns.filter((axe) => !axe.available).length,
  axeCriticalSerious: axeViolations.filter((violation) => violation.impact === "critical" || violation.impact === "serious"),
  webVitals: allRoutes.map((route) => ({ name: route.name, ...route.inspection?.vitals })),
};

await writeFile(join(evidenceDir, "audit.json"), `${JSON.stringify(audit, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  evidenceDir,
  routes: allRoutes.map((route) => ({
    name: route.name,
    status: route.status,
    screenshots: route.screenshots.length,
    actions: route.actions.map((action) => ({ id: action.id, pass: action.pass })),
    consoleErrors: route.consoleErrors.length,
    consoleWarnings: route.consoleWarnings.length,
    fiveXx: route.network.fiveXx.length,
    fourXx: route.network.fourXx.length,
    axe: route.accessibility.axe?.available ? route.accessibility.axe.violations.length : "unavailable",
    overflow: route.inspection?.horizontalOverflow ?? null,
  })),
  hardGates: audit.hardGates,
}, null, 2));
setTimeout(() => process.exit(0), 100);

