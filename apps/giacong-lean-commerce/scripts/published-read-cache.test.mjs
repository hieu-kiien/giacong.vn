import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sources = await Promise.all([
  readFile(new URL("../src/lib/site-settings.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/site-pages.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/site-navigation.ts", import.meta.url), "utf8"),
]);

test("published storefront readers use one request-scoped cache per reader", () => {
  const readers = [
    [sources[0], "getPublishedSiteSettings"],
    [sources[1], "getPublishedSitePage"],
    [sources[2], "getPublishedSiteNavigation"],
  ];

  for (const [source, reader] of readers) {
    assert.match(source, /import\s*{\s*cache\s*}\s*from\s*["']react["']/);
    assert.match(
      source,
      new RegExp(`export const ${reader} = cache\\(`),
      `${reader} must be memoized at its public boundary`,
    );
  }
});
