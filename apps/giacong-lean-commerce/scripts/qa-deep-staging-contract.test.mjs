import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("deep staging QA waits for semantic render readiness", async () => {
  const source = await readFile(new URL("./qa-deep-staging.mjs", import.meta.url), "utf8");

  assert.match(source, /async function waitForPageSettled\(page/);
  assert.match(source, /waitForRenderedSelector\(page, selector/);
  assert.match(source, /document\.fonts\?\.ready/);
  assert.match(source, /await waitForPageSettled\(page\)/);
  assert.doesNotMatch(source, /await page\.waitForTimeout\(500\)/);
});

test("deep staging QA supports the configured Cloudflare Access service token without printing it", async () => {
  const workflow = await readFile(new URL("../../../.github/workflows/cloudflare-staging-deep-qa.yml", import.meta.url), "utf8");

  assert.match(workflow, /CLOUDFLARE_ACCESS_CLIENT_ID:\s*\$\{\{\s*secrets\.CLOUDFLARE_ACCESS_CLIENT_ID\s*\}\}/);
  assert.match(workflow, /CLOUDFLARE_ACCESS_CLIENT_SECRET:\s*\$\{\{\s*secrets\.CLOUDFLARE_ACCESS_CLIENT_SECRET\s*\}\}/);
  assert.match(workflow, /staging_curl\(\)/);
  assert.match(workflow, /CF-Access-Client-Id:/);
  assert.match(workflow, /CF-Access-Client-Secret:/);
  assert.match(workflow, /--user-agent\s+['"]Giacong-Staging-Deep-QA\/1\.0['"]/);
  assert.match(workflow, /context\.route\(/);
  assert.doesNotMatch(workflow, /extraHTTPHeaders:\s*accessHeaders/);
  assert.doesNotMatch(workflow, /echo\s+.*CLOUDFLARE_ACCESS_CLIENT_SECRET/);
});
