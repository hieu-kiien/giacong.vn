import { GiacongInteractions } from "@/components/GiacongInteractions";
import { CapturedRequestCartButton } from "@/components/request-cart/CapturedRequestCartButton";
import { layerCapturedStyles, normalizeCapturedMarkup } from "@/lib/captured-markup";
import { applySiteSettingsToMarkup, siteBrandStyles } from "@/lib/site-markup";
import { siteSettingDefaults, type PublishedSiteSettings } from "@/lib/site-settings";
import type { CapturedPageData } from "@/types/captured-page";

type CapturedPageProps = Pick<
  CapturedPageData,
  "markup" | "pageStyles" | "bodyClasses" | "htmlClasses"
>;

export function CapturedPage({
  markup,
  pageStyles,
  bodyClasses,
  htmlClasses,
  siteSettings,
}: CapturedPageProps & { siteSettings?: PublishedSiteSettings }) {
  const settings = siteSettings ?? siteSettingDefaults;
  const normalizedMarkup = applySiteSettingsToMarkup(normalizeCapturedMarkup(markup), settings);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `${layerCapturedStyles(pageStyles)}\n${siteBrandStyles(settings)}` }} />
      <div
        className={bodyClasses}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: normalizedMarkup }}
      />
      <CapturedFloatingContact settings={settings} />
      <GiacongInteractions bodyClasses={bodyClasses} htmlClasses={htmlClasses} />
    </>
  );
}

export function CapturedFloatingContact({ settings = siteSettingDefaults }: { settings?: PublishedSiteSettings }) {
  const phone = settings.contact_phone.replace(/[^\d+]/g, "");
  return (
    <div className="echbay-sms-messenger style-for-position-br max-[549px]:!hidden" aria-label="Liên hệ nhanh">
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
