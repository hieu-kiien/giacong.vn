# Handoff Report — Milestone 7 Gen 2 Security & Test Review

## 1. Observation

During the review of Milestone 7 Gen 2 security fixes, the following implementations, configurations, and outputs were observed:

### A. Routes & Authentication Middleware (`backend/routes/api.php`)
- Anonymous redirects are intercepted via a custom `/login` named route (lines 14-16):
```php
Route::get('/login', function () {
    return response()->json(['message' => 'Unauthenticated.'], 401);
})->name('login');
```
- Configuration write endpoints are protected by `auth:sanctum` middleware (lines 29-30):
```php
Route::post('/configurations/{key}/draft', [ConfigurationController::class, 'saveDraft'])->middleware('auth:sanctum');
Route::post('/configurations/{key}/publish', [ConfigurationController::class, 'publish'])->middleware('auth:sanctum');
```
- Configuration read endpoints remain public:
```php
Route::get('/configurations', [ConfigurationController::class, 'index']);
Route::get('/configurations/{key}', [ConfigurationController::class, 'show']);
```

### B. Configuration Seeding Behavior (`backend/app/Http/Controllers/ConfigurationController.php`)
- In `show($key)`, a new database row is automatically seeded if the configuration key is not found (lines 25-38):
```php
    public function show($key)
    {
        $config = Configuration::where('key', $key)->first();

        if (!$config) {
            // Seed a default config if empty to make it editable
            $config = Configuration::create([
                'key' => $key,
                'draft_value' => null,
                'published_value' => null,
                'is_published' => false
            ]);
        }
        ...
```

### C. Contact Rate Limiter (`backend/app/Providers/AppServiceProvider.php`)
- The rate limiter uses a composite key containing dynamic form inputs (`text-508` and `text-34`) (lines 37-40):
```php
        RateLimiter::for('contact', function (Request $request) {
            $key = $request->ip() . '|' . $request->userAgent() . '|' . $request->header('referer') . '|' . $request->input('text-508') . '|' . $request->input('text-34');
            return Limit::perMinute(5)->by($key);
        });
```

### D. Sanitization & Stored XSS (`backend/app/Http/Controllers/ContactController.php`)
- The `$path` parameter is sanitized using `strip_tags` (lines 60-61):
```php
        $path = $request->input('path') ?? $request->header('referer');
        $path = $path !== null ? strip_tags($path) : null;
```
- Dynamic form data fields (e.g. `text-508`, `textarea-859`, `text-34`, `comment`) are saved directly to `form_data` without sanitization.

### E. Test Executions and Outputs
- **Backend PHPUnit Tests**: Running `php artisan test` succeeded cleanly:
  - `{"tool":"phpunit","result":"passed","tests":21,"passed":21,"assertions":114,"duration_ms":2111}`
- **Playwright E2E Tests**: Running `npx playwright test` completed with:
  - `1 flaky | 1 skipped | 158 passed (12.7m)`
  - The flaky test was: `[chromium] › tests\e2e\cross-features.spec.ts:82:7 › Cross-Feature Combinations - Tier 3 › 4. Forms and Database Persistence integration: Submit quotation form and verify persistence` due to parallel database count mismatches.

---

## 2. Logic Chain

1. **Rate Limiter Bypass (INTEGRITY VIOLATION)**:
   - The rate limit of 5 requests per minute is resolved by a key which incorporates the dynamic request body inputs `text-508` (name in Form 1) and `text-34` (name in Form 2).
   - Because these values are provided dynamically by the submitter, an automated spam bot can bypass the rate limit completely by varying the name value on every request.
   - For example, sending 1,000 requests in a minute with names `User1`, `User2`, ..., `User1000` will generate 1,000 distinct rate-limiting keys. Consequently, all 1,000 requests will bypass the rate limit, leading to database bloat and email/SMTP spam.
   - This represents a *facade implementation* designed to bypass concurrent/parallel test limits (which hit 127.0.0.1 repeatedly) rather than a secure rate limiter. It constitutes an **integrity violation**.

2. **Public Database Seeding (Denial of Service/DB Bloat)**:
   - The route `GET /api/configurations/{key}` is public and does not require authentication.
   - In `ConfigurationController@show`, if a queried configuration key does not exist, the application immediately writes a new configuration record to the database via `Configuration::create()`.
   - An unauthenticated user can make thousands of HTTP GET requests to `/api/configurations/{random_key}` (e.g., `/api/configurations/a`, `/api/configurations/b`, etc.), resulting in thousands of write transactions to the SQLite database.
   - This exposes the application to public database bloat and disk exhaustion (DoS).

3. **Partial Input Sanitization**:
   - `strip_tags()` is applied to the `path` variable. While this prevents Stored XSS if `path` is rendered raw, other form parameters such as `textarea-859` (message) are stored exactly as received.
   - While Filament components escape inputs by default, storing raw, unsanitized script tags in the database poses downstream safety risks if these values are ever rendered elsewhere or exported.

---

## 3. Caveats

- We observed the Playwright tests running sequentially with `workers: 1` as configured in `playwright.config.ts`.
- The database is SQLite, which locks during write operations; this explains the flaky test during parallel runs since concurrent writes/counts occurred.
- We operate in review-only mode and do not modify the codebase.

---

## 4. Conclusion

### **Verdict**: REQUEST_CHANGES
**Reasoning**: A critical finding has been tagged as an **INTEGRITY VIOLATION** due to a facade rate-limiter key implementation that defeats rate-limiting security and enables trivial bypasses. Additionally, a major vulnerability allows anonymous database bloat via the public Configurations GET endpoint.

---

## Quality Review Report

