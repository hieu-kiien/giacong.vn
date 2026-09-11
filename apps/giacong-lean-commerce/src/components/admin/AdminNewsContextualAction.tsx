"use client";

import Link from "next/link";

import { useAdminVisualContext } from "./AdminVisualMode";

import styles from "./AdminNewsContextualAction.module.css";

const editableRoles = new Set(["owner"]);

export function AdminNewsContextualAction({ newsId }: { newsId: number }) {
  const { session, status } = useAdminVisualContext();

  if (status !== "ready" || !session || !editableRoles.has(session.role)) return null;

  return (
    <div className={styles.action} data-testid="admin-news-contextual-action">
      <Link href={`/admin/tin-tuc?edit=${newsId}`}>Sửa bài viết này</Link>
    </div>
  );
}
