import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { parse } = require("next/dist/compiled/node-html-parser");

const maxBlocks = 40;
const maxPageJsonBytes = 48_000;
const maxRichTextLength = 8_000;
const maxTitleLength = 240;
const maxSeoDescriptionLength = 1_000;
const skippedTags = new Set(["ASIDE", "BUTTON", "FOOTER", "FORM", "IFRAME", "NAV", "NOSCRIPT", "SCRIPT", "STYLE", "SVG"]);
const skippedClasses = new Set(["ftwp-in-post", "ez-toc-container", "ez-toc-v2", "jp-relatedposts", "nav-pagination", "post-item", "sharedaddy"]);

export function extractLegacyArticle({ description = "", markup = "", title = "" }) {
  if (typeof markup !== "string" || !markup.trim()) return null;

  const document = parse(markup);
  const article = document.querySelector("#ftwp-postcontent")
    ?? document.querySelector(".entry-content")
    ?? document.querySelector("article")
    ?? document.querySelector("main");
  if (!article) return null;

  const items = [];
  visitChildren(article.childNodes ?? [], items);
  if (items.length === 0) return null;

  const pageTitle = plainText(title) || items.find((item) => item.kind === "heading")?.text || "Bài viết dịch vụ";
  if (items[0]?.kind === "heading" && items[0].text.toLocaleLowerCase() === pageTitle.toLocaleLowerCase()) items.shift();
  const seoTitle = pageTitle;
  if (seoTitle.length > maxTitleLength) throw new Error("Tiêu đề bài cũ vượt quá giới hạn 240 ký tự.");
  const seoDescription = plainText(description).slice(0, maxSeoDescriptionLength);

  const firstLeadIndex = items.findIndex((item) => item.kind === "text");
  const firstLead = firstLeadIndex === 0 ? items[firstLeadIndex] : null;
  const heroDescription = firstLead && firstLead.text.length <= 2_400
    ? firstLead.text
    : seoDescription || items.find((item) => item.kind === "text" && item.text.length <= 2_400)?.text || "Nội dung chi tiết được trình bày bên dưới.";

  const blocks = [{
    type: "hero",
    eyebrow: "",
    title: pageTitle,
    description: heroDescription,
    imageUrl: null,
    primaryCta: null,
    secondaryCta: null,
  }];
  if (firstLead && firstLead.text === heroDescription) items.shift();

  let sectionTitle = "";
  let paragraphs = [];
  const flushText = () => {
    if (paragraphs.length === 0) return;
    for (const body of packParagraphs(paragraphs)) {
      blocks.push({ type: "rich_text", title: sectionTitle, body });
      sectionTitle = "";
    }
    paragraphs = [];
  };

  for (const item of items) {
    if (item.kind === "heading") {
      flushText();
      sectionTitle = item.text;
    } else if (item.kind === "text") {
      paragraphs.push(item.text);
    } else if (item.kind === "image") {
      flushText();
      blocks.push(item.block);
    }
  }
  flushText();

  if (blocks.length > maxBlocks) throw new Error(`Bài cũ cần hơn ${maxBlocks} khối để nhập đầy đủ.`);
  if (new TextEncoder().encode(JSON.stringify(blocks)).length > maxPageJsonBytes) {
    throw new Error("Bài cũ vượt quá giới hạn dung lượng của trình soạn; nội dung chưa bị cắt.");
  }

  return { blocks, seoDescription, seoTitle };
}

function visitChildren(nodes, items) {
  for (const node of nodes) {
    if (node.nodeType === 3) {
      const text = normalizeText(node.text ?? node.rawText ?? "");
      if (text) items.push({ kind: "text", text });
      continue;
    }

    const tag = node.tagName?.toUpperCase();
    if (!tag || shouldSkip(node, tag)) continue;
    if (tag === "FIGURE") {
      appendFigure(node, items);
    } else if (/^H[1-6]$/.test(tag)) {
      const text = plainNodeText(node);
      if (text) items.push({ kind: text.length <= maxTitleLength ? "heading" : "text", text });
    } else if (tag === "P") {
      appendImages(node, items);
      const text = plainNodeText(node);
      if (text) items.push({ kind: "text", text });
    } else if (tag === "IMG") {
      const block = imageBlock(node);
      if (block) items.push({ kind: "image", block });
    } else if (tag === "UL" || tag === "OL") {
      const rows = node.querySelectorAll("li").map((item, index) => {
        const text = plainNodeText(item);
        if (!text) return "";
        return tag === "OL" ? `${index + 1}. ${text}` : `• ${text}`;
      }).filter(Boolean);
      if (rows.length) items.push({ kind: "text", text: rows.join("\n") });
    } else if (tag === "TABLE") {
      const rows = node.querySelectorAll("tr").map((row) => row.querySelectorAll("th, td")
        .map((cell) => plainNodeText(cell)).filter(Boolean).join(" · ")).filter(Boolean);
      if (rows.length) items.push({ kind: "text", text: rows.join("\n") });
    } else {
      visitChildren(node.childNodes ?? [], items);
    }
  }
}

