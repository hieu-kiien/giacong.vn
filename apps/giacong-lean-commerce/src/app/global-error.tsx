"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app] uncaught root layout error", error);
  }, [error]);

  return (
    <html lang="vi">
      <body style={{ background: "#f7f8f5", color: "#252b23", fontFamily: "system-ui, sans-serif", margin: 0, minHeight: "100vh" }}>
        <main aria-labelledby="global-error-title" style={{ margin: "10vh auto", maxWidth: 680, padding: 24 }}>
          <section aria-describedby="global-error-description" role="alert">
            <h1 id="global-error-title">Website đang gặp sự cố</h1>
            <p id="global-error-description">Hệ thống chưa thể mở trang. Hãy thử tải lại sau ít phút.</p>
            {error.digest ? <p>Mã sự cố: {error.digest}</p> : null}
            <button onClick={reset} type="button">Thử tải lại</button>
            <p><Link href="/" style={{ color: "#397b19" }}>Về trang chủ</Link></p>
          </section>
        </main>
      </body>
    </html>
  );
}
