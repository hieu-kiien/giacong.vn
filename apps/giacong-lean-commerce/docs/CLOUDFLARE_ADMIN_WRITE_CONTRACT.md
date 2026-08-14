# Cloudflare-native admin write contract

**Status:** Lean V1 staging contract, locked before admin CRUD implementation.

This document defines the server-side contract that the Cloudflare-native admin must implement before an admin UI is allowed to write D1 or R2. It complements `CLOUDFLARE_NATIVE_V1_PLAN.md`; it does not authorize production changes.

## 1. Scope and trust boundary

The admin exists to manage the canonical staging catalog and media directly through the Next.js/OpenNext Worker.

Trusted boundary:

- admin hostname: `admin-staging.kienhieu.id.vn`;
- edge protection: the existing Cloudflare Access self-hosted application and allow policy;
- Worker route: `admin-staging.kienhieu.id.vn/*` → `giacong-vn-staging`;
- server-side D1 binding: `GIACONG_VN_CATALOG`;
- server-side R2 binding: `GIACONG_VN_PRODUCT_MEDIA`.

The browser never receives D1/R2 credentials and never talks directly to D1/R2 APIs. Public storefront hostnames must not be accepted as an alternate path to admin write APIs.

Request inbox management is not part of this contract. Google Sheet + Apps Script remains the request queue until a separate decision changes it.

## 2. Authentication and request admission

Every admin read/write route must fail closed unless all admission checks pass.

Required checks:

1. Request hostname is exactly `admin-staging.kienhieu.id.vn` in staging.
2. Request has passed the Cloudflare Access boundary. Implementation should validate the Access identity/JWT mechanism supported by the deployed Worker environment rather than trusting an arbitrary client-provided identity header.
3. Mutation methods require same-origin requests. Reject cross-origin browser writes.
4. `Content-Type` must match the endpoint contract.
5. Requests exceeding the endpoint body limit are rejected before parsing.
6. Responses containing admin data use `Cache-Control: no-store`.

The public storefront origin must receive `404` or `403` for `/api/admin/**`; it must never become an unauthenticated admin API.

Lean V1 has one operator administrator. Do not add customer identity, teams or granular RBAC in this phase.

## 3. API envelope

Successful JSON responses use:

```json
{
  "ok": true,
  "data": {}
}
```

