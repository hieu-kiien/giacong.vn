const homepageImageDirectory = "/images/home-captured";

const productImageSrcset = [
  `${homepageImageDirectory}/img-sp-1-300x185.webp 300w`,
  `${homepageImageDirectory}/img-sp-1-400x247.webp 400w`,
  `${homepageImageDirectory}/img-sp-1-510x315.webp 510w`,
  `${homepageImageDirectory}/img-sp-1-600x371.webp 600w`,
  `${homepageImageDirectory}/img-sp-1-640x395.webp 640w`,
  `${homepageImageDirectory}/img-sp-1.webp 728w`,
].join(", ");

const aboutImageSrcset = [
  `${homepageImageDirectory}/IMG-300x255.webp 300w`,
  `${homepageImageDirectory}/IMG-400x340.webp 400w`,
  `${homepageImageDirectory}/IMG-510x433.webp 510w`,
  `${homepageImageDirectory}/IMG-680x578.webp 680w`,
  `${homepageImageDirectory}/IMG-768x652.webp 768w`,
  `${homepageImageDirectory}/IMG.webp 863w`,
].join(", ");

const contentImageSizes = "(max-width: 549px) 510px, (max-width: 849px) 400px, calc(50vw - 90px)";

/**
 * Rewrites the few large homepage capture images with local responsive
 * candidates. The source capture only knows the original WordPress widths;
 * keeping that srcset makes mobile browsers download a larger candidate than
 * the rendered column needs.
 */
export function optimizeHomepageResponsiveImages(markup: string): string {
  return markup.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = readImageAttribute(tag, "src") ?? "";
    const className = readImageAttribute(tag, "class") ?? "";

    if (isHeaderLogo(src, className)) {
      return setImageAttributes(tag, {
        src: `${homepageImageDirectory}/header-logo-350.webp`,
        srcset: [
          `${homepageImageDirectory}/header-logo-200.webp 200w`,
          `${homepageImageDirectory}/header-logo-350.webp 350w`,
          `${homepageImageDirectory}/header-logo.webp 512w`,
        ].join(", "),
        sizes: "(max-width: 849px) 200px, 350px",
        width: "350",
        height: "100",
      });
    }

    if (/\/img-sp-1(?:\.webp|-\d+x\d+\.webp)(?:[?#]|$)/i.test(src)) {
      return setImageAttributes(tag, {
        src: `${homepageImageDirectory}/img-sp-1-400x247.webp`,
        srcset: productImageSrcset,
        sizes: contentImageSizes,
      });
    }

    if (/\/IMG(?:\.webp|-\d+x\d+\.webp)(?:[?#]|$)/i.test(src)) {
      return setImageAttributes(tag, {
        src: `${homepageImageDirectory}/IMG-680x578.webp`,
        srcset: aboutImageSrcset,
        sizes: contentImageSizes,
      });
    }

    return tag;
  });
}

function isHeaderLogo(src: string, className: string): boolean {
  return /\/header-logo\.webp(?:[?#]|$)/i.test(src)
    && /\bheader_logo\b|\bheader-logo(?:-dark)?\b/i.test(className);
}

function readImageAttribute(tag: string, name: string): string | null {
  return tag.match(new RegExp(`\\s${name}\\s*=\\s*(["'])(.*?)\\1`, "i"))?.[2] ?? null;
}

function setImageAttributes(tag: string, attributes: Readonly<Record<string, string>>): string {
  return Object.entries(attributes).reduce(
    (result, [name, value]) => setImageAttribute(result, name, value),
    tag,
  );
}

function setImageAttribute(tag: string, name: string, value: string): string {
  const escapedValue = value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const attributePattern = new RegExp(`\\s${name}\\s*=\\s*(["'])[^"']*\\1`, "i");
  if (attributePattern.test(tag)) {
    return tag.replace(attributePattern, ` ${name}="${escapedValue}"`);
  }

  return tag.replace(/\/?>(?=$)/, ` ${name}="${escapedValue}"$&`);
}
