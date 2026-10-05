import type { Metadata } from "next";
import Link from "next/link";

import { CapturedStorefrontShell } from "@/components/site/CapturedStorefrontShell";
import { canonicalMetadata, noIndexMetadata } from "@/lib/seo";
import { getPublishedSiteSettings } from "@/lib/site-settings";

import styles from "../dang-nhap/customer-auth.module.css";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublishedSiteSettings();
  return {
    ...canonicalMetadata("/tai-khoan/dat-lai-mat-khau/"),
    ...noIndexMetadata(),
    title: `Đặt lại mật khẩu | ${settings.brand_name}`,
    description: "Đặt mật khẩu mới cho tài khoản khách hàng.",
    icons: settings.favicon_url ? { icon: settings.favicon_url } : undefined,
  };
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = await searchParams;
  const token = typeof query.token === "string" ? query.token : "";
  const linkInvalid = !token || query.error === "INVALID_TOKEN";

  return (
    <CapturedStorefrontShell variant="account">
      <main className={styles.main} id="main">
        <section aria-labelledby="reset-page-title" className="giacong-page-hero">
          <div aria-hidden="true" className="giacong-page-hero__orb giacong-page-hero__orb--one" />
          <div aria-hidden="true" className="giacong-page-hero__orb giacong-page-hero__orb--two" />
          <div className="giacong-page-hero__inner">
            <h1 id="reset-page-title">Đặt lại mật khẩu</h1>
            <nav aria-label="Breadcrumb" className="giacong-page-hero__breadcrumb">
              <Link href="/">Trang chủ</Link>
              <span aria-hidden="true">»</span>
              <span aria-current="page">Đặt lại mật khẩu</span>
            </nav>
          </div>
        </section>

        <section aria-labelledby="reset-title" className={styles.contentSection}>
          <div className="giacong-content-rail">
            <div className={styles.card}>
              <h2 className={styles.cardTitle} id="reset-title">Tạo mật khẩu mới</h2>
              {linkInvalid ? (
                <>
                  <p className={styles.formError} role="alert" style={{ marginTop: 18 }}>
                    Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Hãy yêu cầu một liên kết mới.
                  </p>
                  <Link className={styles.homeLink} href="/tai-khoan/dang-nhap/">Quay lại đăng nhập</Link>
                </>
              ) : (
                <>
                  <p className={styles.cardCopy}>Nhập mật khẩu mới (ít nhất 8 ký tự) cho tài khoản của bạn.</p>
                  <ResetPasswordForm token={token} />
                </>
              )}
            </div>
          </div>
        </section>
      </main>
    </CapturedStorefrontShell>
  );
}
