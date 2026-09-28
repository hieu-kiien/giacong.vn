export type SafeInlineTextSegment =
  | { type: "text"; text: string }
  | { type: "link"; text: string; href: string };

const inlineLinkPattern = /\[((?:\\.|[^\]])+)\]\(([^)\s]+)\)/g;

export function parseSafeInlineLinks(value: string): SafeInlineTextSegment[] {
  const segments: SafeInlineTextSegment[] = [];
  let cursor = 0;

  for (const match of value.matchAll(inlineLinkPattern)) {
    const fullMatch = match[0];
    const index = match.index ?? cursor;
    const label = unescapeLabel(match[1]);
    const href = unescapeLabel(match[2]);
    appendText(segments, value.slice(cursor, index));
    if (isSafeInlineHref(href)) segments.push({ type: "link", text: label, href });
    else appendText(segments, label);
    cursor = index + fullMatch.length;
  }

  appendText(segments, value.slice(cursor));
  return segments;
}

function isSafeInlineHref(value: string): boolean {
  const href = value.trim();
  if (!href || /[\u0000-\u0020\\]/.test(href)) return false;
  if (href.startsWith("/")) return !href.startsWith("//");
  if (href.startsWith("#")) return href.length > 1;

  try {
    return ["http:", "https:", "mailto:", "tel:"].includes(new URL(href).protocol);
  } catch {
    return false;
  }
}

function unescapeLabel(value: string): string {
  return value.replace(/\\([\\\[\]])/g, "$1");
}

function appendText(segments: SafeInlineTextSegment[], text: string): void {
  if (!text) return;
  const previous = segments[segments.length - 1];
  if (previous?.type === "text") previous.text += text;
  else segments.push({ type: "text", text });
}
