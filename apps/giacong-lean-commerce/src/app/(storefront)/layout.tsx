// Imports the same `public/styles/` sheets that used to ship as `<link>` tags,
// but inside the `captured` cascade layer so Tailwind utilities can override
// them. See the comment in the file itself.
import { AdminVisualModeGate } from "@/components/admin/AdminVisualMode";
import { getRuntimeAdminAccessConfig } from "@/lib/admin-access-runtime";
import { normalizeAdminAccessConfig } from "@/lib/admin-access";
import { KNOWN_ADMIN_VISUAL_HOSTNAMES } from "@/lib/admin-visual-contract";

import "./captured-layers.css";
import "../../styles/admin.css";

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const adminConfig = normalizeAdminAccessConfig(getRuntimeAdminAccessConfig());
  const adminHostnames = [...new Set([
    ...KNOWN_ADMIN_VISUAL_HOSTNAMES,
    ...(adminConfig?.adminHostnames ?? []),
  ])];

  return (
    <AdminVisualModeGate adminHostnames={adminHostnames}>
      {children}
    </AdminVisualModeGate>
  );
}
