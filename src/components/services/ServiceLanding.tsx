import Link from "next/link";

import { serviceFamilies } from "@/data/service-families";
import styles from "@/components/services/service.module.css";

export function ServiceLanding() {
  return (
    <main className={styles.main} id="catalog-main">
      <section className={styles.hero}>
        <div className={styles.inner}>
          <nav className={styles.crumbs} aria-label="Breadcrumb"><Link href="/">Trang chủ</Link><span aria-hidden="true">/</span>Thuê gia công</nav>
          <p className={styles.eyebrow}>Danh mục dịch vụ</p>
          <h1>Thuê gia công</h1>
          <p className={styles.lead}>Chọn một nhóm nhu cầu để đi đến các dịch vụ chuyên biệt đang có trên Giacong.vn.</p>
        </div>
      </section>
      <section className={styles.section} aria-labelledby="service-family-title">
        <div className={styles.inner}>
          <div className={styles.sectionHeading}>
            <h2 id="service-family-title">Sáu nhóm dịch vụ</h2>
            <p>Cấu trúc gọn để bạn bắt đầu từ ngành hàng, rồi chọn đúng nội dung dịch vụ.</p>
          </div>
          <div className={styles.familyGrid}>
            {serviceFamilies.map((family, index) => (
              <article className={styles.familyCard} key={family.slug}>
                <span className={styles.number} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <h3><Link href={`/thue-gia-cong/${family.slug}/`}>{family.name}</Link></h3>
                <p>{family.summary}</p>
                <Link className={styles.textLink} href={`/thue-gia-cong/${family.slug}/`}>Xem {family.offerings.length} dịch vụ <span aria-hidden="true">→</span></Link>
              </article>
            ))}
          </div>
        </div>
      </section>
      <ContactBand />
    </main>
  );
}

export function ContactBand() {
  return (
    <section className={styles.contactBand} aria-labelledby="service-contact-title">
      <div className={`${styles.inner} ${styles.contactInner}`}>
        <div><p className={styles.eyebrow}>Chưa xác định đúng nhóm?</p><h2 id="service-contact-title">Trao đổi nhu cầu gia công</h2></div>
        <Link className={styles.primaryAction} href="/lien-he/">Liên hệ tư vấn</Link>
      </div>
    </section>
  );
}
