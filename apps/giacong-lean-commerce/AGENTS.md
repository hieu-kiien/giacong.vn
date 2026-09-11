<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Lean V1 project rules

## Decision source

- [docs/CLOUDFLARE_NATIVE_V1_PLAN.md](docs/CLOUDFLARE_NATIVE_V1_PLAN.md) is the only current product/architecture decision source.
- [docs/CLOUDFLARE_CURRENT_STATE.md](docs/CLOUDFLARE_CURRENT_STATE.md) is the current runtime/audit evidence log. It records verified state but does not expand product scope by itself.
- [docs/COMMERCE_PLATFORM_MASTER_PLAN.md](docs/COMMERCE_PLATFORM_MASTER_PLAN.md) is historical Bagisto-era planning evidence and is no longer a decision source.
- [docs/README.md](docs/README.md) is the documentation index; keep new material under its existing categories.
- `docs/research/` and `docs/design-references/` are historical research evidence, not target scope or product decisions.
- [docs/UI_CURRENT_MAP.md](docs/UI_CURRENT_MAP.md) and [docs/ORIGINAL_GIACONG_VN_MAP.md](docs/ORIGINAL_GIACONG_VN_MAP.md) are descriptive interface evidence only.
- [docs/GOOGLE_SHEETS_CONTACT_WEBHOOK.md](docs/GOOGLE_SHEETS_CONTACT_WEBHOOK.md) describes the current request-intake webhook contract.
- The `giacong-product-ai-handoff` pack is design input, not a decision source. Where it conflicts with the Cloudflare-native plan, the plan wins.

## Commands

- `npm run test:contact` — contact/webhook, cart and request-intake contract tests
- `npm run test:catalog` — catalog contract tests
- `npm run lint` — ESLint
- `npm run typecheck` — Next type generation and TypeScript
- `npm run build` — production build
- `npm run check` — full application gate; every implementation phase must end green
- `npm run check:fe` — frontend-focused gate
- `npm run check:be` — backend-focused gate

Neither `check:fe` nor `check:be` replaces runtime QA. Run the relevant Cloudflare preview/staging workflow or QA harness explicitly when behavior depends on D1, R2, Worker bindings or browser layout.

## Frontend and backend tracks

The split is by work track, not by directory. FE owns storefront pages/components/styles and admin UI only after its server write contract is locked. BE owns `src/app/api/**`, Cloudflare binding access, D1/R2 adapters, canonical cart logic and request-intake server modules. Cross-layer contract changes must update tests and both sides together.

Do not revive Bagisto as a runtime boundary. `bagisto/`, Bagisto-era adapters/tests and old docs may remain as migration/history artifacts until deliberately removed, but new runtime work must use the Cloudflare-native plan.

## Code style

- TypeScript strict mode; no `any`.
- Named exports, PascalCase components, camelCase utilities.
- Tailwind utility classes; no inline styles unless an existing audited exception requires them.
- Two-space indentation and mobile-first responsive behavior.

## Lean V1 boundaries

- Cloudflare D1 is the canonical commerce data source for catalog, variants, tier prices and managed service copy.
- Cloudflare R2 is the canonical product-media store; browser code never receives D1/R2 credentials.
- The guest cart is preview-only `localStorage`; no server cart state or cart table. `/gui-yeu-cau` is the only cart route.
- The server re-reads D1 and computes canonical price/totals/request type; never trust client-supplied money.
- There are no customer accounts, checkout, `/thanh-toan`, payment, shipping, Bagisto order or quote engine in V1.
- Do not add rating, review or favorite.
- Google Sheet + Apps Script remains the request queue until a separate decision changes it.
- A Cloudflare-native admin is now in scope, but only behind an audited admin authentication boundary and only after server-side D1/R2 write contracts and tests are locked. Do not expose admin writes on the public storefront as an unauthenticated shortcut.
- The V1 admin has no customer identity. The sole active role is “Admin toàn quyền”, persisted as `owner` (user decision 2026-09-07, superseding the five-role decision of 2026-08-23). Retired roles must fail admission and capability checks; never promote them implicitly. Preserve Access authentication, last-owner protections and audit history.
- `admin-staging.kienhieu.id.vn` is the staging admin hostname target. `admin.kienhieu.id.vn` is production-only and must not be activated before the production acceptance gate.
- Production Worker/data/routes stay untouched until all gates in the Cloudflare-native plan are satisfied.
- Do not create demo production data implicitly; staging demo data is not production seed data.
- Do not run or alter reserved development ports `3000`, `8000`, or `8001` unless tracked configuration explicitly requires a reviewed change.
- Do not push unless the user explicitly asks.

## D1/R2 mutation discipline

- Before any staging D1 mutation, audit the exact rows/state expected and make the mutation abort if the guard does not match.
- Verify post-conditions and schema/business invariants after every mutation.
- MOQ, quantity step, contact threshold and tier quantities must stay mutually reachable under the canonical quantity rules.
- Media deletion must not orphan an active product/variant reference.
- Production D1/R2 mutation requires a separate production-data acceptance gate and rollback/export plan.

## Delivery discipline

- For behavior changes, start with a RED test, then implement the smallest GREEN change.
- Use isolated branches/worktrees for implementation work. Review order remains Terra implementation → Luna independent review → Gemini simplicity/routing review when those agents are available.
- Keep scope small; do not add dependencies or speculative architecture.
- After editing this file, run `bash scripts/sync-agent-rules.sh` and inspect only its generated changes. Do not edit generated agent-rule files independently.
- The `clone-website` skill is kept as identical copies in `.claude/`, `.codex/` and `.github/skills/`. There is no generator for them; edit all three together or they drift.

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
