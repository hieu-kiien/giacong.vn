import type { Metadata } from "next";
import Link from "next/link";

import { CapturedStorefrontShell } from "@/components/site/CapturedStorefrontShell";
import { canonicalMetadata, noIndexMetadata } from "@/lib/seo";
import { getPublishedSiteSettings } from "@/lib/site-settings";
import { customerLoginDestination } from "@/lib/customer-login-destination";

import { CustomerAccountAuth } from "./CustomerAccountAuth";
import styles from "./customer-auth.module.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublishedSiteSettings();
  return {
    ...canonicalMetadata("/tai-khoan/dang-nhap/"),
    ...noIndexMetadata(),
    title: `Đăng nhập hoặc tạo tài khoản | ${settings.brand_name}`,
    description: "Đăng nhập hoặc tạo tài khoản để gửi yêu cầu và theo dõi lịch sử mua hàng.",
    icons: settings.favicon_url ? { icon: settings.favicon_url } : undefined,
  };
}

export default async function CustomerSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = await searchParams;
  const callbackURL = customerLoginDestination(query.next);
  const isAdminSignIn = callbackURL === "/admin/" || callbackURL.startsWith("/admin/");

  return (
    <CapturedStorefrontShell>
      <main className={styles.main} id="main">
        <section aria-labelledby="account-page-title" className="giacong-page-hero">
          <div aria-hidden="true" className="giacong-page-hero__orb giacong-page-hero__orb--one" />
          <div aria-hidden="true" className="giacong-page-hero__orb giacong-page-hero__orb--two" />
          <div className="giacong-page-hero__inner">
            <p className="giacong-page-hero__eyebrow">Tài khoản website</p>
            <h1 id="account-page-title">Tài khoản</h1>
            <nav aria-label="Breadcrumb" className="giacong-page-hero__breadcrumb">
              <Link href="/">Trang chủ</Link>
              <span aria-hidden="true">»</span>
              <span aria-current="page">Tài khoản</span>
            </nav>
          </div>
        </section>

        <section aria-labelledby="sign-in-title" className={styles.contentSection}>
          <div className="giacong-content-rail">
            <div className={styles.card}>
              <h2 className={styles.cardTitle} id="sign-in-title">Đăng nhập hoặc tạo tài khoản</h2>
              <p className={styles.cardCopy}>{isAdminSignIn
                ? "Đăng nhập bằng tài khoản website. Chỉ tài khoản đã được cấp quyền admin mới vào được khu vực quản trị."
                : "Dùng Google, hoặc email và mật khẩu. Tên đăng nhập là tùy chọn."}</p>

              <CustomerAccountAuth callbackURL={callbackURL} />

              <Link className={styles.homeLink} href="/">
                <span aria-hidden="true">←</span> Quay lại trang chủ
              </Link>
            </div>
          </div>
        </section>
      </main>
    </CapturedStorefrontShell>
  );
}
