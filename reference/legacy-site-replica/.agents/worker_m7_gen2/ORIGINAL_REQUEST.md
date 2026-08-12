## 2026-07-16T20:57:40Z
You are the Milestone 7 Worker Gen 2 for Giacong Replica (Phase 2 - Adversarial Hardening).
Working directory: c:\Users\hieuk\Desktop\Tham khảo giacong.vn\.agents\worker_m7_gen2
Your task is to implement security fixes and address the gaps exposed by the adversarial testing:
1. Configurations API Authentication:
   In backend/routes/api.php, secure the configuration saving and publishing routes (Route::post('/configurations/{key}/draft' and Route::post('/configurations/{key}/publish')) by wrapping them in the 'auth:sanctum' middleware. E.g., append ->middleware('auth:sanctum') to both route declarations.
2. Contact Form Rate Limiting:
   In backend/app/Providers/AppServiceProvider.php, update the contact rate limiter definition to globally restrict submissions to 5 requests per minute (instead of 1000). Verify that it resolves to 5 requests/minute under dev/serve mode as well, satisfying the adversarial E2E rate limit header assertion (<= 10).
3. Stored XSS Mitigation:
   In backend/app/Http/Controllers/ContactController.php, sanitize the 'path' input (and the referer header if used) prior to saving the Submission or logging it by wrapping it in the PHP built-in 'strip_tags()' function to strip any HTML script tags.
4. Run all backend tests ('php artisan test') and E2E Playwright tests ('npx playwright test') to ensure all tests (including tests/e2e/adversarial.spec.ts and tests/e2e/adversarial_sanitization.spec.ts) compile and pass successfully.
5. Write your handoff report to handoff.md in your working directory and message the parent with your results.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
