import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { betterAuth } from "better-auth";
import { username } from "better-auth/plugins";
import type { CustomerContactDeliveryDatabase } from "./customer-contact-delivery.ts";
import { enqueueCustomerContact } from "./customer-contact-queue.ts";

import {
  buildPasswordResetEmail,
  buildVerificationEmail,
  resolveCustomerEmailConfig,
  sendCustomerEmail,
} from "./customer-email.ts";

type BetterAuthOptions = Parameters<typeof betterAuth>[0];
type BetterAuthDatabase = NonNullable<BetterAuthOptions["database"]>;

interface CustomerAuthEnvironment {
  BETTER_AUTH_SECRET?: string;
  /** Sender shown on verification / reset e-mails, e.g. "Kienhieu <no-reply@kienhieu.id.vn>". */
  CUSTOMER_EMAIL_FROM?: string;
  /** Resend API key; without it e-mail sign-up and password reset stay switched off. */
  RESEND_API_KEY?: string;
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

  // Self-service e-mail accounts need working e-mail delivery (verification and
  // password reset). Without Resend configured, sign-up fails closed and only
  // Google sign-in (plus password set-up after Google) is available.
  const emailConfig = resolveCustomerEmailConfig(environment);
  const brand = "Kienhieu";

  return betterAuth({
    appName: brand,
    baseURL: origin,
    trustedOrigins: [...CUSTOMER_AUTH_ORIGINS],
    secret,
    database,
    emailAndPassword: {
      enabled: true,
      disableSignUp: !emailConfig,
      requireEmailVerification: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 60 * 60,
      sendResetPassword: emailConfig
        ? async ({ user, url }) => {
            await sendCustomerEmail(emailConfig, buildPasswordResetEmail({ brand, name: user.name, to: user.email, url }));
          }
        : undefined,
    },
    emailVerification: emailConfig
      ? {
          autoSignInAfterVerification: true,
          expiresIn: 60 * 60 * 24,
          sendOnSignIn: true,
          sendOnSignUp: true,
          afterEmailVerification: async (user) => {
            try { await enqueueCustomerContact(user.id, database as unknown as CustomerContactDeliveryDatabase); }
            catch { /* Verification stays successful; D1 retains the contact event for retry. */ }
          },
          sendVerificationEmail: async ({ user, url }) => {
            await sendCustomerEmail(emailConfig, buildVerificationEmail({ brand, name: user.name, to: user.email, url }));
          },
        }
      : undefined,
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
