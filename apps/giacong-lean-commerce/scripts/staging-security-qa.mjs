import assert from "node:assert/strict";

const origin = requiredEnv("STAGING_ORIGIN").replace(/\/$/, "");
const accessHeaders = {
  "CF-Access-Client-Id": requiredEnv("CLOUDFLARE_ACCESS_CLIENT_ID"),
  "CF-Access-Client-Secret": requiredEnv("CLOUDFLARE_ACCESS_CLIENT_SECRET"),
};

const routes = [
  "/",
  "/san-pham",
  "/tin-tuc",
  "/api/catalog/products/bot-gao-lut-xay-min",
];

for (const route of routes) {
  const response = await fetch(`${origin}${route}`, {
    headers: accessHeaders,
    redirect: "follow",
    signal: AbortSignal.timeout(25000),
  });

  if (response.status >= 400) {
    await logSafeFailureDiagnostic(response, route);
  }

  assert.ok(response.status < 400, `${route}: HTTP ${response.status}`);
  assertHsts(response, route);
  assert.equal(header(response, "x-content-type-options"), "nosniff", `${route}: X-Content-Type-Options`);
  assert.equal(header(response, "x-frame-options"), "deny", `${route}: X-Frame-Options`);
  assert.equal(
    header(response, "referrer-policy"),
    "strict-origin-when-cross-origin",
    `${route}: Referrer-Policy`,
  );

  const permissions = header(response, "permissions-policy");
  for (const directive of ["camera=()", "microphone=()", "geolocation=()", "payment=()", "usb=()"]) {
    assert.ok(permissions.includes(directive), `${route}: Permissions-Policy missing ${directive}`);
  }

  assert.equal(header(response, "x-dns-prefetch-control"), "off", `${route}: X-DNS-Prefetch-Control`);
  assert.equal(response.headers.get("x-powered-by"), null, `${route}: framework disclosure via X-Powered-By`);

  console.log(`${route}: baseline security headers passed (HTTP ${response.status}).`);
}

console.log("Staging baseline security-header acceptance passed.");

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for staging security QA.`);
  return value;
}

function header(response, name) {
  return (response.headers.get(name) ?? "").trim().toLowerCase();
}

function assertHsts(response, route) {
  const hsts = header(response, "strict-transport-security");
  const maxAge = /(?:^|;)\s*max-age=(\d+)/i.exec(hsts)?.[1];
  assert.ok(maxAge, `${route}: Strict-Transport-Security missing max-age`);
  assert.ok(Number(maxAge) >= 31536000, `${route}: HSTS max-age must be at least one year`);
  assert.ok(hsts.includes("includesubdomains"), `${route}: HSTS must include subdomains`);
}

async function logSafeFailureDiagnostic(response, route) {
  const metadata = {
    route,
    status: response.status,
    finalUrl: response.url,
    redirected: response.redirected,
    server: diagnosticHeader(response, "server"),
    contentType: diagnosticHeader(response, "content-type"),
    location: diagnosticHeader(response, "location"),
    cfRay: diagnosticHeader(response, "cf-ray"),
    cfMitigated: diagnosticHeader(response, "cf-mitigated"),
    cfCacheStatus: diagnosticHeader(response, "cf-cache-status"),
  };

  let bodySnippet = "";
  try {
    bodySnippet = sanitizeDiagnosticText((await response.clone().text()).slice(0, 1200)).slice(0, 600);
  } catch (error) {
    bodySnippet = `[body unavailable: ${sanitizeDiagnosticText(error instanceof Error ? error.message : String(error))}]`;
  }

  console.error("STAGING_HTTP_FAILURE_DIAGNOSTIC", JSON.stringify({ ...metadata, bodySnippet }));
}

function diagnosticHeader(response, name) {
  return sanitizeDiagnosticText((response.headers.get(name) ?? "").slice(0, 300));
}

function sanitizeDiagnosticText(value) {
  return String(value)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/([?&](?:token|code|secret|key|signature|sig|jwt|credential)=)[^&\s"'<>]+/gi, "$1[REDACTED]")
    .replace(/\b(?:bearer\s+)?[A-Za-z0-9_-]{48,}\b/gi, "[REDACTED_LONG_TOKEN]")
    .trim();
}
