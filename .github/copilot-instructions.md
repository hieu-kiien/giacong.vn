<!-- AUTO-GENERATED from AGENTS.md — do not edit directly.
     Run `bash scripts/sync-agent-rules.sh` to regenerate. -->

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Lean V1 project rules

## Decision source

- [docs/COMMERCE_PLATFORM_MASTER_PLAN.md](docs/COMMERCE_PLATFORM_MASTER_PLAN.md) is the only current decision source.
- [docs/README.md](docs/README.md) is the documentation index; keep new material under its existing categories.
- [docs/GOOGLE_SHEETS_CONTACT_WEBHOOK.md](docs/GOOGLE_SHEETS_CONTACT_WEBHOOK.md) describes the current webhook and its implemented 15-column intake schema; Sheet operations and handoff remain in the master plan.
- The `giacong-product-ai-handoff` pack is design input (business rules, IA, component specs, data models, reference images), not a decision source. Where it conflicts with the master plan, the master plan wins — it drops `/gio-hang`, `/thanh-toan`, checkout and rating/review/favorite.

## Commands

- `npm run test:contact` — contact/webhook and port-reservation checks
- `npm run lint` — ESLint
- `npm run typecheck` — Next type generation and TypeScript
- `npm run build` — production build
- `npm run check` — contact tests, lint, typecheck and build; the full gate every phase must end on
- `npm run check:fe` — frontend track only: commerce/header/listing/detail/card tests, lint, typecheck
- `npm run check:be` — backend track only: contact/catalog/service tests, lint, typecheck

Neither `check:fe` nor `check:be` includes a `qa:*` harness. The Playwright suites are the only thing that catches a chrome regression, so run the relevant one explicitly.

## Frontend and backend tracks

The split is by work track, not by directory — the tree stays as it is. FE owns `src/app/**` except `api/`, plus `src/components/**`, `src/styles/**`, `src/app/globals.css`, `src/app/(storefront)/captured-layers.css`, `public/styles/**` and `src/data/pages/**`. BE owns `src/app/api/**`, the `server-only` modules in `src/lib/` and `bagisto/`. See section 11 of the master plan for the module list, the three seam pairs that must be edited together, and why `contact-webhook.ts` and `request-cart.ts` deliberately carry no `server-only` guard.

## Code style

- TypeScript strict mode; no `any`.
- Named exports, PascalCase components, camelCase utilities.
- Tailwind utility classes; no inline styles.
- Two-space indentation and mobile-first responsive behavior.

## Lean V1 boundaries

- Bagisto admin is the only administration surface. The duplicate Next.js `/quan-tri` UI and its BFF were removed; do not recreate them.
- Never write directly to Bagisto core tables.
- There are no customer accounts, checkout, `/thanh-toan`, payment, Bagisto order, shipping or quote engine in V1.
- The guest cart is in scope but preview-only: `localStorage` on the client, no server cart state and no cart table. `/gui-yeu-cau` is the only cart route. The server re-reads Bagisto to revalidate every cart line and computes unit price and totals itself; never trust client-supplied prices or totals.
- Do not add rating, review or favorite in any form.
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

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **giacong.vn** (2341 symbols, 4799 relationships, 173 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "master"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/giacong.vn/context` | Codebase overview, check index freshness |
| `gitnexus://repo/giacong.vn/clusters` | All functional areas |
| `gitnexus://repo/giacong.vn/processes` | All execution flows |
| `gitnexus://repo/giacong.vn/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
