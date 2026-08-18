import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("staging deep QA executes the dedicated News regression suite", async () => {
  const workflow = await source("../../.github/workflows/cloudflare-staging-deep-qa.yml");
  assert.match(workflow, /Run News staging regression QA/);
  assert.match(workflow, /node scripts\/staging-news-qa\.mjs/);
});

test("News staging QA verifies migrations before exercising runtime", async () => {
  const qa = await source("scripts/staging-news-qa.mjs");
  assert.match(qa, /PRAGMA table_info\(article_categories\)/);
  assert.match(qa, /column\.name === "revision"/);
  assert.match(qa, /PRAGMA table_info\(articles\)/);
  assert.match(qa, /column\.name === "archived_at"/);
  assert.match(qa, /STAGING_DATABASE/);
});

test("News staging QA mirrors canonical public visibility rules", async () => {
  const qa = await source("scripts/staging-news-qa.mjs");
  assert.match(qa, /a\.archived_at IS NULL/);
  assert.match(qa, /a\.status = 'published'/);
  assert.match(qa, /a\.published_at <= CURRENT_TIMESTAMP/);
  assert.match(qa, /published_at > CURRENT_TIMESTAMP/);
  assert.match(qa, /archived_at IS NOT NULL/);
  assert.match(qa, /missing News detail must return 404/);
  assert.match(qa, /future scheduled News article leaked before publish time/);
  assert.match(qa, /archived News article leaked through the public detail route/);
});

test("News staging QA covers archive rendering, category filtering and responsive overflow", async () => {
  const qa = await source("scripts/staging-news-qa.mjs");
  assert.match(qa, /fetchResponse\("\/tin-tuc"\)/);
  assert.match(qa, /query: \{ category: publicArticle\.category_slug \}/);
  assert.match(qa, /width: 390, height: 844/);
  assert.match(qa, /width: 1440, height: 900/);
  assert.match(qa, /horizontal overflow/);
  assert.match(qa, /browser errors/);
});
