import { GiacongInteractions } from "@/components/GiacongInteractions";
import { CapturedFloatingContact } from "@/components/CapturedPage";
import { layerCapturedStyles, normalizeCapturedMarkup } from "@/lib/captured-markup";
import { applySiteSettingsToMarkup, siteBrandStyles } from "@/lib/site-markup";
import { siteSettingDefaults, type PublishedSiteSettings } from "@/lib/site-settings";
import type { CapturedPageData } from "@/types/captured-page";

const HOME_HERO_GALLERY = [
  { alt: "Nhân sự trong dây chuyền gia công thực phẩm", src: "/images/home-hero/hero-1.png" },
  { alt: "Sơ chế nông sản tại nhà máy", src: "/images/home-hero/hero-2.png" },
  { alt: "Nhà máy gia công thực phẩm", src: "/images/home-hero/hero-3.png" },
  { alt: "Đóng gói sản phẩm thực phẩm", src: "/images/home-hero/hero-4.png" },
] as const;

type CapturedHomePageProps = Pick<
  CapturedPageData,
  "markup" | "pageStyles" | "bodyClasses" | "htmlClasses"
> & { siteSettings?: PublishedSiteSettings };

/**
 * Renders the captured homepage while replacing the source's composite hero
 * artwork with four real image elements. Keeping this at the page boundary
 * leaves the shared captured shell untouched for the other storefront routes.
 */
export function CapturedHomePage({
  markup,
  pageStyles,
  bodyClasses,
  htmlClasses,
  siteSettings,
}: CapturedHomePageProps) {
  const settings = siteSettings ?? siteSettingDefaults;
  const normalizedMarkup = applySiteSettingsToMarkup(normalizeCapturedMarkup(markup), settings);
  const homeMarkup = replaceCompositeHeroWithGallery(normalizedMarkup);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `${layerCapturedStyles(pageStyles)}\n${siteBrandStyles(settings)}` }} />
      <div
        className={bodyClasses}
        dangerouslySetInnerHTML={{ __html: homeMarkup }}
        suppressHydrationWarning
      />
      <CapturedFloatingContact settings={settings} />
      <GiacongInteractions bodyClasses={bodyClasses} htmlClasses={htmlClasses} />
    </>
  );
}

function replaceCompositeHeroWithGallery(markup: string): string {
  const compositeHeroPattern = /<div\b(?=[^>]*\bid=["']image_[^"']+["'])(?=[^>]*\bclass=["'][^"']*\bimg\b[^"']*["'])[^>]*>[\s\S]*?<img\b(?=[^>]*\balt=["']gia cong thuc pham["'])[^>]*\/?>(?:[\s\S]*?)<\/div>\s*(?:<style\b[\s\S]*?<\/style>\s*)?<\/div>/i;
  return markup.replace(compositeHeroPattern, homeHeroGalleryMarkup());
}

function homeHeroGalleryMarkup(): string {
  const items = HOME_HERO_GALLERY.map((image, index) => `
    <figure class="giacong-home-gallery__item giacong-home-gallery__item--${index + 1}">
      <img
        alt="${image.alt}"
        data-gallery-image="${index + 1}"
        decoding="async"
        height="202"
        loading="eager"
        src="${image.src}"
        width="341"
      />
    </figure>`).join("");

  return `<div aria-label="Năng lực gia công của Giacong.vn" class="giacong-home-gallery" data-testid="home-hero-gallery">${items}
  </div>`;
}
