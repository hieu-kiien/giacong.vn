# Handoff Report — Challenger Milestone 3

## 1. Observation
- **File Paths**: `frontend/src/components/HeaderClient.tsx`, `frontend/src/components/Footer.tsx`, `frontend/src/components/MobileDrawer.tsx`, `frontend/src/components/SanPhamDropdown.tsx`, `frontend/src/components/DichVuDropdown.tsx`, `frontend/src/app/layout.tsx`.
- **Command Output (Build)**: `next build` succeeded with no errors.
- **Command Output (Lint)**: `eslint` returned 0 errors and 18 warnings (LCP/img optimization related).
- **Test Failures**:
  - `tests/e2e/menus.spec.ts` had 4 failures in Chromium.
    - Overlay covers mobile drawer: `main-menu-overlay intercepts pointer events` on `button.toggle` click.
    - Escape key close fails: `expect(productsMenu).not.toHaveClass(/hover/)` failed (received `hover` class).
    - Footer strict mode: `locator('footer')` resolved to 2 elements (second element is nextjs-error-overlay-footer).
    - Link absolute check: `expect(href).not.toContain('https://giacong.vn')` failed on DMCA badge query param `refurl=https://giacong.vn/`.
  - `tests/e2e/seo-brand.spec.ts` had 4 failures in Chromium.
    - Header logo check: `expect(logoImg).toBeVisible() failed`.
    - Dynamic title mismatch: `expect(title.toLowerCase()).toContain('giới thiệu')` failed (received `"về giacong.vn - giacong.vn"`).
    - 404 page title check: `expect(title.toLowerCase()).toContain('not found')` failed (received `"giacong.vn"`).
  - `tests/e2e/search.spec.ts` had 3 failures in Chromium.
    - Search bar fill: `locator.fill: Test timeout of 60000ms exceeded` on `input[name="s"]` (element not visible on desktop viewport).
    - Search results empty: `expect(count).toBeGreaterThan(0)` received 0 for query `sua` and `sua bot`.

## 2. Logic Chain
- **Build Success**: The compilation and sitemap generation succeeded, meaning there are no syntactic or import errors blocking page generation.
- **Z-Index bug**: The `.main-menu-overlay` has an inline style of `zIndex: 99`. The drawer `.mobile-sidebar` lacks positioning/z-index properties to place it above the overlay. Therefore, the overlay intercepts clicks intended for the drawer toggle.
- **jQuery Conflict**: The `flatsome.js` jQuery script runs alongside React, dynamically injecting the `hover` class on hover. When React tries to clean classes on `Escape` keypress, jQuery overrides the behavior because the cursor is still hovering.
- **Missing Desktop Search**: The `<SearchForm>` is omitted in desktop navigation elements in `HeaderClient.tsx`. Therefore, there are no visible search fields on desktop viewports.
- **Tone-folding Bug**: SQLite does not support tone-folding. An API search for `sua` returns `[]`. Because the API is online, `apiUsed` is `true`, preventing the frontend from falling back to local search (which does implement tone-folding). Accented searches like `sữa` succeed literally.

## 3. Caveats
- Playwright mobile safari (Webkit) tests could not be run because the Webkit binary was not installed in the user's environment.
- Only Chromium was verified.
- SMTP mailing triggering was not audited in detail as it lies outside the header/footer conversion scope.

## 4. Conclusion
The header and footer React conversion is successful from a compilation, structure, linting, and routing standpoint. However, the components suffer from UI layering conflicts (z-index blocking mobile menu clicks), missing elements (desktop search bar), state management clashes with legacy Flatsome jQuery scripts (Escape key close failing), and fallback weaknesses (tone-folding search failures). These findings are documented in `verification.md`.

## 5. Verification Method
1. Run Next.js build:
   ```bash
   cd frontend
   npm run build
   ```
2. Run Chromium E2E tests:
   ```bash
   npx playwright test tests/e2e/menus.spec.ts tests/e2e/seo-brand.spec.ts tests/e2e/search.spec.ts --project=chromium
   ```
3. Inspect `verification.md` at:
   `c:\Users\hieuk\Desktop\Tham khảo giacong.vn\.agents\challenger_m3\verification.md`
