const localCtaRoutes: Record<string, string> = {
  "Liên hệ ngay": "/lien-he/",
  "Về chúng tôi": "/gioi-thieu-ve-gia-cong/",
};

function readLinkLabel(content: string) {
  return content
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeCapturedMarkup(markup: string) {
  return markup.replace(
    /<a\b([^>]*?)href=(["'])#\2([^>]*)>([\s\S]*?)<\/a>/gi,
    (link, beforeHref: string, quote: string, afterHref: string, content: string) => {
      const route = localCtaRoutes[readLinkLabel(content)];
      if (!route) return link;
      return `<a${beforeHref}href=${quote}${route}${quote}${afterHref}>${content}</a>`;
    },
  );
}
