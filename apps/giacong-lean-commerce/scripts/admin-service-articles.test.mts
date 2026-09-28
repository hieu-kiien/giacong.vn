import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildServiceArticlePageSeed } from "../src/lib/admin-service-articles.ts";
import { isSuppressedServiceArticleFallback } from "../src/lib/site-pages.ts";
import { extractLegacyArticle } from "./legacy-article-import.mjs";
import { serviceFamilies } from "../src/data/service-families.ts";
import { parsePageBlocks, type PageBlock } from "../src/lib/page-builder.ts";

test("unpublishing a live service article suppresses the captured fallback for its route", () => {
  assert.equal(isSuppressedServiceArticleFallback("service-do-uong-nuoc-ep", false, "2026-09-28T00:00:00Z"), true);
  assert.equal(isSuppressedServiceArticleFallback("service-do-uong-nuoc-ep", true, "2026-09-28T00:00:00Z"), false);
  assert.equal(isSuppressedServiceArticleFallback("service-do-uong-nuoc-ep", false, null), false);
  assert.equal(isSuppressedServiceArticleFallback("gioi-thieu", false, "2026-09-28T00:00:00Z"), false);
});

test("service article identity follows its service offering and keeps the public route", () => {
  assert.deepEqual(buildServiceArticlePageSeed({
    articleTitle: "Gia công nước ép trái cây",
    articleRoute: "/gia-cong-nuoc-ep-trai-cay/",
    serviceSlug: "gia-cong-do-uong",
  }), {
    pageKey: "service-gia-cong-do-uong-gia-cong-nuoc-ep-trai-cay",
    routePath: "/gia-cong-nuoc-ep-trai-cay/",
    title: "Gia công nước ép trái cây",
  });
});

test("service article identity rejects external, traversing, or ambiguous routes", () => {
  for (const articleRoute of [
    "https://example.com/article",
    "//example.com/article",
    "/../admin",
    "/dich-vu?draft=true",
    "/dich-vu#section",
  ]) {
    assert.equal(buildServiceArticlePageSeed({
      articleTitle: "Bài dịch vụ",
      articleRoute,
      serviceSlug: "gia-cong-do-uong",
    }), null);
  }
});

