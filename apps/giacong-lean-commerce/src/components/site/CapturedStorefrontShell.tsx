import type { ReactNode } from "react";

import { CapturedFloatingContact } from "@/components/CapturedPage";
import { GiacongInteractions } from "@/components/GiacongInteractions";
import {
  getStorefrontNavigation,
  type StorefrontNavigationKey,
} from "@/components/site/storefront-navigation";
import newsPage from "@/data/pages/tin-tuc.json";
import {
  appendAccountLinksToCapturedMarkup,
  layerCapturedStyles,
  normalizeCapturedMarkup,
} from "@/lib/captured-markup";
import { applySiteSettingsToMarkup, siteBrandStyles } from "@/lib/site-markup";
import {
  applyFooterNavigationToMarkup,
  applyNavigationToMarkup,
  getPublishedSiteNavigation,
} from "@/lib/site-navigation";
import { getPublishedSiteSettings } from "@/lib/site-settings";
import styles from "./account-shell.module.css";

interface CapturedStorefrontShellProps {
  activeNavigation?: StorefrontNavigationKey;
  children: ReactNode;
  variant?: "captured" | "account";
}

interface CapturedElement {
  end: number;
  markup: string;
}

function extractElement(markup: string, tag: "header" | "footer", startAt = 0): CapturedElement {
  const start = markup.indexOf(`<${tag}`, startAt);
  const closing = `</${tag}>`;
  const end = markup.indexOf(closing, start);
  if (start < 0 || end < 0) return { end: -1, markup: "" };

  const outerEnd = end + closing.length;
  return { end: outerEnd, markup: markup.slice(start, outerEnd) };
}

function activateDesktopNavigation(markup: string, activeNavigation?: StorefrontNavigationKey): string {
  if (!activeNavigation) return markup;
  const activeMenuId = getStorefrontNavigation(activeNavigation)?.menuItemId;
  if (!activeMenuId) return markup;

  const withoutActiveState = markup
    .replace(/\s(?:current-menu-item|current_page_item|current-menu-parent|active)\b/g, "")
    .replace(/\saria-current=(['"])page\1/g, "");

  return withoutActiveState.replace(
    new RegExp(`<li\\b[^>]*\\bid=(['"])${activeMenuId}\\1[^>]*>`, "i"),
    (item) => item.replace(/class=(['"])([^'"]*)\1/i, (_className, quote: string, classes: string) =>
      `class=${quote}${classes} active current-menu-item${quote}`),
  );
}

const shellSourceMarkup = newsPage.markup.replace(/<main\b[^>]*>[\s\S]*?<\/main>/i, '<main id="main"></main>');
const normalizedNewsMarkup = normalizeCapturedMarkup(shellSourceMarkup);
const capturedHeader = extractElement(normalizedNewsMarkup, "header");
const capturedFooter = extractElement(normalizedNewsMarkup, "footer", capturedHeader.end);
const wrapperClose = normalizedNewsMarkup.indexOf("</div>", capturedFooter.end);
const capturedAuxiliaryMarkupSource = wrapperClose < 0
  ? ""
  : normalizedNewsMarkup.slice(wrapperClose + "</div>".length);

interface PreparedShellMarkup {
  auxiliaryMarkup: string;
  footerMarkup: string;
  headerWithAccountLinks: string;
  styleMarkup: string;
}

const preparedShellCache = new Map<string, PreparedShellMarkup>();

function buildPreparedShellMarkup(
  activeNavigation: StorefrontNavigationKey | undefined,
  settings: Awaited<ReturnType<typeof getPublishedSiteSettings>>,
  navigation: Awaited<ReturnType<typeof getPublishedSiteNavigation>>,
): PreparedShellMarkup {
  const cacheKey = `${activeNavigation ?? ""}\0${JSON.stringify(settings)}\0${JSON.stringify(navigation)}`;
  const cached = preparedShellCache.get(cacheKey);
  if (cached) return cached;

  const activeCapturedMenuId = activeNavigation ? getStorefrontNavigation(activeNavigation)?.menuItemId : undefined;
  const headerMarkup = applySiteSettingsToMarkup(
    applyNavigationToMarkup(
      activateDesktopNavigation(capturedHeader.markup, activeNavigation),
      navigation,
      activeCapturedMenuId,
    ),
    settings,
  );
  const headerWithAccountLinks = appendAccountLinksToCapturedMarkup(headerMarkup);
  const footerMarkup = applySiteSettingsToMarkup(
    applyFooterNavigationToMarkup(capturedFooter.markup, navigation),
    settings,
  );
  const auxiliaryMarkup = applySiteSettingsToMarkup(
    applyNavigationToMarkup(capturedAuxiliaryMarkupSource, navigation, activeCapturedMenuId),
    settings,
  );
  const styleMarkup = `${layerCapturedStyles(newsPage.pageStyles)}\n${siteBrandStyles(settings)}`;
  const prepared: PreparedShellMarkup = {
    auxiliaryMarkup,
    footerMarkup,
    headerWithAccountLinks,
    styleMarkup,
  };
  if (preparedShellCache.size >= 16) {
    const oldest = preparedShellCache.keys().next().value;
    if (oldest !== undefined) preparedShellCache.delete(oldest);
  }
  preparedShellCache.set(cacheKey, prepared);
  return prepared;
}

/** Shared source of the approved captured Header, Footer and interactions. */
export async function CapturedStorefrontShell({
  activeNavigation,
  children,
  variant = "captured",
}: CapturedStorefrontShellProps) {
  const accountShell = variant === "account";
  const bodyClasses = accountShell
    ? newsPage.bodyClasses.split(/\s+/).filter((name) => name !== "archive" && !/^category(?:-|$)/.test(name)).join(" ")
    : newsPage.bodyClasses;
  const [settings, navigation] = await Promise.all([getPublishedSiteSettings(), getPublishedSiteNavigation()]);
  const { auxiliaryMarkup, footerMarkup, headerWithAccountLinks, styleMarkup } = buildPreparedShellMarkup(
    activeNavigation,
    settings,
    navigation,
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styleMarkup }} />
      <div className={`${bodyClasses}${accountShell ? ` ${styles.shell}` : ""}`}>
        <a className="skip-link screen-reader-text" href="#main">Chuyển đến nội dung chính</a>
        <div id="wrapper">
          <div dangerouslySetInnerHTML={{ __html: headerWithAccountLinks }} />
          {children}
          <div dangerouslySetInnerHTML={{ __html: footerMarkup }} />
        </div>
        <div dangerouslySetInnerHTML={{ __html: auxiliaryMarkup }} />
      </div>
      <CapturedFloatingContact settings={settings} />
      <GiacongInteractions bodyClasses={bodyClasses} htmlClasses={newsPage.htmlClasses} />
    </>
  );
}
