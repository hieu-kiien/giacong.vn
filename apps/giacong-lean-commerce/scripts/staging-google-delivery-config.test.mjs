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
