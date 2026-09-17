import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const mirrorRoot = resolve(
  process.argv[2] ?? "C:/Users/hieuk/Desktop/cào giacong.vn/mirror",
);
const pagesRoot = resolve("src/data/pages");
const publicStylesRoot = resolve("public/styles");
const remoteIconRoot = "https://giacong.vn/wp-content/themes/flatsome/assets/css/icons/";
const remoteFontRoot = "https://giacong.vn/wp-content/themes/thiet-ke-web/font/";
const remoteFixedTocFontRoot = "https://giacong.vn/wp-content/plugins/fixed-toc/frontend/assets/fonts/";
const sharedStyles = [
  ["menu-icons.css", "https://giacong.vn/wp-content/plugins/menu-icons/css/extra.min.css?ver=0.13.23"],
  ["woocommerce-blocks.css", "https://giacong.vn/wp-content/plugins/woocommerce/assets/client/blocks/wc-blocks.css?ver=wc-10.9.4"],
  ["star-ratings.css", "https://giacong.vn/wp-content/plugins/kk-star-ratings/src/core/public/css/kk-star-ratings.min.css?ver=5.4.10.5"],
  ["quick-buy.css", "https://giacong.vn/wp-content/plugins/devvn-quick-buy/css/devvn-quick-buy.css?ver=2.1.3"],
  ["flatsome.css", "https://giacong.vn/wp-content/themes/flatsome/assets/css/flatsome.css?ver=3.16.2"],
  ["flatsome-shop.css", "https://giacong.vn/wp-content/themes/flatsome/assets/css/flatsome-shop.css?ver=3.16.2"],
  ["giacong.css", "https://giacong.vn/wp-content/themes/thiet-ke-web/style.css?ver=3.0"],
  ["fixed-toc.css", "https://giacong.vn/wp-content/plugins/fixed-toc/frontend/assets/css/ftoc.min.css?ver=3.1.28"],
  ["contact-form.css", "https://giacong.vn/wp-content/plugins/contact-form-7/includes/css/styles.css?ver=6.1.6"],
];
const iconFiles = ["fl-icons.eot", "fl-icons.woff2", "fl-icons.ttf", "fl-icons.woff", "fl-icons.svg"];
const fixedTocFontFiles = [
  "icons.eot",
  "icons.woff2",
  "icons.woff",
  "icons.ttf",
  "icons.svg",
];
const localCapturedMedia = {
  "https://giacong.vn/wp-content/uploads/2024/10/img-b.png": "/images/home-captured/img-b.webp",
  "https://giacong.vn/wp-content/uploads/2024/10/banner-gia-cong.jpg": "/images/home-captured/banner-gia-cong.webp",
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
  "https://giacong.vn/wp-content/uploads/2024/10/logo-gia-cong-new-300x85.png": "/images/home-captured/footer-logo-300.webp",
  "https://giacong.vn/wp-content/uploads/2024/10/logo-gia-cong-new.png": "/images/home-captured/footer-logo.webp",
  "https://giacong.vn/wp-content/uploads/2024/10/marketing-email-mail-information-news-svgrepo-com.svg": "/images/home-captured/service-email.svg",
  "https://giacong.vn/wp-content/uploads/2024/10/money-dollar-cash-payment-svgrepo-com.svg": "/images/home-captured/service-money.svg",
  "https://giacong.vn/wp-content/uploads/2024/10/seo-application-like-thumb-svgrepo-com.svg": "/images/home-captured/service-like.svg",
  "https://giacong.vn/wp-content/uploads/2024/10/seo-mobile-setting-gear-cog-07-svgrepo-com.svg": "/images/home-captured/service-mobile.svg",
  "https://giacong.vn/wp-content/uploads/2024/10/seo-reward-license-certificate-contract-svgrepo-com.svg": "/images/home-captured/service-certificate.svg",
};
const fontFiles = [
  "SFProDisplay-Regular.woff2",
  "SFProDisplay-Regular.woff",
  "SFProDisplay-Regular.ttf",
  "SFProDisplay-Bold.woff2",
  "SFProDisplay-Bold.woff",
  "SFProDisplay-Bold.ttf",
];
const routeAliases = new Map([
  ["/dich-vu-dong-goi/", "/dich-vu-dong-goi-bao-jumbo/"],
  ["/sua/", "/gia-cong-sua/"],
]);
let knownRoutes = new Set();

const isMainModule =
  process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMainModule) {
await Promise.all([
  mkdir(pagesRoot, { recursive: true }),
  mkdir(`${publicStylesRoot}/icons`, { recursive: true }),
  mkdir(`${publicStylesRoot}/fonts`, { recursive: true }),
  mkdir(`${publicStylesRoot}/fonts/fixed-toc`, { recursive: true }),
]);
}

