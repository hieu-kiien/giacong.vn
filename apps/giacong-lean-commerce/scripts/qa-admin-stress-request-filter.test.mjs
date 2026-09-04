import assert from "node:assert/strict";
import { test } from "node:test";
import { isUnexpectedMutationRequest } from "./qa-admin-stress-helpers.mjs";

const stagingBaseUrl = "https://admin-staging.kienhieu.id.vn";

test("ignores Cloudflare RUM telemetry but flags app mutations", () => {
  assert.equal(
    isUnexpectedMutationRequest("POST", `${stagingBaseUrl}/cdn-cgi/rum`, stagingBaseUrl),
    false,
  );
  assert.equal(
    isUnexpectedMutationRequest("POST", `${stagingBaseUrl}/api/admin/products`, stagingBaseUrl),
    true,
  );
  assert.equal(
    isUnexpectedMutationRequest("PATCH", `${stagingBaseUrl}/api/admin/products/1`, stagingBaseUrl),
    true,
  );
  assert.equal(
    isUnexpectedMutationRequest("GET", `${stagingBaseUrl}/api/admin/products`, stagingBaseUrl),
    false,
  );
  assert.equal(
    isUnexpectedMutationRequest("POST", "https://example.invalid/collect", stagingBaseUrl),
    false,
  );
});
