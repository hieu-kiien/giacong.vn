"use client";

import {
  ChefHat,
  Coffee,
  CookingPot,
  CupSoda,
  FlaskConical,
  Leaf,
  Milk,
  Package,
  Search,
  Sparkles,
  SunMedium,
  Wheat,
  Wine,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";

import { AdminServiceContextualAction } from "@/components/admin/AdminServiceContextualAction";
import { AdminServiceCreateContextualAction } from "@/components/admin/AdminServiceCreateContextualAction";
import styles from "@/components/services/service-index.module.css";
import { ServiceImage } from "@/components/services/ServiceImage";
import { getServiceFamilyImage } from "@/components/services/service-visuals";
import { serviceFamilies, type ServiceFamily, type ServiceOffering } from "@/data/service-families";

const FEATURED_SERVICE_COUNT = 3;
type ServiceDirectoryFamily = ServiceFamily & {
  adminId?: number | null;
  sortOrder?: number;
};
type FilteredServiceFamily = Omit<ServiceDirectoryFamily, "offerings"> & {
  offerings: ServiceFamily["offerings"][number][];
  selfMatch: boolean;
};

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("vi")
    .trim();
}

const SERVICE_ICON_BY_SLUG = {
  "gia-cong-sot-cham": CookingPot,
  "gia-cong-do-uong": CupSoda,
  "gia-cong-bot-pha-che": CookingPot,
  "gia-cong-duoc-lieu": FlaskConical,
  "gia-cong-thuc-pham": ChefHat,
  "gia-cong-my-pham": Sparkles,
  "gia-cong-tra": Leaf,
  "gia-cong-ca-phe": Coffee,
  "gia-cong-dong-goi": Package,
  "gia-cong-bot": Wheat,
  "gia-cong-ruou": Wine,
  "gia-cong-sua": Milk,
  "say-thuc-pham-say": SunMedium,
} as const;

function ServiceIcon({ slug }: { slug: string }) {
  const iconProps = { "aria-hidden": true, size: 31, strokeWidth: 1.8 } as const;
  const Icon = SERVICE_ICON_BY_SLUG[slug as keyof typeof SERVICE_ICON_BY_SLUG] ?? Sparkles;
  return <Icon {...iconProps} />;
}

/**
 * A family's promoted R2 image replaces the icon circle when it loads; any
 * failure degrades back to the icon so a dead URL never leaves an empty frame.
 */
function ServiceFamilyImage({ family }: { family: FilteredServiceFamily }) {
  return (
    <span className={styles.iconCircle} data-service-image>
      <ServiceImage
        className="size-full rounded-full object-cover"
        fallback={<ServiceIcon slug={family.slug} />}
        src={family.imageUrl ?? getServiceFamilyImage(family.slug)}
      />
    </span>
  );
}

