# Task Progress

**Last visited**: 2026-07-17T03:51:00+07:00

## Current Status
- Backend rate limiter fixed and verified. All 20 PHPUnit tests pass.
- Playwright E2E tests refactored to use `php artisan tinker --execute="..."` instead of `sqlite3`.
- Fixed React hydration mismatch on the homepage by removing `order-attribution` custom elements scripts and moving dynamic page content into client-only rendering wrapper.
- Verified that single E2E test `cross-features.spec.ts:82` passes cleanly on both Chromium and Mobile Safari.
- Resolved race conditions in Playwright E2E tests (H1 timing, mobile drawer duplicate IDs, and concurrent backend requests).
- Verified that the full E2E test suite completes successfully with all 147 passed tests.

## Todo List
- [x] Read `backend/app/Providers/AppServiceProvider.php` to understand contact rate limiter definition
- [x] Read Playwright E2E tests under `tests/e2e/` to identify `sqlite3` executions
- [x] Run backend unit tests to verify baseline status
- [x] Run Playwright tests to verify baseline status
- [x] Implement rate limiter update in `AppServiceProvider.php`
- [x] Refactor E2E tests to replace `sqlite3` shell executions with `php artisan tinker --execute="..."`
- [x] Run backend unit tests and ensure all 20 tests pass
- [x] Resolve React hydration mismatch and verify page/form rendering in tests
- [x] Run Playwright E2E tests and ensure all pass
- [x] Generate `handoff.md` and message the parent agent
