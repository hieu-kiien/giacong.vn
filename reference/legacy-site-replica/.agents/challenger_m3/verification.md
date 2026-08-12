# Empirical Verification Report - Milestone 3 Challenger

**Date**: 2026-07-16  
**Status**: Verification Complete (with findings and failing test analysis)  
**Target Directory**: `c:\Users\hieuk\Desktop\Tham khảo giacong.vn\frontend`

---

## 1. Observations

### 1.1 Compile and Build Verification
Running the production Next.js build command:
```powershell
npm run build
```
Resulted in a **successful build**:
- **Compilation**: `✓ Compiled successfully in 2.7s`
- **TypeScript Check**: `Finished TypeScript in 4.7s ...`
- **Sitemap Generation**: `Successfully generated sitemap.xml with 799 entries.`
- **Static Page Generation**: All routes generated successfully (`/`, `/[...slug]`, `/search`, `/tin-tuc`).

### 1.2 ESLint and Type Safety
Running the linter command:
```powershell
npm run lint
```
Resulted in **0 errors** and 18 image optimization warnings (Next.js `@next/next/no-img-element` rule):
- `HeaderClient.tsx`: 8 warnings regarding `<img>` tag usage instead of `next/image`.
- `Footer.tsx`: 3 warnings regarding `<img>` tag usage.
- `MobileDrawer.tsx`: 5 warnings.
- `search/page.tsx` & `tin-tuc/page.tsx`: 2 warnings.
- **TypeScript Types**: The TypeScript compiler completed with no errors, confirming types are robust.

### 1.3 Link Routing Audit
We analyzed all navigation link paths in the newly converted React components:
- **`HeaderClient.tsx`**: Contains relative lowercase links `/`, `/gioi-thieu-ve-gia-cong`, `/san-pham`, `/tin-tuc`, `/lien-he`.
- **`Footer.tsx`**: Contains relative lowercase links like `/chinh-sach-thanh-toan`, `/chinh-sach-bao-mat`, `/gia-cong-sua`, `/dich-vu-say`, etc.
- **`MobileDrawer.tsx`**: Contains relative lowercase links like `/thuc-pham-chuc-nang`, `/tin-tuc`, `/lien-he`.
- **`SanPhamDropdown.tsx`** & **`DichVuDropdown.tsx`**: Contains relative lowercase links like `/gia-cong-sot-cham`, `/dich-vu-say`, `/say-thang-hoa`, `/gia-cong-sua-hat`.

**Result**: All routing paths correctly point to valid relative paths (no uppercase characters, no spaces, and no empty/dead links).

### 1.4 HTML Structure Verification
We inspected `layout.tsx` and the output structure:
- **Layout Integration**: The Next.js layout (`layout.tsx`) wraps the pages with the basic `<html>`, `<head>`, and `<body>` tags.
- **Regex Stripping**: In `frontend/src/utils/pageParser.ts` (lines 153 and 264), the parser strips the legacy mobile sidebar menu using:
  ```typescript
  afterFooter = html.substring(footerIdx + footerInclude.length).replace(/<div\s+id="main-menu"[\s\S]*$/i, '');
  ```
- **Result**: This regex successfully strips the original `<div id="main-menu">` off-canvas element along with duplicates of scripts already loaded in `layout.tsx` from the static EJS template. There is exactly one `#main-menu` element rendered dynamically by the React component `MobileDrawer`.

---

## 2. E2E Test Failure Analysis & Findings

We executed the E2E test suite in Chromium and identified key failures in the converted components and E2E test scripts.

### 2.1 Mobile Drawer Click Overlay Interception (Test Failure 1)
- **Verbatim Error**: 
  ```
  Error: locator.click: Test timeout of 60000ms exceeded.
  ...
  <div class="main-menu-overlay"></div> intercepts pointer events
  ```
- **Finding**: In `MobileDrawer.tsx`, the `<div className="main-menu-overlay">` has an inline style with `zIndex: 99` and `pointerEvents: 'auto'`. However, the off-canvas drawer `#main-menu` has class `.mobile-sidebar` and no higher inline z-index. Consequently, the overlay sits *on top of* the drawer in the layout stack, blocking all pointer events (clicks) on the menu toggle buttons or links inside the drawer.
- **Blast Radius**: Mobile users cannot interact with or navigate via the drawer submenus because the overlay intercepts all clicks.

