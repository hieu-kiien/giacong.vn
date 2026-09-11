// Regression: the product admin form keeps inputs as strings, but the server
// write contract only accepts JSON numbers for categoryId/leadTimeDays.
// A chosen category must arrive as a number, an empty one as null — otherwise
// every save with a category fails with a categoryId field error.
import assert from "node:assert/strict";
import test from "node:test";
import { buildAdminProductPayload } from "../src/lib/admin-product-form.ts";
import { parseAdminProductCreateCommand } from "../src/lib/admin-product-command.ts";
import { parseAdminProductPayload } from "../src/lib/admin-product-input.ts";

const REQUEST_ID = "123e4567-e89b-42d3-a456-426614174000";

function baseForm() {
  return {
    categoryId: "",
    description: "Mo ta",
    imageUrl: "",
    isActive: false,
    leadTimeDays: "",
    name: "Mon thu",
    shortDescription: "",
    sku: "TEST-001",
    slug: "mon-thu",
    status: "draft",
  };
}

test("product form sends an empty category as null", () => {
  const payload = buildAdminProductPayload(baseForm(), REQUEST_ID);

  assert.equal(payload.categoryId, null);
});

test("product form sends a chosen category as a JSON number", () => {
  const payload = buildAdminProductPayload({ ...baseForm(), categoryId: "3" }, REQUEST_ID);

  assert.equal(typeof payload.categoryId, "number");
  assert.equal(payload.categoryId, 3);
});

test("form payload with a chosen category passes the server create command", () => {
  const payload = buildAdminProductPayload({ ...baseForm(), categoryId: "3" }, REQUEST_ID);
  const { command, fieldErrors } = parseAdminProductCreateCommand(payload);

  assert.deepEqual(fieldErrors, {});
  assert.ok(command);
  assert.equal(command.input.categoryId, 3);
});

test("form payload without a category passes the server create command", () => {
  const payload = buildAdminProductPayload(baseForm(), REQUEST_ID);
  const { command, fieldErrors } = parseAdminProductCreateCommand(payload);

  assert.deepEqual(fieldErrors, {});
  assert.ok(command);
  assert.equal(command.input.categoryId, null);
});

test("product editor rejects an empty name before a write", () => {
  const payload = buildAdminProductPayload({ ...baseForm(), name: "" }, REQUEST_ID);
  const parsed = parseAdminProductPayload(payload);

  assert.equal(parsed.input, null);
  assert.match(parsed.fieldErrors.name ?? "", /Tên sản phẩm/);
});
