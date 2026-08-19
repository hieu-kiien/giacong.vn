import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const config = JSON.parse(await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
const required = config?.env?.staging?.secrets?.required;

test("staging declares Google delivery values as encrypted Worker secrets only", () => {
  assert.deepEqual(required, [
    "GOOGLE_SHEETS_WEBHOOK_URL",
    "GOOGLE_SHEETS_WEBHOOK_SECRET",
  ]);
  assert.equal(Object.hasOwn(config?.vars ?? {}, "GOOGLE_SHEETS_WEBHOOK_URL"), false);
  assert.equal(Object.hasOwn(config?.vars ?? {}, "GOOGLE_SHEETS_WEBHOOK_SECRET"), false);
  assert.equal(Object.hasOwn(config?.env?.staging?.vars ?? {}, "GOOGLE_SHEETS_WEBHOOK_URL"), false);
  assert.equal(Object.hasOwn(config?.env?.staging?.vars ?? {}, "GOOGLE_SHEETS_WEBHOOK_SECRET"), false);
  assert.equal(config?.secrets, undefined, "Production must not require the staging Google sink secrets.");
});

test("contact runtime and Apps Script template keep the explicit secondary-sink authorization boundary", async () => {
  const [contactSource, appsScriptSource] = await Promise.all([
    readFile(new URL("../src/lib/contact-webhook.ts", import.meta.url), "utf8"),
    readFile(new URL("../docs/google-apps-script-contact-webhook.gs", import.meta.url), "utf8"),
  ]);
  assert.match(contactSource, /GOOGLE_SHEETS_WEBHOOK_URL/);
  assert.match(contactSource, /GOOGLE_SHEETS_WEBHOOK_SECRET/);
  assert.match(appsScriptSource, /CONTACT_WEBHOOK_SECRET/);
  assert.match(appsScriptSource, /validSecret\(payload\)/);
});

test("staging deploy injects Google delivery secrets from GitHub Actions without committing values", async () => {
  const workflow = await readFile(new URL("../../../.github/workflows/ci-cloudflare.yml", import.meta.url), "utf8");

  assert.match(workflow, /STAGING_GOOGLE_SHEETS_WEBHOOK_URL:\s*\$\{\{ secrets\.STAGING_GOOGLE_SHEETS_WEBHOOK_URL \}\}/);
  assert.match(workflow, /STAGING_GOOGLE_SHEETS_WEBHOOK_SECRET:\s*\$\{\{ secrets\.STAGING_GOOGLE_SHEETS_WEBHOOK_SECRET \}\}/);
  assert.match(workflow, /test -n "\$STAGING_GOOGLE_SHEETS_WEBHOOK_URL"/);
  assert.match(workflow, /test -n "\$STAGING_GOOGLE_SHEETS_WEBHOOK_SECRET"/);
  assert.match(workflow, /--secrets-file=\/tmp\/giacong-staging-google-delivery-secrets\.json/);
  assert.match(workflow, /Remove ephemeral staging Google delivery secret file/);
  assert.doesNotMatch(workflow, /AKfy[a-zA-Z0-9_-]{20,}/, "A real Apps Script deployment capability must never be committed to CI source.");
});
