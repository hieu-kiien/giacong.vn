import { GiacongInteractions } from "@/components/GiacongInteractions";
import { CapturedFloatingContact } from "@/components/CapturedPage";
import { layerCapturedStyles, normalizeCapturedMarkup } from "@/lib/captured-markup";
import { applyHomepageSiteSettingsToMarkup, siteBrandStyles } from "@/lib/site-markup";
import {
  applyFooterNavigationToMarkup,
  applyNavigationToMarkup,
  getPublishedSiteNavigation,
} from "@/lib/site-navigation";
import { siteSettingDefaults, type PublishedSiteSettings } from "@/lib/site-settings";
import type { CapturedPageData } from "@/types/captured-page";

const HOME_HERO_GALLERY = [
  {
    alt: "Nhân sự trong dây chuyền gia công thực phẩm",
    avif: "/images/home-hero/hero-1.avif",
    src: "/images/home-hero/hero-1.png",
    webp: "/images/home-hero/hero-1.webp",
  },
  {
    alt: "Sơ chế nông sản tại nhà máy",
    avif: "/images/home-hero/hero-2.avif",
    src: "/images/home-hero/hero-2.png",
    webp: "/images/home-hero/hero-2.webp",
  },
  {
    alt: "Nhà máy gia công thực phẩm",
    avif: "/images/home-hero/hero-3.avif",
    src: "/images/home-hero/hero-3.png",
    webp: "/images/home-hero/hero-3.webp",
  },
  {
    alt: "Đóng gói sản phẩm thực phẩm",
    avif: "/images/home-hero/hero-4.avif",
    src: "/images/home-hero/hero-4.png",
    webp: "/images/home-hero/hero-4.webp",
  },
] as const;

const HOMEPAGE_MEDIA_ALIASES: Readonly<Record<string, string>> = {
  "https://giacong.vn/wp-content/uploads/2024/10/img-b.png": "/images/home-captured/img-b.webp",
  "https://giacong.vn/wp-content/uploads/2024/10/banner-gia-cong.jpg": "/images/home-captured/banner-gia-cong.webp",
  "https://giacong.vn/wp-content/uploads/2024/10/img-sp-1.png": "/images/home-captured/img-sp-1.webp",
  "https://giacong.vn/wp-content/uploads/2024/10/img-sp-1-510x315.png": "/images/home-captured/img-sp-1-510x315.webp",
  "https://giacong.vn/wp-content/uploads/2024/10/img-sp-1-300x185.png": "/images/home-captured/img-sp-1-300x185.webp",
  "https://giacong.vn/wp-content/uploads/2024/09/IMG.png": "/images/home-captured/IMG.webp",
  "https://giacong.vn/wp-content/uploads/2024/09/IMG-768x652.png": "/images/home-captured/IMG-768x652.webp",
  "https://giacong.vn/wp-content/uploads/2024/09/IMG-510x433.png": "/images/home-captured/IMG-510x433.webp",
  "https://giacong.vn/wp-content/uploads/2024/09/IMG-300x255.png": "/images/home-captured/IMG-300x255.webp",
  "https://giacong.vn/wp-content/uploads/2024/08/logo-__1_-removebg-preview.png": "/images/home-captured/menu-logo.webp",
  "https://giacong.vn/wp-content/uploads/2024/10/GIACONG.VN-ngang-03-1-1024x291.png": "/images/home-captured/header-logo.webp",
  "https://giacong.vn/wp-content/uploads/2024/08/book-open-svgrepo-com.svg": "/images/home-captured/book-open.svg",
  "https://giacong.vn/wp-content/uploads/2020/06/banner-bg-2.png": "/images/home-captured/banner-gia-cong.webp",
  "https://giacong.vn/wp-content/uploads/2020/06/phone-icon.png": "/images/home-captured/call.webp",
  "https://giacong.vn/wp-content/uploads/2024/09/bg-tin-tuc.png": "/images/home-captured/bg-tin-tuc.webp",
  "https://giacong.vn/wp-content/uploads/2024/09/Group-205.png": "/images/home-captured/Group-205.webp",
  "https://giacong.vn/wp-content/uploads/2024/09/quote.png": "/images/home-captured/quote.webp",
  "https://giacong.vn/wp-content/uploads/2024/10/check-circle-svgrepo-com.svg": "/images/home-captured/check-circle.svg",
  "https://giacong.vn/wp-content/uploads/2024/10/form-bg.jpg": "/images/home-captured/form-bg.webp",
  "https://giacong.vn/wp-content/uploads/2024/10/thumbcn-1200x676-9.jpg": "/images/home-captured/thumbcn-1200x676-9.webp",
  "https://giacong.vn/wp-content/uploads/2026/01/call.webp": "/images/home-captured/call.webp",
  "https://giacong.vn/wp-content/uploads/2026/01/mail.webp": "/images/home-captured/mail.webp",
  "https://giacong.vn/wp-content/uploads/2026/01/zalo.webp": "/images/home-captured/zalo.webp",
  "https://giacong.vn/wp-content/uploads/2026/01/messenger.webp": "/images/home-captured/messenger.webp",
};

