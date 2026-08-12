# Handoff Report - E2E & Adversarial Test Exploration (Milestone 7)

## 1. Observation

During read-only inspection of the E2E test suite and application codebase, the following locations and structures were observed:

### A. E2E Test Suite (Tiers 1-4)
The current test suite is located in `tests/e2e/` and consists of 8 spec files covering **71 test cases** in total (verified via `TEST_READY.md` and `TEST_INFRA.md`):
- `page-rendering.spec.ts`: Page load validations (homepage, `/bot-gia-vi`, `/dich-vu-say`, `/gioi-thieu-ve-gia-cong`, `/lien-he`), trailing slashes, 404 layout and styles, and hydration errors.
- `menus.spec.ts`: Desktop hover menus (ARIA attributes, ESC key closing), mobile navigation drawer (toggle, overlay click, hidden on desktop), and link audits (no absolute `giacong.vn` URLs).
- `search.spec.ts`: Redirection to `/search?s=<query>`, matching results, Vietnamese accent folding, case insensitivity, extreme length query, and relative URL assertions.
- `form-submissions.spec.ts`: Success paths for Form 1 (Contact Form) and Form 2 (Quotation Form), referrers, loading state checking, and client-side missing field validation.
- `cors-smtp.spec.ts`: CORS headers allowed/disallowed origins, SQLite persistence, and SMTP logging in `laravel.log`.
- `seo-brand.spec.ts`: Metadata tags, robots.txt, sitemap.xml (>=10 entries), brand compliance (Net Food company info, SF Pro Display font, brand colors).
- `cross-features.spec.ts`: 6 cross-feature combination tests (e.g. Search & Navigation, Navigation & Form, Persistence).
- `workloads.spec.ts`: 5 real-world user scenarios emulating complex visitor discovery, lead capture, mobile self-service, referral tracking, and conversion funnels.

### B. Codebase Insights and Key Locations
- **Backend API Routes** (`backend/routes/api.php`):
  ```php
  // Configurations API
  use App\Http\Controllers\ConfigurationController;
  Route::get('/configurations', [ConfigurationController::class, 'index']);
  Route::get('/configurations/{key}', [ConfigurationController::class, 'show']);
  Route::post('/configurations/{key}/draft', [ConfigurationController::class, 'saveDraft']);
  Route::post('/configurations/{key}/publish', [ConfigurationController::class, 'publish']);
  ```
- **Rate Limiter Configuration** (`backend/app/Providers/AppServiceProvider.php` lines 37-39):
  ```php
  RateLimiter::for('contact', function (Request $request) {
      return Limit::perMinute(1000)->by($request->ip());
  });
  ```
- **Local File Path Resolution** (`frontend/src/utils/pageParser.ts` lines 245-248):
  ```typescript
  let p = path.join(process.cwd(), 'src/data/pages', `${name}.ejs`);
  if (!fs.existsSync(p)) {
    p = path.join(process.cwd(), 'frontend/src/data/pages', `${name}.ejs`);
  }
  ```
  where `name` resolves from `slugStr = slug.join('/')` passed from the Next.js catch-all route `SlugPage({ params })` in `frontend/src/app/[...slug]/page.tsx`.
- **Form Submission Controller** (`backend/app/Http/Controllers/ContactController.php` lines 60-69):
  ```php
  $path = $request->input('path') ?? $request->header('referer');
  $ip = $request->ip();
  $userAgent = $request->userAgent();

  $submission = Submission::create([
      'form_data' => $formData,
      'path' => $path,
      'ip' => $ip,
      'user_agent' => $userAgent,
  ]);
  ```

---

## 2. Logic Chain

Based on the observations, we deduce the following logical inferences:
1. **Unauthenticated Configurations API**: Since the `/configurations` routes in `backend/routes/api.php` are exposed outside any auth middlewares (unlike the `/user` endpoint which uses `auth:sanctum`), any user or external client can make POST requests to `/api/configurations/{key}/draft` and `/api/configurations/{key}/publish` directly on port 8002. This allows unauthenticated tampering of configuration settings.
2. **Spam & Rate Limiter Bypass**: The contact submission rate limit is `1000` requests per minute. This high threshold is practically useless for preventing automated spam scripts from bloat-attacking the SQLite database or exhaustively triggering SMTP emails. Additionally, since the rate limit is grouped solely by `$request->ip()` and there is no proxy trust header verification configured in Laravel's bootstrap, an attacker can easily bypass this by spoofing headers like `X-Forwarded-For` with random IPs, or they might trigger a denial of service (DoS) for all users behind a shared corporate proxy.
3. **Path Traversal Vulnerability**: In `pageParser.ts`, the application relies on `path.join` to locate `.ejs` files. Although Next.js standard routing drops basic parent-directory patterns, a double-encoded sequence (e.g. `%252e%252e%252f`) or parameter manipulation could pass `..` segments. Because the `name` is not validated against parent directory characters before resolving paths, this allows looking up `.ejs` files outside of the `data/pages` folder.
4. **Stored XSS Threat**: In `ContactController.php`, the payload parameter `path` is written directly to the `submissions` table database row and log files without sanitization. An attacker submitting malicious code (e.g., `<script>alert('xss')</script>`) via `path` or `Referer` header would store it. If a Filament administrator views submissions in the admin panel and the field is rendered as raw HTML, the script will execute in the context of the administrator's session.

