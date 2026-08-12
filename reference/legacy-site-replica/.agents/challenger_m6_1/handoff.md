# SEO & Trademark Challenger Report (Milestone 6)

## 1. Observation
We have empirically verified the correctness of the Milestone 6 (SEO & Configurations) implementation by running both static audits and the full E2E Playwright test suite.

*   **Static Asset Auditing (`verify-seo.js`)**:
    *   Command: `node scripts/verify-seo.js` run in `./frontend`
    *   Results:
        ```
        --- Verifying SEO Assets ---
        ✅ Pass: robots.txt allows all
        ✅ Pass: robots.txt disallows /search
        ✅ Pass: robots.txt references sitemap.xml
        ✅ Pass: sitemap.xml contains mapped home page
        ✅ Pass: sitemap.xml does not contain any "Page Not Found" pages
        --- All SEO asset checks passed successfully ---
        ```
*   **Playwright E2E Test Suite**:
    *   Command: `npx playwright test` run in project root
    *   Results:
        *   **147 tests passed, 1 test skipped** (total 148 tests executed across Chromium and Mobile Safari in 6.3 minutes).
        *   The skipped test was `Keyboard accessibility - Pressing Escape key closes the active desktop menu dropdown` under Mobile Safari, which is correct since mobile viewports do not have physical keyboard focus inputs for Escape.
        *   `seo-brand.spec.ts` passed 100% on both browsers:
            *   Verified page titles contain "giacong.vn" (`SB-1`, `SB-6`).
            *   Verified home and dynamic pages have exactly one H1 tag (`SB-2`, `SB-6`).
            *   Verified sitemap returns valid XML content-type and layout structure (`SB-3`, `SB-8`).
            *   Verified robots.txt returns Plain Text with crawl rules and sitemap path (`SB-4`, `SB-9`).
            *   Verified logo exists, points to relative local paths, and renders properly (`SB-5`).
            *   Verified footer copyright references Net Food trademark/company info (`SB-10`).
            *   Verified SF Pro Display font stack and official primary/secondary colors (`#5aa400` / `#eb892d`) exist.
*   **Metadata Audit (`audit-metadata.js`)**:
    *   Command: `node audit-metadata.js` run in working directory
    *   Results:
        *   Successfully loaded 805 page objects from `metadata.json`.
        *   0 duplicate slugs, 0 empty titles, 0 empty slugs, and 0 URL-unsafe slugs.
*   **Page Rendering & Hydration Audit**:
    *   Inspected `frontend/src/app/layout.tsx`, `page.tsx`, `[...slug]/page.tsx`, and `ClientPage.tsx`.
    *   Meta tags are generated dynamically on the server side (SSR) using Next.js `generateMetadata` API, rendering statically in the `<head>` before hydration.
    *   Main page content from EJS is rendered with `dangerouslySetInnerHTML` and `suppressHydrationWarning={true}`.
    *   Script-heavy EJS blocks (like `beforeHeader` and `afterFooter`) are deferred to client-side mounting using `SafeHTML` (a 2-pass component that returns `null` on the server and only mounts on the client). This isolates scripts from the SSR step, preventing hydration mismatches entirely.
*   **Brand & Staging Discrepancy**:
    *   `TRADEMARK_BRAND_GUIDE.md` Section 2.2 states:
        > *Robots.txt: The staging/replica site's robots.txt must explicitly block all crawlers: User-agent: * Disallow: /*
        > *Meta Tags: All pages in the replica environment should include a robot exclusion header: <meta name="robots" content="noindex, nofollow" />*
        > *Staging/Demo Banner: Every page of the replica environment must display a highly visible banner ...*
        > *No Impersonation: The title tag of the site should indicate it is a replica (e.g., [REPLICA] Giacong.vn)*
    *   However, the actual Next.js implementation and E2E tests expect the replica environment to allow indexing, omit the staging disclaimer banner, omit the `noindex` tag, and use the official site's titles without a `[REPLICA]` prefix.

