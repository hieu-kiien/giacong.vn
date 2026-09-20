import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sources = await Promise.all([
  readFile(new URL("../src/lib/site-settings.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/site-pages.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/site-navigation.ts", import.meta.url), "utf8"),
]);

test("published storefront readers combine request and cross-request caching", () => {
  const readers = [
    [sources[0], "getPublishedSiteSettings", "published-site-settings"],
    [sources[1], "getPublishedSitePage", "published-site-page"],
    [sources[2], "getPublishedSiteNavigation", "published-site-navigation"],
  ];

  for (const [source, reader, cacheKey] of readers) {
    assert.match(source, /import\s*{\s*cache\s*}\s*from\s*["']react["']/);
    assert.match(source, /import\s*{\s*unstable_cache\s*}\s*from\s*["']next\/cache\.js["']/);
    assert.match(
      source,
      new RegExp(`export const ${reader} = cache\\(`),
      `${reader} must keep request-scoped memoization at its public boundary`,
    );
    assert.ok(source.includes(`["${cacheKey}"]`), `${reader} must use a stable durable cache key`);
    assert.match(source, /{ revalidate: 60 }/);
  }
});

test("published reader fallbacks stay outside the durable cache", () => {
  assert.match(sources[0], /return await readPublishedSiteSettings\(\);[\s\S]*?catch \(error\)[\s\S]*?siteSettingDefaults/);
  assert.match(sources[1], /return await readPublishedSitePage\(normalizedPath\);[\s\S]*?catch \(error\)[\s\S]*?return null/);
  assert.match(sources[2], /return await readPublishedSiteNavigation\(\);[\s\S]*?catch \(error\)[\s\S]*?defaultPrimaryNavigation/);
});
