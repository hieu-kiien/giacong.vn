import assert from "node:assert/strict";

const origin = requiredEnv("STAGING_EDGE_ORIGIN").replace(/\/$/, "");
const response = await fetch(`${origin}/`, {
  headers: {
    "CF-Access-Client-Id": requiredEnv("CLOUDFLARE_ACCESS_CLIENT_ID"),
    "CF-Access-Client-Secret": requiredEnv("CLOUDFLARE_ACCESS_CLIENT_SECRET"),
  },
  redirect: "manual",
  signal: AbortSignal.timeout(25000),
});

if (response.status < 400) {
  console.log(`Custom staging edge is directly reachable for QA (HTTP ${response.status}).`);
  process.exit(0);
}

const server = (response.headers.get("server") ?? "").trim().toLowerCase();
const mitigated = (response.headers.get("cf-mitigated") ?? "").trim().toLowerCase();
assert.equal(response.status, 403, `custom staging edge returned unexpected HTTP ${response.status}`);
assert.equal(server, "cloudflare", "custom staging 403 did not come from Cloudflare edge");
assert.equal(mitigated, "challenge", "custom staging 403 was not a recognized Cloudflare challenge");
console.log("Custom staging edge is protected by a recognized Cloudflare challenge; application QA will use a temporary guarded workers.dev route.");

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for staging edge QA.`);
  return value;
}