function ServiceGroupCard({ family }: { family: FilteredServiceFamily }) {
  return (
    <section
      aria-labelledby={`family-${family.slug}`}
      className={styles.card}
      data-service-group
    >
      <header className={styles.cardHeader}>
        <ServiceFamilyImage family={family} />
        <span className={styles.cardHeading}>
          <h3 id={`family-${family.slug}`}>
            <Link href={family.hubHref} prefetch={false}>{family.name}</Link>
          </h3>
          <p>{family.summary}</p>
        </span>
      </header>
      <AdminServiceContextualAction serviceId={family.adminId ?? null} serviceSlug={family.slug} />

      {family.offerings.length > 0 ? (
        <ul className={styles.offeringList}>
          {family.offerings.map((offering) => (
            <li data-service-offering key={offering.href}>
              <Link className={styles.offeringLink} href={offering.href} prefetch={false}>
                <span className={styles.offeringLabel}>
                  <span aria-hidden="true" className={styles.bullet} />
                  {offering.label}
                </span>
                <span aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.emptyFamily}>
          Nhóm này chưa có trang dịch vụ riêng. Liên hệ để trao đổi yêu cầu cụ thể.
        </p>
      )}

      <Link className={styles.groupLink} href={`/thue-gia-cong/${family.slug}/`} prefetch={false}>
        Xem trang nhóm →
      </Link>
    </section>
  );
}

/**
 * The approved index opens with the three featured groups shown in the visual
 * reference, then continues with every remaining group in the same card language.
 *
 * Search matches a group by its own name as well as by its offerings, so a group whose
 * name matches still appears when none of its offering labels do — and so
 * `gia-cong-duoc-lieu`, which has no offerings at all, is reachable by name rather
 * than being permanently filtered out. Diacritics fold through `normalizeSearch`, so
 * "sua" finds "sữa".
 *
 * Each card offers two destinations that are deliberately different: the hub link goes
 * to the archive giacong.vn already serves, and `Xem trang nhóm` goes to this project's
 * own grouped view at `/thue-gia-cong/<slug>/`.
 */
export function ServiceDirectory({
  contentIndex = [],
  families = serviceFamilies,
}: {
  contentIndex?: readonly ServiceOffering[];
  families?: readonly ServiceDirectoryFamily[];
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = normalizeSearch(query);
  const orderedFamilies = useMemo(
    () => [...families].sort((left, right) => (
      (left.sortOrder ?? families.indexOf(left)) - (right.sortOrder ?? families.indexOf(right))
    )),
    [families],
  );
  const filteredFamilies = useMemo(
    () => orderedFamilies
      .map((family) => {
        const familyMatches = normalizeSearch(family.name).includes(normalizedQuery);
        return {
          ...family,
          offerings: family.offerings.filter((offering) => (
            normalizedQuery.length === 0
            || familyMatches
            || normalizeSearch(offering.label).includes(normalizedQuery)
          )),
          selfMatch: familyMatches,
        };
      })
      .filter((family) => (
        normalizedQuery.length === 0 || family.selfMatch || family.offerings.length > 0
      )),
    [normalizedQuery, orderedFamilies],
  );
  const filteredContent = useMemo(
    () => contentIndex.filter((content) => (
      normalizedQuery.length === 0
      || normalizeSearch(`${content.label} ${content.href}`).includes(normalizedQuery)
    )),
    [contentIndex, normalizedQuery],
  );
  const featuredFamilies = filteredFamilies.slice(0, FEATURED_SERVICE_COUNT);
  const remainingFamilies = filteredFamilies.slice(FEATURED_SERVICE_COUNT);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <section aria-labelledby="service-directory-title" className={styles.directory} id="service-directory">
      <h2 className="sr-only" id="service-directory-title">Danh mục nhóm dịch vụ</h2>

      <div className={styles.filterPanel}>
        <form onSubmit={handleSearchSubmit} role="search">
          <label className={styles.searchLabel} htmlFor="service-search">
            Bạn cần gia công gì?
          </label>
          <div className={styles.searchRow}>
            <input
              className={styles.searchInput}
              id="service-search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tên dịch vụ hoặc nhóm dịch vụ"
              type="search"
              value={query}
            />
            <button aria-label="Tìm dịch vụ" className={styles.searchButton} type="submit">
              <Search aria-hidden="true" size={24} strokeWidth={2} />
            </button>
          </div>
        </form>

        <div className={styles.resultRow}>
          <p aria-live="polite" className={styles.resultCount}>
            {filteredFamilies.length} nhóm · {filteredContent.length} trang nội dung
          </p>
          <div className={styles.resultActions}>
            {query ? (
              <button
                className={styles.clearButton}
                onClick={() => setQuery("")}
                type="button"
              >
                Xóa bộ lọc
              </button>
            ) : null}
            <AdminServiceCreateContextualAction />
            <Link
              className={styles.consultationLink}
              href="/lien-he/"
              prefetch={false}
            >
              Chưa chắc? Liên hệ tư vấn
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </div>

      {featuredFamilies.length > 0 ? (
        <>
          <div className={styles.cardGrid}>
            {featuredFamilies.map((family) => <ServiceGroupCard family={family} key={family.slug} />)}
          </div>
          {remainingFamilies.length > 0 ? (
            <section aria-labelledby="all-service-groups" className={styles.remainingSection}>
              <h2 id="all-service-groups">Tất cả nhóm dịch vụ</h2>
              <div className={styles.cardGrid}>
                {remainingFamilies.map((family) => <ServiceGroupCard family={family} key={family.slug} />)}
              </div>
            </section>
          ) : null}
        </>
      ) : filteredContent.length === 0 ? (
        <div className={styles.emptyResult} role="status">
          <h3>Chưa tìm thấy dịch vụ phù hợp</h3>
          <p>
            Thử từ khóa ngắn hơn hoặc xóa bộ lọc để xem toàn bộ danh mục.
          </p>
        </div>
      ) : null}

      {contentIndex.length > 0 ? (
        <details className={styles.contentIndex} open={Boolean(query)}>
          <summary>
            <span>Kho nội dung dịch vụ</span>
            <strong>{filteredContent.length} trang</strong>
          </summary>
          <p className={styles.contentIndexIntro}>
            Các trang đã có trong dự án, gồm cả nội dung nằm sâu trong những trang nhóm. Tìm kiếm ở trên cũng lọc danh sách này.
          </p>
          {filteredContent.length > 0 ? (
            <ul className={styles.contentIndexList}>
              {filteredContent.map((content) => (
                <li key={content.href}>
                  <Link href={content.href} prefetch={false}>{content.label}</Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.contentIndexEmpty}>Không có trang dịch vụ nào khớp từ khóa này.</p>
          )}
        </details>
      ) : null}
    </section>
  );
}