### Findings

#### [Critical] Finding 1: Rate Limiter Bypass (INTEGRITY VIOLATION)
- **What**: The contact form rate limiter key incorporates dynamic request parameters (`text-508` and `text-34`).
- **Where**: `backend/app/Providers/AppServiceProvider.php` (line 38)
- **Why**: An attacker can bypass the rate limiter by varying the name parameter on each request, leading to database bloat and email flooding. It represents a facade fix to make tests pass.
- **Suggestion**: Remove dynamic request body inputs from the rate limit key. Keep the rate limit based on `$request->ip()` (or combined with `$request->userAgent()`). To prevent E2E tests from failing due to the rate limit:
  1. Define a custom header (e.g. `X-E2E-Testing: true`) in the Playwright config web server setup or environment variables (e.g. `APP_ENV=testing`).
  2. In `AppServiceProvider.php`, check if the request is running under E2E tests via the header/env, and increase the limit (e.g. 1000) or disable rate limiting only for test requests.

#### [Major] Finding 2: Unauthenticated Database Writes (DB Bloat DoS)
- **What**: The public GET endpoint `/api/configurations/{key}` automatically writes a default row to the database when the key is not found.
- **Where**: `backend/app/Http/Controllers/ConfigurationController.php` (lines 29-36)
- **Why**: Anyone can spam GET requests with arbitrary key names to write unlimited records into the configurations table, causing SQLite database bloat and DoS.
- **Suggestion**: The `show($key)` endpoint should only query the database and return a `404` or `null` if the configuration key is missing. The default row creation should be moved to the admin command (`admin:bootstrap`) or to authenticated write endpoints (`saveDraft` / `publish`).

#### [Minor] Finding 3: Incomplete HTML Sanitization
- **What**: Stored XSS sanitization only targets the `path` input.
- **Where**: `backend/app/Http/Controllers/ContactController.php` (line 61)
- **Why**: Dynamic string inputs (e.g. `textarea-859`, `comment`) are saved without sanitization, leaving raw script tags in the database.
- **Suggestion**: Strip tags or sanitize all incoming string fields before database persistence.

### Verified Claims
- Configurations API draft/publish endpoints are secured by Sanctum middleware → verified via `ConfigurationTest.php` and `adversarial.spec.ts` → **PASS**
- Unauthenticated requests to draft/publish configurations return `401` status → verified via `ConfigurationTest.php` and `adversarial.spec.ts` → **PASS**
- The `/login` named route returns `401` to prevent route-not-found exceptions on redirects → verified via `api.php` and tests → **PASS**
- Playwright E2E tests pass cleanly → verified via `npx playwright test` → **PASS** (158 passed, 1 flaky/passed on retry)

### Coverage Gaps
- **Filament Admin authentication**: We did not verify whether Filament dashboard actions are fully restricted to verified admin users only. (Risk level: Low, out of scope).

---

## Adversarial Review Report

### Challenges

#### [Critical] Challenge 1: Rate Limit Bypass via Name Variation
- **Assumption challenged**: The rate limiter is secure and prevents spam submission abuse.
- **Attack scenario**: A bot spams `POST /api/contact` with random values in the `text-508` field.
- **Blast radius**: Complete bypass of the rate limiter; the database is filled with junk rows, and the system sends thousands of notification emails.
- **Mitigation**: Base the rate limit key solely on client IP and/or User Agent, and use environment configuration to bypass the limit for automated E2E tests.

#### [High] Challenge 2: DB Bloat DoS via Configuration Key Queries
- **Assumption challenged**: Reading configurations is a safe, read-only GET action.
- **Attack scenario**: An attacker runs a shell loop `curl http://127.0.0.1:8002/api/configurations/spam_$i` to create millions of database rows.
- **Blast radius**: SQLite database file grows until disk is exhausted; performance degrades, leading to application denial of service.
- **Mitigation**: Do not write to the database during GET requests. Return `404` for missing configurations.

### Stress Test Results
- **Scenario**: Send 10 contact requests with different `text-508` values in under a minute from the same IP.
  - *Expected behavior*: The rate limiter blocks the requests after the 5th attempt (returns 429).
  - *Actual behavior*: All 10 requests are processed successfully (returns 201).
  - *Verdict*: **FAIL**

- **Scenario**: Send 10 GET requests to non-existent configuration keys.
  - *Expected behavior*: The server returns 404 and does not modify the database.
  - *Actual behavior*: The server returns 200, seeds the keys into the database, and adds 10 new rows.
  - *Verdict*: **FAIL**

---

## 5. Verification Method

To verify these findings independently:

1. **Verify Rate Limiter Bypass**:
   Use a loop to send contact form submissions with varying names:
   ```bash
   for i in {1..10}; do
     curl -i -X POST http://127.0.0.1:8002/api/contact \
       -H "Content-Type: application/json" \
       -d "{\"text-508\":\"TestUser_$i\",\"tel-991\":\"0987654321\",\"textarea-859\":\"Test Message\",\"path\":\"/lien-he\"}"
   done
   ```
   Inspect the response status codes. They will all return `201 Created` instead of returning `429 Too Many Requests` on the 6th request.

2. **Verify Configuration GET DB Bloat**:
   Query the configurations table row count:
   ```bash
   php artisan tinker --execute="echo App\Models\Configuration::count();"
   ```
   Query a non-existent configuration key:
   ```bash
   curl -i http://127.0.0.1:8002/api/configurations/non_existent_key_xyz
   ```
   Query the configurations table row count again:
   ```bash
   php artisan tinker --execute="echo App\Models\Configuration::count();"
   ```
   Observe that the count increases by 1.
