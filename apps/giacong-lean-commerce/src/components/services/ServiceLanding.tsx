import Link from "next/link";

import { ServiceDirectory } from "@/components/services/ServiceDirectory";
import indexStyles from "@/components/services/service-index.module.css";
import styles from "@/components/services/service.module.css";

/**
 * Content-only portion of `/thue-gia-cong`. `CapturedNewsFrame` owns the approved
 * News header, title band, main landmark and footer; this component stays inside the
 * 1115px content rail measured from the service reference.
 */
export function ServiceLanding() {
  return (
    <div className={indexStyles.landing}>
      <div className={indexStyles.rail}>
        <p className={indexStyles.intro}>
          Mười ba nhóm dịch vụ gia công. Chọn nhóm gần nhất với sản phẩm của bạn để xem
          các trang dịch vụ chi tiết.
        </p>
        <ServiceDirectory />
      </div>
    </div>
  );
}

interface ContactBandProps {
  /**
   * Slug of the family this band sits under, forwarded to the contact form as
   * pre-filled context. Omitted on the index, which spans every group and so has no
   * one service to claim.
   */
  service?: string;
}

export function ContactBand({ service }: ContactBandProps) {
  return (
    <section className={styles.contactBand} aria-labelledby="service-contact-title">
      <div className={`${styles.inner} ${styles.contactInner}`}>
        <div><p className={styles.eyebrow}>Chưa xác định đúng nhóm?</p><h2 id="service-contact-title">Trao đổi nhu cầu gia công</h2></div>
        <Link className={styles.primaryAction} href={service ? `/lien-he/?service=${service}` : "/lien-he/"}>Liên hệ tư vấn</Link>
      </div>
    </section>
  );
}
