# Handoff Report: Milestone 4 Link Interception & Dropdown Mappings Verification

This handoff report summarizes the verification findings, logical analysis, and stress-testing results of the SPA link click interception and dropdown navigation mappings for Milestone 4 (Link Audit & Correction).

---

## 1. Observation
1. **E2E Test Output**:
   - Running `npx playwright test` returned `69 passed, 73 failed` (Exit Code 1).
   - Verbatim error for tone folding search in `tests\e2e\search.spec.ts:77:7`:
     ```
     Error: expect(received).toBeGreaterThan(expected)
     Expected: > 0
     Received:   0
     at C:\Users\hieuk\Desktop\Tham khảo giacong.vn\tests\e2e\search.spec.ts:80:19
     ```
   - Verbatim error for mobile menu toggle in `tests\e2e\menus.spec.ts:98:7`:
     ```
     Error: Timeout 5000ms exceeded while waiting on the predicate
     111 |       await toggleSubMenu.click({ force: true });
     112 |       await expect(subMenuParent).toHaveClass(/active/);
     > 113 |     }).toPass({ timeout: 5000 });
     ```
   - Verbatim error for 404 page title check in `tests\e2e\seo-brand.spec.ts:60:7`:
     ```
     Error: expect(received).toContain(expected) // indexOf
     Expected substring: "not found"
     Received string:    "giacong.vn - đối tác gia công oem/odm & private label hàng đầu"
     ```
   - Verbatim error for loading button check in `tests\e2e\form-submissions.spec.ts:77:7`:
     ```
     Error: "page.waitForTimeout: Test ended." while running route callback.
     ```
2. **Search API Implementation (`backend/app/Http/Controllers/SearchController.php`)**:
   - Line 28: `$products = Product::whereRaw('LOWER(name) like ? ESCAPE \'/\'', [$lowerQuery])->get();`
3. **Link click listener (`frontend/src/components/ClientPage.tsx`)**:
   - Lines 359-397 contain `handleLinkClick` which intercepts any click matching `href.startsWith('/')` and calls `e.preventDefault()` followed by `router.push(href)`. It checks modifier keys (`e.metaKey || e.ctrlKey || e.shiftKey || e.altKey`), but does not check `e.button` (for middle clicks).
4. **Header structure (`frontend/src/components/HeaderClient.tsx`)**:
   - The desktop navigation block (`hide-for-medium flex-right`) contains menu items but does not render a search form. The search form is only inside `show-for-medium flex-right` (mobile view).
5. **Mobile Drawer (`frontend/src/components/MobileDrawer.tsx`)**:
   - Lines 73 & 109 show that visibility of the drawer and submenus is toggleable via state `isOpen` and `isDichVuOpen`. Clicking a drawer link calls `handleLinkClick` which synchronously changes state to closed.

---

## 2. Logic Chain
1. **Search Tone Folding Bug**:
   - The test `Search matches accented products... ( Vietnamese Tone folding )` inputs search terms without accents (e.g. `sua bot`) and expects to match records containing accents (e.g. `Sữa Bột`).
   - `SearchController.php` delegates search to SQLite using `LOWER(name) like ?`.
   - SQLite `like` searches do not support tone-folding or character collation mapping natively on UTF-8 characters.
   - Therefore, accented items are not returned when queried without accents, causing the test to fail.
2. **Desktop Search Form Timeout Bug**:
   - The E2E tests target `input[name="s"]:visible` immediately on the homepage without first opening the mobile menu.
   - The desktop layout hides the mobile header block `show-for-medium`. Since the desktop layout does not render any search input, the element is never visible.
   - Thus, Playwright test times out waiting for the search input.
3. **Mobile Drawer Navigation Interruption (Race Condition)**:
   - When a link in the mobile drawer is clicked, the `onClick` handler synchronously closes the drawer (setting `isOpen = false`), causing it to receive `display: none` instantly.
   - This layout update hides the element from the DOM during event dispatching.
   - As a result, the click event fails to bubble up to the `document` (where `ClientPage.tsx`'s interceptor is listening) and prevents the default Next.js `Link` navigation from completing.
4. **404 page title issue**:
   - `not-found.tsx` renders a raw HTML `<title>` tag in its body.
   - Next.js App Router root layout specifies default `metadata.title` which overrides any non-metadata HTML `<title>` tags rendered inside page components.
   - Therefore, the title of the 404 page remains the root layout's title, failing the test.

---

## 3. Caveats
- Playwright tests on WebKit/Mobile Safari failed completely due to the test environment lacking the WebKit browser binaries. WebKit E2E tests could not be verified, but the CORS/SMTP tests that do not launch browser windows passed.
- No direct implementation changes were made, in accordance with the challenger role constraints ("Review-only — do NOT modify implementation code").

---

## 4. Conclusion
While the SPA click interceptor handles nested image tags and modifier keys successfully, it introduces minor UX limitations (potential middle-click override, blockage of same-page hash scrolling, and ignoring of relative links without leading slashes). The E2E test failures on Chromium (11 failures) are caused by:
1. Missing tone folding support in the Laravel SQLite backend API.
2. Missing desktop search input inside the header layout.
3. Race condition between drawer closing and SPA navigation.
4. Next.js App Router metadata overriding the 404 page title.
5. Playwright test checking `value` attribute of a `<button type="submit">` instead of `.textContent`.

---

## 5. Verification Method
- Execute the Chromium-only E2E tests:
  `npx playwright test --project=chromium`
- To run search tests specifically:
  `npx playwright test tests/e2e/search.spec.ts --project=chromium`
- To run menus tests specifically:
  `npx playwright test tests/e2e/menus.spec.ts --project=chromium`

---

## 6. Remaining Work
- Fix the tone-folding search behavior in Laravel or add local search fallback on empty API responses.
- Resolve the synchronous drawer-close race condition.
- Update the E2E tests to check button `textContent` instead of `value` attribute.
- Add metadata or layout override to fix the 404 Page title.
