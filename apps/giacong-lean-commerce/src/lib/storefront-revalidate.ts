import { revalidatePath, revalidateTag } from "next/cache";

export function revalidatePublishedStorefront(options?: {
  tags?: string[];
  paths?: string[];
}): void {
  try {
    const tags = options?.tags ?? [
      "published-site-settings",
      "site-settings",
      "published-site-navigation",
      "site-navigation",
      "published-site-page",
      "site-pages",
    ];
    for (const tag of tags) {
      try {
        revalidateTag(tag, { expire: 0 });
      } catch {
        // Safe in environments without Next.js server context
      }
    }

    const paths = options?.paths ?? ["/"];
    for (const path of paths) {
      try {
        revalidatePath(path);
      } catch {
        // Safe in environments without Next.js server context
      }
    }
  } catch {
    // Graceful fallback
  }
}

export function withStorefrontPurgeHeader(response: Response, paths: string[] = ["/"]): Response {
  response.headers.set("x-purge-storefront-cache", paths.join(","));
  return response;
}
