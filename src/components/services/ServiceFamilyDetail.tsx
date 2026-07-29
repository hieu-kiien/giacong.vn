import Link from "next/link";

import { ContactBand } from "@/components/services/ServiceLanding";
import styles from "@/components/services/service.module.css";
import type { ServiceFamily } from "@/data/service-families";

interface ServiceFamilyDetailProps { family: ServiceFamily }

export function ServiceFamilyDetail({ family }: ServiceFamilyDetailProps) {
  // The shared storefront frame owns the main landmark. This component keeps
  // only the service content so it can render under the common site chrome.
  return (
    <div className={styles.main}>
      <section className={styles.hero}>
        <div className={styles.inner}>
          <nav className={styles.crumbs} aria-label="Breadcrumb"><Link href="/">Trang chủ</Link><span aria-hidden="true">/</span><Link href="/thue-gia-cong/">Thuê gia công</Link><span aria-hidden="true">/</span>{family.name}</nav>
          <p className={styles.eyebrow}>Nhóm dịch vụ</p>
          <h1>{family.name}</h1>
          <p className={styles.lead}>{family.description}</p>
        </div>
      </section>
      <section className={styles.section} aria-labelledby="offering-title">
        <div className={styles.inner}>
          <div className={styles.sectionHeading}><h2 id="offering-title">Dịch vụ trong nhóm</h2><p>Mỗi liên kết dưới đây dẫn đến một trang nội dung hiện có.</p></div>
          <ul className={styles.offeringList}>
            {family.offerings.map((offering, index) => (
              <li key={offering.href}><Link href={offering.href}><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><strong>{offering.label}</strong><span aria-hidden="true">→</span></Link></li>
            ))}
          </ul>
          <Link className={styles.backLink} href="/thue-gia-cong/">← Xem tất cả nhóm dịch vụ</Link>
        </div>
      </section>
      <ContactBand service={family.slug} />
    </div>
  );
}