### 2.2 React Menu State vs. Legacy jQuery Scripts Conflict (Test Failure 2)
- **Verbatim Error**:
  ```
  Error: expect(productsMenu).not.toHaveClass(/hover/) failed
  Received string: "... active hover show ..."
  ```
- **Finding**: In `HeaderClient.tsx`, pressing `Escape` calls `setActiveMenu(null)` to close the dropdown. However, because the mouse cursor is still physically hovering over the `#menu-item-1742` element, the legacy `flatsome.js` jQuery script (loaded in `layout.tsx`) dynamically re-injects the `.hover` class on the element. Additionally, native CSS `:hover` selectors in `flatsome.css` keep the dropdown visually open.
- **Blast Radius**: Keyboard navigation accessibility is compromised because pressing `Escape` fails to close the active desktop dropdown if the pointer remains on it.

### 2.3 Missing Desktop Search Bar (Test Failure 3)
- **Verbatim Error**:
  ```
  Error: locator.fill: Test timeout of 60000ms exceeded.
  waiting for locator('input[name="s"]').first() - element is not visible
  ```
- **Finding**: In `HeaderClient.tsx`, `<SearchForm>` is only rendered inside the mobile right header dropdown (`show-for-medium`) and the mobile drawer (`MobileDrawer.tsx`). There is no desktop search form in the desktop header. As a result, when tests run on desktop viewports, they cannot find any visible search inputs.
- **Blast Radius**: Desktop users have no search functionality.

### 2.4 Search Page Fallback Logic and Accent-Folding Defect (Test Failure 4)
- **Verbatim Error**:
  ```
  Error: expect(received).toBeGreaterThan(expected)
  Expected: > 0, Received: 0 (for query "sua" and "sua bot")
  ```
- **Finding**: 
  1. The backend SQLite database search utilizes a standard SQL `LIKE '%sua%'` query which does not support Vietnamese accent/tone folding. Thus, searching for `sua` returns 0 database matches (while searching for `sữa` works).
  2. In `app/search/page.tsx`, the search page fetches from the API. If the server is online, it returns status 200 with an empty list `[]`. The page marks `apiUsed = true` and skips local search.
  3. Consequently, the local search fallback (which *does* normalize and tone-fold queries using `removeVietnameseTones`) is never executed, yielding 0 results.
- **Blast Radius**: Search fails to return results for unaccented queries when the API is active.

### 2.5 Over-Strict Test Assertions (Test Issues)
- **`footer` Locator Violation**: `Should render header and footer layouts` failed because Next.js dev tools dynamically inject an `<footer class="error-overlay-footer">` in development, violating Playwright's strict mode expectation of a single `footer`.
- **Absolute URL Check Violation**: `Footer links audit` failed because the DMCA badge links legitimately contain the absolute URL `https://giacong.vn` as a query parameter (e.g., `&refurl=https://giacong.vn/`).
- **About Page Title Discrepancy**: The dynamic about page test expected `'giới thiệu'` in the title, but the metadata title is `"Về Giacong.vn - Giacong.vn"`.
- **404 Page Title**: Dynamic catch-all pages that throw 404 retain the default title `'Giacong.vn'` instead of `'Page Not Found'` because `generateMetadata` evaluates before the component calls `notFound()`.

---

## 3. Conclusions

1. **Compilation & Build**: SUCCESSFUL. The React components compile, and Next.js successfully generates optimized production builds.
2. **HTML Structure & Links**: SUCCESSFUL. Duplicates are cleanly stripped by pageParser regex, and links conform to relative lowercase guidelines.
3. **Accessibility, Interactivity & UI Layering**: FAILED. The converted components have critical bugs:
   - Z-Index mismatch on mobile overlay blocks all drawer clicks.
   - Missing desktop search bar on desktop viewports.
   - Escape key close fails due to jQuery class conflicts.
   - Unaccented search results are blocked by empty API responses.

---

## 4. Verification Methods

To reproduce these observations, run the following commands from the project root directory:

1. **Production Build Check**:
   ```bash
   cd frontend
   npm run build
   ```
2. **Run Menus Tests (Chromium)**:
   ```bash
   npx playwright test tests/e2e/menus.spec.ts --project=chromium
   ```
3. **Run SEO/Brand Tests (Chromium)**:
   ```bash
   npx playwright test tests/e2e/seo-brand.spec.ts --project=chromium
   ```
4. **Run Search Tests (Chromium)**:
   ```bash
   npx playwright test tests/e2e/search.spec.ts --project=chromium
   ```
