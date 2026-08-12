# Handoff Report — Milestone 7 Adversarial Challenger 1

## 1. Observation

During execution of the Tier 5 Adversarial tests in `tests/e2e/adversarial.spec.ts` (run via command `npx playwright test tests/e2e/adversarial.spec.ts`), the following outcomes were observed:

### A. Configurations API Unauthorized Access
- Under both `chromium` and `mobile-safari` projects, the anonymous requests to `/api/configurations/brand_settings/draft` and `/api/configurations/brand_settings/publish` returned HTTP `200 OK` instead of triggering a blocked response (`401 Unauthorized` or `403 Forbidden`).
- Console output:
  ```
  [Config Draft] Anonymous POST returned status: 200
  [Config Publish] Anonymous POST returned status: 200
  ```
- Verbatim Playwright error log snippet:
  ```
  Error: expect(received).toContain(expected) // indexOf

  Expected value: 200
  Received array: [401, 403]
  ```

### B. Contact Form Rate Limiter - Excessive Threshold
- The contact form rate limit query returned `1000` from the `x-ratelimit-limit` header.
- Console output:
  ```
  [Rate Limit] Configured per-minute limit: 1000
  ```
- Verbatim Playwright error log snippet:
  ```
  Error: expect(received).toBeLessThanOrEqual(expected)

  Expected: <= 10
  Received:    1000
  ```

### C. Contact Form Rate Limiter - X-Forwarded-For Spoofing
- The rate limiter test verifying `X-Forwarded-For` spoofing passed successfully, indicating that IP spoofing headers are **not trusted** by Laravel in the current configuration.
- Console output:
  ```
  [Rate Limit Spoofing] Remaining (IP 1.1.1.1): 991, Remaining (IP 2.2.2.2): 990
  [Rate Limit Spoofing] Remaining (IP 1.1.1.1): 981, Remaining (IP 2.2.2.2): 980
  ```
- Under chromium, the remaining rate limit decremented from 991 to 990, showing that both requests were tracked under the same client IP (`127.0.0.1`), meaning `X-Forwarded-For` headers did not bypass/split the rate limiter.

---

## 2. Logic Chain

1. **Unauthenticated Configurations Route (Security Vulnerability)**:
   - In `backend/routes/api.php`, the routes:
     ```php
     Route::post('/configurations/{key}/draft', [ConfigurationController::class, 'saveDraft']);
     Route::post('/configurations/{key}/publish', [ConfigurationController::class, 'publish']);
     ```
     are defined globally outside of the `auth:sanctum` middleware block.
   - When Playwright sends an anonymous POST request, the server accepts it and returns `200 OK`, modifying the configuration value. This confirms that any unauthenticated external attacker can overwrite and publish critical site and brand configuration settings.
2. **Weak Rate Limit Protection**:
   - In `backend/app/Providers/AppServiceProvider.php` (line 38), the limit is set to:
     ```php
     Limit::perMinute(app()->runningUnitTests() ? 5 : 1000)
     ```
   - Since the running web server is running under `php artisan serve` (and thus `app()->runningUnitTests()` evaluates to `false`), the limit defaults to `1000` per minute.
   - This excessively high threshold allows automated bots or malicious actors to execute database bloat/spam and SMTP flooding attacks without being throttled.
3. **Ignored Proxy Headers / DoS Vulnerability**:
   - The E2E tests showed that sending `X-Forwarded-For: 1.1.1.1` and `X-Forwarded-For: 2.2.2.2` decremented the *same* remaining rate limiter bucket.
   - This proves that Laravel is not configured to trust proxy headers (e.g. through the TrustedProxies middleware), resolving the request IP to the actual TCP socket connection address (`127.0.0.1`).
   - While this prevents spoofing bypasses, it introduces a severe **Denial of Service (DoS) Risk for Proxy Users**: if the application is deployed behind a reverse proxy (e.g., Nginx, Cloudflare) without specifying the proxy as trusted, all incoming requests will appear to Laravel as coming from the proxy's IP. As a result, they will all share a single rate limiter bucket of 1000/minute, enabling a single malicious user to block the contact form for all users site-wide.

