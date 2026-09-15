import Link from "next/link";

import { ServiceDirectory } from "@/components/services/ServiceDirectory";
import indexStyles from "@/components/services/service-index.module.css";
import styles from "@/components/services/service.module.css";
import type { ServiceFamily, ServiceOffering } from "@/data/service-families";
import { defaultServicePresentation, safeInternalHref } from "@/lib/service-presentation";

/**
 * Content-only portion of `/thue-gia-cong`. `CapturedNewsFrame` owns the approved
 * News header, title band, main landmark and footer; this component stays inside the
 * 1115px content rail measured from the service reference.
 *
 * `families` lets the server page overlay managed D1 copy/images onto the static
 * taxonomy; without it the directory falls back to the icon-only static list.
 */
export function ServiceLanding({
  contentIndex,
  families,
}: {
  contentIndex?: readonly ServiceOffering[];
  families?: readonly ServiceFamily[];
}) {
  const familyCount = families?.length ?? 13;

  return (
    <div className={indexStyles.landing}>
      <div className={indexStyles.rail}>
        <p className={indexStyles.intro}>
          {familyCount} nhóm dịch vụ gia công. Chọn nhóm gần nhất với sản phẩm của bạn để xem
          các trang dịch vụ chi tiết.
        </p>
        <ServiceDirectory contentIndex={contentIndex} families={families} />
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
  ctaHref?: string;
  ctaLabel?: string;
}

export function ContactBand({ service, ctaHref, ctaLabel }: ContactBandProps) {
  const defaultCta = service ? defaultServicePresentation(service).ctaHref : "/lien-he/";
  const href = safeInternalHref(ctaHref) ?? defaultCta;
  const label = ctaLabel?.trim() || "Liên hệ tư vấn";
  return (
    <section className={styles.contactBand} aria-labelledby="service-contact-title">
      <div className={`${styles.inner} ${styles.contactInner}`}>
        <div><p className={styles.eyebrow}>Chưa xác định đúng nhóm?</p><h2 id="service-contact-title">Trao đổi nhu cầu gia công</h2></div>
        <Link className={styles.primaryAction} href={href}>{label}</Link>
      </div>
    </section>
  );
}
