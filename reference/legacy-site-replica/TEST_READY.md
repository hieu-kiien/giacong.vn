# E2E Test Suite Execution Readiness

## Test Runner Command
To execute the E2E test suite, run the following command from the project root directory:
```bash
npx playwright test
```

## E2E Feature Coverage Checklist

### Tier 1: Feature Coverage (30 Tests Total, 5 per Feature)
- [x] **Page Rendering (PR)**
  - `PR-1`: Homepage rendering (200 OK)
  - `PR-2`: Product category page rendering (`/bot-gia-vi`)
  - `PR-3`: Service category page rendering (`/dich-vu-say`)
  - `PR-4`: Information page rendering (`/gioi-thieu-ve-gia-cong`)
  - `PR-5`: Contact page rendering (`/lien-he`)
- [x] **Header/Footer Menus (HM)**
  - `HM-1`: Header & Footer layout presence
  - `HM-2`: Desktop Product hover menu expands & updates ARIA
  - `HM-3`: Desktop Service hover menu expands
  - `HM-4`: Mobile hamburger menu drawer opens & activates off-canvas body class
  - `HM-5`: Link Audit: Check navigation links do not contain absolute giacong.vn URLs
- [x] **Search (SE)**
  - `SE-1`: Header search submission redirects to `/search?s=<query>`
  - `SE-2`: Search results render matching products/services
  - `SE-3`: Support search with Vietnamese accents/tones
  - `SE-4`: Search is case-insensitive
  - `SE-5`: Search with non-existent query displays fallback message
- [x] **Form Submissions (FS)**
  - `FS-1`: Submit Form 1 (Contact Form) on `/lien-he` successfully
  - `FS-2`: Submit Form 2 (Quotation Form) on homepage successfully
  - `FS-3`: Include current client-side route path in submission payload
  - `FS-4`: Form 1 submit button is disabled and shows "Đang gửi..." during request
  - `FS-5`: Form 2 submit button is disabled and shows "Đang gửi..." during request
- [x] **CORS/SMTP (CS)**
  - `CS-1`: CORS: Allow origin `http://localhost:3000`
  - `CS-2`: CORS: Allow origin `http://localhost:3001`
  - `CS-3`: CORS: Allow origin `http://localhost:3002`
  - `CS-4`: DB Persistence: Submitting a form successfully creates a row in the submissions table
  - `CS-5`: SMTP Log: Submitting form triggers submission log in `laravel.log`
- [x] **SEO/Brand (SB)**
  - `SB-1`: Homepage has unique title and description meta tag
  - `SB-2`: Homepage has exactly one `<h1>` tag
  - `SB-3`: Sitemap: `/sitemap.xml` returns valid XML structure
  - `SB-4`: Robots: `/robots.txt` returns plaintext directives
  - `SB-5`: Trademark Compliance: Header logo image exists and renders

---

### Tier 2: Boundary & Edge Cases (30 Tests Total, 5 per Feature)
- [x] **Page Rendering (PR)**
  - `PR-6`: Visit non-existent page returns 404 status
  - `PR-7`: Custom 404 page styled within standard header/footer layout
  - `PR-8`: Handle URL encoded characters in path correctly
  - `PR-9`: Page rendering without hydration errors
  - `PR-10`: Gracefully handle trailing slash in routes
- [x] **Header/Footer Menus (HM)**
  - `HM-6`: Pressing `Escape` closes active desktop menu dropdowns
  - `HM-7`: Mobile View: Navigating through drawer submenus works
  - `HM-8`: Mobile View: Clicking the overlay closes the drawer
  - `HM-9`: Verify drawer is hidden on desktop viewports
  - `HM-10`: Link Audit: Check footer links do not link back to absolute giacong.vn URLs
- [x] **Search (SE)**
  - `SE-6`: Empty search query handled gracefully with fallback text
  - `SE-7`: Wildcard character search behaves safely without SQL errors
  - `SE-8`: Search query with extreme length handles gracefully
  - `SE-9`: Vietnamese Tone folding: match accented products with unaccented search
  - `SE-10`: Verify returned search results have local/relative asset URLs
- [x] **Form Submissions (FS)**
  - `FS-6`: Form 1 validation - Missing Họ và Tên triggers alert
  - `FS-7`: Form 1 validation - Missing Số điện thoại triggers alert
  - `FS-8`: Form 1 validation - Missing Nội dung yêu cầu triggers alert
  - `FS-9`: Form 2 validation - Missing Họ và Tên triggers alert
  - `FS-10`: Form 2 validation - Missing Số điện thoại triggers alert
- [x] **CORS/SMTP (CS)**
  - `CS-6`: CORS: Disallow arbitrary origin `http://localhost:4000`
  - `CS-7`: CORS: Disallow malicious origin `http://evil.com`
  - `CS-8`: CORS: Request without Origin header passes without CORS headers
  - `CS-9`: CORS: Options preflight request returns standard headers
  - `CS-10`: DB Persistence: SQLite handles missing email and nullable parameters
- [x] **SEO/Brand (SB)**
  - `SB-6`: Dynamic page (`/gioi-thieu-ve-gia-cong`) has unique title, description, and single H1
  - `SB-7`: Missing pages have descriptive page title
  - `SB-8`: Sitemap contains at least 30 entries mapping valid pages
  - `SB-9`: Robots.txt contains crawling rules for search path
  - `SB-10`: Brand Compliance: Footer contains trademark Net Food company info

---

### Tier 3: Cross-Feature Combinations (6 Tests)
- [x] `CF-1`: Search and Navigation: Search term, click result, verify page rendering
- [x] `CF-2`: Navigation and Form Submission: Open mobile menu, navigate to contact, submit form
- [x] `CF-3`: Page Rendering and CORS: Verify pages load assets without CORS blockers
- [x] `CF-4`: Forms and Database Persistence: Submit quotation form, verify persistence in SQLite
- [x] `CF-5`: Dynamic Page and SEO: Category page renders unique H1 matching metadata title
- [x] `CF-6`: Footer Menus & Path Resolution: Footer navigation links match dynamic routes

---

### Tier 4: Real-World Workload Testing (5 Tests / Scenarios)
- [x] `Scenario 1`: New Visitor Discovery Flow
- [x] `Scenario 2`: Customer Lead Capture & Verification Flow
- [x] `Scenario 3`: Mobile Self-Service Audit Flow
- [x] `Scenario 4`: Referral-tracked Contact Flow
- [x] `Scenario 5`: Cross-Search and In-Page Conversion Flow
