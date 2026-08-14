import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import {
  admitAdminRequest,
  type AdminAccessConfig,
  type AdminAdmissionResult,
} from "./admin-access";

interface AdminAccessEnv {
  ADMIN_HOSTNAME?: string;
  POLICY_AUD?: string;
  TEAM_DOMAIN?: string;
}

export async function admitRuntimeAdminRequest(request: Request): Promise<AdminAdmissionResult> {
  return admitAdminRequest(request, getRuntimeAdminAccessConfig());
}

export function getRuntimeAdminAccessConfig(): AdminAccessConfig {
  try {
    const { env } = getCloudflareContext();
    const accessEnv = env as unknown as AdminAccessEnv;
    return {
      adminHostname: accessEnv.ADMIN_HOSTNAME ?? "",
      policyAudience: accessEnv.POLICY_AUD ?? "",
      teamDomain: accessEnv.TEAM_DOMAIN ?? "",
    };
  } catch {
    return {
      adminHostname: "",
      policyAudience: "",
      teamDomain: "",
    };
  }
}
