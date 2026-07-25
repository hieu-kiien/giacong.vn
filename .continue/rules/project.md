<!-- AUTO-GENERATED from AGENTS.md — do not edit directly.
     Run `bash scripts/sync-agent-rules.sh` to regenerate. -->

---
description: Project conventions for AI Website Clone Template
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

# Website Inspection Guide

## How to Reverse-Engineer Any Website

This guide outlines what to capture when inspecting a target website via Chrome MCP or browser DevTools.

## Phase 1: Visual Audit

### Screenshots to Capture
- [ ] Every distinct page — desktop, tablet, mobile
- [ ] Dark mode variants (if applicable)
- [ ] Light mode variants (if applicable)
- [ ] Key interaction states (hover, active, open menus, modals)
- [ ] Loading/skeleton states
- [ ] Empty states
- [ ] Error states

### Design Tokens to Extract
- [ ] **Colors** — background, text (primary/secondary/muted), accent, border, hover, error, success, warning
- [ ] **Typography** — font family, sizes (h1-h6, body, caption, label), weights, line heights, letter spacing
- [ ] **Spacing** — padding/margin patterns (look for a scale: 4px, 8px, 12px, 16px, 24px, 32px, etc.)
- [ ] **Border radius** — buttons, cards, avatars, inputs
- [ ] **Shadows/elevation** — card shadows, dropdown shadows, modal overlay
- [ ] **Breakpoints** — when does the layout shift? (inspect with DevTools responsive mode)
- [ ] **Icons** — which icon library? custom SVGs? sizes?
- [ ] **Avatars** — sizes, shapes, fallback behavior
- [ ] **Buttons** — all variants (primary, secondary, ghost, icon-only, danger)
- [ ] **Inputs** — text fields, textareas, selects, checkboxes, toggles

## Phase 2: Component Inventory

For each distinct UI component, document:
1. **Name** — what would you call this component?
2. **Structure** — what HTML elements / child components does it contain?
3. **Variants** — does it have different sizes, colors, or states?
4. **States** — default, hover, active, disabled, loading, error, empty
5. **Responsive behavior** — how does it change at different breakpoints?
6. **Interactions** — click, hover, focus, keyboard navigation
7. **Animations** — transitions, entrance/exit animations, micro-interactions

### Common Components to Look For
- Navigation (top bar, sidebar, bottom bar)
- Cards / list items
- Buttons and links
- Forms and inputs
- Modals and dialogs
- Dropdowns and menus
- Tabs and segmented controls
- Avatars and user badges
- Loading skeletons
- Toast notifications
- Tooltips and popovers

## Phase 3: Layout Architecture

- [ ] **Grid system** — CSS Grid? Flexbox? Fixed widths?
- [ ] **Column layout** — how many columns at each breakpoint?
- [ ] **Max-width** — main content area max-width
- [ ] **Sticky elements** — header, sidebar, floating buttons
- [ ] **Z-index layers** — navigation, modals, tooltips, overlays
- [ ] **Scroll behavior** — infinite scroll, pagination, virtual scrolling

## Phase 4: Technical Stack Analysis

- [ ] **Framework** — React? Vue? Angular? Check `__NEXT_DATA__`, `__NUXT__`, `ng-version`
- [ ] **CSS approach** — Tailwind (utility classes), CSS Modules, Styled Components, Emotion, vanilla CSS
- [ ] **State management** — Redux (check DevTools), React Query, Zustand, Pinia
- [ ] **API patterns** — REST, GraphQL (check network tab for `/graphql` requests)
- [ ] **Font loading** — Google Fonts, self-hosted, system fonts
- [ ] **Image strategy** — CDN, lazy loading, srcset, WebP/AVIF
- [ ] **Animation library** — Framer Motion, GSAP, CSS transitions only

## Phase 5: Documentation Output

After inspection, create these files in `docs/research/`:
1. `DESIGN_TOKENS.md` — All extracted colors, typography, spacing
2. `COMPONENT_INVENTORY.md` — Every component with structure notes
3. `LAYOUT_ARCHITECTURE.md` — Page layouts, grid system, responsive behavior
4. `INTERACTION_PATTERNS.md` — Animations, transitions, hover states
5. `TECH_STACK_ANALYSIS.md` — What the site uses and our chosen equivalents
