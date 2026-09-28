import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  isSafeNewsArticleUrl,
  parseNewsArticleBlocks,
  serializeNewsArticleBlocks,
  type NewsArticleBlock,
} from "../src/lib/news-article-content.ts";

test("legacy plain-text news content keeps its paragraph spacing", () => {
  const legacy = "Mở đầu bài viết.\n\nĐoạn tiếp theo.";
  assert.deepEqual(parseNewsArticleBlocks(legacy), [{ type: "paragraph", text: legacy }]);
  assert.equal(serializeNewsArticleBlocks(parseNewsArticleBlocks(legacy)), legacy);
  assert.deepEqual(parseNewsArticleBlocks(""), []);
});

test("long legacy articles keep their body as one lossless editable block", () => {
  const legacy = Array.from({ length: 120 }, (_, index) => `Đoạn văn ${index + 1}`).join("\n\n");
  const blocks = parseNewsArticleBlocks(legacy);

  assert.deepEqual(blocks, [{ type: "paragraph", text: legacy }]);
  assert.equal(serializeNewsArticleBlocks(blocks), legacy);
});

test("legacy text that resembles the internal marker is preserved when it is not a valid payload", () => {
  const legacy = "GIACONG_NEWS_BLOCKS_V1\nThis is literal article content, not JSON.";
  const blocks: NewsArticleBlock[] = [{ type: "paragraph", text: legacy }];
  const serialized = serializeNewsArticleBlocks(blocks);

  assert.deepEqual(parseNewsArticleBlocks(legacy), blocks);
  assert.notEqual(serialized, legacy);
  assert.deepEqual(parseNewsArticleBlocks(serialized), blocks);
});

test("a literal article paragraph beginning with a valid marker is escaped when saved", () => {
  const literal = `GIACONG_NEWS_BLOCKS_V1\n${JSON.stringify({
    version: 1,
    blocks: [{ type: "paragraph", text: "This JSON is literal article prose." }],
  })}`;
  const block: NewsArticleBlock[] = [{ type: "paragraph", text: literal }];

  assert.deepEqual(parseNewsArticleBlocks(serializeNewsArticleBlocks(block)), block);
});

test("structured news blocks round-trip through the existing content field", () => {
  const blocks: NewsArticleBlock[] = [
    { type: "heading", text: "Tiêu đề chính" },
    { type: "subheading", text: "Tiêu đề phụ" },
    { type: "paragraph", text: "Mô tả nội dung." },
    { type: "list", ordered: false, items: ["Bước một", "Bước hai"] },
    { type: "quote", text: "Trích dẫn." },
    { type: "image", url: "/media/article.jpg", alt: "Sản phẩm", caption: "Ảnh minh họa" },
    { type: "link", url: "/lien-he/", label: "Liên hệ" },
  ];

  assert.deepEqual(parseNewsArticleBlocks(serializeNewsArticleBlocks(blocks)), blocks);
});

test("article links and images reject executable or protocol-relative URLs", () => {
  assert.equal(isSafeNewsArticleUrl("https://example.com/article"), true);
  assert.equal(isSafeNewsArticleUrl("/tin-tuc/bai-viet/"), true);
  assert.equal(isSafeNewsArticleUrl("/media/article.webp", true), true);
  assert.equal(isSafeNewsArticleUrl("javascript:alert(1)"), false);
  assert.equal(isSafeNewsArticleUrl("//example.com/image.jpg", true), false);
  assert.equal(isSafeNewsArticleUrl("/other-site/image.jpg", true), false);
});

test("news admin editors and the public article route share the structured content format", async () => {
  const [editor, admin, contextual, storefront] = await Promise.all([
    readFile(new URL("../src/components/admin/AdminNewsContentEditor.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/admin/tin-tuc/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/admin/AdminNewsContextualAction.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/(storefront)/tin-tuc/[slug]/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(editor, /Xem trước bài viết/);
  assert.match(editor, /Ảnh \+ chú thích/);
  assert.match(editor, /serializeNewsArticleBlocks/);
  assert.match(admin, /<AdminNewsContentEditor/);
  assert.match(contextual, /<AdminNewsContentEditor/);
  assert.match(storefront, /<NewsArticleBody content=\{post\.content\}/);
});
