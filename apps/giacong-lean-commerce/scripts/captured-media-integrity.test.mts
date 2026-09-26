import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import sharp from "sharp";

import { normalizeCapturedMarkup } from "../src/lib/captured-markup.ts";

const manifest = JSON.parse(
  await readFile(new URL("../src/data/pages/manifest.json", import.meta.url), "utf8"),
) as Record<string, string>;
const mediaRoot = fileURLToPath(new URL("../public/", import.meta.url));

async function packagedMediaPaths(directory = mediaRoot, prefix = ""): Promise<Set<string>> {
  const paths = new Set<string>();
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      for (const nested of await packagedMediaPaths(join(directory, entry.name), relative)) {
        paths.add(nested);
      }
    } else {
      paths.add(relative);
    }
  }
  return paths;
}

function capturedWordPressImageSources(markup: string): Set<string> {
  const sources = new Set<string>();
  for (const [source] of markup.matchAll(/https?:\/\/(?:www\.)?giacong\.vn\/wp-content\/uploads\/[^"'\\\s)]+/gi)) {
    if (/\.(?:avif|gif|jpe?g|png|webp)(?:[?#]|$)/i.test(source)) {
      sources.add(source.replace(/&amp;/gi, "&"));
    }
  }
  return sources;
}

test("captured WordPress images resolve to real packaged media on all legacy routes", async () => {
  const sourceUrls = new Set<string>();
  const localMediaPaths = await packagedMediaPaths();

  for (const [route, filename] of Object.entries(manifest)) {
    const page = JSON.parse(
      await readFile(new URL(`../src/data/pages/${filename}`, import.meta.url), "utf8"),
    ) as { markup?: string };
    for (const source of capturedWordPressImageSources(page.markup ?? "")) {
      sourceUrls.add(source);
      const normalized = normalizeCapturedMarkup(`<img src="${source}">`);
      const localSource = normalized.match(/\bsrc=["']([^"']+)["']/i)?.[1];

      assert.ok(localSource, `route ${route} lost image source ${source}`);
      assert.doesNotMatch(
        localSource,
        /^\/images\/captured-asset-placeholder\.svg$/,
        `route ${route} falls back to a placeholder for ${source}`,
      );
      assert.match(localSource, /^\/images\//, `route ${route} has a non-local image ${source}`);
      assert.ok(
        localMediaPaths.has(localSource),
        `route ${route} points to missing or incorrectly-cased media ${localSource}`,
      );
    }
  }

  assert.ok(sourceUrls.size > 0, "the legacy route manifest should contain captured images");
});

test("all packaged captured raster media is non-empty and decodes as an image", async () => {
  const capturedMediaRoot = join(mediaRoot, "images", "captured-legacy", "source");
  const mediaFiles = Array.from(await packagedMediaPaths(capturedMediaRoot))
    .filter((path) => /\.(?:avif|gif|jpe?g|png|webp)$/i.test(path));

  assert.ok(mediaFiles.length > 0, "captured media should include real raster images");

  for (const relativePath of mediaFiles) {
    const absolutePath = join(capturedMediaRoot, relativePath);
    const metadata = await sharp(absolutePath).metadata();
    assert.ok(metadata.width && metadata.height, `image dimensions are missing for ${relativePath}`);
  }
});
