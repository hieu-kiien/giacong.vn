# Giacong.vn — Daily Execution Map

**Current day:** Day 1 — Foundation → Cloudflare staging proof  
**Branch:** `feat/cloudflare-admin-category-api`  
**Mode:** staging-only  
**Production:** locked

## North-star outcome

By the end of this delivery day, the existing Cloudflare-native server foundation must be **provably healthy**, not merely implemented:

> **Quality Gate → Typecheck → Build → Cloudflare staging gate → Live smoke/read-back → documented evidence**

No new feature is required if any gate is red.

## Today's work package

### 1. Quality Gate — first priority

- Verify the post-lint-fix commit.
- If failed, fix only the first blocking defect.
- Re-run the full gate.
- Do not suppress or weaken tests.

**Done when:** GitHub Quality Gate is green.

### 2. Typecheck + production build

- Confirm TypeScript typecheck.
- Confirm production build.
- Treat warnings separately from blockers.

**Done when:** both are green on the same commit that passed Quality Gate.

### 3. Cloudflare staging verification

Use the existing GitHub Actions → Cloudflare API bridge. Do not expose credential values.

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
Cloudflare staging red?
  └─ YES → fix runtime/deployment drift only
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
