import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyAccessApplications,
  formatRelatedAccessApps,
} from "./access-application-targets.mjs";

const target = "staging.kienhieu.id.vn";

test("recognizes legacy exact-domain Access applications", () => {
  const app = { id: "legacy", name: "legacy storefront", domain: target };
  const result = classifyAccessApplications([app], target);

  assert.deepEqual(result.exactApps, [app]);
  assert.deepEqual(result.relatedApps, []);
});

test("recognizes exact public destinations even when legacy domain is not the target", () => {
  const app = {
    id: "destinations",
    name: "staging storefront",
    domain: "display.example.invalid",
    destinations: [{ type: "public", uri: `https://${target}/*` }],
  };
  const result = classifyAccessApplications([app], target);

  assert.deepEqual(result.exactApps, [app]);
  assert.deepEqual(result.relatedApps, []);
});

test("recognizes exact legacy self_hosted_domains", () => {
  const app = {
    id: "legacy-multi-field",
    self_hosted_domains: [`${target}/*`],
  };
  const result = classifyAccessApplications([app], target);

  assert.deepEqual(result.exactApps, [app]);
  assert.deepEqual(result.relatedApps, []);
});

test("fails closed for wildcard applications that cover the target", () => {
  const app = {
    id: "wildcard",
    name: "shared staging",
    destinations: [{ type: "public", uri: "*.kienhieu.id.vn/*" }],
  };
  const result = classifyAccessApplications([app], target);

  assert.deepEqual(result.exactApps, []);
  assert.equal(result.relatedApps.length, 1);
  assert.match(formatRelatedAccessApps(result.relatedApps), /shared staging/);
  assert.match(formatRelatedAccessApps(result.relatedApps), /\*\.kienhieu\.id\.vn/);
});

test("fails closed for multi-domain applications even when one destination is exact", () => {
  const app = {
    id: "multi",
    destinations: [
      { type: "public", uri: target },
      { type: "public", uri: "admin-staging.kienhieu.id.vn" },
    ],
  };
  const result = classifyAccessApplications([app], target);

  assert.deepEqual(result.exactApps, []);
  assert.equal(result.relatedApps.length, 1);
});

test("fails closed for path-only or mixed destination applications", () => {
  const pathOnly = {
    id: "path-only",
    destinations: [{ type: "public", uri: `${target}/private/*` }],
  };
  const mixed = {
    id: "mixed",
    destinations: [
      { type: "public", uri: target },
      { type: "private", hostname: "internal.example" },
    ],
  };

  const result = classifyAccessApplications([pathOnly, mixed], target);
  assert.deepEqual(result.exactApps, []);
  assert.equal(result.relatedApps.length, 2);
});
