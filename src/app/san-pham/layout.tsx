import type { ReactNode } from "react";

import { CatalogChrome } from "@/components/catalog/CatalogChrome";

export default function CatalogLayout({ children }: { children: ReactNode }) {
  return <CatalogChrome>{children}</CatalogChrome>;
}
