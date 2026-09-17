import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const heroDirectory = join(projectRoot, "public/images/home-hero");
const capturedDirectory = join(projectRoot, "public/images/home-captured");

const remoteSources = {
  background: "https://giacong.vn/wp-content/uploads/2024/10/img-b.png",
  banner: "https://giacong.vn/wp-content/uploads/2024/10/banner-gia-cong.jpg",
  product: "https://giacong.vn/wp-content/uploads/2024/10/img-sp-1.png",
  about: "https://giacong.vn/wp-content/uploads/2024/09/IMG.png",
  menuLogo: "https://giacong.vn/wp-content/uploads/2024/08/logo-__1_-removebg-preview.png",
  headerLogo: "https://giacong.vn/wp-content/uploads/2024/10/GIACONG.VN-ngang-03-1-1024x291.png",
  bookOpen: "https://giacong.vn/wp-content/uploads/2024/08/book-open-svgrepo-com.svg",
  newsBackground: "https://giacong.vn/wp-content/uploads/2024/09/bg-tin-tuc.png",
  sectionBackground: "https://giacong.vn/wp-content/uploads/2024/09/Group-205.png",
  quote: "https://giacong.vn/wp-content/uploads/2024/09/quote.png",
  checkCircle: "https://giacong.vn/wp-content/uploads/2024/10/check-circle-svgrepo-com.svg",
  formBackground: "https://giacong.vn/wp-content/uploads/2024/10/form-bg.jpg",
  newsThumbnail: "https://giacong.vn/wp-content/uploads/2024/10/thumbcn-1200x676-9.jpg",
  call: "https://giacong.vn/wp-content/uploads/2026/01/call.webp",
  mail: "https://giacong.vn/wp-content/uploads/2026/01/mail.webp",
  zalo: "https://giacong.vn/wp-content/uploads/2026/01/zalo.webp",
  messenger: "https://giacong.vn/wp-content/uploads/2026/01/messenger.webp",
};

async function fetchImage(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not download ${url}: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function writeWebp(source, outputName, width, quality) {
  const pipeline = sharp(source);
  if (width) pipeline.resize({ width, fit: "inside", withoutEnlargement: true });
  await pipeline.webp({ quality, effort: 5 }).toFile(join(capturedDirectory, outputName));
}

async function writeHeroModernFormats(name) {
  const source = join(heroDirectory, `${name}.png`);
  await sharp(source).webp({ quality: 82, effort: 5 }).toFile(join(heroDirectory, `${name}.webp`));
  await sharp(source).avif({ quality: 55, effort: 5 }).toFile(join(heroDirectory, `${name}.avif`));
}

await mkdir(capturedDirectory, { recursive: true });

for (const name of ["hero-1", "hero-2", "hero-3", "hero-4"]) {
  await writeHeroModernFormats(name);
}

const [background, banner, product, about, menuLogo, headerLogo] = await Promise.all(
  [remoteSources.background, remoteSources.banner, remoteSources.product, remoteSources.about, remoteSources.menuLogo, remoteSources.headerLogo].map(fetchImage),
);
const bookOpenResponse = await fetch(remoteSources.bookOpen);
if (!bookOpenResponse.ok) throw new Error(`Could not download ${remoteSources.bookOpen}: ${bookOpenResponse.status}`);
const bookOpen = Buffer.from(await bookOpenResponse.arrayBuffer());
const additionalRasterSources = [
  ["newsBackground", "bg-tin-tuc.webp", 1600, 78],
  ["sectionBackground", "Group-205.webp", 1600, 78],
  ["quote", "quote.webp", 160, 82],
  ["formBackground", "form-bg.webp", 1600, 78],
  ["newsThumbnail", "thumbcn-1200x676-9.webp", 1200, 78],
  ["call", "call.webp", 96, 82],
  ["mail", "mail.webp", 96, 82],
  ["zalo", "zalo.webp", 96, 82],
  ["messenger", "messenger.webp", 96, 82],
];
const additionalRasterBuffers = await Promise.all(
  additionalRasterSources.map(async ([key]) => ({ key, source: await fetchImage(remoteSources[key]) })),
);

await writeWebp(background, "img-b.webp", 1600, 78);
await writeWebp(banner, "banner-gia-cong.webp", 1600, 78);
await writeWebp(menuLogo, "menu-logo.webp", 300, 78);
await writeWebp(headerLogo, "header-logo.webp", 512, 82);
await writeFile(join(capturedDirectory, "book-open.svg"), bookOpen);
await writeWebp(product, "img-sp-1.webp", 728, 80);
await writeWebp(product, "img-sp-1-510x315.webp", 510, 80);
await writeWebp(product, "img-sp-1-300x185.webp", 300, 80);
await writeWebp(about, "IMG.webp", 863, 80);
await writeWebp(about, "IMG-768x652.webp", 768, 80);
await writeWebp(about, "IMG-510x433.webp", 510, 80);
await writeWebp(about, "IMG-300x255.webp", 300, 80);
for (const { key, source } of additionalRasterBuffers) {
  const [, outputName, width, quality] = additionalRasterSources.find(([sourceKey]) => sourceKey === key);
  await writeWebp(source, outputName, width, quality);
}

const checkCircle = await fetchImage(remoteSources.checkCircle);
await writeFile(join(capturedDirectory, "check-circle.svg"), checkCircle);

const generatedFiles = [
  ...["hero-1", "hero-2", "hero-3", "hero-4"].flatMap((name) => [
    join(heroDirectory, `${name}.avif`),
    join(heroDirectory, `${name}.webp`),
  ]),
  ...[
    "img-b.webp",
    "banner-gia-cong.webp",
    "menu-logo.webp",
    "header-logo.webp",
    "book-open.svg",
    "img-sp-1.webp",
    "img-sp-1-510x315.webp",
    "img-sp-1-300x185.webp",
    "IMG.webp",
    "IMG-768x652.webp",
    "IMG-510x433.webp",
    "IMG-300x255.webp",
    "bg-tin-tuc.webp",
    "Group-205.webp",
    "quote.webp",
    "check-circle.svg",
    "form-bg.webp",
    "thumbcn-1200x676-9.webp",
    "call.webp",
    "mail.webp",
    "zalo.webp",
    "messenger.webp",
  ].map((name) => join(capturedDirectory, name)),
];

for (const file of generatedFiles) {
  console.log(`${file.replace(`${projectRoot}/`, "")} ${(await stat(file)).size} bytes`);
}