---

## 2. Logic Chain
1. **SSR Metadata Generation**: Since Next.js generates head elements statically during SSR via the `generateMetadata()` function in `page.tsx` and `[...slug]/page.tsx`, the search engine crawlers receive complete title and description meta tags on the initial HTTP response.
2. **Hydration Protection**: EJS contents containing inline scripts and widgets are wrapped in `<SafeHTML>`. Because `<SafeHTML>` yields `null` during server rendering and only populates the DOM in the client-side `useEffect` hook, Next.js does not compare the server-side empty placeholder with the client-side injected widgets. This prevents hydration errors.
3. **Trademark/Staging Mismatch**: The replica environment is currently configured to allow search engines (`Allow: /` in `robots.txt`) and has no `noindex, nofollow` headers or title disclaimers. If this project is ever deployed to a public staging server without basic authentication, it poses a medium risk of duplicate indexing, which would harm the official site's search rankings.

---

## 3. Caveats
*   **Local Fallback Traversal**: When Laravel API is down, `getPageData` resolves local file paths using the slug parameter. Next.js route parameterization restricts values to safe segments, protecting against basic `../` traversal, but local file name checks should still be explicitly verified for security.
*   **Local Database Sync**: The E2E tests for database persistence query the local SQLite DB directly. The test suite assumes the production database schema is identical.

---

## 4. Conclusion & Adversarial Review

**Overall risk assessment**: **MEDIUM** (due to the indexing/staging disclaimer mismatch; otherwise **LOW**).

### Challenges

#### [Medium] Challenge 1: Lack of Staging Indexing Restriction
*   **Assumption challenged**: That the replica environment should deploy with standard production-like indexing configs.
*   **Attack scenario**: If hosted publicly for staging/review without basic auth, search engine bots will crawl the staging site, creating duplicate content issues and indexing non-functional forms under the official brand.
*   **Blast radius**: High impact on live `giacong.vn` domain SEO rankings due to duplicate content penalties.
*   **Mitigation**: Staging builds should inject a dynamic robot meta tag (`noindex, nofollow`) and overwrite `robots.txt` to block all crawlers (`Disallow: /`), or use environment variables to toggle production vs. staging SEO configurations.

#### [Low] Challenge 2: Missing Trademark Disclaimer Banners & Brand Prefixes
*   **Assumption challenged**: Conformity with trademark guidelines.
*   **Attack scenario**: A user arrives on the replica environment and submits real quotation/contact details, thinking it is the official service.
*   **Blast radius**: Trademark infringement liability and loss of customer lead data.
*   **Mitigation**: Implement a visual banner component at the top of the header indicating replica status, and append `[REPLICA]` to the Next.js page title configurations.

### Stress Test Results
*   **Vietnamese Accents & Accented/Unaccented Tone Search**: Checked via `search.spec.ts` → Matches accent-folded strings successfully → **PASS**.
*   **Wildcard Search (`%`, `_`)**: Checked via `search.spec.ts` → Handled safely by Laravel Parameterization → **PASS**.
*   **Extreme Length Search**: Checked via `search.spec.ts` → Handled gracefully → **PASS**.
*   **Hydration Mismatch Check**: Checked via `page-rendering.spec.ts` → No console hydration errors detected → **PASS**.
*   **Empty Slugs, Unsafe Characters**: Checked via `audit-metadata.js` → Checked 805 pages, all URLs are URL-safe with no duplicates → **PASS**.

---

## 5. Verification Method
1.  **Running Asset Checks**:
    ```bash
    cd frontend
    node scripts/verify-seo.js
    ```
2.  **Running Playwright Tests**:
    ```bash
    npx playwright test
    ```
3.  **Inspecting Files**:
    *   Verify Next.js metadata logic: `frontend/src/app/[...slug]/page.tsx`
    *   Verify hydration handling: `frontend/src/components/ClientPage.tsx`
    *   Verify robots.txt configuration: `frontend/public/robots.txt`
