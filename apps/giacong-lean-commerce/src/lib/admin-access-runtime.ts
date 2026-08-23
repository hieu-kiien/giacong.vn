import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import {
  admitAdminRequest,
  type AdminAccessConfig,
  type AdminAdmissionResult,
} from "./admin-access";

interface AdminAccessEnv {
  ADMIN_HOSTNAME?: string;
  ADMIN_HOSTNAMES?: string;
  ADMIN_PUBLIC?: string;
  ADMIN_PUBLIC_SUBJECT?: string;
  PRODUCTION_ADMIN_HOSTNAME?: string;
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
      additionalAdminHostnames: parseHostnames(accessEnv.ADMIN_HOSTNAMES),
      productionAdminHostname: accessEnv.PRODUCTION_ADMIN_HOSTNAME ?? "",
      publicAdmin: accessEnv.ADMIN_PUBLIC?.trim().toLowerCase() === "true",
      publicSubject: accessEnv.ADMIN_PUBLIC_SUBJECT ?? "",
      policyAudience: accessEnv.POLICY_AUD ?? "",
      teamDomain: accessEnv.TEAM_DOMAIN ?? "",
    };
  } catch {
    return {
      adminHostname: "",
      additionalAdminHostnames: [],
      productionAdminHostname: "",
      publicAdmin: false,
      publicSubject: "",
      policyAudience: "",
      teamDomain: "",
    };
  }
}

function parseHostnames(value: string | undefined): string[] {
  return value?.split(",").map((hostname) => hostname.trim()).filter(Boolean) ?? [];
}
