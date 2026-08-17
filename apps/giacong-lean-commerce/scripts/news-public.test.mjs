import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("News is a first-class storefront navigation target using the captured News menu item", async () => {
  const [navigation, frame] = await Promise.all([
    source("src/components/site/storefront-navigation.ts"),
    source("src/components/CapturedNewsFrame.tsx"),
  ]);

  assert.match(navigation, /key:\s*"news"/);
  assert.match(navigation, /menuItemId:\s*"menu-item-1541"/);
  assert.match(navigation, /pathPrefix:\s*"\/tin-tuc"/);
  assert.match(frame, /"\/tin-tuc"/);
  assert.match(frame, /"Tin tức"/);
});

test("News archive is explicit, dynamic and reads canonical D1 News data", async () => {
  const route = await source("src/app/(storefront)/tin-tuc/page.tsx");

  assert.match(route, /export const dynamic = "force-dynamic"/);
  assert.match(route, /getNewsList/);
  assert.match(route, /CapturedNewsFrame activePath="\/tin-tuc" title="Tin tức"/);
  assert.match(route, /NewsArchive/);
  assert.doesNotMatch(route, /readFile|tin-tuc\.json|CapturedPage/);
});

test("News detail rejects unpublished or missing articles through the canonical reader", async () => {
  const route = await source("src/app/(storefront)/tin-tuc/[slug]/page.tsx");

  assert.match(route, /getNewsArticle/);
  assert.match(route, /getRelatedNews/);
  assert.match(route, /if \(!article\) notFound\(\)/);
  assert.match(route, /activeNavigation="news"/);
  assert.match(route, /openGraph/);
  assert.doesNotMatch(route, /readFile|tin-tuc\.json|dangerouslySetInnerHTML/);
});

test("News article body remains plain text and never becomes an HTML injection boundary", async () => {
  const articleView = await source("src/components/news/NewsArticleView.tsx");

  assert.match(articleView, /article\.contentText/);
  assert.match(articleView, /split\(\/\\n\\s\*\\n\/g\)/);
  assert.match(articleView, /whitespace-pre-line/);
  assert.doesNotMatch(articleView, /dangerouslySetInnerHTML|__html/);
});
