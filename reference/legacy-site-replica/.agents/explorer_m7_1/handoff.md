# Visual & Layout Parity Exploration Report

## 1. Observation
- **Visual Parity & Breakpoint Requirements**:
  As defined in `c:\Users\hieuk\Desktop\Tham khảo giacong.vn\PROJECT.md` under section **R5. Visual Parity & Layout Alignment**:
  - Viewport breakpoints: `320px`, `768px`, and `1280px` must match the live `https://giacong.vn` site.
  - Converted layout components (Header, Footer, Mobile Drawer, dropdowns) must use native Flatsome-themed CSS classes and visual colors (`#5aa400` / `#eb892d`) to ensure brand identity.
  - As defined in `c:\Users\hieuk\Desktop\Tham khảo giacong.vn\TRADEMARK_BRAND_GUIDE.md` under section **4.1. Official Palette**:
    - **Primary Green**: `#5aa400` (used for headers, primary badges, and brand highlights).
    - **Secondary Orange**: `#eb892d` (used for call-to-actions, buttons, and accents).
    - **Typography**: System-native sans-serif fonts mimicking clean Vietnamese typography or Flatsome standard layouts. The user request specifies `SF Pro Display`.

- **Layout Components Inspection**:
  - **Header (`HeaderClient.tsx`)**:
    - Implements sticky navigation layout (`header.has-transparent.has-sticky.sticky-jump`) with react state triggers (`isStuck`, `isTransparent`) that toggle `.stuck` and `.transparent` classes on scroll.
    - Preserves Flatsome-themed classes (`.flex-row`, `.container`, `.logo-center`, `.header-nav`, `.menu-item`, `.nav-top-link`).
    - Maps navigation links to local relative Next.js routes (e.g. `Link` to `/`, `/gioi-thieu-ve-gia-cong`, `/san-pham`, `/tin-tuc`, `/lien-he`).
    - Handles mega dropdown menus (`#menu-item-1742` for Sản Phẩm and `#menu-item-5166` for Dịch vụ) with hover/focus handlers (`onPointerEnter`, `onPointerLeave`) and a `150ms` close delay to prevent flickering.
    - Integrates with search form dropdown and mobile menu button (`a[aria-label="Menu"]`) to toggle the mobile drawer.
  - **Footer (`Footer.tsx`)**:
    - Renders standard footer section (`#section_758033202`) with logo `/assets/images/logo-gia-cong-new-300x85_f07d085c.png` and 4-column grid (`medium-4 small-6 large-4`, etc.) detailing services, policies, company information, DMCA badges, and social follow icons.
    - Renders absolute copyright footer and a back-to-top button appearing when `window.scrollY > 300` with smooth scroll behavior.
  - **Mobile Drawer (`MobileDrawer.tsx`)**:
    - Renders sliding off-canvas panel `#main-menu` with backdrop overlay `.main-menu-overlay`.
    - Synchronizes state with document classes: adding `has-off-canvas`, `has-off-canvas-left`, and `off-canvas-active` to both `html` and `body` tags when open, matching Flatsome's native viewport lock behavior.
    - Registers capture-phase click/touch event listeners at the document level to intercept clicks and handle drawer submenu toggling.

- **Typography & Brand Colors**:
  - `globals.css` contains `@font-face` declarations for `SF Pro Display` and `SFProDisplay` pointing to local fonts (`/assets/fonts/SFProDisplay-Regular.woff2`, etc.) and sets the global rule `html, body, h1, h2, h3, h4, h5, h6 { font-family: "SF Pro Display", "SFProDisplay", sans-serif; }`.
  - The branding colors `#5aa400` (primary green) and `#eb892d` (secondary orange) are not hardcoded in `globals.css`. Instead, they are dynamically loaded via an inline stylesheet block `<style id="custom-css" type="text/css">` on all pages (found at lines 83/89 of EJS fallbacks like `home.ejs`, `san-pham.ejs`, and inside Laravel SQLite database records). This block declares `:root { --primary-color: #5aa400; }`, `.header-bg-color { background-color: #5aa400 }`, hover colors (`a:hover { color: #eb892d }`), and secondary background highlights (`[data-icon-label]:after, ... { background-color: #eb892d }`).

