import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin admission keeps hostname, origin, and public-mode boundaries", async () => {
  const source = await readFile(new URL("../src/lib/admin-access.ts", import.meta.url), "utf8");
  assert.match(source, /adminHostnames/);
  assert.match(source, /adminOrigins/);
  assert.match(source, /publicAdmin/);
  assert.match(source, /cf-access-jwt-assertion/);
  assert.match(source, /mutationMethods/);
});

test("staging admin is never configured as a public demo", async () => {
  const wrangler = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  const staging = wrangler.slice(wrangler.indexOf('"staging"'));

  assert.match(wrangler, /"workers_dev":\s*false/);
  assert.match(staging, /"ADMIN_HOSTNAME":\s*"admin-staging\.kienhieu\.id\.vn"/);
  assert.match(staging, /"ADMIN_PUBLIC":\s*"false"/);
  assert.match(staging, /"STAGING_DIRECT_QA_MODE":\s*"readonly-public-qa"/);
  assert.doesNotMatch(staging, /ADMIN_PUBLIC_SUBJECT|public-demo/);
  assert.match(staging, /"TEAM_DOMAIN"/);
  assert.match(staging, /"POLICY_AUD"/);
});

test("deep QA keeps the custom edge boundary and opens workers.dev only temporarily", async () => {
  const workflow = await readFile(
    new URL("../../../.github/workflows/cloudflare-staging-deep-qa.yml", import.meta.url),
    "utf8",
  );

  assert.match(workflow, /STAGING_EDGE_ORIGIN:[\s\S]*https:\/\/staging\.kienhieu\.id\.vn/);
  assert.match(workflow, /node scripts\/staging-edge-protection-qa\.mjs/);
  assert.match(workflow, /node scripts\/manage-staging-direct-qa\.mjs open/);
  assert.match(workflow, /node scripts\/manage-staging-direct-qa\.mjs restore/);
  assert.match(workflow, /if: always\(\)/);
  assert.ok(
    workflow.indexOf("manage-staging-direct-qa.mjs restore") < workflow.indexOf("Record successful master staging QA evidence"),
    "temporary workers.dev state must be restored before success evidence is recorded",
  );
});
