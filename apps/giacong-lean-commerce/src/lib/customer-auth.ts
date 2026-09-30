import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { betterAuth } from "better-auth";
import { username } from "better-auth/plugins";

type BetterAuthOptions = Parameters<typeof betterAuth>[0];
type BetterAuthDatabase = NonNullable<BetterAuthOptions["database"]>;

interface CustomerAuthEnvironment {
  BETTER_AUTH_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GIACONG_VN_CATALOG?: BetterAuthDatabase;
}

const CUSTOMER_AUTH_ORIGINS = [
  "https://kienhieu.id.vn",
  "https://staging.kienhieu.id.vn",
  "https://admin-staging.kienhieu.id.vn",
  "http://localhost:3000",
] as const;

const CUSTOMER_AUTH_ORIGIN_SET = new Set<string>(CUSTOMER_AUTH_ORIGINS);
const CUSTOMER_AUTH_ORIGIN_BY_HOST = new Map<string, string>([
  ["kienhieu.id.vn", "https://kienhieu.id.vn"],
  ["staging.kienhieu.id.vn", "https://staging.kienhieu.id.vn"],
  ["admin-staging.kienhieu.id.vn", "https://admin-staging.kienhieu.id.vn"],
  ["localhost:3000", "http://localhost:3000"],
]);
const DEFAULT_CUSTOMER_AUTH_ORIGIN = "https://kienhieu.id.vn";

export class CustomerAuthConfigurationError extends Error {
  constructor() {
    super("Customer authentication is not configured.");
    this.name = "CustomerAuthConfigurationError";
  }
}

export class CustomerAuthOriginError extends Error {
  constructor() {
    super("Customer authentication origin is not allowed.");
    this.name = "CustomerAuthOriginError";
  }
}

function getCustomerAuthEnvironment(): CustomerAuthEnvironment {
  let environment: CustomerAuthEnvironment;

  try {
    const { env } = getCloudflareContext();
    environment = env as unknown as CustomerAuthEnvironment;
  } catch {
    throw new CustomerAuthConfigurationError();
  }

  const hasRequiredConfiguration = Boolean(
    environment.GIACONG_VN_CATALOG &&
      environment.GOOGLE_CLIENT_ID?.trim() &&
      environment.GOOGLE_CLIENT_SECRET?.trim() &&
      environment.BETTER_AUTH_SECRET?.trim().length &&
      environment.BETTER_AUTH_SECRET.trim().length >= 32,
  );

  if (!hasRequiredConfiguration) throw new CustomerAuthConfigurationError();
  return environment;
}

function resolveCustomerAuthOrigin(origin: string): string {
  let normalizedOrigin: string;

  try {
    normalizedOrigin = new URL(origin).origin;
  } catch {
    throw new CustomerAuthOriginError();
  }

  if (!CUSTOMER_AUTH_ORIGIN_SET.has(normalizedOrigin)) {
    throw new CustomerAuthOriginError();
  }

  return normalizedOrigin;
}

function resolveCustomerAuthOriginFromHeaders(headers: Headers): string {
  const host = headers.get("host")?.trim().toLowerCase();
  const hostOrigin = host ? CUSTOMER_AUTH_ORIGIN_BY_HOST.get(host) : undefined;
  if (host && !hostOrigin) throw new CustomerAuthOriginError();

  const originHeader = headers.get("origin");
  const origin = originHeader
    ? resolveCustomerAuthOrigin(originHeader)
    : hostOrigin ?? DEFAULT_CUSTOMER_AUTH_ORIGIN;

  if (hostOrigin && hostOrigin !== origin) throw new CustomerAuthOriginError();
  return origin;
}

function createCustomerAuth(origin: string) {
  const environment = getCustomerAuthEnvironment();
  const database = environment.GIACONG_VN_CATALOG;
  const clientId = environment.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = environment.GOOGLE_CLIENT_SECRET?.trim();
  const secret = environment.BETTER_AUTH_SECRET?.trim();

  if (!database || !clientId || !clientSecret || !secret) {
    throw new CustomerAuthConfigurationError();
  }

  return betterAuth({
    appName: "Kienhieu",
    baseURL: origin,
    trustedOrigins: [...CUSTOMER_AUTH_ORIGINS],
    secret,
    database,
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      requireEmailVerification: true,
    },
    plugins: [username({ displayUsername: false, immutableUsername: true })],
    socialProviders: {
      google: {
        clientId,
        clientSecret,
        requireEmailVerification: true,
        disableIdTokenSignIn: true,
        mapProfileToUser: (profile) => ({
          name: profile.name?.trim() || profile.email || "Khách hàng",
        }),
      },
    },
    account: {
      accountLinking: { enabled: false },
      encryptOAuthTokens: true,
    },
    advanced: {
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
      useSecureCookies: origin.startsWith("https://"),
    },
  });
}

export function getCustomerAuthForRequest(request: Request) {
  const requestOrigin = resolveCustomerAuthOrigin(new URL(request.url).origin);
  const headerOrigin = resolveCustomerAuthOriginFromHeaders(request.headers);
  if (headerOrigin !== requestOrigin) throw new CustomerAuthOriginError();
  return createCustomerAuth(requestOrigin);
}

export function getCustomerAuthForHeaders(headers: Headers) {
  return createCustomerAuth(resolveCustomerAuthOriginFromHeaders(headers));
}

export async function getCustomerAuthAccounts(headers: Headers) {
  return getCustomerAuthForHeaders(headers).api.listUserAccounts({ headers });
}

export async function getCustomerSession(headers: Headers) {
  if (!headers.has("cookie")) return null;

  return getCustomerAuthForHeaders(headers).api.getSession({ headers });
}
