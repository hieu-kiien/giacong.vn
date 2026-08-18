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
    if (header(response, "cf-mitigated") === "challenge") {
      await logCloudflareChallengeSource(route);
    }
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

function optionalEnv(name) {
  return process.env[name]?.trim() || "";
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
    finalUrl: sanitizeDiagnosticText(response.url.slice(0, 1200)),
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

async function logCloudflareChallengeSource(route) {
  const apiToken = optionalEnv("CLOUDFLARE_API_TOKEN");
  const accountId = optionalEnv("CLOUDFLARE_ACCOUNT_ID");
  if (!apiToken || !accountId) {
    console.error("CLOUDFLARE_CHALLENGE_SOURCE_UNAVAILABLE", JSON.stringify({ reason: "missing read credentials" }));
    return;
  }

  const hostname = new URL(origin).hostname.toLowerCase();
  const zoneName = optionalEnv("CLOUDFLARE_ZONE_NAME") || "kienhieu.id.vn";

  try {
    const zones = await cloudflareApi(
      `/zones?name=${encodeURIComponent(zoneName)}&account.id=${encodeURIComponent(accountId)}&status=active&per_page=50`,
      apiToken,
    );
    const matchingZones = (zones.result ?? []).filter((zone) => zone?.name === zoneName);
    if (matchingZones.length !== 1 || !matchingZones[0]?.id) {
      console.error(
        "CLOUDFLARE_CHALLENGE_SOURCE_UNAVAILABLE",
        JSON.stringify({ reason: `expected one active zone ${zoneName}, found ${matchingZones.length}` }),
      );
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 2500));

    const now = new Date();
    const start = new Date(now.getTime() - 10 * 60 * 1000);
    const query = `
      query ChallengeEvents($zoneTag: string, $start: Time, $end: Time) {
        viewer {
          zones(filter: { zoneTag: $zoneTag }) {
            firewallEventsAdaptive(
              filter: { datetime_geq: $start, datetime_leq: $end }
              limit: 50
              orderBy: [datetime_DESC]
            ) {
              action
              source
              datetime
              clientRequestHTTPHost
              clientRequestPath
              userAgent
            }
          }
        }
      }
    `;
    const analytics = await cloudflareGraphql(query, {
      zoneTag: matchingZones[0].id,
      start: start.toISOString(),
      end: now.toISOString(),
    }, apiToken);

    const events = analytics?.data?.viewer?.zones?.[0]?.firewallEventsAdaptive ?? [];
    const matchingEvents = events
      .filter((event) => event?.clientRequestHTTPHost === hostname && event?.clientRequestPath === route)
      .slice(0, 10)
      .map((event) => ({
        datetime: event?.datetime ?? "",
        action: event?.action ?? "",
        source: event?.source ?? "",
        host: event?.clientRequestHTTPHost ?? "",
        path: event?.clientRequestPath ?? "",
        userAgent: sanitizeDiagnosticText((event?.userAgent ?? "").slice(0, 240)),
      }));

    console.error(
      "CLOUDFLARE_CHALLENGE_SOURCE_DIAGNOSTIC",
      JSON.stringify({ zone: zoneName, hostname, route, matchingEvents }),
    );
  } catch (error) {
    console.error(
      "CLOUDFLARE_CHALLENGE_SOURCE_UNAVAILABLE",
      JSON.stringify({ reason: sanitizeDiagnosticText(error instanceof Error ? error.message : String(error)).slice(0, 600) }),
    );
  }
}

async function cloudflareApi(pathname, apiToken) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${pathname}`, {
    headers: { Authorization: `Bearer ${apiToken}`, Accept: "application/json" },
    signal: AbortSignal.timeout(20000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.success !== true) {
    throw new Error(cloudflareError("REST", pathname, response.status, body));
  }
  return body;
}

async function cloudflareGraphql(query, variables, apiToken) {
  const response = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(20000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || (Array.isArray(body?.errors) && body.errors.length > 0)) {
    throw new Error(cloudflareError("GraphQL", "/graphql", response.status, body));
  }
  return body;
}

function cloudflareError(kind, pathname, status, body) {
  const messages = [
    ...(Array.isArray(body?.errors) ? body.errors : []),
    ...(Array.isArray(body?.messages) ? body.messages : []),
  ].map((item) => item?.message).filter(Boolean).join(" | ");
  return `${kind} ${pathname} failed with HTTP ${status}${messages ? `: ${messages}` : ""}`;
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
