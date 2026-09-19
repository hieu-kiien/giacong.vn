import Link from "next/link";

import { AdminServiceContextualAction } from "@/components/admin/AdminServiceContextualAction";
import { ContactBand } from "@/components/services/ServiceLanding";
import { ServiceImage } from "@/components/services/ServiceImage";
import { getServiceFamilyImage } from "@/components/services/service-visuals";
import styles from "@/components/services/service.module.css";
import type { ServiceFamily } from "@/data/service-families";

interface ServiceFamilyDetailProps {
  /**
   * Managed D1 copy (`service_admin_meta`) arrives on the same object when the
   * public reader carries it. Both fields stay optional: families without
   * managed facts render exactly as before — read-only, no schema/API change.
   */
  family: ServiceFamily & {
    adminId?: number | null;
    ctaHref?: string;
    ctaLabel?: string;
    leadTimeDays?: number | null;
    moqSummary?: string | null;
    sortOrder?: number;
  };
}

export function ServiceFamilyDetail({ family }: ServiceFamilyDetailProps) {
  // The shared storefront frame owns the main landmark. This component keeps
  // only the service content so it can render under the common site chrome.
  const moqSummary = family.moqSummary?.trim() ? family.moqSummary.trim() : null;
  const leadTimeDays = typeof family.leadTimeDays === "number"
    && Number.isInteger(family.leadTimeDays)
    && family.leadTimeDays >= 0
    ? family.leadTimeDays
    : null;
  const heroImage = family.imageUrl ?? getServiceFamilyImage(family.slug) ?? "/images/services/service-manufacturing.svg";
  return (
    <div className={styles.main}>
      <section className={styles.hero} data-motion-section="service-detail-hero">
        <ServiceImage
          alt=""
          className={styles.heroImage}
          src={heroImage}
        />
        <div className={styles.inner}>
          <nav className={styles.crumbs} aria-label="Breadcrumb"><Link href="/">Trang chủ</Link><span aria-hidden="true">/</span><Link href="/thue-gia-cong/">Thuê gia công</Link><span aria-hidden="true">/</span>{family.name}</nav>
          <p className={styles.eyebrow}>Nhóm dịch vụ</p>
          <h1>{family.name}</h1>
          <AdminServiceContextualAction serviceId={family.adminId ?? null} serviceSlug={family.slug} />
          <p className={styles.lead}>{family.description}</p>
        </div>
      </section>
      <section className={styles.section} aria-labelledby="offering-title" data-motion-section="service-detail-offerings">
        <div className={styles.inner}>
          <div className={styles.sectionHeading}><h2 id="offering-title">Dịch vụ trong nhóm</h2><p>Mỗi liên kết dưới đây dẫn đến một trang nội dung hiện có.</p></div>
          {moqSummary || leadTimeDays !== null ? (
            <ul className={styles.offeringList} data-testid="service-managed-facts" aria-label="Điều kiện gia công">
              {moqSummary ? <li><span>Số lượng tối thiểu</span><strong>{moqSummary}</strong></li> : null}
              {leadTimeDays !== null ? <li><span>Thời gian làm hàng</span><strong>{leadTimeDays} ngày</strong></li> : null}
            </ul>
          ) : null}
          <ul className={styles.offeringList}>
            {family.offerings.map((offering, index) => (
              <li key={offering.href}><Link href={offering.href}><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><strong>{offering.label}</strong><span aria-hidden="true">→</span></Link></li>
            ))}
          </ul>
          <Link className={styles.backLink} href="/thue-gia-cong/">← Xem tất cả nhóm dịch vụ</Link>
        </div>
      </section>
      <ContactBand ctaHref={family.ctaHref} ctaLabel={family.ctaLabel} service={family.slug} />
    </div>
  );
}
