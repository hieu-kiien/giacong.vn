"use client";

import { lazy, Suspense, useEffect, useState } from "react";

const LazyCapturedRequestCartButton = lazy(async () => {
  const cartModule = await import("./CapturedRequestCartButton");
  return { default: cartModule.CapturedRequestCartButton };
});

export function DesktopCapturedRequestCartButton() {
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    const viewport = window.matchMedia("(min-width: 550px)");
    const sync = () => setDesktop(viewport.matches);
    sync();
    viewport.addEventListener("change", sync);
    return () => viewport.removeEventListener("change", sync);
  }, []);

  if (!desktop) return null;
  return (
    <Suspense fallback={null}>
      <LazyCapturedRequestCartButton />
    </Suspense>
  );
}
