# Production readiness map

Status date: 2026-08-23

Tracking issue: #70 `Production readiness map and launch gates`

Baseline master when this map was created: `e48df6d6f01fbff5591e1d39b171e8b5e88b6720`.

## Purpose

This document is the execution map from the current Cloudflare-native Lean V1 baseline to a deliberate production promotion. It is not authorization to mutate production. A gate closes only when the required runtime/operator evidence exists.

The canonical architecture remains:

- Next.js/OpenNext on Cloudflare Workers;
- D1 as canonical commerce/content/request data;
- R2 for media and Next cache where configured;
- Cloudflare Queue for asynchronous secondary delivery where configured;
- Google Apps Script/Sheet only as a secondary operational sink, never the only durable intake boundary;
- Cloudflare Access plus server-side admission for protected Admin surfaces;
- no Bagisto/VPS/Tunnel dependency in the canonical runtime.

## Current position

Already merged and treated as foundation:

- D1/R2 storefront and catalog migration;
- D1-first durable lead/request intake with replay/idempotency guards;
- Cloudflare-native Admin CRUD and audit/stale-write boundaries;
- D1-backed News CMS and article-owned News media lifecycle;
- reference-safe/tombstone-before-R2 media deletion;
- baseline response-security acceptance;
- staging semantic/keyboard accessibility acceptance;
- production dependency SCA gate with exact, expiring exceptions for currently unavoidable findings;
- Cloudflare recovery/rollback runbook;
- staging synthetic performance anti-regression budgets;
- durable issue #70 breadcrumbs for correlating a successful master staging deploy with its post-deploy QA run.

Production remains **NO-GO** until G0 through G7 are green and retained evidence is reviewed before G8.

Latest accepted staging chain (2026-08-22):

- source master SHA: `4651e94d88a36dff700df832a3bcde73c5770576`;
- G1 source CI run `32573099984`, active staging Worker version `200b9734-6bef-4161-b189-84aa5f738724`, with deep-QA run `32573384328`;
- G2 News media operator acceptance run `32573791603`;
- G3 durable request-delivery acceptance run `32573995446`.

The corresponding deployment, deep-QA, G2 and G3 breadcrumbs are retained in issue #70. Older failed attempts below remain historical evidence and do not reopen the latest accepted chain.

## Gate map

| Gate | State | Objective | Exit evidence |
| --- | --- | --- | --- |
| G0 | COMPLETE | Reconcile source of truth | Map + issue #70 established; `CLOUDFLARE_CURRENT_STATE.md` aligned with merged security/recovery/performance work and current launch order |
| G1 | COMPLETE | Current master staging evidence | Correlated issue #70 deployment + deep-QA breadcrumbs for source CI run `32573099984`, master SHA `4651e94d88a36dff700df832a3bcde73c5770576`, active Worker version `200b9734-6bef-4161-b189-84aa5f738724` |
| G2 | COMPLETE | News media operator acceptance | G2 run `32573791603` proved Access-protected upload/select/save/render/MEDIA_IN_USE/replace/delete with D1/R2 post-conditions |
| G3 | COMPLETE | Durable request-delivery acceptance | G3 run `32573995446` proved Queue/consumer delivery, D1 inbox visibility, invalid-input rejection and idempotent replay |
| G4 | IN PROGRESS | Security acceptance completion | CSP/source audit recorded in `docs/CSP_STAGING_AUDIT.md`; the policy must be observed on the accepted master staging run and pass the security QA |
| G5 | TODO | Recovery drill | Staging Worker/D1/R2/Queue recovery drill completed with timings and retained evidence |
| G6 | TODO | Production data/content freeze | Approved manifest with demo/test data excluded |
| G7 | TODO | Production resources and rehearsal | Intentional resource audit, migration rehearsal, backup/export and smoke/rollback checklist proven |
| G8 | BLOCKED | Production promotion | G0–G7 green, then controlled upload/smoke/promotion with immediate rollback on NO-GO trigger |

## G0 — Reconcile source of truth

Completed by the production-readiness map/tracker and the current-state reconciliation that lands with this gate update:

