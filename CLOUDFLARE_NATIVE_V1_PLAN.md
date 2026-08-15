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

## 2. Execution gates

No feature work is allowed to outrun the gates.

Every server capability must pass, in order:

1. contract/validation tests;
2. repository/runtime tests where applicable;
3. lint;
4. typecheck;
5. production build;
6. Cloudflare staging deployment/gate;
7. live staging smoke/read-back;
8. documentation/state update.

The Admin UI is blocked until the server contracts and Cloudflare staging runtime are green.

## 3. One-day execution model

Work is planned as **one controlled delivery day at a time**, not as an unbounded feature sprint.

### Daily objective

At the start of each day, select **one primary outcome** that can be proven end-to-end. A day is successful only when its acceptance evidence exists; number of commits or lines changed is not a success metric.

### Daily sequence

```text
1. Inspect current gate and live evidence
        ↓
2. Pick one bounded outcome
        ↓
3. Implement the smallest complete slice
        ↓
4. Test → lint → typecheck → build
        ↓
5. Cloudflare staging verification
        ↓
6. Read-back / regression
        ↓
7. Update plan + current-state evidence
        ↓
8. Stop at the gate
```

### Daily stop rules

- If Quality Gate is red, stop feature expansion and fix the gate.
- If Cloudflare staging is red, stop feature expansion and fix runtime/deployment drift.
- Do not weaken/delete tests merely to make CI green.
- Do not expose secrets to logs or documentation.
- Do not promote production as part of normal daily work.
- Do not start UI work while server/runtime gates are red.

## 4. Phase A — Foundation hardening (CURRENT)

### A1. Quality gate

- [x] Admin contract tests established.
- [x] Commerce regression suite passed at the test level in the latest observed quality run.
- [x] Remove the `no-explicit-any` lint failure in `admin-variant-repository.ts`.
- [ ] Full `npm run check` green on the post-fix commit.
- [ ] Typecheck green.
- [ ] Production build green.
- [ ] Review dependency audit without blind `npm audit fix --force`.

### A2. CI hygiene

- [ ] Review GitHub Actions runtime warnings and upgrade action majors only where compatible.
- [x] Keep Cloudflare staging gate dependent on a green quality gate.
- [x] Keep production deployment locked.

### A3. Day 1 — current delivery target

**Primary outcome:** prove the existing server foundation is CI-clean before adding another feature.

**Work package:**

1. Verify the post-lint-fix Quality Gate.
2. If red, fix only the first real blocking error and rerun the gate.
3. If green, verify typecheck and production build.
4. Run the Cloudflare staging gate against the same commit.
5. Read back Worker version, D1 binding/schema, R2 binding, Access protection and admin API smoke paths.
6. Record the evidence in `CLOUDFLARE_CURRENT_STATE.md`.
7. Update this plan with the next day's single primary outcome.

**Day 1 acceptance criteria:**

- Quality Gate green;
- typecheck green;
- production build green;
- Cloudflare staging gate green;
- admin Access remains enforced;
- no production change;
- current-state evidence committed.

**Day 1 non-goals:**

- no Admin UI;
- no new business feature unless required to repair an existing gate;
- no production deployment;
- no dependency-wide automated upgrade;
- no Vercel build repair.

## 5. Phase B — Cloudflare staging verification

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

## 6. Phase C — Server contract completion

Only after Phase A/B gates are green, implement and verify one bounded capability per delivery day:

1. Category — stabilize existing contract/runtime evidence.
2. Product — stabilize existing contract/runtime evidence.
3. Variant — stabilize existing contract/runtime evidence.
4. Tier prices — atomic replacement + parent revision concurrency.
5. Product media — R2 lifecycle + D1 references/audit.
6. Service content — schema/read/write contract based on the live D1 schema.

Each mutation must preserve validation, authorization, optimistic concurrency where applicable, idempotency, auditability, and bounded payloads.

A capability is not considered complete until its Cloudflare staging path has been exercised.

## 7. Phase D — Admin UI

Only after Phase C and staging verification are green:

- [ ] Admin shell/dashboard
- [ ] Categories
- [ ] Products
- [ ] Variants
- [ ] Tier prices
- [ ] Product media
- [ ] Services

The Admin UI calls `/api/admin/*` only. It must not access D1/R2 directly.

Admin UI work is also delivered as bounded daily slices: shell → category CRUD → product CRUD → variant/tier editing → media → services → regression/accessibility.

## 8. Phase E — Production readiness

- [ ] staging regression complete;
- [ ] security/access review;
- [ ] backup/restore and rollback evidence;
- [ ] observability checks;
- [ ] deployment runbook current;
- [ ] explicit production approval;
- [ ] production promotion.

Production work is a separate release event, not a daily implementation task.

## 9. Legacy cleanup

- [x] Remove obsolete Bagisto-origin probe workflow from the repository.
- [x] Disable automatic Vercel Git deployments from repository configuration (`vercel.json`).
- [ ] Verify no new Vercel preview deployments are created after the disabling commit.
- [ ] Remove remaining obsolete Vercel/Bagisto references only after confirming they are historical/documentary rather than runtime dependencies.

## 10. Documentation source of truth

This file is the execution plan for the current Cloudflare-native migration. Historical plans may be retained for traceability but must not override this document's runtime decisions.

`README.md` should point contributors here when the plan/navigation is updated.

`CLOUDFLARE_CURRENT_STATE.md` is the evidence ledger for live Cloudflare state.

`DAILY_EXECUTION_MAP.md` is the bounded work queue for the current delivery day and must never override the architectural plan.

## 11. Current gate

**Do not start Admin UI yet.** The immediate objective is to make the post-lint-fix quality gate fully green, then verify the deployed Cloudflare staging runtime. Only after both are green may the next server-contract day be selected.