async function writeOutput(file, contents) {
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      await writeFile(file, contents);
      return;
    } catch (error) {
      const retryable = error && typeof error === "object"
        && "code" in error
        && ["EBUSY", "EPERM", "UNKNOWN"].includes(error.code);
      if (!retryable || attempt === 8) throw error;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 75));
    }
  }
}

function routeFromFile(file) {
  const localPath = relative(mirrorRoot, file).split(sep).join("/");
  if (localPath === "index.html") return "/";
  return `/${localPath.replace(/\/index\.html$/i, "")}/`;
}

function fileFromRoute(route) {
  if (route === "/") return "home.json";
  return `${route.replace(/^\/+|\/+$/g, "").replaceAll("/", "__")}.json`;
}

function localizeCapturedMedia(value) {
  return Object.entries(localCapturedMedia).reduce(
    (result, [source, replacement]) => result.split(source).join(replacement),
    value,
  );
}

function rewriteInternalUrl(value, route) {
  if (!value || value.startsWith("#") || value.startsWith("mailto:") || value.startsWith("tel:")) {
    return value;
  }
  if (/^(?:https?:)?\/\//i.test(value) && !/^https?:\/\/(?:www\.)?giacong\.vn/i.test(value)) {
    return value;
  }

  let pathname;
  if (/^https?:\/\/(?:www\.)?giacong\.vn/i.test(value)) {
    pathname = new URL(value).pathname;
  } else if (value.startsWith("/")) {
    pathname = value;
  } else {
    pathname = new URL(value, `https://local.invalid${route}`).pathname;
  }

  pathname = pathname.replace(/\/index\.html$/i, "/");
  if (pathname === "/index.html") pathname = "/";
  if (!pathname.endsWith("/") && !/\.[a-z0-9]+$/i.test(pathname)) pathname += "/";
  const aliasedPath = routeAliases.get(pathname) ?? pathname;
  return knownRoutes.has(aliasedPath) ? aliasedPath : "#";
}

