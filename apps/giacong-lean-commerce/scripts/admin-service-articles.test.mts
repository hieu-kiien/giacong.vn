import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildServiceArticlePageSeed } from "../src/lib/admin-service-articles.ts";

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
  assert.match(builder, /Bắt đầu viết bài/);
  assert.match(builder, /Nội dung bài viết/);
  assert.match(builder, /Bài dịch vụ đã gỡ khỏi nhóm vẫn ở đây để sửa, ẩn hoặc đăng lại/);
  assert.match(builder, /Bỏ chọn, lưu bản nháp rồi bấm “Ẩn bài khỏi website”/);
  assert.match(builder, /mode === "service-article" && draftEnabled && blocks\.length === 0/);
  assert.match(builder, /!draftEnabled && selectedPage\.publishedEnabled[\s\S]*?"Ẩn bài khỏi website"/);
  assert.match(builder, /draftEnabled && selectedPage\.publishedEnabled[\s\S]*?"Cập nhật bài trên website"/);
});
