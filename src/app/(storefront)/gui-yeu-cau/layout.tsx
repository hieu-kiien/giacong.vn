import type { ReactNode } from "react";

import { CatalogChrome } from "@/components/catalog/CatalogChrome";

export default function RequestCartLayout({ children }: { children: ReactNode }) {
  return <CatalogChrome floatingContact={false}>{children}</CatalogChrome>;
}
