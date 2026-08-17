import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ciUrl = new URL("../../../.github/workflows/ci-cloudflare.yml", import.meta.url);
const deepQaUrl = new URL("../../../.github/workflows/cloudflare-staging-deep-qa.yml", import.meta.url);
const deepQaScriptUrl = new URL("./staging-deep-qa.mjs", import.meta.url);
const accessBootstrapUrl = new URL("./ensure-staging-access-service-auth.mjs", import.meta.url);

test("pull requests package OpenNext for staging without deploying remote state", async () => {
  const workflow = await readFile(ciUrl, "utf8");

  assert.match(workflow, /cloudflare-package:/);
  assert.match(workflow, /if: github\.event_name == 'pull_request'/);
  assert.match(workflow, /npm run cf:build:staging/);
  assert.match(workflow, /wrangler@4\.115\.0 deploy --env=staging --dry-run/);
});

test("validated master ensures staging Service Auth, applies D1 migrations and deploys the same build", async () => {
  const workflow = await readFile(ciUrl, "utf8");
  const serviceAuth = "node scripts/ensure-staging-access-service-auth.mjs";
  const migration = "d1 migrations apply GIACONG_VN_CATALOG --env=staging --remote";
  const deploy = "opennextjs-cloudflare deploy --env=staging";

  assert.match(workflow, /staging-deploy:/);
  assert.match(workflow, /if: github\.event_name != 'pull_request'/);
  assert.ok(workflow.includes(serviceAuth), "staging deploy must ensure Access Service Auth before acceptance QA");
  assert.ok(workflow.includes(migration), "staging deploy must apply pending D1 migrations");
  assert.ok(workflow.includes(deploy), "staging deploy must publish the already built OpenNext package");
  assert.ok(workflow.indexOf(serviceAuth) < workflow.indexOf(migration), "Service Auth must be verified before changing remote app state");
  assert.ok(workflow.indexOf(migration) < workflow.indexOf(deploy), "D1 migrations must complete before Worker deployment");
  assert.match(workflow, /CLOUDFLARE_ACCESS_CLIENT_ID:\s*\$\{\{ secrets\.CLOUDFLARE_ACCESS_CLIENT_ID \}\}/);
  assert.match(workflow, /CLOUDFLARE_ACCESS_CLIENT_SECRET:\s*\$\{\{ secrets\.CLOUDFLARE_ACCESS_CLIENT_SECRET \}\}/);
  assert.doesNotMatch(workflow, /Staging remains unchanged/);
});

test("Access bootstrap is scoped to the exact staging app and exact service token", async () => {
  const script = await readFile(accessBootstrapUrl, "utf8");

  assert.match(script, /const stagingDomain = "staging\.kienhieu\.id\.vn"/);
  assert.match(script, /token\?\.client_id === serviceClientId/);
  assert.match(script, /app\?\.domain === stagingDomain/);
  assert.match(script, /policy\?\.decision !== "non_identity"/);
  assert.match(script, /service_token:\s*\{ token_id: serviceToken\.id \}/);
  assert.doesNotMatch(script, /admin-staging\.kienhieu\.id\.vn|admin\.kienhieu\.id\.vn/);
  assert.match(script, /Access: Apps and Policies Read\/Write plus Access: Service Tokens Read/);
});

test("deep QA waits for successful staging deployment and checks out the deployed commit", async () => {
  const workflow = await readFile(deepQaUrl, "utf8");

  assert.match(workflow, /workflow_run:/);
  assert.match(workflow, /CI and Cloudflare staging gate/);
  assert.match(workflow, /github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(workflow, /github\.event\.workflow_run\.head_sha/);
  assert.doesNotMatch(workflow, /\n  push:/);
  assert.match(workflow, /https:\/\/staging\.kienhieu\.id\.vn/);
  assert.match(workflow, /CLOUDFLARE_ACCESS_CLIENT_ID/);
  assert.match(workflow, /CLOUDFLARE_ACCESS_CLIENT_SECRET/);
  assert.match(workflow, /node scripts\/staging-deep-qa\.mjs/);
  assert.doesNotMatch(workflow, /workers\.dev/);
});

test("staging deep QA sends the Access service token through HTTP and browser checks", async () => {
  const script = await readFile(deepQaScriptUrl, "utf8");

  assert.match(script, /requiredEnv\("CLOUDFLARE_ACCESS_CLIENT_ID"\)/);
  assert.match(script, /requiredEnv\("CLOUDFLARE_ACCESS_CLIENT_SECRET"\)/);
  assert.match(script, /"CF-Access-Client-Id"/);
  assert.match(script, /"CF-Access-Client-Secret"/);
  assert.match(script, /extraHTTPHeaders: accessHeaders/);
  assert.match(script, /wrangler@4\.115\.0/);
});
