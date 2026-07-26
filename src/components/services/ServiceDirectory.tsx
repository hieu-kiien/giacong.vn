"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import styles from "@/components/services/service.module.css";
import { serviceFamilies } from "@/data/service-families";

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("vi")
    .trim();
}

export function ServiceDirectory() {
  const [query, setQuery] = useState("");
  const normalizedQuery = normalizeSearch(query);
  const filteredFamilies = useMemo(
    () => serviceFamilies
      .map((family) => ({
        ...family,
        offerings: family.offerings.filter((offering) => (
          normalizedQuery.length === 0
          || normalizeSearch(`${offering.label} ${family.name}`).includes(normalizedQuery)
        )),
      }))
      .filter((family) => family.offerings.length > 0),
    [normalizedQuery],
  );
  const resultCount = filteredFamilies.reduce((count, family) => count + family.offerings.length, 0);

  const clearFilters = () => {
    setQuery("");
  };

  return (
    <section className={styles.directorySection} id="service-directory" aria-labelledby="service-directory-title">
      <div className={styles.inner}>
        <div className={styles.directoryIntro}>
          <div>
            <p className={styles.eyebrow}>Danh mục dịch vụ</p>
            <h2 id="service-directory-title">Tìm đúng năng lực gia công</h2>
          </div>
          <p>Tra cứu theo nhu cầu hoặc phương pháp sấy để chọn hướng tư vấn phù hợp.</p>
        </div>

        <div className={styles.filterPanel}>
          <label className={styles.searchLabel} htmlFor="service-search">Bạn cần gia công gì?</label>
          <div className={styles.searchRow}>
            <input
              className={styles.searchInput}
              id="service-search"
              onChange={(event) => setQuery(event.target.value)}
              type="search"
              value={query}
            />
            <button
              className={styles.clearButton}
              disabled={!query}
              onClick={clearFilters}
              type="button"
            >
              Xóa bộ lọc
            </button>
          </div>
        </div>

        <div className={styles.resultBar}>
          <p aria-live="polite">{resultCount} dịch vụ phù hợp</p>
          <Link
            className={styles.consultationLink}
            href="/lien-he/?service=say-thuc-pham-say"
            prefetch={false}
          >
            Chưa chắc? Liên hệ tư vấn
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        {filteredFamilies.length > 0 ? (
          <div className={styles.serviceGroups}>
            {filteredFamilies.map((family) => (
              <section className={styles.serviceGroup} key={family.slug} aria-labelledby={`family-${family.slug}`}>
                <div className={styles.groupHeading}>
                  <h3 id={`family-${family.slug}`}>{family.name}</h3>
                  <Link href={`/thue-gia-cong/${family.slug}/`} prefetch={false}>Xem trang nhóm</Link>
                </div>
                <ul className={styles.directoryList}>
                  {family.offerings.map((offering) => (
                    <li data-service-offering key={offering.href}>
                      <Link href={offering.href} prefetch={false}>
                        <span>{offering.label}</span>
                        <span aria-hidden="true">→</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState} role="status">
            <h3>Chưa tìm thấy dịch vụ phù hợp</h3>
            <p>Thử từ khóa ngắn hơn hoặc xóa bộ lọc để xem toàn bộ danh mục.</p>
          </div>
        )}
      </div>
    </section>
  );
}