---

## 3. Caveats

- **Test Environment Context**: The server was run locally via `php artisan serve` on port 8002. If deployed to production under a different gateway/proxy, behavior might differ depending on the proxy configuration and whether the proxy adds or strips the `X-Forwarded-For` header.
- **Unit Tests vs E2E Rate Limiting**: The rate limiter decreases limit to 5 only when `app()->runningUnitTests()` is true. During E2E tests, the application runs under a standard dev environment, meaning the limit is 1000.

---

## 4. Conclusion & Adversarial Review

### Challenge Summary
**Overall risk assessment**: **HIGH**

### Challenges

#### [Critical] Challenge 1: Unauthenticated Configurations API Access
- **Assumption challenged**: Configuration saving/publishing is restricted to administrative sessions.
- **Attack scenario**: An attacker sends a raw HTTP POST request to `/api/configurations/brand_settings/draft` or `/api/configurations/brand_settings/publish` to change the default website logo, font styles, colors, and layout text, defacing the site or redirecting links.
- **Blast radius**: Full site defacement, brand manipulation, or credential phishing (by modifying links to pointing to malicious domains).
- **Mitigation**: Wrap the configurations POST routes inside an authentication middleware (`auth:sanctum` or administrative session middleware).

#### [Medium] Challenge 2: Excessive Rate Limiting Threshold
- **Assumption challenged**: The contact form is protected against automated spam and database flooding.
- **Attack scenario**: An attacker runs a script submitting thousands of form requests, bloating the SQLite database file size and sending thousands of automated SMTP mail logs.
- **Blast radius**: Storage exhaustion (DoS) of the database, SMTP server throttling or IP blacklisting.
- **Mitigation**: Set the contact form rate limit to a low, reasonable threshold (e.g., 5 to 10 submissions per minute per IP).

#### [High] Challenge 3: Shared Proxy Rate Limiter DoS
- **Assumption challenged**: The rate limiter safely identifies unique users using `$request->ip()`.
- **Attack scenario**: A user behind a shared proxy gateway or corporate network makes a burst of requests, depleting the rate limiter bucket for the proxy's IP. All other users behind the same proxy are immediately blocked from submitting forms.
- **Blast radius**: Site functionality degradation (DoS) for entire corporate offices or networks of users.
- **Mitigation**: Properly configure trusted proxies using `$middleware->trustProxies()` in Laravel's `bootstrap/app.php` and use authentication status or session identifiers in addition to client IP to track rate limit buckets.

### Stress Test Results

| Scenario | Expected Behavior | Actual Behavior | Pass/Fail |
|---|---|---|---|
| POST to `/api/configurations/brand_settings/draft` anonymously | Blocked (401/403) | Success (200 OK) | **FAIL** (Vulnerability) |
| POST to `/api/configurations/brand_settings/publish` anonymously | Blocked (401/403) | Success (200 OK) | **FAIL** (Vulnerability) |
| Limit threshold evaluation (<= 10/min) | Limit <= 10 | Limit is 1000 | **FAIL** (Logic/Spam risk) |
| Spoofing IP via `X-Forwarded-For` header | Request is tracked under spoofed IP (bypassed) | Request is tracked under actual IP (not bypassed) | **PASS** (Protected against spoofing, but DoS risk exists) |

---

## 5. Verification Method

To verify these findings independently, execute:

1. **Test Execution**:
   ```bash
   npx playwright test tests/e2e/adversarial.spec.ts
   ```
2. **Review Failures**:
   Verify that 6 failures are reported (3 tests failing on both `chromium` and `mobile-safari` projects).
3. **Manual cURL Check**:
   ```bash
   curl -X POST http://127.0.0.1:8002/api/configurations/brand_settings/draft -H "Content-Type: application/json" -d '{"value":"test"}'
   ```
   *Expected outcome*: Returns `200 OK` (proving lack of auth protection).
