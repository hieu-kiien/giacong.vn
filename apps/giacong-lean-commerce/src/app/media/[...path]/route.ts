import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

interface R2ObjectBodyLike {
  body: ReadableStream<Uint8Array>;
  httpEtag?: string;
  writeHttpMetadata(headers: Headers): void;
}

interface R2BucketLike {
  get(key: string): Promise<R2ObjectBodyLike | null>;
}

interface MediaEnv {
  GIACONG_VN_PRODUCT_MEDIA?: R2BucketLike;
}

export async function GET(_request: Request, context: RouteContext<"/media/[...path]">) {
  const { path } = await context.params;
  const parts = Array.isArray(path) ? path : [path];
  if (!parts.length || parts.some((part) => !part || part === "." || part === "..")) {
    return new Response("Not found", { status: 404 });
  }

  const key = parts.join("/");
  const bucket = getMediaBucket();
  if (!bucket) return new Response("Media unavailable", { status: 503 });

  const object = await bucket.get(key);
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  if (object.httpEtag) headers.set("ETag", object.httpEtag);
  headers.set("Cache-Control", "public, max-age=3600, s-maxage=86400");
  headers.set("X-Content-Type-Options", "nosniff");

  return new Response(object.body, { headers });
}

function getMediaBucket(): R2BucketLike | null {
  try {
    const { env } = getCloudflareContext();
    return (env as unknown as MediaEnv).GIACONG_VN_PRODUCT_MEDIA ?? null;
  } catch {
    return null;
  }
}