---

## 3. Caveats

- **No Active Writing Permitted**: Because this investigation is strictly read-only, no code changes (like patching the rate limit or securing the configurations API) were made.
- **Client-Side/Proxy Trust Assumptions**: We assume the production infrastructure is behind a proxy (like Nginx/Cloudflare) which forwards the client IP. If trusted proxies are not configured in Laravel 11 (`bootstrap/app.php` or middleware), rate limiting is vulnerable to header manipulation.
- **Next.js Router Path Filters**: Standard Next.js server routing has built-in sanitization that redirects path traversal characters. Our traversal findings are based on the internal utility structure (`pageParser.ts`) rather than standard HTTP endpoints, but this code is still an architectural gap.

---

## 4. Conclusion

The application is well-covered by E2E tests (Tiers 1-4) for happy paths and basic validation, but it lacks coverage for adversarial vectors and has critical security gaps:
1. **Security Vulnerability 1**: Unauthenticated API endpoints for saving and publishing configuration data (`/api/configurations/{key}/draft` and `/api/configurations/{key}/publish`).
2. **Security Vulnerability 2**: A virtually infinite rate limit (1000/min) on the contact form, combined with vulnerability to IP spoofing via `X-Forwarded-For`.
3. **Security Vulnerability 3**: Lack of path sanitization on dynamic page resolution, exposing a traversal risk if Next.js route filters are bypassed.
4. **Security Vulnerability 4**: Stored XSS possibility via the `path` and `referer` field storage.

### Recommended Targets & Test Cases for Tier 5 Adversarial Coverage Hardening:
We recommend creating `tests/e2e/adversarial.spec.ts` targeting these specific issues:
- **Target 1: Configurations API Unauthorized Access**
  - *Test Case 5-1*: Send anonymous POST requests to `/api/configurations/brand_settings/draft` with values and verify that the server returns `401 Unauthorized` or `403 Forbidden` (or fails to write if auth is implemented).
- **Target 2: Contact Form Rate Limiting and Spoofing**
  - *Test Case 5-2*: Verify rate limiter functionality by sending multiple rapid POST requests to `/api/contact` and checking that it restricts submissions with HTTP `429 Too Many Requests`.
  - *Test Case 5-3*: Send requests with fake `X-Forwarded-For` headers to verify whether the system allows bypassing the rate limits.
- **Target 3: Input Sanitization / Stored XSS Protection**
  - *Test Case 5-4*: Submit a contact payload with `path` set to `<script>alert('XSS')</script>`. Verify that either the API rejects the payload with validation errors (422) or that the value is sanitized/escaped before database persistence.
- **Target 4: Route Path Traversal and Null Byte Handling**
  - *Test Case 5-5*: Query `/....//....//package.json` and `%252e%252e%252fpackage.json` to verify that the application returns standard 404 pages without disclosure or internal server error logs.
  - *Test Case 5-6*: Send query parameters containing null bytes (e.g. `%00`) in search and page requests to confirm that the Node/Express and Laravel engines handle it cleanly.

---

## 5. Verification Method

To verify the test suite and confirm current status:
1. **Run Current E2E Tests**:
   Ensure both servers are running, then run Playwright tests from the root directory:
   ```bash
   npx playwright test
   ```
2. **Verify Configuration Access**:
   Using curl/Invoke-RestMethod, test draft modification:
   ```powershell
   Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8002/api/configurations/test-key/draft" -Body @{value="malicious-value"}
   ```
   *Expected outcome (current status)*: Succeeds with a 200/201 response containing the updated JSON.
   *Expected outcome (secured status)*: Fails with 401/403.
3. **Verify Stored XSS Storage**:
   Submit a script tag as the `path` parameter:
   ```powershell
   Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8002/api/contact" -ContentType "application/json" -Body '{"text-34":"Test User","tel-471":"0912345678","path":"<script>alert(1)</script>"}'
   ```
   Check the SQLite database:
   ```bash
   sqlite3 backend/database/database.sqlite "select path from submissions order by id desc limit 1;"
   ```
   *Outcome*: Verifies whether the raw script is stored directly or escaped.
