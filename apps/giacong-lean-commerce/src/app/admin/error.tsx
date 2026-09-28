"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AdminRouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[admin] uncaught route error", error);
  }, [error]);

  return (
    <div aria-labelledby="admin-route-error-title" className="admin-content">
      <section aria-describedby="admin-route-error-description" className="admin-access-card" role="alert">
        <h1 id="admin-route-error-title">Không thể hiển thị trang quản trị</h1>
        <p id="admin-route-error-description">
          Hệ thống gặp lỗi khi mở màn hình này. Hãy tải lại để thử lần nữa. Nếu vừa gửi thay đổi, kiểm tra dữ liệu trước khi gửi lại.
        </p>
        {error.digest ? <div className="admin-access-detail">Mã sự cố: {error.digest}</div> : null}
        <div className="admin-editor-actions">
          <button className="admin-button admin-button-primary" onClick={reset} type="button">
            Thử tải lại
          </button>
          <Link className="admin-button admin-button-quiet" href="/admin">
            Về trang tổng quan
          </Link>
        </div>
      </section>
    </div>
  );
}
