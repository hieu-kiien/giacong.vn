import type { Metadata } from "next";
import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";

import { CapturedStorefrontShell } from "@/components/site/CapturedStorefrontShell";
import { canonicalMetadata, noIndexMetadata } from "@/lib/seo";
import { getPublishedSiteSettings } from "@/lib/site-settings";
import { customerLoginDestination } from "@/lib/customer-login-destination";
import { customerContactDestination } from "@/lib/customer-contact-input";
import { resolveCustomerEmailConfig, type CustomerEmailEnvironment } from "@/lib/customer-email";

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
  const destination = customerLoginDestination(query.next);
  const callbackURL = customerContactDestination(query.next);
  const isAdminSignIn = destination === "/admin/" || destination.startsWith("/admin/");
  let emailRegistrationEnabled = false;
  try {
    emailRegistrationEnabled = Boolean(resolveCustomerEmailConfig(getCloudflareContext().env as CustomerEmailEnvironment));
  } catch {
    // Google remains the primary account entry when email delivery is unavailable.
  }

  return (
    <CapturedStorefrontShell variant="account">
      <main className={styles.main} id="main">
        <section aria-labelledby="account-page-title" className="giacong-page-hero">
          <div aria-hidden="true" className="giacong-page-hero__orb giacong-page-hero__orb--one" />
          <div aria-hidden="true" className="giacong-page-hero__orb giacong-page-hero__orb--two" />
          <div className="giacong-page-hero__inner">
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
              <h2 className={styles.cardTitle} id="sign-in-title">Chào mừng bạn</h2>
              <p className={styles.cardCopy}>{isAdminSignIn
                ? "Đăng nhập bằng tài khoản website. Chỉ tài khoản đã được cấp quyền admin mới vào được khu vực quản trị."
                : "Đăng nhập để gửi yêu cầu và theo dõi giao dịch của bạn."}</p>
              {query.error ? <p className={styles.formError} role="alert">Đăng nhập Google chưa hoàn tất. Bạn có thể thử lại bằng nút bên dưới.</p> : null}

              <CustomerAccountAuth callbackURL={callbackURL} emailRegistrationEnabled={emailRegistrationEnabled} />

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
