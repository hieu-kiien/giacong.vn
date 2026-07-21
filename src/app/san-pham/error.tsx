"use client";

import { useEffect } from "react";

import styles from "@/components/catalog/catalog.module.css";

export default function CatalogError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <main id="catalog-main" className={styles.catalog}><div className={styles.inner}><div className={styles.notice}><h1 className={styles.title}>Chưa thể tải danh mục</h1><p>Vui lòng thử lại sau ít phút.</p><button className={styles.button} onClick={reset} type="button">Thử lại</button></div></div></main>;
}
