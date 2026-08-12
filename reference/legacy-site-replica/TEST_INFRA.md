# E2E Test Suite Infrastructure & Methodology

## 1. Feature Inventory
The E2E test suite targets six core areas of the Giacong Replica application, verifying full functional equivalence with the original site:

1. **Page Rendering (PR)**:
   - Visual stability, SSR validation, and DOM structure.
   - Dynamic catch-all slug routes (e.g., `/gioi-thieu-ve-gia-cong`, `/san-pham`, `/tin-tuc`, `/lien-he`).
   - Category pages (e.g., `/bot-gia-vi`, `/dich-vu-dong-goi`).
   - Custom 404 page rendering within the main Flatsome layout context (Header & Footer).
   
2. **Header/Footer Menus (HM)**:
   - Main menu interactivity on desktop (hover, focus, Escape key closing, ARIA tags).
   - Mobile navigation drawer toggle, off-canvas body class, auto-closing submenus.
   - Comprehensive link audit to prevent dead links (`#`, `javascript:void(0)`) or absolute live domain links (`https://giacong.vn`).

3. **Search (SE)**:
   - Header search bar functionality and redirection to `/search?s=<query>`.
   - Accent and tone sensitivity, empty fallbacks, and wildcard character processing.
   - Asset path rewriting to local/relative paths.

4. **Form Submissions (FS)**:
   - Client-side input validation (name, email, phone, message).
   - Anti-spam click protection (disabling buttons, "Đang gửi..." status text).
   - Referrer path forwarding within submission payloads.
   - UI feedback on success/failure and form clearing.

5. **CORS/SMTP (CS)**:
   - Backend CORS origin restrictions (restricting API access to frontend domains and rejecting random origins).
   - Persistence verification: ensuring submissions write correctly to the SQLite database.
   - Mail trigger logs checking (`MAIL_MAILER=log` entries in backend storage).

6. **SEO/Brand (SB)**:
   - Metadata compliance (unique `<title>`, `<meta name="description">`, single `<h1>` tag).
   - Correct structure and routing of `/robots.txt` and `/sitemap.xml`.
   - Brand logo assets and trademark guidelines check.

---

## 2. Methodology
We implement a multi-layered testing methodology to achieve maximum coverage and reliability:
- **Category-Partition**: Features are partitioned into positive paths, negative paths, and empty paths. Input vectors are defined for each partition (e.g., alphanumeric search vs. special/wildcard characters vs. Vietnamese characters).
- **Boundary Value Analysis (BVA)**: Focus on limits such as empty forms, maximum lengths for names/phone numbers, minimum/maximum search queries, and boundary characters.
- **Pairwise Testing**: Ensure cross-browser coverage between Desktop Chrome and Mobile Safari across different screen dimensions.
- **Real-World Workloads (Scenario-Based)**: Emulating high-fidelity user journeys that cross multiple boundaries and mock real customer use cases.

---

## 3. Test Architecture
- **Framework**: [Playwright](https://playwright.dev/) (v1.61.1) running from the project root.
- **Configuration (`playwright.config.ts`)**:
  - `baseURL`: `http://localhost:3000` (Next.js server).
  - Parallel server launching via the `webServer` option for both Next.js (port 3000) and Laravel (port 8002).
  - Emulated environments:
    - **Desktop Chrome** (1280x800, no touch support).
    - **Mobile Safari** (375x667, touch support, mimicking iPhone).
- **Test File Organization**:
  - `tests/e2e/page-rendering.spec.ts`
  - `tests/e2e/menus.spec.ts`
  - `tests/e2e/search.spec.ts`
  - `tests/e2e/form-submissions.spec.ts`
  - `tests/e2e/cors-smtp.spec.ts`
  - `tests/e2e/seo-brand.spec.ts`
  - `tests/e2e/cross-features.spec.ts` (Tier 3 Combinations)
  - `tests/e2e/workloads.spec.ts` (Tier 4 Real-World Workloads)

---

## 4. Real-World Application Scenarios (Tier 4)
The test suite defines five realistic customer scenarios in `workloads.spec.ts`:
1. **New Visitor Discovery Flow**: A user loads the homepage, navigates via the Header menu, searches for a custom term, and verifies SEO metadata.
2. **Customer Lead Capture & Verification Flow**: A customer selects a service, fills in the quote request form, hits submit, and the suite verifies SQLite persistence and Laravel email triggering.
3. **Mobile Self-Service Audit Flow**: A mobile user opens the site, toggles the mobile drawer menu, expands nested items, navigates to `/lien-he`, and submits the contact form with missing fields to trigger alerts.
4. **Referral-tracked Contact Flow**: A user arrives on a deep category page, submits the contact form, and the test suite verifies that the API receives the correct current path as referrer.
5. **Cross-Search and In-Page Conversion Flow**: A user runs a product search, clicks the search result to open a page, and submits the in-page form, validating the full conversion funnel.

---

## 5. Coverage Thresholds
The E2E suite implements a total of **71 test cases** distributed across the following tiers:
- **Tier 1 (Feature Coverage)**: 30 tests (5 tests per feature × 6 features)
- **Tier 2 (Boundary & Edge Cases)**: 30 tests (5 tests per feature × 6 features)
- **Tier 3 (Cross-Feature Combinations)**: 6 tests (testing interaction between search, menus, forms, database, and layouts)
- **Tier 4 (Real-World Workloads)**: 5 complex multi-page scenarios
- **Total**: **71 tests**
