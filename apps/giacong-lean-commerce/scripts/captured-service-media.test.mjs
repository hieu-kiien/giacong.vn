import assert from "node:assert/strict";
import { join } from "node:path";
import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import sharp from "sharp";

import { normalizeCapturedMarkup } from "../src/lib/captured-markup.ts";

const mediaRoot = fileURLToPath(new URL("../public/images/captured-legacy/source/", import.meta.url));
const optimizedImages = [
  ["gia-cong-da-vien.png", "gia-cong-da-vien-optimized.webp"],
  ["dich-vu-gia-cong-say-thang-hoa-hoa-tan-85287.png", "dich-vu-gia-cong-say-thang-hoa-hoa-tan-85287-optimized.webp"],
  ["gia-cong-kem-ly.webp", "gia-cong-kem-ly-optimized.webp"],
  ["gia-cong-nuoc-bo-sung-khoang-chat-cho-the-thao.webp", "gia-cong-nuoc-bo-sung-khoang-chat-cho-the-thao-optimized.webp"],
  ["gia-cong-nuoc-vitamin-tong-hopn.jpg", "gia-cong-nuoc-vitamin-tong-hopn-optimized.webp"],
];

test("heavy beverage-service images resolve to optimized local WebP assets", async () => {
  for (const [legacyName, optimizedName] of optimizedImages) {
    const normalized = normalizeCapturedMarkup(`<img src="https://giacong.vn/wp-content/uploads/${legacyName}">`);
    const localSource = normalized.match(/\bsrc=["']([^"']+)["']/i)?.[1];

    assert.equal(localSource, `/images/captured-legacy/source/${optimizedName}`, legacyName);
    const assetPath = join(mediaRoot, optimizedName);
    const imageStat = await stat(assetPath);
    const metadata = await sharp(assetPath).metadata();
    assert.ok(imageStat.size > 0, `${optimizedName} should not be empty`);
    assert.equal(metadata.format, "webp", `${optimizedName} should be WebP`);
  }
});

test("the beverage overview hero uses a topic-matched, claim-free generated image", async () => {
  const normalized = normalizeCapturedMarkup(
    '<img src="https://giacong.vn/wp-content/uploads/dich-vu-gia-cong-do-uong.webp">',
  );
  const localSource = normalized.match(/\bsrc=["']([^"']+)["']/i)?.[1];

  assert.equal(localSource, "/images/captured-legacy/source/gia-cong-do-uong-ai.webp");
  const assetPath = join(mediaRoot, "gia-cong-do-uong-ai.webp");
  const imageStat = await stat(assetPath);
  const metadata = await sharp(assetPath).metadata();
  assert.ok(imageStat.size > 0, "generated beverage hero should not be empty");
  assert.equal(metadata.format, "webp", "generated beverage hero should be WebP");
});
