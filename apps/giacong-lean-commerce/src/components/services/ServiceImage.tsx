"use client";

import { useState } from "react";

interface ServiceImageProps {
  alt?: string;
  className?: string;
  /** Rendered instead of the image whenever there is no URL or the load fails. */
  fallback?: React.ReactNode;
  src: string | null | undefined;
}

/**
 * A service family's promoted R2 image. Mirrors CatalogProductImage's rule: an
 * upstream URL that 404s degrades to the fallback instead of leaving an empty frame.
 */
export function ServiceImage({ alt = "", className, fallback = null, src }: ServiceImageProps) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <>{fallback}</>;
  return (
    <>
      {fallback}
      {/* R2 media URLs are runtime-generated; native img avoids remote-host config. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt={alt} className={className} loading="lazy" onError={() => setFailed(true)} src={src} />
    </>
  );
}