function appendFigure(figure, items) {
  const caption = normalizeText(figure.querySelector("figcaption")?.text ?? "");
  const images = figure.querySelectorAll("img");
  if (images.length === 0) {
    visitChildren(figure.childNodes ?? [], items);
    return;
  }
  images.forEach((image, index) => {
    const block = imageBlock(image, index === 0 ? caption : "");
    if (block) items.push({ kind: "image", block });
  });
}

function appendImages(node, items) {
  for (const image of node.querySelectorAll("img")) {
    const block = imageBlock(image);
    if (block) items.push({ kind: "image", block });
  }
}

function imageBlock(image, caption = "") {
  const imageUrl = image.getAttribute("src") || image.getAttribute("data-src") || image.getAttribute("data-lazy-src") || "";
  if (!isSafeImageUrl(imageUrl)) return null;
  const alt = normalizeText(image.getAttribute("alt") ?? image.getAttribute("title") ?? caption) || "Ảnh minh họa bài viết";
  if (alt.length > maxTitleLength) throw new Error("Mô tả ảnh bài cũ vượt quá giới hạn 240 ký tự.");
  const cleanCaption = normalizeText(caption);
  if (cleanCaption.length > 500) throw new Error("Chú thích ảnh bài cũ vượt quá giới hạn 500 ký tự.");
  return { type: "image", imageUrl, alt, caption: cleanCaption };
}

function plainNodeText(node) {
  return normalizeText(collectText(node));
}

function collectText(node) {
  if (node.nodeType === 3) return node.text ?? node.rawText ?? "";
  const tag = node.tagName?.toUpperCase();
  if (!tag || shouldSkip(node, tag) || tag === "IMG") return "";
  if (tag === "BR") return "\n";
  return (node.childNodes ?? []).map(collectText).join("");
}

function shouldSkip(node, tag) {
  if (skippedTags.has(tag)) return true;
  if (node.getAttribute?.("aria-hidden") === "true" || node.getAttribute?.("role") === "navigation") return true;
  const classes = (node.getAttribute?.("class") ?? "").split(/\s+/);
  return classes.some((className) => skippedClasses.has(className));
}

function normalizeText(value) {
  return String(value)
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b-\u200f\ufeff]/g, "")
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[<>]/g, (character) => character === "<" ? "‹" : "›")
    .trim();
}

function plainText(value) {
  return normalizeText(value);
}

function isSafeImageUrl(value) {
  const normalized = value.trim();
  if (!normalized || normalized.startsWith("//")) return false;
  if (normalized.startsWith("/")) return true;
  try {
    return ["http:", "https:"].includes(new URL(normalized).protocol);
  } catch {
    return false;
  }
}

function packParagraphs(paragraphs) {
  const blocks = [];
  let current = "";
  for (const paragraph of paragraphs) {
    for (const part of splitAtLength(paragraph, maxRichTextLength)) {
      const next = current ? `${current}\n\n${part}` : part;
      if (next.length > maxRichTextLength) {
        blocks.push(current);
        current = part;
      } else {
        current = next;
      }
    }
  }
  if (current) blocks.push(current);
  return blocks;
}

function splitAtLength(value, limit) {
  const parts = [];
  let rest = value;
  while (rest.length > limit) {
    let boundary = rest.lastIndexOf(" ", limit);
    if (boundary < limit * 0.6) boundary = limit;
    parts.push(rest.slice(0, boundary).trim());
    rest = rest.slice(boundary).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}
