import type { ReactNode } from "react";

import { CapturedStorefrontShell } from "@/components/site/CapturedStorefrontShell";
import { getStorefrontNavigationForPath } from "@/components/site/storefront-navigation";
import styles from "@/components/site/CapturedStorefrontTabFrame.module.css";

interface CapturedStorefrontTabFrameProps {
  activePath: "/san-pham" | "/thue-gia-cong";
  children: ReactNode;
}

/**
 * Shared page frame for every direct route inside the two approved tabs.
 * It deliberately adds only the captured site's main landmark; each page keeps
 * ownership of its current content layout.
 */
export function CapturedStorefrontTabFrame({ activePath, children }: CapturedStorefrontTabFrameProps) {
  const activeNavigation = getStorefrontNavigationForPath(activePath)?.key;
  if (!activeNavigation) throw new Error(`Missing storefront navigation for ${activePath}`);

  return (
    <CapturedStorefrontShell activeNavigation={activeNavigation}>
      <main className={styles.detailMain} data-storefront-detail-main id="main">
        {children}
      </main>
    </CapturedStorefrontShell>
  );
}
