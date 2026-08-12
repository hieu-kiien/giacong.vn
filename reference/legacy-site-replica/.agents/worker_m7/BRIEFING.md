# BRIEFING — 2026-07-17T03:51:00+07:00

## Mission
Fix backend rate limit test discrepancy, refactor Playwright E2E tests to eliminate sqlite3 shell command calls in favor of php artisan tinker, and ensure all tests pass cleanly.

## 🔒 My Identity
- Archetype: Milestone 7 Worker
- Roles: implementer, qa, specialist
- Working directory: c:\Users\hieuk\Desktop\Tham khảo giacong.vn\.agents\worker_m7
- Original parent: e8a28c40-d18a-42f1-8175-538ec431171b
- Milestone: Milestone 7

## 🔒 Key Constraints
- Fix contact rate limiter in backend/app/Providers/AppServiceProvider.php.
- Eliminate sqlite3 execSync in tests/e2e/ in favor of PHP artisan tinker execute commands.
- Ensure all 20 backend unit/feature tests pass cleanly.
- Ensure all Playwright E2E tests pass without hanging/timeout.
- Write handoff.md and send_message to main agent.
- DO NOT CHEAT, do not hardcode/facade implementations.

## Current Parent
- Conversation ID: e8a28c40-d18a-42f1-8175-538ec431171b
- Updated: 2026-07-16T20:51:00Z

## Task Summary
- **What to build**: Rate limit configuration update for unit tests, refactoring E2E SQLite query runner.
- **Success criteria**: All tests (PHPUnit and Playwright) pass without errors or hanging.
- **Interface contracts**: backend/app/Providers/AppServiceProvider.php, tests/e2e/
- **Code layout**: Laravel standard, tests/e2e/ Playwright tests

## Key Decisions Made
- Used Laravel Eloquent `DB::table('submissions')` queries wrapped in `php artisan tinker --execute="..."` as a cross-platform replacement for sqlite3 CLI calls.
- Resolved React hydration mismatch #418 on homepage by turning page into client-rendered component dynamically imported with `{ ssr: false }`, and not caching the local EJS fallback in Next.js to solve race conditions during test startup.
- Scoped mobile drawer selectors in tests to `#main-menu` and used auto-retrying `toHaveCount(1)` H1 assertions in Playwright tests to eliminate WebKit/Safari timing race conditions.
- Added `PHP_CLI_SERVER_WORKERS: '8'` env variable to Laravel backend server config in `playwright.config.ts` to allow multi-threaded connections, preventing `ECONNRESET` / connection drops under parallel WebKit requests.

## Change Tracker
- **Files modified**:
  - `backend/app/Providers/AppServiceProvider.php` (Fix contact rate limiter limit during tests)
  - `tests/e2e/cross-features.spec.ts` (Replace sqlite3 command-line database calls with artisan tinker calls)
  - `tests/e2e/form-submissions.spec.ts` (Replace sqlite3 command-line database calls with artisan tinker calls)
  - `tests/e2e/menus.spec.ts` (Scope mobile drawer menu selectors)
  - `tests/e2e/seo-brand.spec.ts` (Update H1 count checks to be auto-retrying)
  - `tests/e2e/workloads.spec.ts` (Replace sqlite3 command-line database calls and scope mobile drawer submenu selectors)
  - `frontend/src/app/page.tsx` (Use ClientPageContent wrapper)
  - `frontend/src/app/[...slug]/page.tsx` (Use ClientPageContent wrapper)
  - `frontend/src/components/ClientPageWrapper.tsx` (Create wrapper component)
  - `frontend/src/components/ClientPageContent.tsx` (Create dynamic loader)
  - `frontend/src/utils/pageParser.ts` (Comment out local EJS fallback caching)
  - `playwright.config.ts` (Add PHP_CLI_SERVER_WORKERS to backend server config)
- **Build status**: pass
- **Pending issues**: none

## Quality Status
- **Build/test result**: backend: pass (20/20); Playwright E2E: pass (147/147)
- **Lint status**: 0 violations
- **Tests added/modified**: E2E tests refactored for cross-platform execution and timed race conditions solved.

## Loaded Skills
- [None]

## Artifact Index
- [None]
