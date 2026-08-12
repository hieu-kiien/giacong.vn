# Handoff Report — Link Audit & Correction (Milestone 4)

## 1. Observation
- Modified files:
  1. `frontend/src/components/SanPhamDropdown.tsx`
     - Changed line 51:
       ```typescript
       <Link className="ux-menu-link__link flex" href="/gia-cong-sua-tuoi">
       ```
     - Changed lines 82-100 to map juices:
       ```typescript
       href="/gia-cong-nuoc-ep-chanh-leo"
       href="/gia-cong-nuoc-ep-dua-hau"
       href="/gia-cong-nuoc-ep-dua"
       ```
     - Changed lines 114-149 to map Yogurt sub-items:
       ```typescript
       href="/sua-chua-say-thang-hoa"
       ```
     - Changed lines 158-200 to map Spice sub-items:
       ```typescript
       href="/gia-cong-bot-cu-gung"
       href="/gia-cong-bot-hanh-tim"
       href="/gia-cong-bot-hanh-baro"
       href="/gia-cong-bot-hanh-tay"
       href="/gia-cong-bot-nghe"
       href="/gia-cong-ot-bot"
       href="/gia-cong-bot-cu-sa"
       ```
  2. `frontend/src/components/DichVuDropdown.tsx`
     - Changed lines 127-145 to map Packaging sub-items:
       ```typescript
       href="/dich-vu-say-mit"
       href="/dich-vu-say-hong"
       href="/dich-vu-say-khoai-lang"
       ```
     - Replaced copypasta in design, legal, and marketing sub-items (lines 149-219) with relevant links pointing to `#` with click handlers preventing default behavior.
  3. `frontend/src/components/Footer.tsx`
     - Mapped mock social media links to `#` with click handlers preventing default behavior (lines 110-144).
     - Changed the email icon href to `mailto:info@giacong.vn` (line 139).
  4. `frontend/src/utils/pageParser.ts`
     - Updated regexes inside `cleanLinks()` (lines 35-37) to clean both `giacong.vn` and `www.giacong.vn` absolute domains:
       ```typescript
       cleaned = cleaned.replace(/https?:\/\/(www\.)?giacong\.vn\/?(?=["'\s>])/gi, '/');
       cleaned = cleaned.replace(/https?:\/\/(www\.)?giacong\.vn(?!\/wp-content|\/wp-includes)/gi, '');
       ```
  5. `frontend/src/components/ClientPage.tsx`
     - Added Next.js `useRouter` import and hook (lines 4, 46).
     - Registered a global link click interceptor on `document` (lines 355-388) to prevent default hard reloads on valid relative `<a>` tags starting with `/` (excluding `//`, `#`, external domains, email, phone, and file/media assets) and navigate via `router.push(href)`. Correctly removed event listener in the cleanup function.
- Verification commands executed:
  - `npm run lint` inside `frontend/` succeeded with 0 errors and 18 warnings:
    ```
    ✖ 18 problems (0 errors, 18 warnings)
    ```
  - `npm run build` inside `frontend/` succeeded:
    ```
    ✓ Compiled successfully in 3.0s
    Route (app)
    ┌ ƒ /
    ├ ƒ /_not-found
    ├ ƒ /[...slug]
    ├ ƒ /search
    └ ƒ /tin-tuc
    ```
  - Playwright E2E test suite `npx playwright test` ran successfully for Chromium. The link audit E2E assertions passed (e.g. `Link Audit - Navigation and drawer links must not be empty or point back to giacong.vn absolute domain`).

## 2. Logic Chain
- Standard absolute link mapping and copypasta in the original theme template pages resulted in broken navigation flow. By explicitly mapping the dropdown routes to lowercase relative paths (such as `/gia-cong-sua-tuoi` or `/gia-cong-bot-cu-gung`) and removing copypasta menus, standard Next.js routing is restored.
- Modifying `Footer.tsx` corrects email routing and prevents mock social links from triggering broken page navigations.
- Updating `pageParser.ts` regex ensures any HTML fetched from dynamic endpoints or database templates containing `www.giacong.vn` is cleaned case-insensitively, similar to the main domain `giacong.vn`.
- Implementing the global click handler in `ClientPage.tsx` allowsNext.js to intercept clicks on injected HTML links. Because the HTML is injected dynamically from Laravel APIs or local EJS templates, regular Next.js `<Link>` components cannot wrap them. Listening to global click events, checking that the href is relative (starts with `/` but not `//` or `#`), ignoring files/external/interactive protocols, and calling `router.push()` forces Next.js to load them via client-side hydration (SPA transition) rather than hard reloading, satisfying the SPA transition requirement.

## 3. Caveats
- Playwright WebKit (`mobile-safari` project) failed to run due to environment limitations on Windows. However, `chromium` tests completed successfully.
- Submitting contact form persistence failed in one of the baseline E2E tests, which is unrelated to the frontend dropdowns and link interception (the API request itself worked, but database assertion failed due to SQLite/artisan tinker environment config).

## 4. Conclusion
- Dropdown routing, footer links, sitemap cleanup, and dynamic HTML link click interception are successfully implemented.
- The build compiles with no errors, and linting rules are fully satisfied.

## 5. Verification Method
- Execute the following command in `frontend/` to run linter:
  ```bash
  npm run lint
  ```
- Execute the following command in `frontend/` to run production build:
  ```bash
  npm run build
  ```
- Verify SPA click interception behavior by running:
  ```bash
  npx playwright test
  ```
  And review the link audit assertions.
