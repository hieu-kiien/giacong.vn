import type { ReactNode } from "react";

import { CapturedFloatingContact } from "@/components/CapturedPage";
import { GiacongInteractions } from "@/components/GiacongInteractions";
import {
  getStorefrontNavigation,
  type StorefrontNavigationKey,
} from "@/components/site/storefront-navigation";
import newsPage from "@/data/pages/tin-tuc.json";
import { layerCapturedStyles, normalizeCapturedMarkup } from "@/lib/captured-markup";
import { applySiteSettingsToMarkup, siteBrandStyles } from "@/lib/site-markup";
import { applyNavigationToMarkup, getPublishedSiteNavigation } from "@/lib/site-navigation";
import { getPublishedSiteSettings } from "@/lib/site-settings";

interface CapturedStorefrontShellProps {
  activeNavigation?: StorefrontNavigationKey;
  children: ReactNode;
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

const normalizedNewsMarkup = normalizeCapturedMarkup(newsPage.markup);
const capturedHeader = extractElement(normalizedNewsMarkup, "header");
const capturedFooter = extractElement(normalizedNewsMarkup, "footer", capturedHeader.end);
const wrapperClose = normalizedNewsMarkup.indexOf("</div>", capturedFooter.end);
const capturedAuxiliaryMarkup = wrapperClose < 0
  ? ""
  : normalizedNewsMarkup.slice(wrapperClose + "</div>".length);

/** Shared source of the approved captured Header, Footer and interactions. */
export async function CapturedStorefrontShell({
  activeNavigation,
  children,
}: CapturedStorefrontShellProps) {
  const [settings, navigation] = await Promise.all([getPublishedSiteSettings(), getPublishedSiteNavigation()]);
  const activeCapturedMenuId = activeNavigation ? getStorefrontNavigation(activeNavigation)?.menuItemId : undefined;
  const headerMarkup = applySiteSettingsToMarkup(
    applyNavigationToMarkup(
      activateDesktopNavigation(capturedHeader.markup, activeNavigation),
      navigation,
      activeCapturedMenuId,
    ),
    settings,
  );
  const footerMarkup = applySiteSettingsToMarkup(capturedFooter.markup, settings);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `${layerCapturedStyles(newsPage.pageStyles)}\n${siteBrandStyles(settings)}` }} />
      <div className={newsPage.bodyClasses}>
        <a className="skip-link screen-reader-text" href="#main">Skip to content</a>
        <div id="wrapper">
          <div dangerouslySetInnerHTML={{ __html: headerMarkup }} />
          {children}
          <div dangerouslySetInnerHTML={{ __html: footerMarkup }} />
        </div>
        <div dangerouslySetInnerHTML={{ __html: capturedAuxiliaryMarkup }} />
      </div>
      <CapturedFloatingContact settings={settings} />
      <GiacongInteractions bodyClasses={newsPage.bodyClasses} htmlClasses={newsPage.htmlClasses} />
    </>
  );
}
