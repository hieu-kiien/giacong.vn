## 2026-07-16T20:24:24Z

You are teamwork_preview_worker_e2e_impl. Your working directory is c:\Users\hieuk\Desktop\Tham khảo giacong.vn\.agents\worker_e2e_implementation.

Your task is to design, implement, and run the E2E test suite matching the project requirements.
Do NOT build implementation features. Your output is ONLY testing infrastructure and test cases.

MANDATORY INTEGRITY WARNING:
> DO NOT CHEAT. All implementations must be genuine. DO NOT
> hardcode test results, create dummy/facade implementations, or
> circumvent the intended task. A Forensic Auditor will independently
> verify your work. Integrity violations WILL be detected and your
> work WILL be rejected.

Steps to follow:
1. Create c:\Users\hieuk\Desktop\Tham khảo giacong.vn\TEST_INFRA.md detailing feature inventory, methodology, and test architecture. Make sure it follows the template in your instructions:
   - Feature inventory
   - Methodology (Category-Partition, BVA, Pairwise, Real-world workloads)
   - Test architecture (Playwright configuration, runner, formats)
   - Real-World Application Scenarios (Tier 4)
   - Coverage thresholds (Tier 1: 30 tests, Tier 2: 30 tests, Tier 3: 6 tests, Tier 4: 5 tests)

2. Create a Playwright configuration file playwright.config.ts at the project root c:\Users\hieuk\Desktop\Tham khảo giacong.vn\playwright.config.ts.
   - Set the baseURL to http://localhost:3000
   - Configure a webServer or webServers to start:
     * The Next.js frontend (npm run dev inside frontend/) on port 3000
     * The Laravel backend (php artisan serve --port=8002 inside backend/) on port 8002
     Make sure reuseExistingServer is set so it works locally and in CI.
   - Configure browsers, screen sizes, trace settings, etc.

3. Create the test files under tests/e2e/ folder at project root:
   - page-rendering.spec.ts: Page rendering tests
   - menus.spec.ts: Header/Footer menus interactivity and link audit tests
   - search.spec.ts: Search query, accents, tones, wildcards, and fallbacks tests
   - form-submissions.spec.ts: Contact/Quotation form submissions client-side validation, click-spam protection, success behaviors, path forwarding
   - cors-smtp.spec.ts: backend config origin restrictions, SQLite DB storage verification, SMTP logs mail trigger verification
   - seo-brand.spec.ts: Head tags (title, description, H1), robots.txt, sitemap.xml, trademark compliance
   - cross-features.spec.ts: Tier 3 Cross-feature combinations (at least 6 tests)
   - workloads.spec.ts: Tier 4 Real-world workload application scenarios (at least 5 tests)

   Ensure you organize tests into:
   - Tier 1: Feature Coverage (at least 30 test cases: 5 per feature for 6 features)
   - Tier 2: Boundary & Edge Cases (at least 30 test cases: 5 per feature)
   - Tier 3: Cross-Feature Combinations (at least 6 test cases)
   - Tier 4: Real-World Workload Testing (at least 5 application scenarios)
   Total test cases: at least 71 tests. Use Playwright's test/expect syntax, with clear descriptions.

4. Run the test suite against the running replica (use run_command to run npx playwright test or similar, and check if it runs. Note: if Playwright browsers are not installed, you might need to run npx playwright install first).
   Verify that the test infrastructure runs successfully and resolves properly.

5. Once complete, publish c:\Users\hieuk\Desktop\Tham khảo giacong.vn\TEST_READY.md at project root with the test runner command and a checklist showing feature coverage across Tiers 1-4.

Deliver a detailed handoff.md report summarizing the generated files, the exact commands to run the test suite, test execution output/logs, and verification results. Write a message back to me when you're done.
