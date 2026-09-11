# Admin product reassessment — Lean V1

**Date:** 2026-09-09
**Mode:** audit-only; no code, configuration, data, deployment, commit, or production changes
**Audience:** project owner and technically experienced staff who should be able to operate the existing site without developer assistance

## Executive conclusion

The admin already has the Lean V1 building blocks for product, service-copy, news, media, site settings, page sections, navigation, owner access, audit, and request review. The main problem is not missing CRUD screens. It is unclear ownership of the public source of truth and too many overlapping edit paths.

Keep the product/catalog core, draft/publish safeguards, media reference checks, owner/audit controls, and the existing request-intake boundary. Before adding features, make three boundaries explicit:

1. **Services:** `/admin/dich-vu` currently edits managed copy for records that overlay a static 13-family/offerings taxonomy. It does not own the complete public service tree.
2. **Website content:** `/admin/noi-dung`, `/admin/thiet-ke`, and contextual visual editing are three different authoring paths. Their responsibility and preview/read-back contract is not obvious to an operator.
3. **Navigation:** `/admin/dieu-huong` edits primary/footer rows, while the nested Sản phẩm/Dịch vụ mega-menu remains captured/static markup and CSS. Staff cannot correct the full menu from the admin.

This is **not enough evidence to call the control plane staging-ready**: route load and source coverage are not acceptance. It is a viable staging candidate with open gates, but there is no production-ready claim. The remaining gate is complete UI → save → publish → public read-back → recovery evidence for every high-value domain, plus the ownership decisions above.

## Evidence and confidence

### Runtime evidence

- Read-only route inventory was checked in the authenticated staging admin on the current staging release after the modal readability fix. The routes loaded without rendered alerts: dashboard, products, services, news, content/brand, page design, navigation, leads, members, and audit.
- Modal readability was rechecked live: opaque panel `rgb(255,254,250)`, visible border `rgb(220,227,220)`, dark text `rgb(30,42,39)`, backdrop `rgba(24,34,29,.44)`, z-index 80, confirm button minimum height 42px. No write was made.
- The earlier staging write/read-back test covered a site-setting draft, invalid-length rejection, idempotent retry, conflicting request-id rejection, audit rows, reload read-back, and restoration to the original value. Final state was clean.
- Browser R1 evidence covered sidebar, pathname back/forward, nested variant/media guards, and query/hash stay behavior. Same-route query/hash discard was fixed in source and deployed, but a fresh authenticated live proof of the post-discard component reset remains pending; do not count it as a passed live gate.
- Public staging menu Escape/re-entry behavior is verified: Sản phẩm and Dịch vụ close while hovered and reopen on pointer/focus re-entry. This is a runtime interaction fix, not an admin customization capability.

### Source evidence

- `src/app/admin/san-pham/page.tsx` and `/api/admin/products/**` cover product editing, categories, variants, tier prices, media selection, import, archive, and batch operations.
- `src/app/admin/dich-vu/page.tsx` and `/api/admin/services/**` cover service records with name, slug, status, summary, description, MOQ summary, lead time, image, archive, and batch operations.
- `src/lib/cloudflare-services.ts` explicitly treats D1 service rows as an additive managed-copy overlay and falls back to `src/data/service-families.ts`.
- `src/data/service-families.ts` owns the static 13-family taxonomy and offering links. The managed D1 service query does not replace the family offering arrays.
- `src/app/admin/tin-tuc/page.tsx` and `/api/admin/news/**` cover news draft CRUD, publish/unpublish, delete, and batch publication.
- `src/app/admin/noi-dung/page.tsx` and `/api/admin/site-settings/**` cover global settings with draft, per-setting publish, publish-all, media upload, version checks, and unsaved protection.
- `src/components/admin/AdminPageBuilder.tsx` and `/api/admin/pages/**` cover schema-safe page blocks, page draft, SEO fields, and publish.
- `src/components/admin/AdminVisualEditor.tsx`/`AdminVisualMode.tsx` provide contextual visual editing in addition to settings and page-builder routes.
- `src/components/admin/AdminNavigationManager.tsx` and `/api/admin/navigation/**` cover editable primary/footer rows only. Nested mega-menu content is in `src/lib/captured-markup.ts` and its runtime interaction is in `src/app/globals.css`/`src/components/GiacongInteractions.tsx`.
- `/api/admin/leads/**` and `/admin/yeu-cau` provide an admin request view, while the Lean V1 decision source keeps Google Sheet + Apps Script as the request queue. These are related operational surfaces, not silently interchangeable sources of truth.

