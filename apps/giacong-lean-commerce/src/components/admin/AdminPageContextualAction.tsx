"use client";

import Link from "next/link";

import { useAdminVisualContext } from "./AdminVisualMode";

import styles from "./AdminNewsContextualAction.module.css";

const editableRoles = new Set(["owner"]);

export function AdminPageContextualAction({ pageKey }: { pageKey: string }) {
  const { session, status } = useAdminVisualContext();

  if (status !== "ready" || !session || !editableRoles.has(session.role)) return null;

  return (
    <div className={styles.action} data-testid="admin-page-contextual-action">
      <Link href={`/admin/thiet-ke?page=${encodeURIComponent(pageKey)}`}>Chỉnh sửa page này</Link>
    </div>
  );
}
