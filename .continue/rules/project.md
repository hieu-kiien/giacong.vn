<!-- AUTO-GENERATED from AGENTS.md — do not edit directly.
     Run `bash scripts/sync-agent-rules.sh` to regenerate. -->

---
description: Project conventions for Giacong Lean Commerce
alwaysApply: true
---
<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Lean V1 project rules

## Decision source

- [docs/COMMERCE_PLATFORM_MASTER_PLAN.md](docs/COMMERCE_PLATFORM_MASTER_PLAN.md) is the only current decision source.
- `docs/research/` and `docs/design-references/` are historical research evidence, not target scope or product decisions.
- [docs/GOOGLE_SHEETS_CONTACT_WEBHOOK.md](docs/GOOGLE_SHEETS_CONTACT_WEBHOOK.md) describes the current webhook, not the 15-column target until that change is implemented.

## Commands

- `npm run test:contact` — contact/webhook and port-reservation checks
- `npm run lint` — ESLint
- `npm run typecheck` — Next type generation and TypeScript
- `npm run build` — production build
- `npm run check` — contact tests, lint, typecheck and build

## Code style

- TypeScript strict mode; no `any`.
- Named exports, PascalCase components, camelCase utilities.
- Tailwind utility classes; no inline styles.
- Two-space indentation and mobile-first responsive behavior.

## Lean V1 boundaries

- Bagisto admin is the long-term administration surface. `/quan-tri` is frozen for compatibility/security; do not expand it.
- Never write directly to Bagisto core tables.
- There are no customer accounts, cart, checkout, payment, Bagisto order, shipping or quote engine in V1.
- There is one shared `administrator` account only; no `employee` type and no granular RBAC.
- Google Sheet + Apps Script is the request queue. Keep its ownership-handoff requirements in the master plan.
- Do not create UI before the app-layer contract is locked. Do not add a new admin UI.
- Do not run or alter ports `3000`, `8000`, or `8001`. The audited Bagisto development endpoint is `127.0.0.1:18001`; describe any other port only when it already appears in tracked config or environment files.
- Do not push unless the user explicitly asks.

## Delivery discipline

- For behavior changes, start with a RED test, then implement the smallest GREEN change.
- Use isolated worktrees for implementation work. Review order is Terra implementation → Luna independent review → Gemini simplicity/routing review.
- Keep scope small; do not add dependencies or speculative architecture.
- After editing this file, run `bash scripts/sync-agent-rules.sh` and inspect only its generated changes. Do not edit generated agent-rule files directly.