function hydrateImage(tag) {
  const lazySrc = tag.match(/\sdata-(?:lazy-)?src=(["'])(.*?)\1/i)?.[2];
  const lazySrcset = tag.match(/\sdata-srcset=(["'])(.*?)\1/i)?.[2];
  let result = tag
    .replace(/\sdata-(?:lazy-)?src=(["']).*?\1/gi, "")
    .replace(/\sdata-srcset=(["']).*?\1/gi, "");

  if (lazySrc) {
    result = /\ssrc=(["']).*?\1/i.test(result)
      ? result.replace(/\ssrc=(["']).*?\1/i, ` src="${lazySrc}"`)
      : result.replace(/^<img/i, `<img src="${lazySrc}"`);
  }
  if (lazySrcset) {
    result = /\ssrcset=(["']).*?\1/i.test(result)
      ? result.replace(/\ssrcset=(["']).*?\1/i, ` srcset="${lazySrcset}"`)
      : result.replace(/^<img/i, `<img srcset="${lazySrcset}"`);
  }
  return result;
}

function cleanGeneratedText(value) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+$/gm, "");
}

function normalizeInlineCss(css) {
  return cleanGeneratedText(css
    .replaceAll(remoteIconRoot, "/styles/icons/")
    .replaceAll(remoteFontRoot, "/styles/fonts/")
    .replaceAll("/wp-content/themes/thiet-ke-web/font/", "/styles/fonts/")
    .replaceAll("url(/wp-content/", "url(https://giacong.vn/wp-content/")
    .replaceAll("url('/wp-content/", "url('https://giacong.vn/wp-content/")
    .replaceAll('url("/wp-content/', 'url("https://giacong.vn/wp-content/'));
}

function transformPage(pageSource, route) {
  const bodyMatch = pageSource.match(/<body\b([^>]*)>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) throw new Error(`Unable to locate body for ${route}`);
  const htmlAttributes = pageSource.match(/<html\b([^>]*)>/i)?.[1] ?? "";
  const bodyClasses = (bodyMatch[1].match(/\bclass=(["'])(.*?)\1/i)?.[2] ?? "")
    .replace(/\bwoocommerce-no-js\b/g, "woocommerce-js");
  const htmlClasses = (htmlAttributes.match(/\bclass=(["'])(.*?)\1/i)?.[2] ?? "js")
    .replace(/\bno-js\b/g, "js")
    .replace(/\bloading-site\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const pageStyles = normalizeInlineCss(
    [...pageSource.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)]
      .map((match) => match[1])
      .join("\n"),
  );
  const title = pageSource.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "Giacong.vn";
  const descriptionTag = pageSource
    .match(/<meta\b[^>]*\bname=(["'])description\1[^>]*>/i)?.[0] ?? "";
  const description = descriptionTag
    .match(/\bcontent=(["'])(.*?)\1/i)?.[2] ?? "";

  const markup = bodyMatch[2]
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, "")
    .replace(/\son[a-z]+=(["']).*?\1/gi, "")
    .replace(/<img\b[^>]*>/gi, hydrateImage)
    // Keep the reveal state client-owned. Baking data-animated=true here
    // removes the initial frame that the IntersectionObserver needs.
    .replace(/data-animate=(["'])(.*?)\1/gi, 'data-animate="$2"')
    .replace(/class=(["'])([^"']*\bsection-bg\b[^"']*)\1/gi, (_, quote, classes) => (
      `class=${quote}${classes.includes("bg-loaded") ? classes : `${classes} bg-loaded`}${quote}`
    ))
    .replace(/\sdata-bg=(["'])(.*?)\1/gi, (attribute, _quote, value) => (
      /^(?:https?:\/\/|\/|.*\.(?:avif|gif|jpe?g|png|svg|webp)(?:\?.*)?$)/i.test(value)
        ? ` style="background-image:url(${value})"`
        : attribute
    ))
    .replace(/\b(href|action)=(["'])(.*?)\2/gi, (_, attribute, quote, value) => (
      `${attribute}=${quote}${rewriteInternalUrl(value, route)}${quote}`
    ))
    .replace(
      /https:\/\/giacong\.vn\/wp-content\/uploads\/woocommerce-placeholder(?:-[^\s,"']+)?\.png/gi,
      "/images/woocommerce-placeholder.svg",
    )
    .replaceAll('"/wp-content/', '"https://giacong.vn/wp-content/')
    .replaceAll("'/wp-content/", "'https://giacong.vn/wp-content/");

  return {
    markup: cleanGeneratedText(markup),
    pageStyles,
    title,
    description,
    bodyClasses,
    htmlClasses,
  };
}

export { transformPage };

if (isMainModule) {
const directoryEntries = await readdir(mirrorRoot, { recursive: true, withFileTypes: true });
const htmlFiles = directoryEntries
  .filter((entry) => entry.isFile() && entry.name === "index.html")
  .map((entry) => resolve(entry.parentPath, entry.name))
  .sort();

const manifest = Object.fromEntries(
  htmlFiles.map((file) => {
    const route = routeFromFile(file);
    return [route, fileFromRoute(route)];
  }),
);
knownRoutes = new Set(Object.keys(manifest));
for (const file of htmlFiles) {
  const route = routeFromFile(file);
  const data = transformPage(await readFile(file, "utf8"), route);
  const outputFile = manifest[route];
  await writeOutput(resolve(pagesRoot, outputFile), JSON.stringify(data));
}
await writeOutput(resolve(pagesRoot, "manifest.json"), JSON.stringify(manifest, null, 2));

const home = JSON.parse(await readFile(resolve(pagesRoot, manifest["/"]), "utf8"));
await writeOutput(`${publicStylesRoot}/giacong-sections.css`, localizeCapturedMedia(home.pageStyles));

function rewriteStylesheetAssets(css, stylesheetUrl) {
  return css.replace(/url\((["']?)(.*?)\1\)/gi, (match, quote, value) => {
    if (!value || value.startsWith("data:") || value.startsWith("#")) return match;
    const absolute = new URL(value, stylesheetUrl).href;
    const localized = absolute
      .replace(remoteIconRoot, "/styles/icons/")
      .replace(remoteFontRoot, "/styles/fonts/")
      .replace(remoteFixedTocFontRoot, "/styles/fonts/fixed-toc/");
    return `url(${quote}${localized}${quote})`;
  });
}

await Promise.all(sharedStyles.map(async ([name, url]) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to download ${name}: ${response.status}`);
  const css = cleanGeneratedText(rewriteStylesheetAssets(await response.text(), url));
  await writeOutput(`${publicStylesRoot}/${name}`, css);
}));

await Promise.all(iconFiles.map(async (name) => {
  const response = await fetch(`${remoteIconRoot}${name}?v=3.16.2`);
  if (response.ok) {
    await writeOutput(`${publicStylesRoot}/icons/${name}`, Buffer.from(await response.arrayBuffer()));
  }
}));

await Promise.all(fontFiles.map(async (name) => {
  const response = await fetch(`${remoteFontRoot}${name}`);
  if (response.ok) {
    await writeOutput(`${publicStylesRoot}/fonts/${name}`, Buffer.from(await response.arrayBuffer()));
  }
}));

await Promise.all(fixedTocFontFiles.map(async (name) => {
  const response = await fetch(`${remoteFixedTocFontRoot}${name}?45335921`);
  if (!response.ok) throw new Error(`Unable to download Fixed TOC font ${name}: ${response.status}`);
  await writeOutput(
    `${publicStylesRoot}/fonts/fixed-toc/${name}`,
    Buffer.from(await response.arrayBuffer()),
  );
}));

console.log(`Captured ${Object.keys(manifest).length} routes from ${mirrorRoot}`);
}
