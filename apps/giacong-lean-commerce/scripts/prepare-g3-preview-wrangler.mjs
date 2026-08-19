import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

const aud = requiredEnv("G3_PREVIEW_ACCESS_AUD");
const hostname = requiredEnv("G3_PREVIEW_HOSTNAME");
const sourcePath = process.env.WRANGLER_SOURCE_CONFIG?.trim() || "wrangler.jsonc";
const outputPath = process.env.WRANGLER_G3_PREVIEW_CONFIG?.trim() || ".wrangler-g3-preview.json";
const g3PreviewMode = "access-protected-g3-preview";

assert.match(aud, /^[0-9a-f]{64}$/i, "G3_PREVIEW_ACCESS_AUD must be a 64-character Access AUD tag.");
assert.match(hostname, /^[a-z0-9.-]+\.workers\.dev$/i, "G3_PREVIEW_HOSTNAME must be an exact workers.dev preview hostname.");

const source = await readFile(sourcePath, "utf8");
let config;
try {
  config = JSON.parse(source);
} catch (error) {
  throw new Error(`${sourcePath} must remain JSON-compatible so the G3 preview config can be prepared safely: ${error instanceof Error ? error.message : String(error)}`);
}

const productionAud = config?.vars?.POLICY_AUD;
const productionAdminHostname = config?.vars?.ADMIN_HOSTNAME;
const productionAdminHostnames = config?.vars?.ADMIN_HOSTNAMES;
const productionDirectQaMode = config?.vars?.STAGING_DIRECT_QA_MODE;
assert.match(productionAud ?? "", /^[0-9a-f]{64}$/i, "Production POLICY_AUD must remain explicitly configured.");
assert.ok(config?.env?.staging?.vars, "Wrangler staging vars are missing.");

config.env.staging.preview_urls = true;
config.env.staging.workers_dev = false;
config.env.staging.vars.ADMIN_HOSTNAME = hostname;
config.env.staging.vars.ADMIN_HOSTNAMES = hostname;
config.env.staging.vars.POLICY_AUD = aud;
config.env.staging.vars.STAGING_DIRECT_QA_MODE = g3PreviewMode;

await writeFile(outputPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

assert.equal(config.vars.POLICY_AUD, productionAud, "Preparing G3 preview config must not alter Production POLICY_AUD.");
assert.equal(config.vars.ADMIN_HOSTNAME, productionAdminHostname, "Preparing G3 preview config must not alter Production ADMIN_HOSTNAME.");
assert.equal(config.vars.ADMIN_HOSTNAMES, productionAdminHostnames, "Preparing G3 preview config must not alter Production ADMIN_HOSTNAMES.");
assert.equal(config.vars.STAGING_DIRECT_QA_MODE, productionDirectQaMode, "Preparing G3 preview config must not alter Production STAGING_DIRECT_QA_MODE.");
assert.equal(config.env.staging.preview_urls, true, "G3 preview config must explicitly enable preview URLs.");
assert.equal(config.env.staging.workers_dev, false, "G3 preview config must keep the root workers.dev route disabled.");
assert.equal(config.env.staging.vars.ADMIN_HOSTNAME, hostname);
assert.equal(config.env.staging.vars.ADMIN_HOSTNAMES, hostname);
assert.equal(config.env.staging.vars.POLICY_AUD, aud);
assert.equal(config.env.staging.vars.STAGING_DIRECT_QA_MODE, g3PreviewMode);
console.log(`Prepared ${outputPath} for the exact Access-protected G3 lead preview; Production vars are unchanged.`);

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
