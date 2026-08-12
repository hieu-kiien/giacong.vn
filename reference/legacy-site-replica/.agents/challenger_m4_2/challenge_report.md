# Challenge Report: SPA Link Interception & Dropdown Navigation Mappings (Milestone 4)

**Overall Risk Assessment**: MEDIUM

This report covers the empirical stress-testing, static code analysis, and E2E test verification of the Giacong Replica project (Milestone 4: Link Audit & Correction).

---

## 1. Summary of Verification & Outcomes

### Build & Lint Analysis
- **`npm run lint`**: **PASS** (with 18 warnings).
  - All 18 warnings were related to Next.js LCP optimization (`@next/next/no-img-element` regarding standard `<img>` tags instead of `<Image />`). No TypeScript or ESLint errors were present.
- **`npm run build`**: **INCOMPLETE/BLOCKED**.
  - Blocked by a port collision/concurrency issue because the Next.js development server (PID 3692) was already running and listening on port 3000, holding locks on the `.next` directory.

### E2E Test Run
- **`npx playwright test`**: **69 passed, 73 failed** (out of 142 total tests run on Chromium and Mobile Safari).
  - **WebKit (Mobile Safari) Infrastructure Failure (62 tests)**: 62 of the failed tests were due to the absence of the WebKit binary on the test environment (`browserType.launch: Executable doesn't exist at C:\Users\hieuk\AppData\Local\ms-playwright\webkit-2311\Playwright.exe`). The only Mobile Safari tests that passed were the API-only CORS/SMTP tests that did not require launching a browser window.
  - **Chromium Failures (11 tests)**: 11 tests failed due to real application issues, test-design mismatches, and race conditions described below.

---

## 2. Identified Bugs & Vulnerabilities

### Bug 1: SQLite Search API Lacks Tone Folding (Breakage of Accentless Queries)
- **Observation**: E2E test `Search matches accented products when searching with unaccented tones ( Vietnamese Tone folding )` failed. The search page returned `0` results when searching for `sua bot`, despite products like `Sữa Bột Pha Sẵn` existing in the database.
- **Root Cause**: `SearchController.php` executes a raw SQLite query: `LOWER(name) like ? ESCAPE '/'`. SQLite does not perform accent-folding or tone-folding by default for Unicode characters. The query `%sua bot%` does not match the accented record `Sữa Bột` in SQLite.
- **Impact**: Users searching without accents (which is highly common in Vietnamese web search) will receive empty results, even though matching products exist in the catalog.
- **Mitigation**: Update the Laravel Search API to normalize or fold Vietnamese tones before querying (e.g., using a custom SQLite function, an FTS5 virtual table, or mapping accented columns in the DB). Alternatively, the frontend's search page should fallback to local search if the API returns 0 results (currently it only falls back if the API call itself throws an error).

### Bug 2: Desktop View Lacks Visible Search Form (Test Timeout)
- **Observation**: Multiple search-related tests (`Search term, click result`, `Submitting query from search bar`, `Scenario 1`, `Scenario 5`) timed out waiting for `input[name="s"]:visible` on the homepage.
- **Root Cause**: In `HeaderClient.tsx`, the search form and input are only rendered inside the mobile menu block (`show-for-medium`). On desktop viewports (1280x800, which is the Chromium default in the Playwright config), this block is hidden (`display: none`), meaning no search input is visible.
- **Impact**: E2E tests executing in desktop Chromium mode cannot locate the search bar and fail.
- **Mitigation**: The test suite must simulate a click/hover on the search icon to open the search bar if running in desktop mode, or the header layout must render a search bar on desktop viewports.

