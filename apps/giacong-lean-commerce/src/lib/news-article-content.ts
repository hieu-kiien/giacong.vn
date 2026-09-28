const NEWS_BLOCKS_PREFIX = "GIACONG_NEWS_BLOCKS_V1\n";

export type NewsArticleBlock =
  | { type: "paragraph" | "heading" | "subheading" | "quote"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "image"; url: string; alt: string; caption: string }
  | { type: "link"; url: string; label: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseStructuredBlocks(content: string): NewsArticleBlock[] | null {
  try {
    const value: unknown = JSON.parse(content.slice(NEWS_BLOCKS_PREFIX.length));
    if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.blocks) || value.blocks.length > 80) return null;

    const blocks: NewsArticleBlock[] = [];
    for (const item of value.blocks) {
      if (!isRecord(item) || typeof item.type !== "string") return null;
      switch (item.type) {
        case "paragraph":
        case "heading":
        case "subheading":
        case "quote":
          if (typeof item.text !== "string") return null;
          blocks.push({ type: item.type, text: item.text });
          break;
        case "list":
          if (typeof item.ordered !== "boolean" || !Array.isArray(item.items) || !item.items.every((entry) => typeof entry === "string")) return null;
          blocks.push({ type: "list", ordered: item.ordered, items: item.items });
          break;
        case "image":
          if (typeof item.url !== "string" || typeof item.alt !== "string" || typeof item.caption !== "string") return null;
          blocks.push({ type: "image", url: item.url, alt: item.alt, caption: item.caption });
          break;
        case "link":
          if (typeof item.url !== "string" || typeof item.label !== "string") return null;
          blocks.push({ type: "link", url: item.url, label: item.label });
          break;
        default:
          return null;
      }
    }
    return blocks;
  } catch {
    return null;
  }
}

export function parseNewsArticleBlocks(content: string): NewsArticleBlock[] {
  if (content.startsWith(NEWS_BLOCKS_PREFIX)) {
    const structuredBlocks = parseStructuredBlocks(content);
    if (structuredBlocks) return structuredBlocks;
  }
  if (!content.trim()) return [];
  return [{ type: "paragraph", text: content }];
}

export function serializeNewsArticleBlocks(blocks: NewsArticleBlock[]): string {
  if (blocks.length === 1 && blocks[0]?.type === "paragraph" && !blocks[0].text.startsWith(NEWS_BLOCKS_PREFIX)) {
    return blocks[0].text;
  }
  return `${NEWS_BLOCKS_PREFIX}${JSON.stringify({ version: 1, blocks })}`;
}

export function isSafeNewsArticleUrl(value: string, image = false): boolean {
  const urlValue = value.trim();
  if (!urlValue || /[\u0000-\u0020<>"'\\]/.test(urlValue) || urlValue.startsWith("//")) return false;
  if (urlValue.startsWith("/")) return image ? urlValue.startsWith("/media/") : true;
  try {
    const url = new URL(urlValue);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
