"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app] uncaught route error", error);
  }, [error]);

  return (
    <main aria-labelledby="route-error-title" style={{ fontFamily: "system-ui, sans-serif", margin: "10vh auto", maxWidth: 680, padding: 24 }}>
      <section aria-describedby="route-error-description" role="alert">
        <h1 id="route-error-title">Trang đang gặp sự cố</h1>
        <p id="route-error-description">
          Hệ thống chưa thể hiển thị trang này. Hãy thử tải lại. Nếu vừa gửi thay đổi, vui lòng kiểm tra dữ liệu trước khi gửi lần nữa.
        </p>
        {error.digest ? <p>Mã sự cố: {error.digest}</p> : null}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <button onClick={reset} type="button">Thử tải lại</button>
          <Link href="/">Về trang chủ</Link>
        </div>
      </section>
    </main>
  );
}
