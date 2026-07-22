import type { ReactNode } from "react";

import { CatalogChrome } from "@/components/catalog/CatalogChrome";

export default function ServiceLayout({ children }: { children: ReactNode }) {
  return <CatalogChrome floatingContact={false}>{children}</CatalogChrome>;
}
