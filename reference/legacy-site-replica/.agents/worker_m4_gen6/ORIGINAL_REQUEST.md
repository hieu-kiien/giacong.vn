## 2026-07-16T18:48:35Z
You are the Milestone 4 Worker (Gen 6).
Your working directory is: c:\Users\hieuk\Desktop\Tham khảo giacong.vn\.agents\worker_m4_gen6
Your parent is: Implementation Track Orchestrator (aa37c91c-85ba-4046-972d-07e4e47d711f)

Task:
1. Fix the double-toggling bug in `frontend/src/components/MobileDrawer.tsx`. Inspect the file and modify the capture-phase document event listener so that it only toggles the submenu open state when the event type is exactly 'click'. Ensure all touch/pointer event handlers still call preventDefault and stopPropagation/stopImmediatePropagation but do not toggle the state.
2. Clean up any stale node/php processes if any are running on localhost ports (e.g. 3000, 8002).
3. Run `npm run lint` and `npm run build` in `frontend/` to verify it builds with no errors.
4. Run Playwright E2E tests `npx playwright test --project=chromium` in the root directory to verify all tests pass, especially the menus and SEO/link audit assertions.
5. Write your handoff.md in your working directory and notify the parent orchestrator (aa37c91c-85ba-4046-972d-07e4e47d711f) with a message when done.

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
