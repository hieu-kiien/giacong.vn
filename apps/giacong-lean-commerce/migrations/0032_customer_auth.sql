-- Better Auth core schema for Google-only customer sign-in.
-- Customer identities are separate from Cloudflare Access admin members and CRM companies.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS "user" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "emailVerified" BOOLEAN NOT NULL DEFAULT 0,
  "image" TEXT,
  "createdAt" TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "expiresAt" TIMESTAMP NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "better_auth_session_user_id_idx"
  ON "session" ("userId");

CREATE TABLE IF NOT EXISTS "account" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" TIMESTAMP,
  "refreshTokenExpiresAt" TIMESTAMP,
  "scope" TEXT,
  "password" TEXT,
  "createdAt" TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "better_auth_account_provider_identity_idx"
  ON "account" ("providerId", "accountId");
CREATE INDEX IF NOT EXISTS "better_auth_account_user_id_idx"
  ON "account" ("userId");

CREATE TABLE IF NOT EXISTS "verification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" TIMESTAMP NOT NULL,
  "createdAt" TIMESTAMP,
  "updatedAt" TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "better_auth_verification_identifier_idx"
  ON "verification" ("identifier");
