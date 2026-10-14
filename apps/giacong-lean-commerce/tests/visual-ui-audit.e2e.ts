import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, test } from "@e2e-dev/web";
import { expect } from "e2e";

const SCREENSHOT_DIR = resolve(process.cwd(), "../../.runtime/e2e-screenshots");
mkdirSync(SCREENSHOT_DIR, { recursive: true });

interface PageUiAuditResult {
  route: string;
  viewport: string;
  url: string;
  title: string;
  docClientWidth: number;
  docScrollWidth: number;
  horizontalOverflowPx: number;
  overflowingElements: Array<{ tag: string; className: string; right: number }>;
  totalImages: number;
  brokenImages: Array<{ src: string; alt: string }>;
  clippedHeadings: Array<{ tag: string; text: string; scrollWidth: number; clientWidth: number }>;
  taglineOverlapsHeroHeading: boolean;
  contactBandEyebrowColor: string | null;
  catalogOrderbyPaddingRightPx: number | null;
  fontsStatus: string;
}

const AUDIT_ROUTES = [
  { slug: "01-home", path: "/", label: "Trang chủ" },
  { slug: "02-catalog", path: "/san-pham/", label: "Danh mục sản phẩm" },
  { slug: "03-product-detail", path: "/san-pham/bot-gao-lut-xay-min", label: "Chi tiết sản phẩm" },
  { slug: "04-request-cart", path: "/gui-yeu-cau/", label: "Giỏ yêu cầu báo giá" },
  { slug: "05-services", path: "/thue-gia-cong/", label: "Danh mục dịch vụ OEM" },
  { slug: "06-service-detail", path: "/thue-gia-cong/gia-cong-tra/", label: "Chi tiết dịch vụ Gia công trà" },
  { slug: "07-news", path: "/tin-tuc/", label: "Tin tức" },
  { slug: "08-about", path: "/gioi-thieu-ve-gia-cong/", label: "Giới thiệu" },
  { slug: "09-contact", path: "/lien-he/", label: "Liên hệ" },
  { slug: "10-account", path: "/tai-khoan", label: "Tài khoản" },
];

const auditResults: PageUiAuditResult[] = [];

async function runDomVisualAudit(browser: { evaluate: <T>(fn: () => T | Promise<T>) => Promise<T> }, route: string, viewport: string): Promise<PageUiAuditResult> {
  return await browser.evaluate(async () => {
    await document.fonts.ready;
    window.scrollTo({ top: Math.min(800, document.body.scrollHeight), behavior: "instant" as ScrollBehavior });
    await new Promise((r) => setTimeout(r, 250));
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    await new Promise((r) => setTimeout(r, 250));

    const docEl = document.documentElement;
    const docClientWidth = docEl.clientWidth;
    const docScrollWidth = docEl.scrollWidth;
    const horizontalOverflowPx = Math.max(0, docScrollWidth - docClientWidth);

    const overflowingElements: Array<{ tag: string; className: string; right: number }> = [];
    if (horizontalOverflowPx > 1) {
      for (const el of Array.from(document.querySelectorAll("*"))) {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") continue;
        if (rect.right > docClientWidth + 2 && rect.width > 0) {
          overflowingElements.push({
            tag: el.tagName.toLowerCase(),
            className: typeof el.className === "string" ? el.className.slice(0, 80) : "",
            right: Math.round(rect.right),
          });
        }
      }
    }

    const visibleImages = Array.from(document.images).filter((img) => {
      const rect = img.getBoundingClientRect();
      const style = window.getComputedStyle(img);
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 4 &&
        rect.height > 4 &&
        rect.top < window.innerHeight * 2
      );
    });

    const brokenImages: Array<{ src: string; alt: string }> = [];
    for (const img of visibleImages) {
      if (!img.complete || img.naturalWidth === 0) {
        brokenImages.push({
          src: img.currentSrc || img.src,
          alt: img.alt || "(no alt)",
        });
      }
    }

    const clippedHeadings: Array<{ tag: string; text: string; scrollWidth: number; clientWidth: number }> = [];
    for (const h of Array.from(document.querySelectorAll("h1, h2, h3"))) {
      const style = window.getComputedStyle(h);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const el = h as HTMLElement;
      if (el.clientWidth <= 2 || el.clientHeight <= 2 || el.classList.contains("sr-only")) continue;
      if (
        el.clientWidth > 2 &&
        el.scrollWidth > el.clientWidth + 4 &&
        style.overflowX !== "visible" &&
        style.textOverflow !== "ellipsis"
      ) {
        clippedHeadings.push({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || "").trim().slice(0, 60),
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
        });
      }
    }

    // Check 1: Does .giacong-brand-tagline visually overlap h1 or stay visible >2px?
    let taglineOverlapsHeroHeading = false;
    const tagline = document.querySelector(".giacong-brand-tagline") as HTMLElement | null;
    const h1 = document.querySelector("h1") as HTMLElement | null;
    if (tagline && h1) {
      const tRect = tagline.getBoundingClientRect();
      const hRect = h1.getBoundingClientRect();
      if (tRect.width > 2 && tRect.height > 2) {
        const verticalOverlap = tRect.bottom > hRect.top && tRect.top < hRect.bottom;
        const horizontalOverlap = tRect.right > hRect.left && tRect.left < hRect.right;
        if (verticalOverlap && horizontalOverlap) {
          taglineOverlapsHeroHeading = true;
        }
      }
    }

    // Check 2: On /thue-gia-cong/[slug], check the ContactBand eyebrow color contrast
    let contactBandEyebrowColor: string | null = null;
    const contactTitle = document.getElementById("service-contact-title");
    if (contactTitle?.parentElement) {
      const eyebrow = contactTitle.parentElement.querySelector("p");
      if (eyebrow) {
        contactBandEyebrowColor = window.getComputedStyle(eyebrow).color;
      }
    }

    // Check 3: On /san-pham/, check #catalog-orderby right padding so text doesn't touch dropdown chevron
    let catalogOrderbyPaddingRightPx: number | null = null;
    const orderbySelect = document.getElementById("catalog-orderby");
    if (orderbySelect) {
      catalogOrderbyPaddingRightPx = parseFloat(window.getComputedStyle(orderbySelect).paddingRight || "0");
    }

    return {
      route: "",
      viewport: "",
      url: window.location.href,
      title: document.title,
      docClientWidth,
      docScrollWidth,
      horizontalOverflowPx,
      overflowingElements: overflowingElements.slice(0, 10),
      totalImages: visibleImages.length,
      brokenImages,
      clippedHeadings,
      taglineOverlapsHeroHeading,
      contactBandEyebrowColor,
      catalogOrderbyPaddingRightPx,
      fontsStatus: document.fonts.status,
    };
  }).then((res) => ({
    ...res,
    route,
    viewport,
  }));
}

