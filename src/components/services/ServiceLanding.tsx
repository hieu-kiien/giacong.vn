import Link from "next/link";

import { ServiceDirectory } from "@/components/services/ServiceDirectory";
import styles from "@/components/services/service.module.css";

export function ServiceLanding() {
  return (
    <main className={styles.main} id="catalog-main">
      <section className={styles.hero}>
        <div className={styles.inner}>
          <nav className={styles.crumbs} aria-label="Breadcrumb"><Link href="/">Trang chủ</Link><span aria-hidden="true">/</span>Thuê gia công</nav>
          <h1>Thuê gia công</h1>
          <p className={styles.lead}>Tìm nhanh dịch vụ theo sản phẩm, phương pháp hoặc nhóm năng lực gia công.</p>
        </div>
      </section>
      <ServiceDirectory />
    </main>
  );
}

export function ContactBand() {
  return (
    <section className={styles.contactBand} aria-labelledby="service-contact-title">
      <div className={`${styles.inner} ${styles.contactInner}`}>
        <div><p className={styles.eyebrow}>Chưa xác định đúng nhóm?</p><h2 id="service-contact-title">Trao đổi nhu cầu gia công</h2></div>
        <Link className={styles.primaryAction} href="/lien-he/?service=say-thuc-pham-say">Liên hệ tư vấn</Link>
      </div>
    </section>
  );
}
