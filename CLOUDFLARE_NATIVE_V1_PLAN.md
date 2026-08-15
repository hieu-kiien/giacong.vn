# Giacong.vn — Cloudflare-Native V1 Execution Plan

**Status:** Active execution plan  
**Branch:** `feat/cloudflare-admin-category-api`  
**Deployment target:** Cloudflare only  
**Production:** Locked until explicit release approval

## 1. Architectural decision

The target runtime is Cloudflare-native:

```text
GitHub
  ↓
GitHub Actions
  ↓
Cloudflare Workers / OpenNext
  ├── D1 — commerce/catalog source of truth
  ├── R2 — product media and cache objects
  ├── Access — admin admission control
  ├── DNS / Routes
  └── Observability
```

Vercel is legacy and is **not** a deployment target. Bagisto/VPS is not an application runtime target.

## 2. Current execution rule

Do not add another feature layer while the quality or Cloudflare staging gates are red.

Every server capability must pass:

1. contract/validation tests;
2. repository/runtime tests where applicable;
3. lint;
4. typecheck;
5. production build;
6. Cloudflare staging deployment/gate;
7. live staging smoke/read-back;
8. documentation/state update.

The UI is blocked until the server contracts and Cloudflare staging runtime are green.

## 3. Phase A — Foundation hardening (CURRENT)

### A1. Quality gate

- [x] Admin contract tests established.
- [x] Commerce regression suite currently passing at the test level in the latest observed run.
- [ ] Remove the remaining `no-explicit-any` lint failure in `admin-variant-repository.ts`.
- [ ] Full `npm run check` green.
- [ ] Typecheck green.
- [ ] Production build green.
- [ ] Review dependency audit without blind `npm audit fix --force`.

### A2. CI hygiene

- [ ] Review GitHub Actions runtime warnings and upgrade action majors only where compatible.
- [ ] Keep Cloudflare staging gate dependent on a green quality gate.
- [ ] Keep production deployment locked.

## 4. Phase B — Cloudflare staging verification

After Phase A is green, verify the actual deployed runtime, not only source code:

- [ ] active Worker/version;
- [ ] D1 binding and schema/migrations;
- [ ] D1 read/write smoke for admin contracts;
- [ ] R2 bucket binding;
- [ ] R2 upload/read/delete smoke;
- [ ] Access protection for admin routes;
- [ ] DNS/routes;
- [ ] required environment/secrets presence without exposing values;
- [ ] cache/runtime behavior;
- [ ] audit-log read-back;
- [ ] rollback/version evidence.

No production promotion is part of this phase.

## 5. Phase C — Server contract completion

Implement and verify in this order:

1. Category
2. Product
3. Variant
4. Tier prices
5. Product media
6. Service content

Each mutation must preserve the project rules for validation, authorization, optimistic concurrency where applicable, idempotency, auditability, and bounded payloads.

A capability is not considered complete until its Cloudflare staging path has been exercised.

## 6. Phase D — Admin UI

Only after Phase C and staging verification are green:

- [ ] Admin shell/dashboard
- [ ] Categories
- [ ] Products
- [ ] Variants
- [ ] Tier prices
- [ ] Product media
- [ ] Services

The Admin UI calls `/api/admin/*` only. It must not access D1/R2 directly.

## 7. Phase E — Production readiness

- [ ] staging regression complete;
- [ ] security/access review;
- [ ] backup/restore and rollback evidence;
- [ ] observability checks;
- [ ] deployment runbook current;
- [ ] explicit production approval;
- [ ] production promotion.

## 8. Legacy cleanup

- [x] Remove obsolete Bagisto-origin probe workflow from the repository.
- [x] Disable automatic Vercel Git deployments from repository configuration (`vercel.json`).
- [ ] Verify no new Vercel preview deployments are created after the disabling commit.
- [ ] Remove remaining obsolete Vercel/Bagisto references only after confirming they are historical/documentary rather than runtime dependencies.

## 9. Documentation source of truth

This file is the execution plan for the current Cloudflare-native migration. Historical plans may be retained for traceability but must not override this document's runtime decisions.

`README.md` should point contributors here when the plan/navigation is updated.

## 10. Current gate

**Do not start Admin UI yet.** The immediate next action is to make the quality gate fully green, then verify the deployed Cloudflare staging runtime before opening the next server-contract phase.
