import type { Metadata } from "next";

/** Public canonical origin. Staging/admin responses are marked noindex by the Worker. */
export const PUBLIC_SITE_ORIGIN = "https://kienhieu.id.vn";

export function canonicalMetadata(path: string): Pick<Metadata, "alternates" | "metadataBase"> {
  const normalized = `/${path.replace(/^\/+|\/+$/g, "")}/`.replace("//", "/");
  return {
    alternates: { canonical: normalized === "//" ? "/" : normalized },
    metadataBase: new URL(PUBLIC_SITE_ORIGIN),
  };
}

export function noIndexMetadata(): Pick<Metadata, "robots"> {
  return { robots: { follow: false, index: false, noarchive: true } };
}
