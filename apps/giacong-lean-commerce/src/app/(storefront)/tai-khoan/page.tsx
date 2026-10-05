import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CapturedStorefrontShell } from "@/components/site/CapturedStorefrontShell";
import { CustomerSessionBoundary } from "@/components/site/CustomerSessionBoundary";
import { getCustomerAccountHistory } from "@/lib/customer-account-data";
import { getCustomerAuthAccounts, getCustomerSession } from "@/lib/customer-auth";
import { findAdminMemberByAuthenticatedEmail, getAdminDatabase } from "@/lib/admin-data";
import { isStagingAdminHost } from "@/lib/admin-navigation";
import { canonicalMetadata, noIndexMetadata } from "@/lib/seo";
import { getPublishedSiteSettings } from "@/lib/site-settings";

import { CustomerCredentialsSetup } from "./CustomerCredentialsSetup";
import { CustomerSignOutButton } from "./CustomerSignOutButton";
import styles from "./customer-account.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublishedSiteSettings();
  return {
    ...canonicalMetadata("/tai-khoan/"),
    ...noIndexMetadata(),
    title: `Tài khoản | ${settings.brand_name}`,
    description: "Theo dõi các yêu cầu đã gửi và giao dịch đã chốt.",
    icons: settings.favicon_url ? { icon: settings.favicon_url } : undefined,
  };
}

function customerRequestStatus(status: string): string {
  switch (status) {
    case "new": return "Đã tiếp nhận";
    case "qualified": return "Đang xem xét";
    case "contacted": return "Nhân viên đã liên hệ";
    case "quotation_sent": return "Đã gửi báo giá";
    case "sampling": return "Đang xử lý mẫu";
    case "negotiation": return "Đang trao đổi qua Zalo";
    case "won": return "Đã hoàn tất trao đổi";
    case "lost": return "Đã kết thúc";
    default: return "Đang xử lý";
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function CustomerAccountPage() {
  const requestHeaders = await headers();
  const session = await getCustomerSession(requestHeaders);
  if (!session?.user.emailVerified) redirect("/tai-khoan/dang-nhap/?next=%2Ftai-khoan%2F");

  const [history, accounts] = await Promise.all([
    getCustomerAccountHistory(session.user.id),
    getCustomerAuthAccounts(requestHeaders),
  ]);
  const hasPassword = accounts.some((account) => account.providerId === "credential");
  let canEnterAdmin = false;
  if (isStagingAdminHost((requestHeaders.get("host") ?? "").split(":")[0])) {
    try {
      const member = await findAdminMemberByAuthenticatedEmail(getAdminDatabase(), session.user.email);
      canEnterAdmin = member?.role === "owner";
    } catch {
      // This optional shortcut must not prevent customers from viewing their account.
    }
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
              <Link href="/">Trang chủ</Link><span aria-hidden="true">»</span><span aria-current="page">Tài khoản</span>
            </nav>
          </div>
        </section>
        <div className={styles.container} id="content">
          <CustomerSessionBoundary userId={session.user.id}>
              <div className={styles.profile}>
                <div>
                  <h2>Thông tin tài khoản</h2>
                  <p className={styles.name}>{session.user.name}</p>
                  <p className={styles.email}>{session.user.email}</p>
                </div>
                <div className={styles.actions}>
                  {canEnterAdmin ? <Link className={styles.primaryLink} href="/admin/">Vào quản trị</Link> : null}
                  <CustomerSignOutButton />
                </div>
              </div>
              <div className={styles.historyGrid}>
              <section aria-labelledby="request-history-heading" className={styles.historyCard}>
                <h2 id="request-history-heading">Yêu cầu đã gửi</h2>
                {history.requests.length ? (
                  <ul className={styles.historyList}>
                    {history.requests.map((request) => (
                      <li key={request.id}>
                        <h3>{request.reference}</h3>
                        <p>{formatDate(request.createdAt)} · {customerRequestStatus(request.status)}</p>
                        {request.items.length ? (
                          <ul>
                            {request.items.map((item, index) => (
                              <li key={`${request.reference}-${index}`}>
                                {item.name}{item.quantity ? ` · ${item.quantity}${item.unit ? ` ${item.unit}` : ""}` : ""}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Bạn chưa gửi yêu cầu nào. <Link href="/san-pham/">Xem sản phẩm</Link></p>
                )}
              </section>

              <section aria-labelledby="sales-history-heading" className={styles.historyCard}>
                <h2 id="sales-history-heading">Giao dịch đã chốt qua Zalo</h2>
                {history.sales.length ? (
                  <ul className={styles.historyList}>
                    {history.sales.map((sale) => (
                      <li key={sale.saleCode}>
                        <h3>{sale.saleCode}</h3>
                        <p>{formatDate(sale.confirmedAt)} · {formatMoney(sale.totalAmount, sale.currency)}</p>
                        {sale.items.length ? (
                          <ul>
                            {sale.items.map((item, index) => (
                              <li key={`${sale.saleCode}-${index}`}>
                                {item.name} · {item.quantity}{item.unit ? ` ${item.unit}` : ""} × {formatMoney(item.unitPrice, sale.currency)} = {formatMoney(item.lineTotal, sale.currency)}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Giao dịch đã chốt qua Zalo sẽ xuất hiện tại đây sau khi nhân viên cập nhật.</p>
                )}
              </section>
              </div>
              <CustomerCredentialsSetup hasPassword={hasPassword} initialUsername={session.user.username ?? null} />
          </CustomerSessionBoundary>
        </div>
      </main>
    </CapturedStorefrontShell>
  );
}
