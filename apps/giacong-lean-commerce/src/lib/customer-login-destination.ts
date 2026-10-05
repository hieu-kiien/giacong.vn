const BASE = "https://website.invalid";

function localDestination(value: string): string | null {
  if (!value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f]/.test(value)) return null;
  const url = new URL(value, BASE);
  if (url.origin !== BASE || /^\/(api|_next)(\/|$)/.test(url.pathname) || url.pathname.startsWith("/tai-khoan/dang-nhap")) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

export function customerLoginDestination(next: unknown, referrer?: string | null, origin?: string): string {
  if (next === "admin") return "/admin/";
  if (next === "gui-yeu-cau") return "/gui-yeu-cau/";
  if (typeof next === "string") {
    const destination = localDestination(next);
    if (destination) return destination;
  }
  if (referrer && origin) {
    try {
      const url = new URL(referrer);
      if (url.origin === origin) return localDestination(`${url.pathname}${url.search}${url.hash}`) ?? "/tai-khoan/";
    } catch { /* Invalid referrers use the account page. */ }
  }
  return "/tai-khoan/";
}
