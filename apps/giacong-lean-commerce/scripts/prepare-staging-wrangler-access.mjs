import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

const aud = requiredEnv("STAGING_ADMIN_ACCESS_AUD");
const sourcePath = process.env.WRANGLER_SOURCE_CONFIG?.trim() || "wrangler.jsonc";
const outputPath = process.env.WRANGLER_RUNTIME_CONFIG?.trim() || ".wrangler-staging-runtime.json";

assert.match(aud, /^[0-9a-f]{64}$/i, "STAGING_ADMIN_ACCESS_AUD must be a 64-character Access AUD tag.");

const source = await readFile(sourcePath, "utf8");
let config;
try {
  config = JSON.parse(source);
} catch (error) {
  throw new Error(`${sourcePath} must remain JSON-compatible so the staging runtime config can be prepared safely: ${error instanceof Error ? error.message : String(error)}`);
}

const productionAud = config?.vars?.POLICY_AUD;
assert.match(productionAud ?? "", /^[0-9a-f]{64}$/i, "Production POLICY_AUD must remain explicitly configured.");
assert.ok(config?.env?.staging?.vars, "Wrangler staging vars are missing.");

config.env.staging.vars.POLICY_AUD = aud;
await writeFile(outputPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

assert.equal(config.vars.POLICY_AUD, productionAud, "Preparing staging runtime config must not alter production POLICY_AUD.");
assert.equal(config.env.staging.vars.POLICY_AUD, aud, "Prepared staging runtime config did not pin the current Access AUD.");
console.log(`Prepared ${outputPath} with the current staging Admin Access AUD; production vars are unchanged.`);

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
