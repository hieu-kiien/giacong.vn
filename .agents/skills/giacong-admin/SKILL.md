---
name: giacong-admin
description: Review, design, and implement the Giacong.vn Cloudflare-native admin without reviving Bagisto or expanding Lean V1 scope.
metadata:
  author: giacong.vn
  version: "1.0.0"
---

# Giacong Admin Quality

Use this skill when the request concerns the Giacong.vn admin shell, content editing, catalog/services/news management, navigation, media, settings, admin UX review, or admin QA. Do not use it for generic marketing design, presentations, banners, or unrelated storefront work.

## Project context

- The application is `apps/giacong-lean-commerce`: Next.js/TypeScript on the Cloudflare-native Lean V1 plan with D1/R2 and Workers.
- Existing admin routes live under `apps/giacong-lean-commerce/src/app/admin/`; inspect the route and its server/write contract before proposing a new area.
- The admin manages the approved content domains: dashboard, products/categories, services, news, pages/content, navigation, design/media, settings, and request intake. Member/customer-account management is not a default V1 requirement.
- Bagisto-era plans and adapters are historical evidence only. Never reintroduce Bagisto as a runtime boundary, order engine, checkout, payment, or customer-account model.

## Working method

1. Read `apps/giacong-lean-commerce/docs/CLOUDFLARE_NATIVE_V1_PLAN.md`, the relevant current-state/contract docs, and the tracked [AI admin guide](../../../apps/giacong-lean-commerce/docs/AI_ADMIN_SKILL_GUIDE.md).
2. Inspect the existing route, components, tests, types, and D1/R2 write contract. Reuse the current `AdminShell` and admin primitives unless there is evidence they block the requested outcome.
3. For unfamiliar architecture, use GitNexus `query`/`context`. Before editing any function, class, or method, run GitNexus `impact` upstream and warn about HIGH/CRITICAL risk.
4. Define the smallest vertical slice: permission/state contract, loading/error/empty states, accessible UI, server mutation, and tests. Avoid speculative page builders or a parallel admin stack.
5. For visual work, use `ui-ux-pro-max`, `design-system`, `ui-styling`, and `frontend-ui-engineering` only as applicable. Validate with a real browser and screenshots; check desktop, mobile, keyboard focus, reduced motion, and dense data states.
6. Before a commit, run `git diff --check`, the relevant app checks (normally `npm run check`), and GitNexus `detect_changes({scope: "staged"})`. Do not claim completion from a code read alone.

## Quality bar

- Admin UI should be a practical data-dense control plane: clear navigation, breadcrumbs, search/filter/sort where needed, explicit draft/publish state, detail/edit flows, safe destructive actions, and visible feedback.
- Keep tokens and existing brand language consistent; do not invent generic dashboard decoration or use emoji as UI icons.
- Keep writes behind the audited admin authentication boundary. Never add an unauthenticated storefront shortcut or silently mutate production data.
- Preserve the Lean V1 invariants: D1 is canonical, R2 media references stay valid, server re-reads and validates submitted data, and production remains untouched until its acceptance gate.
- Do not add dependencies, roles, modules, or data models unless the request and current decision docs require them.

For the invocation contract, expected inputs, review checklist, and prompt examples, read [AI_ADMIN_SKILL_GUIDE.md](../../../apps/giacong-lean-commerce/docs/AI_ADMIN_SKILL_GUIDE.md).
