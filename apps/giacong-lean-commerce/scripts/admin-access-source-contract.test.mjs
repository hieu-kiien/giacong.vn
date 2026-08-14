import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/lib/admin-access.ts", import.meta.url), "utf8");

test("default Access verifier uses Cloudflare JWKS with strict RS256 issuer and audience checks", () => {
  assert.match(source, /createRemoteJWKSet\(new URL\(`\$\{teamDomain\}\/cdn-cgi\/access\/certs`\)\)/);
  assert.match(source, /algorithms:\s*\["RS256"\]/);
  assert.match(source, /audience:\s*config\.policyAudience/);
  assert.match(source, /issuer:\s*config\.teamDomain/);
  assert.match(source, /request\.headers\.get\("cf-access-jwt-assertion"\)/i);
  assert.doesNotMatch(source, /cf-access-authenticated-user-email[^\n]*subject/i);
});
