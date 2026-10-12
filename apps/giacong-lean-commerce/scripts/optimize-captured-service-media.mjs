import { mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const mediaDirectory = join(process.cwd(), "public/images/captured-legacy/source");
const optimizedImages = [
  ["gia-cong-da-vien.png", "gia-cong-da-vien-optimized.webp"],
  ["dich-vu-gia-cong-say-thang-hoa-hoa-tan-85287.png", "dich-vu-gia-cong-say-thang-hoa-hoa-tan-85287-optimized.webp"],
  ["gia-cong-kem-ly.webp", "gia-cong-kem-ly-optimized.webp"],
  ["gia-cong-nuoc-bo-sung-khoang-chat-cho-the-thao.webp", "gia-cong-nuoc-bo-sung-khoang-chat-cho-the-thao-optimized.webp"],
  ["gia-cong-nuoc-vitamin-tong-hopn.jpg", "gia-cong-nuoc-vitamin-tong-hopn-optimized.webp"],
];

await mkdir(mediaDirectory, { recursive: true });

for (const [sourceName, optimizedName] of optimizedImages) {
  const sourcePath = join(mediaDirectory, sourceName);
  const optimizedPath = join(mediaDirectory, optimizedName);
  await sharp(sourcePath)
    .rotate()
    .resize({ width: 960, height: 960, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78, effort: 6 })
    .toFile(optimizedPath);

  const sourceSize = (await stat(sourcePath)).size;
  const optimizedSize = (await stat(optimizedPath)).size;
  console.log(`${sourceName}: ${sourceSize} → ${optimizedSize} bytes`);
}