Confidence labels in this report:

- **Confirmed:** directly observed in the current UI or read from the current source.
- **Source-confirmed:** established by source/contracts/tests but not demonstrated end-to-end in this audit.
- **Open gate:** requires an authenticated staging action or an owner decision; it is not a defect claim.

## Current capability map

| Area | Existing capability | Public/source of truth | Operator autonomy assessment | Disposition |
| --- | --- | --- | --- | --- |
| Products | CRUD, category, status, SKU, descriptions, archive/batch, CSV import | D1 catalog, R2 media | Strong core; verify complete publish/read-back and failure recovery | Keep; finish evidence |
| Variants/prices | Variant fields, MOQ/step/contact threshold, tier prices, availability, media | D1 catalog + server price calculation | High integrity sensitivity; do not simplify away validation/concurrency | Keep; protect |
| Categories | View/create/edit/active/sort and batch paths | D1 catalog | Appropriate Lean V1 scope | Keep |
| Services | CRUD/copy/media/status/batch | D1 copy overlay plus static taxonomy | Staff self-service is incomplete until family/offering links are controlled | Add validated nested taxonomy model |
| News | Draft CRUD, edit, delete, publish/unpublish, batch | D1/news public reader | Suitable; verify cover-media and public read-back | Keep |
| Global content | Brand, SEO, home, contact, footer settings; draft/publish | D1 site settings | Useful, but overlaps with visual/page authoring | Keep and narrow |
| Page design | Safe section schema, draft, SEO, publish, new page | D1 pages/public route | Useful only for schema-backed pages; creation is secondary to recovery priorities | Keep; defer expansion |
| Visual editing | Contextual edit mode and target actions | Depends on target surface | Helpful shortcut but creates a third mental model | Keep as shortcut, not a separate source |
| Navigation | Primary/footer label, href, order, active, draft/publish | D1 navigation rows | Does not cover nested mega-menu tree | Keep top-level; resolve nested ownership |
| Requests | Search/filter/status/detail UI and lead APIs | Google Sheet + Apps Script remains V1 queue | Operational boundary must be explicit; do not call this a replacement inbox without a decision | Keep; document boundary |
| Members/access | One owner role, active-state protections, Access boundary | Cloudflare Access + D1 admin records | Security control, not a feature to cut because there is one owner today | Keep |
| Audit | Entity/search filtering and admin write audit trail | D1 audit | Required for safe operation and incident review | Keep |

## Findings

### F-01 — Service admin does not own the service taxonomy

