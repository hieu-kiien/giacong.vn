import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const origin = requiredEnv("STAGING_ORIGIN").replace(/\/$/, "");
const database = process.env.STAGING_DATABASE?.trim() || "giacong-vn-catalog-staging";
const accessHeaders = {
  "CF-Access-Client-Id": requiredEnv("CLOUDFLARE_ACCESS_CLIENT_ID"),
  "CF-Access-Client-Secret": requiredEnv("CLOUDFLARE_ACCESS_CLIENT_SECRET"),
};

console.log(`News staging QA target: ${origin}`);
const snapshot = readNewsSnapshot();
verifyNewsSchema(snapshot);
await verifyPublicNews(snapshot);
await verifyNewsResponsiveBrowser();
console.log("News staging QA passed.");

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for News staging QA.`);
  return value;
}

function readNewsSnapshot() {
  const command = `
    PRAGMA table_info(article_categories);
    PRAGMA table_info(articles);

    SELECT COUNT(*) AS total
    FROM article_categories;

    SELECT a.slug, a.title, c.slug AS category_slug
    FROM articles a
    LEFT JOIN article_categories c ON c.id = a.category_id
    WHERE a.archived_at IS NULL
      AND a.status = 'published'
      AND a.published_at IS NOT NULL
      AND a.published_at <= CURRENT_TIMESTAMP
    ORDER BY a.is_featured DESC, a.published_at DESC, a.id DESC
    LIMIT 1;

    SELECT slug
    FROM articles
    WHERE archived_at IS NULL
      AND status = 'published'
      AND published_at IS NOT NULL
      AND published_at > CURRENT_TIMESTAMP
    ORDER BY published_at ASC, id ASC
    LIMIT 1;

    SELECT slug
    FROM articles
    WHERE archived_at IS NOT NULL
    ORDER BY archived_at DESC, id DESC
    LIMIT 1;

    PRAGMA table_info(news_media_assets);
  `;

  const output = execFileSync(
    "npx",
    [
      "--yes",
      "wrangler@4.115.0",
      "d1",
      "execute",
      database,
      "--remote",
      "--json",
      `--command=${command}`,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
  const payload = JSON.parse(output);
  assert.ok(Array.isArray(payload) && payload.length >= 7, "News D1 snapshot returned an unexpected shape");
  return payload;
}

function verifyNewsSchema(snapshot) {
  const categoryColumns = snapshot[0]?.results ?? [];
  const articleColumns = snapshot[1]?.results ?? [];
  const categoryCount = Number(snapshot[2]?.results?.[0]?.total ?? 0);
  const mediaColumns = snapshot[6]?.results ?? [];

  assert.ok(categoryColumns.some((column) => column.name === "revision"), "article_categories.revision migration is missing on staging");
  assert.ok(categoryColumns.some((column) => column.name === "sort_order"), "article_categories.sort_order is missing on staging");
  assert.ok(articleColumns.some((column) => column.name === "archived_at"), "articles.archived_at migration is missing on staging");
  assert.ok(articleColumns.some((column) => column.name === "revision"), "articles.revision is missing on staging");
  assert.ok(mediaColumns.some((column) => column.name === "article_id"), "news_media_assets.article_id migration is missing on staging");
  assert.ok(mediaColumns.some((column) => column.name === "storage_key"), "news_media_assets.storage_key migration is missing on staging");
  assert.ok(categoryCount >= 1, "News staging must contain at least the seeded category");
  console.log(`News D1 schema passed with ${categoryCount} categories and News media storage.`);
}

async function verifyPublicNews(snapshot) {
  const archive = await fetchResponse("/tin-tuc");
  assert.equal(archive.status, 200, `/tin-tuc returned HTTP ${archive.status}`);
  const archiveHtml = await archive.text();
  assert.match(archiveHtml, /Tin tức/i, "News archive did not render its heading");

  const publicArticle = snapshot[3]?.results?.[0] ?? null;
  if (publicArticle?.slug) {
    const detail = await fetchResponse(`/tin-tuc/${encodeURIComponent(publicArticle.slug)}`);
    assert.equal(detail.status, 200, `public News detail ${publicArticle.slug} returned HTTP ${detail.status}`);
    const detailHtml = await detail.text();
    assert.ok(detailHtml.includes(publicArticle.title), `public News detail is missing title: ${publicArticle.title}`);

    if (publicArticle.category_slug) {
      const filtered = await fetchResponse("/tin-tuc", { query: { category: publicArticle.category_slug } });
      assert.equal(filtered.status, 200, "News category filter did not return HTTP 200");
      assert.ok((await filtered.text()).includes(publicArticle.title), "News category filter hid its canonical public article");
    }
  } else {
    assert.match(archiveHtml, /Chưa có bài viết đã xuất bản|Chưa tìm thấy bài viết phù hợp/i, "empty News archive did not expose an empty state");
    console.log("No currently public News article exists; archive empty-state path verified.");
  }

  const missing = await fetchResponse("/tin-tuc/qa-news-khong-ton-tai");
  assert.equal(missing.status, 404, "missing News detail must return 404");

  const futureArticle = snapshot[4]?.results?.[0] ?? null;
  if (futureArticle?.slug) {
    const future = await fetchResponse(`/tin-tuc/${encodeURIComponent(futureArticle.slug)}`);
    assert.equal(future.status, 404, "future scheduled News article leaked before publish time");
  }

  const archivedArticle = snapshot[5]?.results?.[0] ?? null;
  if (archivedArticle?.slug) {
    const archived = await fetchResponse(`/tin-tuc/${encodeURIComponent(archivedArticle.slug)}`);
    assert.equal(archived.status, 404, "archived News article leaked through the public detail route");
  }

  console.log("Public News archive/detail visibility checks passed.");
}

async function verifyNewsResponsiveBrowser() {
  const viewports = [
    { name: "mobile", width: 390, height: 844 },
    { name: "desktop", width: 1440, height: 900 },
  ];
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({
        extraHTTPHeaders: accessHeaders,
        viewport,
      });
      try {
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
        page.on("console", (message) => {
          if (message.type() === "error") errors.push(`console: ${message.text()}`);
        });
        const response = await page.goto(`${origin}/tin-tuc`, { waitUntil: "networkidle", timeout: 30000 });
        assert.ok(response && response.status() < 400, `${viewport.name} /tin-tuc: HTTP ${response?.status() ?? "no response"}`);
        const dimensions = await page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        }));
        assert.ok(dimensions.scrollWidth <= dimensions.clientWidth + 1, `${viewport.name} /tin-tuc: horizontal overflow ${dimensions.scrollWidth} > ${dimensions.clientWidth}`);
        assert.deepEqual(errors, [], `${viewport.name} /tin-tuc: browser errors`);
        console.log(`${viewport.name} /tin-tuc: HTTP ${response.status()}, width ${dimensions.clientWidth}/${dimensions.scrollWidth}`);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}

async function fetchResponse(pathname, options = {}) {
  const url = new URL(pathname, `${origin}/`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    url.searchParams.set(key, value);
  }
  const headers = new Headers(options.headers ?? {});
  for (const [key, value] of Object.entries(accessHeaders)) headers.set(key, value);
  return fetch(url, {
    ...options,
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(25000),
  });
}