1. `docs/PRODUCTION_READINESS_MAP.md` and issue #70 are the remaining-work tracker.
2. `CLOUDFLARE_CURRENT_STATE.md` records the merged dependency SCA gate (#67), recovery runbook (#68), performance gate (#69), readiness map (#71) and the evidence-breadcrumb mechanism (#72) without upgrading source existence into runtime acceptance.
3. The stale “write recovery/rollback procedure” future item is removed; the remaining recovery work is the actual staging drill.
4. Future gate closures must keep issue #70 and current-state evidence synchronized.

## G1 — Current master staging evidence (COMPLETE)

1. Observe the post-merge `master` staging deployment for the current commit.
2. Record the exact deployed Worker version and traffic state in issue #70.
3. Confirm the staging sequence executes the security-header, accessibility, performance, broader deep-QA and News regression checks.
4. Require the deployment and QA breadcrumbs to reference the same source `CI and Cloudflare staging gate` run id before G1 closes.
5. Record failures as route-specific work; do not weaken budgets merely to make the gate green.

Retry note, 2026-08-19: master `195c5001b1e9776a37cfdd2e5405038950ceb296` completed source CI run `32210290044` and recorded a 100% staging deployment breadcrumb, but no correlated deep-QA breadcrumb was recorded. That source run is therefore not accepted as G1 evidence. This documentation-only change deliberately forces a fresh authoritative master staging cycle; the new cycle must still satisfy the exact same correlated-evidence rule before G1 can close.

Accepted evidence, 2026-08-22: source CI run `32573099984` deployed master SHA `4651e94d88a36dff700df832a3bcde73c5770576` to Worker version `200b9734-6bef-4161-b189-84aa5f738724` at 100% traffic. Deep-QA run `32573384328` passed the edge boundary, security headers, accessibility, performance, commerce, responsive browser and News regression checks, and recorded the matching source CI run id.

## G2 — News media operator acceptance (COMPLETE)

Use the protected staging Admin through Cloudflare Access and perform a real operator flow:

1. upload a valid article image;
2. select it and persist the thumbnail;
3. verify the public article renders the expected media;
4. try deleting the currently persisted thumbnail and require `MEDIA_IN_USE`;
5. select and persist a replacement thumbnail;
6. delete the old asset;
7. verify the article remains healthy, the D1 media row is tombstoned/deleted as designed, and the R2 object state matches the cleanup result;
8. retain identifiers and timestamps needed to audit the post-condition without retaining credentials or sensitive tokens.

Accepted evidence, 2026-08-22: run `32573791603` completed the protected preview flow, including `MEDIA_IN_USE`, replacement rendering, D1 deletion/activation checks, R2 404/200 checks and cleanup. Active staging traffic remained unchanged.

## G3 — Durable request-delivery acceptance (COMPLETE)

1. Verify the real `GIACONG_VN_LEAD_QUEUE` binding and consumer if asynchronous delivery is enabled.
2. Submit a controlled staging request and trace its public/request reference into D1.
3. Confirm Queue delivery uses the same stable request identifier and retries do not duplicate the durable request or secondary sink row.
4. Verify failed secondary delivery remains visible in the D1-backed Admin inbox.
5. If Google Apps Script/Sheet remains enabled, verify ownership, deployment, authorization, schema/protection, redirect/timeout handling and idempotency on the real configured account.

Accepted evidence, 2026-08-22: run `32573995446` proved real staging Queue enqueue and consumer delivery to the configured secondary sink, D1-backed Admin inbox visibility, invalid-input rejection before persistence and exact replay with one durable lead and no extra delivery attempt. Active staging traffic remained unchanged.

## G4 — Security acceptance completion

1. Inventory all script/style/image/connect sources used by storefront/Admin/Turnstile on staging.
2. Define a CSP compatible with the actual source set and Next/OpenNext runtime.
3. Prefer enforcement when evidence supports it. If enforcement must be deferred, record a narrow reason, expiry/review trigger and compensating controls rather than silently omitting the gate.
4. Re-run the security acceptance after the decision/change.

Current source status, 2026-08-23: a scoped CSP is now present in `next.config.ts` and the staging security QA checks its required directives and rejects `unsafe-eval`. G4 remains open until the policy is deployed on master and the post-deploy security/deep-QA evidence is retained.

## G5 — Recovery drill

Follow the merged recovery runbook on staging only:

1. capture pre-drill Worker/D1/R2/Queue evidence;
2. prove Worker rollback independently from data recovery;
3. prove D1 export/Time Travel restore semantics using a controlled staging scenario;
4. verify R2 reconciliation expectations and Queue/DLQ/idempotency behavior;
5. record operator steps, elapsed times, post-conditions and any runbook corrections.

## G6 — Production data/content freeze

Create an approved production manifest covering:

- categories/taxonomy;
- products/SKU/variants;
- prices, MOQ, quantity step, contact thresholds and tier boundaries;
- product/service/site/News media;
- site content, News content and SEO metadata;
- contact/trust claims;
- explicit exclusion of all staging/demo/test rows and assets.

No production migration should use an implicit copy of staging data.

## G7 — Production resources and migration rehearsal

1. Audit/create only the production D1/R2/Queue resources required by the approved architecture.
2. Rehearse the approved dataset migration and run post-condition audits.
3. Produce backup/export artifacts and verify rollback triggers.
4. Freeze the production smoke checklist and accountable operator/owner for the promotion window.

## G8 — Production promotion

Only after G0–G7 are green:

1. capture pre-change evidence;
2. upload/version the production Worker without traffic first where supported;
3. run version/pre-promotion smoke checks;
4. promote deliberately;
5. run production smoke and request/media health checks immediately;
6. roll back on any documented NO-GO trigger;
7. update `CLOUDFLARE_CURRENT_STATE.md` with the exact evidence after acceptance.

## Operating rules

- Small, isolated branches and PRs.
- Staging is the mandatory mutation/acceptance environment before production.
- No direct production experimentation.
- Preserve D1 as canonical data and R2 reference safety.
- Preserve admission/auth, exact write shapes, audit logging, stale-write protection and idempotency.
- Never treat source existence, a merged PR, or a dry-run build as operator/runtime acceptance by itself.
- Do not use `npm audit fix --force` or force a Next/OpenNext runtime jump without compatibility evidence.
- Every closed gate must leave a durable breadcrumb in issue #70 and the current-state evidence document.