test("service articles open inline from the service offering and do not require another admin page", async () => {
  const [services, builder] = await Promise.all([
    readFile(new URL("../src/app/admin/dich-vu/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/admin/AdminPageBuilder.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(services, /Bài viết cho từng dịch vụ con/);
  assert.match(services, /Viết \/ sửa bài/);
  assert.match(services, /chỉ gỡ hạng mục khỏi nhóm; bài đã đăng vẫn còn/);
  assert.match(services, /Trang & bố cục/);
  assert.match(services, /articleContext=\{inlineArticle\}/);
  assert.match(services, /admin-service-article-inline-slot/);
  assert.match(services, /onClose=\{\(\) => requestArticleSelection\(inlineArticle\)\}/);
  assert.doesNotMatch(services, /\/admin\/dich-vu\/bai-viet/);
  assert.match(builder, /embedded/);
  assert.match(builder, /Tạo bản nháp và nhập bài cũ/);
  assert.match(builder, /Nội dung bài viết/);
  assert.match(builder, /Bài dịch vụ đã gỡ khỏi nhóm vẫn ở đây để sửa, ẩn hoặc đăng lại/);
  assert.match(builder, /Bỏ chọn, lưu bản nháp rồi bấm “Ẩn bài khỏi website”/);
  assert.match(builder, /mode === "service-article" && draftEnabled && blocks\.length === 0/);
  assert.match(builder, /!draftEnabled && selectedPage\.publishedEnabled[\s\S]*?"Ẩn bài khỏi website"/);
  assert.match(builder, /draftEnabled && selectedPage\.publishedEnabled[\s\S]*?"Cập nhật bài trên website"/);
});

test("legacy service articles import into a draft without changing the published article", async () => {
  const [builder, assets] = await Promise.all([
    readFile(new URL("../src/components/admin/AdminPageBuilder.tsx", import.meta.url), "utf8"),
    readFile(new URL("./prepare-captured-assets.mjs", import.meta.url), "utf8"),
  ]);

  assert.match(builder, /Tạo bản nháp và nhập bài cũ/);
  assert.match(builder, /service-article-legacy-import/);
  assert.match(builder, /editable-articles/);
  assert.match(builder, /validateBlocks\(legacy\.blocks\)/);
  assert.match(builder, /Bài trên website chưa thay đổi/);
  assert.match(builder, /!selectedPage\.publishedEnabled[\s\S]*?selectedPage\.publishedBlocks\.length === 0/);
  assert.match(assets, /extractLegacyArticle\(source\)/);
  assert.match(assets, /editable-articles/);
  assert.match(assets, /vượt quá giới hạn|manual handling/);
});

test("legacy article import keeps editable text, headings, images, and captions while dropping page chrome", () => {
  const article = extractLegacyArticle({
    description: "Mô tả SEO cũ.",
    markup: `
      <nav>Không nhập menu</nav>
      <aside>Không nhập sidebar</aside>
      <main class="entry-content">
        <p>Đoạn giới thiệu bài viết.</p>
        <figure><img src="https://giacong.vn/media/san-pham.jpg" alt="Sản phẩm"><figcaption>Ảnh minh họa sản phẩm</figcaption></figure>
        <div class="ftwp-in-post">Không nhập mục lục</div>
        <h2>Quy trình gia công</h2>
        <p>Khách hàng gửi yêu cầu qua <a href="https://example.com">biểu mẫu tư vấn</a>.</p>
        <script>Không nhập mã script</script>
      </main>`,
    title: "Dịch vụ gia công",
  }) as { blocks: PageBlock[]; seoDescription: string; seoTitle: string } | null;

  assert.ok(article);
  assert.equal(article.seoTitle, "Dịch vụ gia công");
  assert.equal(article.seoDescription, "Mô tả SEO cũ.");
  assert.deepEqual(article.blocks[0], {
    type: "hero",
    eyebrow: "",
    title: "Dịch vụ gia công",
    description: "Đoạn giới thiệu bài viết.",
    imageUrl: null,
    primaryCta: null,
    secondaryCta: null,
  });
  assert.ok(article.blocks.some((block) => block.type === "image" && block.caption === "Ảnh minh họa sản phẩm"));
  assert.ok(article.blocks.some((block) => block.type === "rich_text" && block.title === "Quy trình gia công" && block.body.includes("biểu mẫu tư vấn")));
  assert.doesNotMatch(JSON.stringify(article), /Không nhập (menu|sidebar|mục lục|mã script)/);
  assert.doesNotMatch(JSON.stringify(article), /https:\/\/example\.com/);
});

test("legacy article import refuses to silently truncate articles beyond page-builder limits", () => {
  assert.throws(
    () => extractLegacyArticle({
      description: "",
      markup: `<article class="entry-content"><p>${"x".repeat(50_000)}</p></article>`,
      title: "Bài quá dài",
    }),
    /vượt quá giới hạn|quá dài|không thể nhập đầy đủ/i,
  );
});

test("every configured service offering with a captured route can be imported into page-builder blocks", async () => {
  const manifest = JSON.parse(await readFile(new URL("../src/data/pages/manifest.json", import.meta.url), "utf8")) as Record<string, string>;
  const routes = [...new Set(serviceFamilies.flatMap((family) => family.offerings.map((offering) => offering.href)))];

  for (const route of routes) {
    const filename = manifest[route];
    assert.ok(filename, `Missing captured page for ${route}`);
    const source = JSON.parse(await readFile(new URL(`../src/data/pages/${filename}`, import.meta.url), "utf8")) as Parameters<typeof extractLegacyArticle>[0];
    const imported = extractLegacyArticle(source);
    assert.ok(imported, `Could not import legacy service article at ${route}`);
    assert.doesNotThrow(() => parsePageBlocks(imported.blocks), `Imported blocks are invalid for ${route}`);
  }
});
