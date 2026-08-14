import assert from "node:assert/strict";
import test from "node:test";

import {
  SignJWT,
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  jwtVerify,
} from "jose";

const {
  admitAdminRequest,
  normalizeAdminAccessConfig,
} = await import("../src/lib/admin-access" + ".ts");

const config = {
  adminHostname: "admin-staging.kienhieu.id.vn",
  policyAudience: "3a6f8119b3824e5b5b50ba6830f697f1ac8e998bb0246307310b74c91073f35f",
  teamDomain: "https://jolly-brook-7bc8.cloudflareaccess.com",
};

const issuer = config.teamDomain;
const audience = config.policyAudience;
const { privateKey, publicKey } = await generateKeyPair("RS256");
const publicJwk = await exportJWK(publicKey);
publicJwk.kid = "admin-access-test";
publicJwk.alg = "RS256";
publicJwk.use = "sig";
const localJwks = createLocalJWKSet({ keys: [publicJwk] });

async function localVerifier(token: string, normalized: ReturnType<typeof normalizeAdminAccessConfig> & {}) {
  assert.ok(normalized);
  const { payload } = await jwtVerify(token, localJwks, {
    algorithms: ["RS256"],
    audience: normalized.policyAudience,
    issuer: normalized.teamDomain,
  });
  const subject = typeof payload.sub === "string" ? payload.sub.trim() : "";
  if (!subject) throw new Error("missing sub");
  return { subject };
}

async function token(options: {
  audience?: string;
  expiresInSeconds?: number;
  issuer?: string;
  notBeforeSeconds?: number;
  subject?: string;
} = {}) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: "admin-access-test", typ: "JWT" })
    .setIssuer(options.issuer ?? issuer)
    .setAudience(options.audience ?? audience)
    .setSubject(options.subject ?? "access-user-123")
    .setIssuedAt(now)
    .setNotBefore(now + (options.notBeforeSeconds ?? -1))
    .setExpirationTime(now + (options.expiresInSeconds ?? 300))
    .sign(privateKey);
}

function request(
  url = "https://admin-staging.kienhieu.id.vn/api/admin/categories",
  options: { accessToken?: string; method?: string; origin?: string; emailHeader?: string } = {},
) {
  const headers = new Headers();
  if (options.accessToken !== undefined) headers.set("Cf-Access-Jwt-Assertion", options.accessToken);
  if (options.origin !== undefined) headers.set("Origin", options.origin);
  if (options.emailHeader !== undefined) {
    headers.set("Cf-Access-Authenticated-User-Email", options.emailHeader);
  }
  return new Request(url, { headers, method: options.method ?? "GET" });
}

test("normalizes the exact HTTPS Access configuration", () => {
  assert.deepEqual(normalizeAdminAccessConfig(config), {
    adminHostname: config.adminHostname,
    adminOrigin: "https://admin-staging.kienhieu.id.vn",
    policyAudience: audience,
    teamDomain: issuer,
  });
  assert.equal(normalizeAdminAccessConfig({ ...config, teamDomain: "http://example.test" }), null);
  assert.equal(normalizeAdminAccessConfig({ ...config, teamDomain: `${issuer}/unexpected` }), null);
  assert.equal(normalizeAdminAccessConfig({ ...config, policyAudience: "short" }), null);
  assert.equal(normalizeAdminAccessConfig({ ...config, adminHostname: "bad:443" }), null);
});

test("fails closed when authentication configuration is invalid", async () => {
  const result = await admitAdminRequest(
    request(),
    { ...config, policyAudience: "" },
    localVerifier,
  );
  assert.deepEqual(result, {
    code: "INTERNAL_ERROR",
    message: "Cấu hình quản trị chưa sẵn sàng.",
    ok: false,
    status: 500,
  });
});

test("hides the admin API on storefront, workers.dev and non-HTTPS hosts", async () => {
  const validToken = await token();
  for (const url of [
    "https://kienhieu.id.vn/api/admin/categories",
    "https://giacong-vn-staging.example.workers.dev/api/admin/categories",
    "http://admin-staging.kienhieu.id.vn/api/admin/categories",
  ]) {
    const result = await admitAdminRequest(request(url, { accessToken: validToken }), config, localVerifier);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 404);
      assert.equal(result.code, "NOT_FOUND");
    }
  }
});

test("requires an Access assertion on the exact admin host", async () => {
  const result = await admitAdminRequest(request(), config, localVerifier);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 401);
    assert.equal(result.code, "FORBIDDEN");
  }
});

test("requires exact same-origin on every mutation method", async () => {
  const validToken = await token();
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const missingOrigin = await admitAdminRequest(
      request(undefined, { accessToken: validToken, method }),
      config,
      localVerifier,
    );
    assert.equal(missingOrigin.ok, false);
    if (!missingOrigin.ok) assert.equal(missingOrigin.status, 403);

    const crossOrigin = await admitAdminRequest(
      request(undefined, { accessToken: validToken, method, origin: "https://kienhieu.id.vn" }),
      config,
      localVerifier,
    );
    assert.equal(crossOrigin.ok, false);
    if (!crossOrigin.ok) assert.equal(crossOrigin.status, 403);

    const admitted = await admitAdminRequest(
      request(undefined, {
        accessToken: validToken,
        method,
        origin: "https://admin-staging.kienhieu.id.vn",
      }),
      config,
      localVerifier,
    );
    assert.equal(admitted.ok, true);
  }
});

test("cryptographic verifier semantics reject bad signature issuer audience and time claims", async () => {
  const wrongIssuer = await token({ issuer: "https://wrong.cloudflareaccess.com" });
  const wrongAudience = await token({ audience: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" });
  const expired = await token({ expiresInSeconds: -30 });
  const notYetValid = await token({ notBeforeSeconds: 60 });

  const otherKeys = await generateKeyPair("RS256");
  const wrongSignature = await new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: "admin-access-test", typ: "JWT" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject("access-user-123")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(otherKeys.privateKey);

  for (const badToken of [wrongIssuer, wrongAudience, expired, notYetValid, wrongSignature]) {
    const result = await admitAdminRequest(
      request(undefined, { accessToken: badToken }),
      config,
      localVerifier,
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 401);
      assert.equal(result.code, "FORBIDDEN");
      assert.equal(result.message, "Phiên quản trị không hợp lệ.");
    }
  }
});

test("accepts a valid Access token and uses sub rather than an untrusted email header", async () => {
  const result = await admitAdminRequest(
    request(undefined, {
      accessToken: await token({ subject: "access-subject-42" }),
      emailHeader: "attacker-controlled@example.test",
    }),
    config,
    localVerifier,
  );

  assert.deepEqual(result, {
    actor: { subject: "access-subject-42" },
    ok: true,
  });
});

test("rejects a cryptographically valid token that has no subject", async () => {
  const now = Math.floor(Date.now() / 1000);
  const noSubject = await new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: "admin-access-test", typ: "JWT" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(privateKey);

  const result = await admitAdminRequest(
    request(undefined, { accessToken: noSubject }),
    config,
    localVerifier,
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 401);
});
