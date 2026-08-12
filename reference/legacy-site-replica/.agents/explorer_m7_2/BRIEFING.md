# BRIEFING — 2026-07-16T19:48:35Z

## Mission
Explore and analyze backend Laravel codebase for CORS settings, database schema, SQLite logic, and rate limiting discrepancies.

## 🔒 My Identity
- Archetype: Backend and CORS Explorer
- Roles: Explorer, Investigator
- Working directory: c:\Users\hieuk\Desktop\Tham khảo giacong.vn\.agents\explorer_m7_2
- Original parent: e8a28c40-d18a-42f1-8175-538ec431171b
- Milestone: Milestone 7

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- CODE_ONLY network mode: no external website/services access, no curl/wget/etc. to external URLs.
- Write only to your own folder (c:\Users\hieuk\Desktop\Tham khảo giacong.vn\.agents\explorer_m7_2).

## Current Parent
- Conversation ID: e8a28c40-d18a-42f1-8175-538ec431171b
- Updated: 2026-07-16T19:48:35Z

## Investigation State
- **Explored paths**:
  - `backend/config/cors.php` — Checked allowed CORS origins.
  - `backend/database/migrations/2026_07_14_064952_create_submissions_table.php` — Database schema for contact submissions.
  - `backend/app/Models/Submission.php` — Contact submission Eloquent model.
  - `backend/app/Http/Controllers/ContactController.php` — Contact submission validation and saving logic.
  - `backend/app/Providers/AppServiceProvider.php` — Custom LOWER function registration for SQLite; contact rate limiter configuration.
  - `backend/tests/Feature/ApiTest.php` — Unit/feature test containing rate limit verification.
- **Key findings**:
  - Allowed CORS origins are restricted to localhost ports: `http://localhost:3000`, `http://localhost:3001`, `http://localhost:3002`.
  - SQLite backend is active. In `AppServiceProvider.php`, a custom `LOWER` function is registered to support UTF-8 case-insensitive comparisons (important for Vietnamese searches).
  - Submissions are saved into a SQLite database. Payload validation is customized depending on whether it matches Comment form structure or WPCF7 structures.
  - Rate limiting unit test `test_contact_route_rate_limiting` expects a rate limit of 5 requests per minute, but the actual limit in `AppServiceProvider` is set to 1000, causing test failure.
- **Unexplored areas**: None.

## Key Decisions Made
- Confirmed test failure by running PHPUnit tests locally.
- Proposed two alternative fixes for the rate limit discrepancy: aligning production rate limit (setting to 5) or making it environment-dynamic (e.g. using `app()->runningUnitTests()`).

## Artifact Index
- c:\Users\hieuk\Desktop\Tham khảo giacong.vn\.agents\explorer_m7_2\ORIGINAL_REQUEST.md — Original request instructions.
- c:\Users\hieuk\Desktop\Tham khảo giacong.vn\.agents\explorer_m7_2\rate_limit_fix.patch — Proposed patch file for aligning the rate limits.
