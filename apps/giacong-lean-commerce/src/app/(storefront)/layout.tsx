// Imports the same `public/styles/` sheets that used to ship as `<link>` tags,
// but inside the `captured` cascade layer so Tailwind utilities can override
// them. See the comment in the file itself.
import { headers } from "next/headers";

import { AdminVisualMode } from "@/components/admin/AdminVisualMode";
import { isAdminStorefrontHost } from "@/lib/admin-visual-contract";
import { getRuntimeAdminAccessConfig } from "@/lib/admin-access-runtime";
import { normalizeAdminAccessConfig } from "@/lib/admin-access";

import "./captured-layers.css";

export const dynamic = "force-dynamic";

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const adminConfig = normalizeAdminAccessConfig(getRuntimeAdminAccessConfig());
  const isAdminHost = adminConfig
    ? isAdminStorefrontHost(requestHeaders.get("host"), adminConfig)
    : false;

  return isAdminHost ? <AdminVisualMode>{children}</AdminVisualMode> : <>{children}</>;
}
