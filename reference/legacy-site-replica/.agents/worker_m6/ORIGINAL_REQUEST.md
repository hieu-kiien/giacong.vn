## 2026-07-17T19:30:57Z
You are the Milestone 6 Worker.
Your working directory is: c:\Users\hieuk\Desktop\Tham khảo giacong.vn\.agents\worker_m6
Your parent is: Implementation Track Orchestrator (aa37c91c-85ba-4046-972d-07e4e47d711f)

Task:
1. Create a file `TRADEMARK_BRAND_GUIDE.md` at the project root (`c:\Users\hieuk\Desktop\Tham khảo giacong.vn\TRADEMARK_BRAND_GUIDE.md`). Use the exact designed content from `.agents/explorer_m6/proposed_TRADEMARK_BRAND_GUIDE.md`. Read that file first, copy its full contents, and write to the root file.
2. Run the SEO assertion verification script `node scripts/verify-seo.js` inside the `frontend` folder to make sure sitemap.xml and robots.txt checks pass successfully.
3. Clean up any active/stale server processes on ports 3000 and 8002 if needed.
4. Run `npm run lint` and `npm run build` in `frontend/` to ensure the project builds correctly with no errors.
5. Run the Playwright E2E tests `npx playwright test --project=chromium` in the root directory to confirm all tests pass, specifically the SEO and brand tests (e.g. `seo-brand.spec.ts`).
6. Write your handoff.md in your working directory and notify the parent orchestrator (aa37c91c-85ba-4046-972d-07e4e47d711f) when done.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
