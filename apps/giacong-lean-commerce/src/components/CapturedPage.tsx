/* eslint-disable @next/next/no-css-tags -- Fixed TOC is a route-specific public capture asset. */
import { AdminContactContextualAction } from "@/components/admin/AdminContactContextualAction";
import { GiacongInteractions } from "@/components/GiacongInteractions";
import { CapturedRequestCartButton } from "@/components/request-cart/CapturedRequestCartButton";
import { addCapturedServiceContext, layerCapturedStyles, needsCapturedShopStyles, normalizeCapturedMarkup, type CapturedServiceContext } from "@/lib/captured-markup";
import { applySiteSettingsToMarkup, siteBrandStyles } from "@/lib/site-markup";
import {
  applyFooterNavigationToMarkup,
  applyNavigationToMarkup,
  type PublishedNavigationItem,
} from "@/lib/site-navigation";
import { siteSettingDefaults, type PublishedSiteSettings } from "@/lib/site-settings";
import type { CapturedPageData } from "@/types/captured-page";

type CapturedPageProps = Pick<
  CapturedPageData,
  "markup" | "pageStyles" | "bodyClasses" | "htmlClasses"
> & {
  activeCapturedMenuId?: string | null;
  navigation?: readonly PublishedNavigationItem[];
  serviceContext?: CapturedServiceContext;
  contactPageAction?: boolean;
};

export function CapturedPage({
  markup,
  pageStyles,
  bodyClasses,
  htmlClasses,
  siteSettings,
  activeCapturedMenuId,
  navigation = [],
  serviceContext,
  contactPageAction = false,
}: CapturedPageProps & { siteSettings?: PublishedSiteSettings }) {
  const settings = siteSettings ?? siteSettingDefaults;
  const capturedMarkup = normalizeCapturedMarkup(markup, activeCapturedMenuId);
  const contextualMarkup = serviceContext
    ? addCapturedServiceContext(capturedMarkup, serviceContext)
    : capturedMarkup;
  const normalizedMarkup = applySiteSettingsToMarkup(
    applyFooterNavigationToMarkup(
      applyNavigationToMarkup(
        contextualMarkup,
        navigation,
        activeCapturedMenuId ?? undefined,
      ),
      navigation,
    ),
    settings,
  );
  const needsFixedTocStyles = /\bftwp-(?:container|trigger|list)\b/i.test(markup);
  const needsShopStyles = needsCapturedShopStyles(markup);

  return (
    <>
      <link rel="preload" href="/styles/fonts/SFProDisplay-Regular.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      <link rel="preload" href="/styles/fonts/SFProDisplay-Bold.woff2" as="font" type="font/woff2" crossOrigin="anonymous" media="(min-width: 850px)" />
      {needsFixedTocStyles ? <link rel="stylesheet" href="/styles/fixed-toc.css" /> : null}
      {needsShopStyles ? <link rel="stylesheet" href="/styles/captured-shop.css" /> : null}
      <style dangerouslySetInnerHTML={{ __html: `${layerCapturedStyles(pageStyles)}\n${siteBrandStyles(settings)}` }} />
      <div
        className={bodyClasses}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: normalizedMarkup }}
      />
      <CapturedFloatingContact settings={settings} />
      {contactPageAction ? <AdminContactContextualAction /> : null}
      <GiacongInteractions bodyClasses={bodyClasses} htmlClasses={htmlClasses} />
    </>
  );
}

export function CapturedFloatingContact({ settings = siteSettingDefaults }: { settings?: PublishedSiteSettings }) {
  const phone = settings.contact_phone.replace(/[^\d+]/g, "");
  return (
    <div className="echbay-sms-messenger style-for-position-br max-[549px]:!hidden" aria-label="Liên hệ nhanh" role="region">
        <CapturedRequestCartButton />
        <div className="phonering-alo-alo">
          <a href={`tel:${phone}`} rel="nofollow" aria-label={`Gọi ${settings.contact_phone}`}>.</a>
        </div>
        <div className="phonering-alo-sms">
          <a href={`sms:${phone}`} rel="nofollow" aria-label={`Nhắn tin ${settings.contact_phone}`}>.</a>
        </div>
        <div className="phonering-alo-zalo">
          <a
            href={settings.contact_zalo_url}
            target="_blank"
            rel="nofollow noreferrer"
            aria-label="Liên hệ qua Zalo"
          >
            .
          </a>
        </div>
        <div className="phonering-alo-messenger">
          <a
            href={settings.contact_messenger_url}
            target="_blank"
            rel="nofollow noreferrer"
            aria-label="Liên hệ qua Messenger"
          >
            .
          </a>
        </div>
    </div>
  );
}