describe("Kiểm toán Giao diện & Bố cục (Desktop 1440x900 + Mobile 390x844) trên kienhieu.id.vn", { serial: true, tags: ["ui-audit"] }, () => {
  test("1. Kiểm tra toàn diện bố cục Desktop (1440x900): không tràn ngang, không vỡ ảnh, tương phản chuẩn trên 10 trang", async ({ app, browser }) => {
    await browser.setViewport({ width: 1440, height: 900 });

    for (const item of AUDIT_ROUTES) {
      await app.open(item.path);
      if (item.path === "/gui-yeu-cau/") {
        await browser.evaluate(async () => {
          window.localStorage.removeItem("giacong.request-cart.v1");
          window.dispatchEvent(new Event("giacong:request-cart-updated"));
          await new Promise((r) => setTimeout(r, 200));
          return null;
        });
      }
      const result = await runDomVisualAudit(browser, item.path, "desktop-1440x900");
      auditResults.push(result);

      await app.screenshot(`desktop-${item.slug}`);

      expect(result.horizontalOverflowPx, `Trang ${item.path} (Desktop) bị tràn ngang`).toBeLessThanOrEqual(1);
      expect(result.brokenImages, `Trang ${item.path} (Desktop) có ảnh lỗi`).toEqual([]);
      expect(result.clippedHeadings, `Trang ${item.path} (Desktop) có tiêu đề bị cắt`).toEqual([]);
      expect(result.taglineOverlapsHeroHeading, `Trang ${item.path} (Desktop) tagline đè tiêu đề`).toBe(false);

      if (result.contactBandEyebrowColor !== null) {
        expect(result.contactBandEyebrowColor).not.toBe("rgba(255, 255, 255, 0.75)");
        expect(result.contactBandEyebrowColor).not.toBe("rgb(255, 255, 255)");
      }
      if (result.catalogOrderbyPaddingRightPx !== null) {
        expect(result.catalogOrderbyPaddingRightPx).toBeGreaterThanOrEqual(28);
      }
    }
  });

  test("2. Kiểm tra toàn diện bố cục Mobile (390x844): responsive chuẩn xác, không đè chữ, không tràn ngang, không vỡ ảnh trên 10 trang", async ({ app, browser }) => {
    await browser.setViewport({ width: 390, height: 844 });

    for (const item of AUDIT_ROUTES) {
      await app.open(item.path);
      const result = await runDomVisualAudit(browser, item.path, "mobile-390x844");
      auditResults.push(result);

      await app.screenshot(`mobile-${item.slug}`);

      expect(result.horizontalOverflowPx, `Trang ${item.path} (Mobile) bị tràn ngang`).toBeLessThanOrEqual(1);
      expect(result.brokenImages, `Trang ${item.path} (Mobile) có ảnh lỗi`).toEqual([]);
      expect(result.clippedHeadings, `Trang ${item.path} (Mobile) có tiêu đề bị cắt`).toEqual([]);
      expect(result.taglineOverlapsHeroHeading, `Trang ${item.path} (Mobile) tagline đè tiêu đề`).toBe(false);

      if (result.contactBandEyebrowColor !== null) {
        expect(result.contactBandEyebrowColor).not.toBe("rgba(255, 255, 255, 0.75)");
        expect(result.contactBandEyebrowColor).not.toBe("rgb(255, 255, 255)");
      }
      if (result.catalogOrderbyPaddingRightPx !== null) {
        expect(result.catalogOrderbyPaddingRightPx).toBeGreaterThanOrEqual(28);
      }
    }

    await browser.setViewport({ width: 1440, height: 900 });
    await app.open("/");
    writeFileSync(resolve(SCREENSHOT_DIR, "ui-audit-report.json"), JSON.stringify(auditResults, null, 2), "utf8");
  });
});
