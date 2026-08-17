import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { getStorefrontNavigationForPath } from "../src/components/site/storefront-navigation.ts";

const repoRoot = path.join(import.meta.dirname, "..");

function readSource(...segments: string[]): Promise<string> {
  return readFile(path.join(repoRoot, ...segments), "utf8");
}

test("news owns a first-class storefront navigation target", () => {
  const navigation = getStorefrontNavigationForPath("/tin-tuc/bai-viet/");
  assert.equal(navigation?.key, "news");
  assert.equal(navigation?.menuItemId, "menu-item-1541");
});

test("news archive reads only the canonical D1 News model", async () => {
  const source = await readSource("src", "app", "(storefront)", "tin-tuc", "page.tsx");
  assert.match(source, /getNewsList/);
  assert.match(source, /activeNavigation="news"/);
  assert.match(source, /dynamic = "force-dynamic"/);
  assert.doesNotMatch(source, /tin-tuc\.json|CapturedPage/);
});

test("news detail is dynamic, 404-safe and loads related published articles", async () => {
  const source = await readSource("src", "app", "(storefront)", "tin-tuc", "[slug]", "page.tsx");
  assert.match(source, /getNewsArticle/);
  assert.match(source, /getRelatedNews/);
  assert.match(source, /notFound\(\)/);
  assert.match(source, /activeNavigation="news"/);
  assert.match(source, /dynamic = "force-dynamic"/);
  assert.doesNotMatch(source, /dangerouslySetInnerHTML|tin-tuc\.json/);
});

test("news cards route through the CMS slug and never invent a legacy article path", async () => {
  const source = await readSource("src", "components", "news", "NewsCard.tsx");
  assert.match(source, /`\/tin-tuc\/\$\{article\.slug\}\//);
  assert.match(source, /article\.thumbnailUrl/);
  assert.doesNotMatch(source, /src\/data\/pages|manifest\.json/);
});
