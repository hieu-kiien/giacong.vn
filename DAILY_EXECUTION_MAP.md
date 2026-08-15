# Giacong.vn — Daily Execution Map

**Current day:** Day 1 — Foundation → Cloudflare staging proof  
**Branch:** `feat/cloudflare-admin-category-api`  
**Mode:** staging-only  
**Production:** locked

## North-star outcome

By the end of this delivery day, the existing Cloudflare-native server foundation must be **provably healthy**, not merely implemented:

> **Quality Gate → Typecheck → Build → Cloudflare staging gate → Live smoke/read-back → documented evidence**

No new feature is required if any gate is red.

## Current execution status

- Quality/test/lint/typecheck/build: **green on the latest observed quality run**.
- Cloudflare staging gate: **enabled for pull requests** in the non-deploy CI workflow; the previous PR runs skipped it because the workflow intentionally restricted the job to non-PR events.
- Cloudflare staging gate: **pending on the post-fix commit after this workflow correction**.
- Live smoke/read-back: **not yet evidenced**; no production deployment is allowed.

## Today's work package

### 1. Quality Gate — first priority

- Verify the post-lint/typecheck-fix commit.
- If failed, fix only the first blocking defect.
- Re-run the full gate.
- Do not suppress or weaken tests.

**Status:** green on the latest observed quality run; re-verification is triggered by the workflow correction commit.

### 2. Typecheck + production build

- Confirm TypeScript typecheck.
- Confirm production build.
- Treat warnings separately from blockers.

**Status:** green on the latest observed quality run.

### 3. Cloudflare staging verification

Use the existing GitHub Actions → Cloudflare API bridge. Do not expose credential values.

The CI staging gate is intentionally **non-deploying**. It verifies credentials, the existing staging Worker deployment state, OpenNext staging build output, and Wrangler dry-run packaging. It must run on PRs as well as non-PR events so a green PR cannot hide a skipped Cloudflare gate.

Verify:

- active Worker and version;
- expected D1 binding and schema/migration state;
- D1 admin read/write smoke where safe;
- expected R2 buckets/bindings;
- R2 media lifecycle smoke where safe;
- Cloudflare Access on admin host/routes;
- DNS/routes;
- environment/secrets presence only, never values;
- audit-log read-back;
- rollback/version evidence.

**Status:** pending. The current CI gate is a pre-deployment/runtime-package verification; live read-back requires a verified staging endpoint and must not be inferred from a dry-run.

**Done when:** staging gate is green and live read-back matches the repository contract.

### 4. Regression evidence

Capture:

- test result;
- Worker version;
- D1 database identity/schema evidence;
- R2 bucket identity evidence;
- Access response evidence;
- relevant API smoke responses;
- any known drift or warning.

Update `CLOUDFLARE_CURRENT_STATE.md` only with verified evidence.

**Status:** pending Cloudflare evidence.

### 5. Documentation close-out

Update:

- `CLOUDFLARE_NATIVE_V1_PLAN.md`
- `CLOUDFLARE_CURRENT_STATE.md`

Record the next single bounded daily outcome.

## Today's non-goals

- ❌ Admin UI
- ❌ production deployment
- ❌ Vercel build repair
- ❌ broad dependency upgrade
- ❌ new commerce feature merely to increase progress
- ❌ changing architecture without evidence

## Decision tree

```text
Quality Gate red?
  └─ YES → fix gate only
  └─ NO
      ↓
Typecheck/build red?
  └─ YES → fix gate only
  └─ NO
      ↓
Cloudflare staging red or skipped?
  └─ YES → fix gate/workflow/runtime verification only
  └─ NO
      ↓
Live read-back mismatch?
  └─ YES → investigate/fix evidence gap
  └─ NO
      ↓
Day complete
      ↓
Select ONE next-day server-contract outcome
```

## Definition of done for a delivery day

A day is complete only if:

- the selected outcome is implemented or verified;
- automated gates are green for the relevant scope;
- staging evidence exists where the scope reaches Cloudflare;
- documentation reflects the actual state;
- production remains untouched;
- no known failure is hidden by changing tests or gates.

## Next-day selection rule

If Day 1 completes successfully, the next day should be selected from the highest-risk unfinished server capability, in this order:

1. Tier-price atomic replacement and concurrency proof;
2. R2 product-media lifecycle proof;
3. Service-content contract from live D1 schema;
4. full Admin UI shell only after all server/runtime gates are green.
