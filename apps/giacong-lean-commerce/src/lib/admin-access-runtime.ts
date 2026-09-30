import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getCustomerSession } from "./customer-auth";

import {
  admitAdminAccountSessionRequest,
  admitAdminRequest,
  type AdminAccessConfig,
  type AdminAdmissionResult,
} from "./admin-access";

interface AdminAccessEnv {
  ADMIN_ACCOUNT_AUTH?: string;
  ADMIN_HOSTNAME?: string;
  ADMIN_HOSTNAMES?: string;
  ADMIN_PUBLIC?: string;
  ADMIN_PUBLIC_SUBJECT?: string;
  PRODUCTION_ADMIN_HOSTNAME?: string;
  POLICY_AUD?: string;
  TEAM_DOMAIN?: string;
}

export async function admitRuntimeAdminRequest(request: Request): Promise<AdminAdmissionResult> {
  const config = getRuntimeAdminAccessConfig();
  const accessAdmission = await admitAdminRequest(request, config);
  if (
    accessAdmission.ok
    || accessAdmission.status !== 401
    || request.headers.has("cf-access-jwt-assertion")
    || !config.accountAdminEnabled
  ) {
    return accessAdmission;
  }

  try {
    const session = await getCustomerSession(request.headers);
    return admitAdminAccountSessionRequest(request, config, session ? {
      id: session.user.id,
      email: session.user.email,
      emailVerified: session.user.emailVerified,
    } : null);
  } catch {
    return accessAdmission;
  }
}

export function getRuntimeAdminAccessConfig(): AdminAccessConfig {
  try {
    const { env } = getCloudflareContext();
    const accessEnv = env as unknown as AdminAccessEnv;
    return {
      adminHostname: accessEnv.ADMIN_HOSTNAME ?? "",
      additionalAdminHostnames: parseHostnames(accessEnv.ADMIN_HOSTNAMES),
      accountAdminEnabled: accessEnv.ADMIN_ACCOUNT_AUTH?.trim().toLowerCase() === "true",
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