### Bug 3: Synchronous Mobile Drawer Close Aborts SPA Navigation (Race Condition)
- **Observation**: Test `Mobile View - Expanding a drawer submenu and clicking a deep page navigation works` and `Scenario 3` failed or stayed on the homepage.
- **Root Cause**: Clicking a link in the mobile drawer (e.g., `/lien-he`) triggers the React `onClick={handleLinkClick}` handler synchronously. This handler sets `isOpen` to `false`, immediately applying `display: none` to `#main-menu` and unmounting the overlay. This sudden layout update interrupts event propagation and cancels the browser's/Next.js's navigation before it can complete.
- **Impact**: Mobile drawer navigation is flaky or completely broken.
- **Mitigation**: Defer closing the drawer using a microtask or `setTimeout` (e.g., 50ms) to allow the SPA route transition to initiate first, or rely solely on Next.js route change events to close the drawer.

### Bug 4: Button element vs. Input element Attribute Check Mismatch
- **Observation**: Tests `Form 1 submit button is disabled...` and `Form 2 ...` failed because the test asserted that `submitBtn.getAttribute('value')` equals `'Đang gửi...'`.
- **Root Cause**: The contact submit button is rendered as a `<button>` element. `ClientPage.tsx` updates its text using `.textContent = 'Đang gửi...'`. However, the test checks the `value` attribute of the button (`submitBtn.getAttribute('value')`), which is only applicable for `<input type="submit">`.
- **Impact**: Test assertions fail due to a tag attribute mismatch.
- **Mitigation**: Update the test to check `.textContent` or `.innerText` instead of `.getAttribute('value')` when validating loading spinner text.

### Bug 5: Stale/Overridden `<title>` Tag on NotFound Page
- **Observation**: Test `Missing pages have a descriptive Page Not Found title` failed. The page title for a 404 page was still the default title from the root layout.
- **Root Cause**: `not-found.tsx` renders a raw `<title>Page Not Found - Giacong.vn</title>` tag in its body. In Next.js App Router, the title is governed by metadata, and the root layout's metadata title overrides plain HTML `<title>` tags rendered inside the body.
- **Impact**: Non-existent pages display the homepage title instead of a 404/Not Found title, violating SEO standards.
- **Mitigation**: Use Next.js metadata API or export a custom layout configuration to override the title on the 404 page.

---

## 3. Stress-Test Analysis of `ClientPage.tsx` Link Interception

The click event listener in `ClientPage.tsx` (lines 359-397) was subjected to manual and logical analysis for specific edge cases:

1. **Nested Click Targets**:
   - **Scenario**: A user clicks an `<img>` tag wrapped in an `<a>` tag.
   - **Outcome**: **PASS**. The selector `(e.target as HTMLElement).closest('a')` correctly bubbles up the DOM tree and resolves to the parent anchor element.
2. **Modifier Keys**:
   - **Scenario**: A user holds `Ctrl`, `Shift`, `Cmd`, or `Alt` while clicking.
   - **Outcome**: **PASS**. The function checks for these key modifiers and exits early, preserving the browser's default behavior (e.g., opening in a new tab/window).
3. **Same-Page Hashes**:
   - **Scenario**: A link like `/lien-he#form` is clicked from the `/lien-he` page.
   - **Outcome**: **POTENTIAL UX BUG**. The link starts with `/` and doesn't start with `//` or `#`. It is intercepted, calling `e.preventDefault()` and `router.push('/lien-he#form')`. Since default behavior is prevented, the browser will not trigger the native jump/scroll to the element with `id="form"` on the same page.
4. **Middle/Auxiliary Clicks**:
   - **Scenario**: A user middle-clicks a link to open in a new tab.
   - **Outcome**: **POTENTIAL UX BUG**. The handler does not check `e.button`. If the browser fires a `click` event for middle-clicks, it will prevent default and push to the router, overriding the new-tab intent.
5. **No Leading Slash Relative Links**:
   - **Scenario**: An anchor has `href="tin-tuc"`.
   - **Outcome**: **POTENTIAL UX BUG**. The listener only intercepts links starting with `/`. A relative link like `tin-tuc` will bypass the interceptor and cause a full page reload.
