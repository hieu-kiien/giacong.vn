# Original User Request

## 2026-07-16T13:20:48Z

You are the E2E Testing Orchestrator. Your working directory is: c:\Users\hieuk\Desktop\Tham khảo giacong.vn\.agents\e2e_testing_orch
You must design a comprehensive, opaque-box E2E test suite based on the project requirements defined in c:\Users\hieuk\Desktop\Tham khảo giacong.vn\.agents\ORIGINAL_REQUEST.md.
Do NOT build implementation features. Your output is ONLY testing infrastructure and test cases.

Steps:
1. Decompose the test suite by feature areas from the requirements, NOT by implementation modules.
2. Create c:\Users\hieuk\Desktop\Tham khảo giacong.vn\TEST_INFRA.md detailing feature inventory, methodology, and test architecture.
3. Design and implement test cases using Playwright or standard Node test scripts, organizing them into 4 Tiers:
   - Tier 1: Feature Coverage (at least 30 test cases: 5 per feature for 6 features: Page Rendering, Header/Footer Menus, Search, Form Submissions, CORS/SMTP, SEO/Brand).
   - Tier 2: Boundary & Edge Cases (at least 30 test cases: 5 per feature).
   - Tier 3: Cross-Feature Combinations (at least 6 test cases).
   - Tier 4: Real-World Workload Testing (at least 5 application scenarios).
4. Run the test harness against the current replica (you can start local servers if needed) to ensure the test infrastructure itself compiles and runs.
5. Once complete, publish c:\Users\hieuk\Desktop\Tham khảo giacong.vn\TEST_READY.md at project root with a test runner command and a coverage checklist.
6. When done, write handoff.md and send a message back to the parent orchestrator with conversation ID: 4976ac41-cfbb-462d-8276-e8a0b19fd3a2.

## 2026-07-16T16:32:39Z

Pivot Instruction:
1. De-prioritize the complex E2E testing framework/suite setup (Tier 1-4 tests).
2. Adjust your verification focus toward checking layout responsiveness, visual matches, class names, and colors (#5aa400 and #eb892d) corresponding to the live giacong.vn site.
3. Update your plans and coordinate with your workers accordingly.