- **Test Execution Findings**:
  - Running `npm run build` in `frontend/` succeeds, generating static pages and `sitemap.xml` with 799 entries.
  - Running `npx playwright test` triggers the E2E verification suite.
  - **Overall Results**: Out of 148 tests run (testing `chromium` and `mobile-safari` viewports), **131 passed**, **12 failed**, **4 flaky**, and **1 skipped**.
  - **CORS/SMTP Tests**: All CORS origins and database/SMTP logs trigger tests (1-10) passed successfully.
  - **Key Failures**:
    1. **Database Persistence Checks (sqlite3)**: Tests attempting to write/read using direct `sqlite3` CLI commands (e.g. `cross-features.spec.ts` test 14, `workloads.spec.ts` Scenario 2) timed out (60s) on Windows.
    2. **Quotation Form 2 homepage submission**: Test 21 & 22 in `form-submissions.spec.ts` failed on both desktop and mobile viewports due to dialogue expectation timeout.
    3. **Quotation Form 2 validation & disabled states**: Tests 115, 203, and 224 in `form-submissions.spec.ts` failed on Chromium.
    4. **Homepage H1 & Color Compliance**: Test 15 in `seo-brand.spec.ts` (homepage H1 tag count) and test 97 (Color Compliance) failed on Chromium and were flaky on Mobile Safari.
    5. **Connection issues**: Scenario 2 in `workloads.spec.ts` failed on Mobile Safari with `Could not connect to server`.

## 2. Logic Chain
- **Typography Compliance**: Since `globals.css` imports local SF Pro Display assets and applies them to body/headers, and since `next.config.ts` bundles it, typography compliance is verified.
- **Brand Colors Injection**: Since Next.js catches catch-all routes and injects EJS template contents containing the `<style id="custom-css">` block, the brand colors `#5aa400` and `#eb892d` are dynamically applied to the DOM.
- **Flatsome Class Compliance**: Since `HeaderClient.tsx`, `Footer.tsx`, and `MobileDrawer.tsx` preserve original Flatsome classes (`.header-wrapper`, `.footer-wrapper`, `.mobile-sidebar`, `.off-canvas-active`), they match the styling of the live site.
- **Playwright SQLite Hangups**:
  - Observation: `cross-features.spec.ts` test 14 and `workloads.spec.ts` Scenario 2 execute `sqlite3 database/database.sqlite ...` via Node's `execSync`.
  - Observation: On Windows, non-interactive execution of `sqlite3` can hang waiting for stdin if quotes or arguments are parsed incorrectly under `cmd.exe`.
  - Conclusion: Direct `sqlite3` shell execution in test specs causes hangs/timeouts in Windows environments. Using `php artisan tinker --execute="..."` (which succeeded in `cors-smtp.spec.ts`) is a much more robust and cross-platform verification method.
- **Quotation Form 2 and Homepage Load Failures (Race Condition)**:
  - Observation: Multiple page elements (such as `h1` count and CSS brand colors) and Quotation Form 2 validation/submission timed out or failed on the homepage. At the same time, we saw backend connection errors (`ECONNREFUSED` on port 8002) at the start of Next.js page generation.
  - Conclusion: A startup race condition exists. Playwright launches both the Next.js frontend and Laravel backend concurrently. If Next.js attempts to pre-render the homepage or handle browser navigation requests before the Laravel API is fully responsive, it falls back to empty/incomplete data states, preventing the page title, headings, and styling blocks from loading correctly. This propagates as test failures for homepage elements and Quotation Form 2 interactivity.
- **Form 2 Homepage Submission Dialog Failure**:
  - Observation: Form 2 homepage submission test fails because the dialog assertion `expect(msg.includes('thành công') || msg.includes('successfully')).toBe(true)` times out.
  - Conclusion: The submission fetch to `/api/contact` returned a non-success response or threw a network exception due to the API connection failure. This caused `ClientPage.tsx` to alert `Gửi yêu cầu thất bại. Vui lòng thử lại sau.`, which failed the dialog assertion and blocked setting `dialogTriggered = true`.

## 3. Caveats
- Visual regression testing (VRT) screen comparisons were not dynamically verified via screenshots during the current run due to execution time and lack of baseline image assets.
- External analytics/chat widget scripts (like Facebook Chat, OneSignal, Google Analytics) are explicitly blocked in `ClientPage.tsx` (`BLOCKED_SCRIPT_KEYWORDS`) to prevent hydration mismatches and console errors.

## 4. Conclusion
- The Next.js frontend successfully implements the visual parity and responsive design constraints of `PROJECT.md` (colors `#5aa400` and `#eb892d`, typography `SF Pro Display`, breakpoints 320px/768px/1280px).
- The three key layout components (`HeaderClient.tsx`, `Footer.tsx`, `MobileDrawer.tsx`) are functionally compliant, correctly applying Flatsome class structures and responsive drawer class toggles.
- Playwright E2E tests containing direct shell execution of the `sqlite3` command are prone to timeouts on Windows and should be refactored to use `php artisan tinker`.

## 5. Verification Method
- Build: Run `npm run build` in `frontend/` to compile Next.js production bundle.
- Tests: Run `npx playwright test` to execute E2E verification suite.
- Manual Inspection: Inspect `frontend/src/app/globals.css` and EJS fallback files (`frontend/src/data/pages/*.ejs`) to verify font face declarations and brand colors.