Failed JSON responses use:

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "Safe operator-facing message",
  "fieldErrors": {}
}
```

`fieldErrors` is optional and only contains safe field-level validation messages. Do not return SQL, stack traces, binding names, secrets or internal exception text.

Recommended status mapping:

- `400` malformed JSON / invalid request shape;
- `401` Access identity missing or invalid where distinguishable;
- `403` authenticated request not admitted by admin boundary;
- `404` entity not found or admin path intentionally hidden on the wrong host;
- `409` uniqueness conflict, stale write or referenced-media conflict;
- `413` request body/media too large;
- `415` unsupported media/content type;
- `422` business-rule validation failure;
- `500` unexpected server failure with generic message only.

Stable error codes for V1:

- `INVALID_REQUEST`
- `VALIDATION_ERROR`
- `NOT_FOUND`
- `UNIQUE_CONFLICT`
- `STALE_WRITE`
- `MEDIA_IN_USE`
- `UNSUPPORTED_MEDIA`
- `PAYLOAD_TOO_LARGE`
- `FORBIDDEN`
- `INTERNAL_ERROR`

## 4. Concurrency and mutation semantics

Every mutable D1 entity exposes an opaque `version` derived from its canonical `updated_at` value or an equivalent server-generated representation.

Rules:

- create requests do not send `version`;
- update/delete requests must send the last version read by the operator;
- the D1 mutation includes the version in its `WHERE` predicate;
- zero changed rows with an existing entity means `409 STALE_WRITE`;
- the server returns the newly persisted canonical record and new `version` after success;
- client clocks are never used for concurrency decisions.

Multi-row changes that must remain consistent are performed atomically with D1 batch/transaction semantics supported by the runtime. In particular, variant + tier-price replacement must never leave a half-written pricing state.

## 5. Canonical normalization

Before validation/persistence, the server performs only deterministic normalization documented here:

- trim leading/trailing Unicode whitespace from human text fields;
- normalize slugs to lowercase ASCII hyphenated form;
- normalize SKU text by trimming but preserve the operator-provided case unless a future schema decision makes SKU case-insensitive;
- convert booleans to canonical stored `0/1` only inside the persistence adapter;
- prices are integer VND, never floating point;
- integer quantity fields reject fractional, NaN, infinity and numeric strings unless the endpoint schema explicitly parses them before validation.

The server must not silently repair invalid MOQ/step/tier/contact combinations. Return a validation error instead.

## 6. Category contract

### Routes

- `GET /api/admin/categories`
- `POST /api/admin/categories`
- `GET /api/admin/categories/[id]`
- `PATCH /api/admin/categories/[id]`

Category deletion is out of Lean V1 initially. Deactivation is the safe removal path until product-reference behavior is accepted explicitly.

### Create fields

Required exact keys:

- `name`: string, 1..120 chars;
- `slug`: string, 1..140 chars after normalization;
- `description`: string, 0..5000 chars;
- `imageUrl`: string or null, max 500 chars;
- `sortOrder`: integer, 0..1,000,000;
- `isActive`: boolean.

### Update fields

Required exact keys:

- `version`;
- `name`;
- `slug`;
- `description`;
- `imageUrl`;
- `sortOrder`;
- `isActive`.

Slug uniqueness conflict returns `409 UNIQUE_CONFLICT`.

## 7. Product contract

### Routes

- `GET /api/admin/products`
- `POST /api/admin/products`
- `GET /api/admin/products/[id]`
- `PATCH /api/admin/products/[id]`

Product deletion is out of Lean V1 initially. Use `isActive=false` until destructive-delete semantics are separately accepted.

### Create/update fields

Canonical fields:

- `name`: string, 1..180 chars;
- `slug`: string, 1..200 chars;
- `sku`: string, 1..120 chars;
- `shortDescription`: string, 0..1000 chars;
- `description`: string, 0..30000 chars;
- `imageUrl`: string or null, max 500 chars;
- `categoryId`: positive integer or null;
- `isActive`: boolean;
- update only: `version`.

Validation:

- slug unique;
- SKU unique;
- referenced category exists when `categoryId` is not null;
- media reference, when it points to managed product media, must use the canonical `/media/products/...` form.

The response for a product detail includes its current variants and tier prices so the UI can render one canonical editing snapshot.

## 8. Variant contract

### Routes

- `POST /api/admin/products/[productId]/variants`
- `PATCH /api/admin/variants/[id]`
- `DELETE /api/admin/variants/[id]`

Deletion requires `version` and is rejected while the server determines that removing the variant would violate an accepted invariant. Lean V1 has no order history in D1, so the initial implementation may allow deletion when the variant belongs to the target product and no additional catalog reference exists; this behavior must be covered by tests before enabling the UI action.

### Fields

- `name`: string, 1..180 chars;
- `sku`: string, 1..120 chars, unique;
- `optionLabel`: string, 1..120 chars;
- `unit`: string, 1..50 chars;
- `moq`: positive integer;
- `quantityStep`: positive integer;
- `contactFromQuantity`: positive integer;
- `isAvailable`: boolean;
- `sortOrder`: integer, 0..1,000,000;
- `attributeId`: positive integer;
- `attributeCode`: string, 1..120 chars;
- `attributeLabel`: string, 1..120 chars;
- `optionId`: non-negative integer;
- `imageUrl`: string or null, max 500 chars;
- update/delete only: `version`.

Business invariants:

```text
moq > 0
quantityStep > 0
contactFromQuantity >= moq
(contactFromQuantity - moq) % quantityStep == 0
```

A write that would make existing tier prices unreachable under a new MOQ/step is rejected with `422 VALIDATION_ERROR` unless the same atomic request also replaces the affected tiers with a valid set.

## 9. Tier-price contract

### Routes

- `POST /api/admin/variants/[variantId]/tier-prices`
- `PATCH /api/admin/tier-prices/[id]`
- `DELETE /api/admin/tier-prices/[id]`
- optional atomic replacement: `PUT /api/admin/variants/[variantId]/tier-prices`

### Fields

- `minQuantity`: positive integer;
- `price`: positive integer VND;
- update/delete only: `version` when a row-level version is exposed; otherwise the parent variant version is the concurrency token for atomic tier replacement.

For every tier:

```text
minQuantity >= variant.moq
(minQuantity - variant.moq) % variant.quantityStep == 0
price > 0
currency == "VND"
```

Within one variant:

- `minQuantity` is unique;
- tiers are returned sorted ascending by `minQuantity`;
- duplicate boundaries are rejected;
- the canonical storefront price rule remains the existing server rule; admin writes must not introduce a tier state that read/cart code rejects.

The preferred UI write model is atomic replacement of the complete tier set using the parent variant version, because it avoids transient invalid intermediate states.

## 10. Product media contract

### Routes

- `POST /api/admin/media/products`
- `GET /api/admin/media/products`
- `DELETE /api/admin/media/products/[key]`

Association to product/variant occurs through the normal product/variant update routes by storing the returned canonical media URL.

### Upload rules

- request: `multipart/form-data`;
- one file per request in Lean V1;
- maximum file size: **8 MiB**;
- allowed media types: `image/jpeg`, `image/png`, `image/webp`;
- file signature must be validated server-side; do not trust only extension or browser MIME;
- server generates the object key; client cannot choose arbitrary R2 paths;
- canonical key namespace: `products/<uuid>.<ext>`;
- canonical public URL: `/media/products/<uuid>.<ext>`;
- no SVG, executable content, archives or arbitrary binary upload in V1;
- set an explicit content type on the R2 object;
- do not expose bucket credentials or presigned write access to the browser in V1.

### Delete rules

Before deleting an R2 object, query D1 for product and variant references to its canonical URL. If any reference exists, return `409 MEDIA_IN_USE` and list only safe entity identifiers needed by the admin UI to resolve the reference.

Missing objects are handled idempotently only if the D1 reference check is clear; otherwise fail closed.

## 11. Service-content contract

### Routes

- `GET /api/admin/services`
- `GET /api/admin/services/[id]`
- `PATCH /api/admin/services/[id]`

Initial Lean V1 fields follow the existing D1 schema:

- `slug`: string, 1..200 chars, unique;
- `name`: string, 1..180 chars;
- `summary`: string, 0..2000 chars;
- `description`: string, 0..30000 chars;
- `metaTitle`: string, 0..180 chars;
- `isActive`: boolean;
- update: `version`.

Creating new service taxonomy from the admin is deferred until the existing service-page/family mapping is explicitly reconciled with D1. The first UI may therefore be edit-only for known managed rows.

## 12. Auditability

Every successful admin mutation must emit a minimal server-side audit record. Before write APIs are enabled, add an explicit D1 migration for an audit table with a contract equivalent to:

- unique `request_id`;
- `created_at` server timestamp;
- actor identity from the validated Cloudflare Access context;
- action: `create`, `update`, `delete`, `upload`;
- entity type;
- entity identifier/key;
- previous version when applicable;
- resulting version when applicable;
- deterministic hash of the accepted mutation payload or another compact change fingerprint.

Do not store Access tokens, secrets or unnecessary PII in the audit log. The mutation and audit insert must be coupled so a successful business mutation cannot silently omit its audit event.

## 13. Request IDs and idempotency

Every mutation accepts or assigns a UUID request ID. The response echoes it.

For operations that can be retried after an uncertain network outcome, especially media upload and creates, the server should use the request ID to avoid duplicate side effects. At minimum, duplicate successful request IDs must not create a second entity/object.

## 14. Body limits

Initial limits:

- normal JSON admin mutation: 64 KiB;
- long-content service/product mutation: 128 KiB;
- media upload: 8 MiB file plus bounded multipart overhead.

Read the body with an explicit byte guard. Reject oversized bodies with `413 PAYLOAD_TOO_LARGE`.

## 15. Required regression tests before UI writes

The server contract is not considered implemented until automated tests cover at least:

Authentication/admission:

- wrong hostname rejected;
- missing/invalid Access identity rejected;
- public storefront cannot call admin writes;
- cross-origin mutation rejected.

Categories/products:

- create success;
- update success;
- duplicate slug/SKU conflict;
- missing category reference;
- stale version conflict;
- deactivation preserves canonical read behavior.

Variants/tiers:

- valid MOQ/step/contact threshold;
- contact threshold below MOQ;
- unreachable contact threshold;
- tier below MOQ;
- tier off step;
- duplicate tier boundary;
- stale variant write;
- SKU conflict;
- availability update;
- atomic tier replacement preserves valid cart pricing.

Media:

- JPEG/PNG/WebP accepted;
- wrong signature rejected;
- unsupported type rejected;
- oversized upload rejected;
- generated key namespace enforced;
- referenced object deletion rejected;
- unreferenced object deletion succeeds;
- duplicate request ID is idempotent.

Audit/error safety:

- every successful mutation writes an audit event;
- failed validation writes no business mutation;
- error payload does not leak SQL/stack/secrets;
- responses are `no-store`.

After implementation, staging runtime QA must verify the admin write through the protected hostname and then verify the public storefront reflects the canonical D1/R2 result.

## 16. Production prohibition

This contract is staging-only until all production acceptance gates in `CLOUDFLARE_NATIVE_V1_PLAN.md` are met.

Do not:

- bind a production admin write API before staging acceptance;
- create/copy production D1/R2 data implicitly;
- reuse staging demo data as production seed data;
- change `giacong-vn`, production D1/R2 or `kienhieu.id.vn/*` merely to test this contract.
