# Handoff Report — Milestone 4 Challenger

## 1. Observation

- **Direct Observation 1 (E2E Test Execution in frontend/):**
  Running `npx playwright test --config=../playwright.config.ts --project=chromium` inside the `frontend/` directory resulted in 13 failures. The primary errors were path resolution mismatches and shell execution failures:
  ```
  Error: spawnSync C:\Windows\system32\cmd.exe ENOENT
  at C:\Users\hieuk\Desktop\Tham khảo giacong.vn\tests\e2e\cors-smtp.spec.ts:34:37
  
  Error: expect(received).toBe(expected)
  Expected: true
  Received: false
  expect(fs.existsSync(logPath)).toBe(true);
  ```

- **Direct Observation 2 (E2E Test Execution in Root):**
  Running `npx playwright test --project=chromium` in the root repository folder resolved the environment and path resolution issues, resulting in **66 passes and 5 failures**.
  Verbatim failures observed in task-87 log:
  ```
  1) tests\e2e\cross-features.spec.ts:5:7 >> Search and Navigation Integration
     Error: locator.fill: Test timeout of 60000ms exceeded.
     
  2) tests\e2e\cross-features.spec.ts:26:7 >> Navigation and Form Submission
     Error: expect(page).toHaveURL(expected) failed
     Expected pattern: /\/lien-he/
     Received string:  "http://localhost:3000/"
     
  3) tests\e2e\menus.spec.ts:98:7 >> Mobile View - Expanding a drawer submenu and clicking a deep page navigation works
     Error: Timeout 5000ms exceeded while waiting on the predicate
     await expect(subMenuParent).toHaveClass(/active/);
     
  4) tests\e2e\seo-brand.spec.ts:60:7 >> Missing pages have a descriptive Page Not Found title
     Error: expect(received).toContain(expected) // indexOf
     Expected substring: "not found"
     Received string:    "giacong.vn - đối tác gia công oem/odm & private label hàng đầu"
  ```

- **Direct Observation 3 (Hydration Warnings):**
  During tests, the WebServer outputs repeated hydration warnings:
  ```
  [WebServer] [browser] Uncaught Error: Hydration failed because the server rendered HTML didn't match the client. As a result this tree will be regenerated on the client.
  ```

- **Direct Observation 4 (Click Interceptor Logic):**
  In `frontend/src/components/ClientPage.tsx`:
  ```typescript
  359: const handleLinkClick = (e: MouseEvent) => {
  360:   if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
  361:     return;
  362:   }
  ...
  394:   e.preventDefault();
  395:   router.push(href);
  396: };
  ```

---

## 2. Logic Chain

1. **Path/Environment Failures:** From *Observation 1*, E2E test files use relative path constructs like `path.resolve('backend/storage/logs/laravel.log')` and `{ cwd: './backend' }` for `execSync`. If run from `frontend/`, these paths resolve incorrectly, and the stripped environment variables in Playwright's default child-process context prevent spawning `cmd.exe`.
2. **Root Run Success:** Running the tests from the repository root (*Observation 2*) resolves the CWD paths correctly and inherits standard Windows system paths, allowing CORS, Database persistence, and SMTP log assertions to execute and pass.
3. **404 Page Title Bug:** As seen in *Observation 2 (Error 4)*, `/non-existent-page-slug-for-seo` returns the home page title instead of "Page Not Found". Looking at `frontend/src/app/not-found.tsx` and `layout.tsx`, the 404 page attempts to set the title via inline JSX `<title>` tag which Next.js App Router ignores, leaving the default metadata title from the parent layout active.
4. **Mobile Navigation/Menu Failures:** The Mobile drawer click navigation to `/lien-he` and drawer submenu expansion failed (*Observation 2, Errors 2 & 3*). This aligns with *Observation 3* (hydration mismatch error), indicating that React's hydration mismatch on the `MobileDrawer` results in broken client-side event bindings or destructive jQuery manipulation (e.g. `$('.sidebar-menu .toggle').remove()` in `ClientPage.tsx`).
5. **Click Interceptor Vulnerability:** *Observation 4* shows that the link click handler does not check `e.button` or `e.defaultPrevented`. Therefore, middle-clicks, right-clicks, and links with custom handlers that already called `preventDefault` will still be intercepted, leading to broken tab behavior and custom component malfunctions.

---

## 3. Caveats

- We did not modify any source code to fix the bugs because the Challenger agent archetype is strictly review-only ("do NOT modify implementation code").
- E2E tests are somewhat slow on Windows (taking ~3-4 minutes) due to Next.js dev server starting up dynamically inside Playwright's webServer processes.

---

## 4. Conclusion

The Milestone 4 link corrections and E2E persistence capabilities are functional, but 5 core bugs must be addressed before the implementation is fully robust:
1. **Accessibility/Interception bug**: Global click interceptor needs to ignore non-left clicks (`e.button !== 0`) and check `e.defaultPrevented`.
2. **Next.js 404 title metadata bug**: `not-found.tsx` needs to export a standard `Metadata` object to set the title, rather than using JSX `<title>` tags.
3. **Mobile Drawer Hydration conflict**: Resolve the DOM differences causing the hydration mismatch in the MobileDrawer component.
4. **E2E test suite running context**: Tests must be executed from the root directory rather than `frontend/` to ensure correct relative path and environment resolution.

---

## 5. Verification Method

- **Command to verify:** Run `npx playwright test --project=chromium` in the root repository directory.
- **Expected result:** All tests pass once the metadata title, hydration issues, and click interceptor edge cases are resolved.
- **Files to inspect:**
  - `frontend/src/components/ClientPage.tsx`
  - `frontend/src/app/not-found.tsx`
  - `frontend/src/components/MobileDrawer.tsx`