// These captured sections contain customer counts, testimonials and partner marks with no
// verified source in the current content store. Keep them out of the public fallback until the
// owner supplies evidence and intentionally publishes replacement content.
const UNVERIFIED_HOMEPAGE_PROOF_SECTION_IDS = [
  "section_300790898",
  "section_777974837",
  "section_1385300469",
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
export async function CapturedHomePage({
  markup,
  pageStyles,
  bodyClasses,
  htmlClasses,
  siteSettings,
}: CapturedHomePageProps) {
  const settings = siteSettings ?? siteSettingDefaults;
  const navigation = await getPublishedSiteNavigation();
  const normalizedMarkup = localizeHomepageMedia(
    applyHomepageSiteSettingsToMarkup(
      removeUnverifiedHomepageProof(normalizeCapturedMarkup(localizeHomepageMedia(markup))),
      settings,
    ),
  );
  const homeMarkup = replaceCompositeHeroWithGallery(
    applyFooterNavigationToMarkup(
      applyNavigationToMarkup(normalizedMarkup, navigation, "menu-item-4618"),
      navigation,
    ),
    settings.hero_image_url,
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `${layerCapturedStyles(localizeHomepageMedia(pageStyles))}\n${siteBrandStyles(settings)}` }} />
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

function localizeHomepageMedia(value: string): string {
  return Object.entries(HOMEPAGE_MEDIA_ALIASES).reduce(
    (result, [source, replacement]) => result.split(source).join(replacement),
    value,
  );
}

function removeUnverifiedHomepageProof(markup: string): string {
  return UNVERIFIED_HOMEPAGE_PROOF_SECTION_IDS.reduce(
    (result, sectionId) => result.replace(
      new RegExp(`<section\\b(?=[^>]*\\bid=["']${sectionId}["'])[^>]*>[\\s\\S]*?<\\/section>`, "i"),
      "",
    ),
    markup,
  );
}

function replaceCompositeHeroWithGallery(markup: string, heroImageUrl: string): string {
  const compositeHeroPattern = /<div\b(?=[^>]*\bid=["']image_[^"']+["'])(?=[^>]*\bclass=["'][^"']*\bimg\b[^"']*["'])[^>]*>[\s\S]*?<img\b(?=[^>]*\balt=["']gia cong thuc pham["'])[^>]*\/?>(?:[\s\S]*?)<\/div>\s*(?:<style\b[\s\S]*?<\/style>\s*)?<\/div>/i;
  return markup.replace(compositeHeroPattern, homeHeroGalleryMarkup(heroImageUrl));
}

function homeHeroGalleryMarkup(heroImageUrl: string): string {
  const safeHeroImageUrl = heroImageUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const items = HOME_HERO_GALLERY.map((image, index) => `
    <figure class="giacong-home-gallery__item giacong-home-gallery__item--${index + 1}">
      <picture>
        ${index === 0 && safeHeroImageUrl ? "" : `<source srcset="${image.avif} 341w" type="image/avif" /><source srcset="${image.webp} 341w" type="image/webp" />`}
        <img
          alt="${image.alt}"
          data-gallery-image="${index + 1}"
          decoding="async"
          fetchpriority="${index === 0 ? "high" : "low"}"
          height="202"
          loading="${index === 0 ? "eager" : "lazy"}"
          sizes="341px"
          src="${index === 0 && safeHeroImageUrl ? safeHeroImageUrl : image.src}"
          width="341"
        />
      </picture>
    </figure>`).join("");

  return `<div aria-label="Năng lực gia công của Giacong.vn" class="giacong-home-gallery" data-testid="home-hero-gallery">${items}
  </div>`;
}
