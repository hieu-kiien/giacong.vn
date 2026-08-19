import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { classifyAccessApplications } from "./access-application-targets.mjs";

const ciUrl = new URL("../../../.github/workflows/ci-cloudflare.yml", import.meta.url);
const deepQaUrl = new URL("../../../.github/workflows/cloudflare-staging-deep-qa.yml", import.meta.url);
const deepQaScriptUrl = new URL("./staging-deep-qa.mjs", import.meta.url);
const directQaManagerUrl = new URL("./manage-staging-direct-qa.mjs", import.meta.url);
const accessBootstrapUrl = new URL("./ensure-staging-access-service-auth.mjs", import.meta.url);

test("pull requests package OpenNext for staging without deploying remote state", async () => {
  const workflow = await readFile(ciUrl, "utf8");

  assert.match(workflow, /cloudflare-package:/);
  assert.match(workflow, /if: github\.event_name == 'pull_request'/);
  assert.match(workflow, /npm run cf:build:staging/);
  assert.match(workflow, /wrangler@4\.115\.0 deploy --env=staging --dry-run/);
});

test("validated master checks optional staging Service Auth, applies D1 migrations and deploys the same build", async () => {
  const workflow = await readFile(ciUrl, "utf8");
  const serviceAuth = "node scripts/ensure-staging-access-service-auth.mjs";
  const migration = "d1 migrations apply GIACONG_VN_CATALOG --env=staging --remote";
  const deploy = "opennextjs-cloudflare deploy --env=staging";

  assert.match(workflow, /staging-deploy:/);
  assert.match(workflow, /if: github\.event_name != 'pull_request'/);
  assert.ok(workflow.includes(serviceAuth), "staging deploy must inspect Access Service Auth before acceptance QA");
  assert.ok(workflow.includes(migration), "staging deploy must apply pending D1 migrations");
  assert.ok(workflow.includes(deploy), "staging deploy must publish the already built OpenNext package");
  assert.ok(workflow.indexOf(serviceAuth) < workflow.indexOf(migration), "Access bootstrap must run before changing remote app state");
  assert.ok(workflow.indexOf(migration) < workflow.indexOf(deploy), "D1 migrations must complete before Worker deployment");
  assert.match(workflow, /CLOUDFLARE_ACCESS_CLIENT_ID:\s*\$\{\{ secrets\.CLOUDFLARE_ACCESS_CLIENT_ID \}\}/);
  assert.match(workflow, /CLOUDFLARE_ACCESS_CLIENT_SECRET:\s*\$\{\{ secrets\.CLOUDFLARE_ACCESS_CLIENT_SECRET \}\}/);
  assert.doesNotMatch(workflow, /Staging remains unchanged/);
});

test("Access bootstrap supports current destination fields and refuses broad application-level Service Auth", async () => {
  const script = await readFile(accessBootstrapUrl, "utf8");

  assert.match(
    script,
    /process\.env\.ACCESS_SERVICE_AUTH_DOMAIN\?\.trim\(\) \|\| "staging\.kienhieu\.id\.vn"/,
  );
  assert.match(script, /ACCESS_SERVICE_AUTH_REQUIRED\?\.trim\(\)\.toLowerCase\(\) === "true"/);
  assert.match(script, /classifyAccessApplications\(applications\.result \?\? \[\], targetDomain\)/);
  assert.match(script, /ACCESS_APP_SCOPE_TOO_BROAD/);
  assert.match(script, /application-level Service Auth policy/);
  assert.match(script, /targetApps\.length === 0 && !accessAppRequired/);
  assert.match(script, /Service Auth bootstrap is not required for this target/);
  assert.match(script, /assert\.match\(targetDomain, \/\^\[a-z0-9\.\-\]\+\$\/i/);
  assert.match(script, /token\?\.client_id === serviceClientId/);
  assert.match(script, /policy\?\.decision !== "non_identity"/);
  assert.match(script, /service_token:\s*\{ token_id: serviceToken\.id \}/);
  assert.match(script, /Access: Apps and Policies Read\/Write plus Access: Service Tokens Read/);
});

test("Access target discovery accepts exact destinations but rejects wildcard and multi-domain scope", () => {
  const target = "staging.kienhieu.id.vn";
  const exact = { id: "exact", destinations: [{ type: "public", uri: `https://${target}/*` }] };
  const wildcard = { id: "wildcard", destinations: [{ type: "public", uri: "*.kienhieu.id.vn/*" }] };
  const multi = {
    id: "multi",
    destinations: [
      { type: "public", uri: target },
      { type: "public", uri: "admin-staging.kienhieu.id.vn" },
    ],
  };

  const exactResult = classifyAccessApplications([exact], target);
  assert.deepEqual(exactResult.exactApps, [exact]);
  assert.deepEqual(exactResult.relatedApps, []);

  const broadResult = classifyAccessApplications([wildcard, multi], target);
  assert.deepEqual(broadResult.exactApps, []);
  assert.equal(broadResult.relatedApps.length, 2);
});

test("deep QA waits for successful deployment and separates edge from application QA", async () => {
  const workflow = await readFile(deepQaUrl, "utf8");

  assert.match(workflow, /workflow_run:/);
  assert.match(workflow, /CI and Cloudflare staging gate/);
  assert.match(workflow, /github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(workflow, /github\.event\.workflow_run\.head_sha/);
  assert.doesNotMatch(workflow, /\n  push:/);
  assert.match(workflow, /STAGING_EDGE_ORIGIN:[\s\S]*https:\/\/staging\.kienhieu\.id\.vn/);
  assert.match(workflow, /staging-edge-protection-qa\.mjs/);
  assert.match(workflow, /manage-staging-direct-qa\.mjs open/);
  assert.match(workflow, /manage-staging-direct-qa\.mjs restore/);
  assert.match(workflow, /CLOUDFLARE_ACCESS_CLIENT_ID/);
  assert.match(workflow, /CLOUDFLARE_ACCESS_CLIENT_SECRET/);
  assert.match(workflow, /node scripts\/staging-deep-qa\.mjs/);
});

test("free-tier direct QA waits for representative route propagation, opens only a temporary script subdomain, and restores prior state", async () => {
  const script = await readFile(directQaManagerUrl, "utf8");

  assert.match(script, /\/workers\/subdomain/);
  assert.match(script, /\/workers\/scripts\/\$\{scriptName\}\/subdomain/);
  assert.match(script, /enabled: true, previews_enabled: false/);
  assert.match(script, /STAGING_DIRECT_QA_PREVIOUS_ENABLED/);
  assert.match(script, /STAGING_DIRECT_QA_PREVIOUS_PREVIEWS/);
  assert.match(script, /await waitForDirectRoute\(origin\)/);
  assert.match(script, /const attempts = 30/);
  assert.match(script, /const readinessPaths = \["\/", "\/san-pham"\]/);
  assert.match(script, /__staging_direct_qa_ready/);
  assert.match(script, /results\.every\(\(result\) => result\.status !== null && result\.status < 400\)/);
  assert.ok(
    script.indexOf("await waitForDirectRoute(origin)") < script.indexOf("STAGING_ORIGIN: origin"),
    "STAGING_ORIGIN must not be published to downstream QA before representative workers.dev routes are reachable",
  );
  assert.match(script, /STAGING_ORIGIN/);
  assert.match(script, /\.workers\.dev/);
  assert.doesNotMatch(script, /zones\/.*settings|bot_management|firewall\/rules|rulesets/);
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