**Severity:** P1 product-ownership gap
**Confidence:** Confirmed / source-confirmed
**Effort:** M for a validated nested taxonomy model; L if taxonomy migration also changes public routes
**Locations:** [`src/app/admin/dich-vu/page.tsx:67`](../src/app/admin/dich-vu/page.tsx#L67), [`src/lib/cloudflare-services.ts:28-69`](../src/lib/cloudflare-services.ts#L28), [`src/data/service-families.ts:1-36`](../src/data/service-families.ts#L1), [`src/app/(storefront)/thue-gia-cong/page.tsx:4-15`](../src/app/%28storefront%29/thue-gia-cong/page.tsx#L4)

The storefront directory and family pages start from the static `serviceFamilies` list: 13 families with offering arrays and hrefs. D1 can override the matching row's name, summary, description, image, lead time, and MOQ facts, but it does not replace the offering arrays or their links. An operator can therefore publish a changed service record while the public taxonomy, child offerings, or route intent remain unchanged.

**Impact:** staff may believe “Dịch vụ gia công” is the complete service catalog, while the actual public IA is split between code and D1. This can leave stale labels, links, or missing offerings without an admin-visible error.

**Recommendation:** because staff have explicitly requested menu/service self-service, make family/offering taxonomy a first-class controlled dataset with validated parent/child links, route-family checks, draft/publish, and preview. A managed-copy-only label is a temporary containment step, not equivalent autonomy. Do not build a second ad-hoc editor disconnected from the public reader.

### F-02 — Global settings and visual editing share state; page-builder overlap is a UX concern

**Severity:** P1 workflow/operability
**Confidence:** Confirmed for global-settings duplication; UX inference for page-builder overlap
**Effort:** S for navigation/labels; M if the visual editor is reduced to a single shared controller
**Locations:** [`src/app/admin/noi-dung/page.tsx:58-98`](../src/app/admin/noi-dung/page.tsx#L58), [`src/app/admin/noi-dung/page.tsx:144-182`](../src/app/admin/noi-dung/page.tsx#L144), [`src/components/admin/AdminVisualEditor.tsx:38-49`](../src/components/admin/AdminVisualEditor.tsx#L38), [`src/components/admin/AdminVisualEditor.tsx:327-367`](../src/components/admin/AdminVisualEditor.tsx#L327), [`src/components/admin/AdminPageBuilder.tsx:175-208`](../src/components/admin/AdminPageBuilder.tsx#L175)

There is a concrete shared owner between `/admin/noi-dung` and visual mode: both load `/api/admin/site-settings`; both can edit the same `hero_primary_cta_label` / `hero_primary_cta_url` region keys; both save through `PATCH /api/admin/site-settings`; and both publish through `/api/admin/site-settings/publish`. The generic content screen exposes the same setting rows at `page.tsx:320-357`, while visual mode applies the draft directly to the page at `AdminVisualEditor.tsx:214-231` and writes it at `:327-367`.

`AdminPageBuilder` is different: it owns page `blocks`, SEO fields, and `draftEnabled` through `/api/admin/pages/:pageKey` and `/publish` (`AdminPageBuilder.tsx:175-208`). That is not proof of duplicate persistence with global settings; the overlap is a mental-model/route concern until a concrete page block and setting are shown to render the same field.

**Impact:** confirmed duplicate entry points for site settings, plus a likely “which editor owns this page?” UX question for page blocks. The problem is not that each capability is invalid; it is that their boundaries are not visible.

**Recommendation:** keep one persistence owner per content class: global settings for global values/media, page builder for page blocks, and visual mode as a contextual shortcut into the global-settings owner. Hide duplicate global-setting controls from one path only after the shared controller is explicit; do not delete page-builder controls based on the current evidence.

### F-03 — Menu admin stops before the nested Sản phẩm/Dịch vụ tree

**Severity:** P1 autonomy gap
**Confidence:** Confirmed
**Effort:** M for a small validated nested model; L if legacy captured links require migration/review
**Locations:** [`src/components/admin/AdminNavigationManager.tsx:109-146`](../src/components/admin/AdminNavigationManager.tsx#L109), [`src/components/admin/AdminNavigationManager.tsx:327-385`](../src/components/admin/AdminNavigationManager.tsx#L327), [`src/lib/captured-markup.ts:311-361`](../src/lib/captured-markup.ts#L311), [`src/lib/captured-markup.ts:507-539`](../src/lib/captured-markup.ts#L507)

The navigation manager edits primary/footer rows, including label, href, order, active state, draft, and publish. The nested mega-menu labels and hrefs are still captured/static markup, and the open/close behavior is runtime code/CSS. The recent Escape behavior fix improves interaction quality but does not make those items configurable.

**Impact:** an owner cannot correct a nested service link or distinguish a product SKU route from a “Thuê gia công” route using the admin. This directly conflicts with the Lean V1 recovery priority to keep those flows distinct and route them correctly.

**Recommendation:** implement a small validated nested menu model for the requested self-service workflow: parent/child order, label, href, active state, menu location, draft/publish, and route-family validation. Do not turn it into a freeform page builder. A read-only route audit is useful as a diagnostic, but is not an acceptable substitute for the requested nested editing capability.

### F-04 — Publish/read-back is unevenly evidenced across domains

**Severity:** P1 release gate
**Confidence:** Open gate, not a defect claim
**Effort:** M for the evidence pass; domain-specific fixes may be M/L
**Locations:** [`src/app/admin/san-pham/page.tsx:238-306`](../src/app/admin/san-pham/page.tsx#L238), [`src/app/admin/dich-vu/page.tsx:100-180`](../src/app/admin/dich-vu/page.tsx#L100), [`src/app/admin/tin-tuc/page.tsx:152-228`](../src/app/admin/tin-tuc/page.tsx#L152), [`src/components/admin/AdminNavigationManager.tsx:134-216`](../src/components/admin/AdminNavigationManager.tsx#L134), [`src/components/admin/AdminPageBuilder.tsx:175-217`](../src/components/admin/AdminPageBuilder.tsx#L175)

The source and focused tests show draft/publish, optimistic version checks, idempotency, audit, and error envelopes in many paths. The strongest current runtime evidence is for a site-setting write, replay/conflict handling, audit rows, reload read-back, and restoration. This audit does not claim the same complete UI-to-public-read-back evidence for products, variants/tier prices, services, news/media, navigation, and page blocks.

**Required proof per high-value domain:** edit one safe staging record; save draft; verify response/version; reload admin; publish; reload public route; verify the intended visible result; exercise one validation/stale-write/failure path; verify audit and rollback/restore. Keep the evidence IDs and test data isolated from production.

### F-05 — Request management is D1-backed with an external Google delivery sink

**Severity:** P1 operational boundary
**Confidence:** Source-confirmed
**Effort:** S for labels/runbook; M if delivery retry/reconciliation UX is expanded
**Locations:** [`src/app/admin/yeu-cau/page.tsx:121-161`](../src/app/admin/yeu-cau/page.tsx#L121), [`src/app/api/admin/leads/route.ts:21-48`](../src/app/api/admin/leads/route.ts#L21), [`src/app/api/admin/leads/[id]/route.ts:21-55`](../src/app/api/admin/leads/%5Bid%5D/route.ts#L21), [`src/lib/lead-data.ts:64-169`](../src/lib/lead-data.ts#L64), [`src/lib/contact-webhook.ts:116-122`](../src/lib/contact-webhook.ts#L116), [`src/lib/lead-delivery-worker.ts:25-75`](../src/lib/lead-delivery-worker.ts#L25)

The actual implementation is clearer than the route names suggest. Public intake inserts a lead and its items into D1 `leads`/`lead_items` with `delivery_status = pending` (`lead-data.ts:64-123`). A queue/worker sends the payload to the allowed Google Apps Script webhook (`contact-webhook.ts:116-122`, `lead-delivery-worker.ts:25-56`) and updates D1 delivery metadata. The admin GET reads D1 via `listAdminLeads` (`api/admin/leads/route.ts:36-43`), and the admin PATCH changes the D1 pipeline `status` with revision, idempotency, lead events, and audit (`api/admin/leads/[id]/route.ts:38-55`, `admin-lead-write.ts:85-143`). The Sheet is the external delivery sink/queue contract; it is not the admin source for status.

**Recommendation:** label the admin screen as the D1-backed lead inbox and distinguish pipeline status from Google delivery status. Keep retry/reconciliation as an operational runbook or a small explicit action only if staff must perform it; do not build a second inbox or silently move queue ownership.

### F-06 — Dashboard is a useful launcher, not yet an operating inbox

**Severity:** P2 UX opportunity
**Confidence:** Confirmed
**Effort:** S using existing counts/statuses; M if delivery/retry aggregation is added
**Location:** `src/app/admin/page.tsx`

The dashboard shows counts, recent leads, and quick links for products, services, news, and requests. It does not yet appear to prioritize a single actionable queue such as “drafts blocking publish,” stale writes, failed media, unpublished navigation, or request delivery failures.

**Recommendation:** keep the current low-cost dashboard, but make its next iteration a small action list derived from existing states. Do not build analytics or a job scheduler without a confirmed daily operating need.

### F-07 — UI consistency debt is real but not a reason to expand scope

**Severity:** P2 maintenance
**Confidence:** Confirmed
**Effort:** S/M incrementally through shared primitives; not a V1 rewrite
**Locations:** admin panels including category, media, variant, leads, pages, and visual editor

The admin has a shared CSS vocabulary, but several components still contain inline presentation decisions and route-specific patterns. This increases the cost of consistent focus, error, disabled, and responsive states.

**Recommendation:** fix shared primitive states opportunistically when touching a route; do not start a broad design-system rewrite for Lean V1.

## End-to-end autonomy matrix

Legend: **Verified** = evidence exists in this audit or prior controlled staging evidence; **Source only** = contracts/tests/source support it but the full runtime chain was not demonstrated here; **Open** = needs live staging proof or an owner decision.

| Job to be done | UI → save | Publish → public read-back | Recover/error/audit | Current status |
| --- | --- | --- | --- | --- |
| Maintain product/SKU | Source + focused tests | Open for complete domain proof | Source-confirmed validation, stale-write, idempotency; full runtime proof open | Source only / Open |
| Maintain variants, MOQ, tiers | Source + focused tests | Open | Invariant and server-price contracts exist; runtime evidence open | Source only / Open |
| Maintain service copy | Source + focused tests | Open, and taxonomy ownership is split | Validation/concurrency source support; taxonomy drift has no admin warning | Open + F-01 |
| Maintain news | Source + focused tests | Open for public article read-back | Draft/publish/delete error handling source support | Source only / Open |
| Replace media | Source + focused tests | Open by domain | Reference/cleanup constraints source-confirmed; full operator recovery open | Source only / Open |
| Change brand/contact/home settings | **Verified** for controlled staging setting write/read-back and restore | **Verified** for the tested setting | **Verified** invalid input, idempotent retry/conflict, audit, clean restore | Verified for tested setting |
| Change page sections | Source + focused tests | Open | Unsaved guard and versioning source-confirmed | Source only / Open |
| Change top-level navigation | Source + focused tests | Open | Draft/publish/versioning source-confirmed | Source only / Open |
| Change nested Sản phẩm/Dịch vụ links | No admin owner | No admin owner | No admin audit path for the nested static tree | **Gap / F-03** |
| Triage customer requests | D1 list + D1 pipeline-status write | Google Apps Script delivery sink; D1 remains status source | Delivery/retry/reconciliation is source-confirmed but staff procedure needs explicit proof | Open / F-05 |
| Manage owner access and audit | Live route and owner evidence | Not a storefront publish job | Access, owner protections, audit source-confirmed | Keep; security-critical |

## What to keep, consolidate, hide, defer, and add

### Keep

- Product/category/variant/tier/media core and its validation, concurrency, idempotency, and audit contracts.
- Service managed-copy CRUD as the base layer while the validated nested taxonomy model is added.
- News draft/publish workflow.
- Global settings with per-setting draft/publish and media upload.
- Owner-only membership/audit controls and Cloudflare Access admission.
- Unsaved-change guards, opaque confirmation dialogs, and error/retry states.

### Consolidate

- Give each public content class one canonical editor. Keep visual mode as a contextual entry point, not a third state machine.
- Make the service screen the owner of managed copy plus the validated nested taxonomy model; do not leave the current hybrid implicit.
- Use one clear “publish/read back” vocabulary across products, services, news, navigation, settings, and pages.

### Hide or defer

- Hide **“Tạo trang”** behind an advanced action or a lower-priority route until the recovery priorities are accepted. Trade-off: less discoverability for page creation, lower risk of arbitrary pages competing with the existing storefront.
- Group `/admin/noi-dung`, `/admin/thiet-ke`, and `/admin/dieu-huong` under one “Website” navigation group. Trade-off: fewer top-level groups, with one extra click for each tool.
- Collapse product/service batch archive and CSV import controls behind an “Công cụ hàng loạt” disclosure when the operator is doing routine edits. Trade-off: bulk operations remain available but are less discoverable; retain them for the demonstrated catalog-maintenance job.
- Keep members and audit visible under a compact “Tài khoản & kiểm soát” group. Do not remove them because there is currently one owner; the trade-off is a slightly larger nav for a security-critical capability.
- Do not propose deleting any existing route yet: current evidence identifies prioritization and ownership problems, not a demonstrably unused or unsafe control. Checkout/payment and other out-of-scope Lean V1 features are not existing admin features to cut.
- Defer broad CSS/design-system migration; fix shared primitives only when a route is touched.

### Add only what closes an autonomy gap

- A read-only **source-of-truth/coverage** indicator on services and navigation.
- A compact public preview or “open storefront” action with explicit draft vs published status.
- Clear draft/published/dirty state and a direct “mở storefront” link for staff confidence. Acceptance checklists and evidence links remain QA artifacts, not product features, unless a separate operating workflow proves they are needed.
- A validated nested menu model with route-family checks preventing product links from silently becoming service links.
- Clear request-queue labels and retry/reconciliation instructions, without creating a second inbox by accident.

## Minimal roadmap, cut first

1. **Clarify ownership and labels.** Rename or annotate service-copy, content, page, navigation, and request surfaces so an operator knows what they control and what remains code/external-system owned.
2. **Close high-value E2E evidence.** Prove one safe staging record through save, publish, public read-back, failure/retry, audit, and restore for product, service, news/media, navigation, and page content.
3. **Resolve nested navigation.** Implement the small validated nested model required for staff self-service; keep a read-only route audit as a diagnostic, not as the primary solution.
4. **Consolidate content entry points.** Keep global settings, schema page blocks, and visual shortcuts, but give each a single persistence/publish owner.
5. **Improve the dashboard as an action list.** Use existing draft/unpublished/error state; do not invent a new job system.
6. **Reassess only after operating evidence.** Add fields or automation when real staff work demonstrates a repeated gap.

## Non-negotiable integrity and security dependencies

Do not cut or bypass these while simplifying the product:

- Cloudflare Access and server-side admission; public storefront must not become an admin write shortcut.
- The single `owner` role, last-owner protections, fail-closed capability checks, and audit history.
- D1/R2 server-side writes, validation, optimistic concurrency, request IDs/idempotency, and non-leaky error mapping.
- Canonical server pricing and quantity invariants for MOQ, quantity step, contact threshold, and tier quantities.
- Media reference checks before deletion and backup/restore procedures for production data.
- Draft versus published separation and explicit public read-back before production promotion.
- Staging/production resource separation and the production acceptance gate in `docs/CLOUDFLARE_NATIVE_V1_PLAN.md`.

## Decisions required from the owner

1. Confirm the validation policy for the nested menu model: allowed route families, parent/child depth, and whether inactive parents may contain active children.
2. Confirm which visual settings should remain directly editable in both the generic settings route and visual mode; the shared site-settings persistence owner is already established.
3. Confirm which three recurring staff jobs matter most after launch. Use those jobs to justify any additional fields, bulk actions, or automation.
4. Confirm who owns retry/reconciliation when Google delivery is `failed`; D1 remains the admin status source and the Sheet remains the external delivery sink under the current implementation.
