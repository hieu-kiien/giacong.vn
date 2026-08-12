## 2026-07-16T17:03:30Z
Fix the double-toggling bug in `frontend/src/components/MobileDrawer.tsx`. Inspect the file and modify the capture-phase document event listener so that it only toggles the submenu open state when the event type is exactly 'click'. Ensure all touch/pointer event handlers still call preventDefault and stopPropagation/stopImmediatePropagation but do not toggle the state.
Clean up any stale node/php processes if any are running on localhost ports (e.g. 3000, 8002).
Run `npm run lint` and `npm run build` in `frontend/` to verify it builds with no errors.
Run Playwright E2E tests `npx playwright test --project=chromium` in the root directory to verify all tests pass, especially the menus and SEO/link audit assertions.
Write your handoff.md in your working directory and notify the parent orchestrator (aa37c91c-85ba-4046-972d-07e4e47d711f) with a message when done.
