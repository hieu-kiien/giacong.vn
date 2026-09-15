import { PUBLIC_SITE_ORIGIN } from "@/lib/seo";

const STAGING_HOSTS = new Set([
  "admin-staging.kienhieu.id.vn",
  "staging.kienhieu.id.vn",
]);
const ADMIN_HOSTS = new Set([
  "admin.kienhieu.id.vn",
  "admin-staging.kienhieu.id.vn",
]);

export function GET(request: Request): Response {
  const hostname = new URL(request.url).hostname.toLowerCase();
  const privateHost = STAGING_HOSTS.has(hostname) || ADMIN_HOSTS.has(hostname);
  const body = privateHost
    ? "User-agent: *\nDisallow: /\n"
    : `User-agent: *\nAllow: /\nSitemap: ${PUBLIC_SITE_ORIGIN}/sitemap.xml\n`;

  return new Response(body, {
    headers: {
      "Cache-Control": "public, max-age=300",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Robots-Tag": privateHost ? "noindex, nofollow, noarchive" : "all",
    },
  });
}
