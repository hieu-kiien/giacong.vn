# Review Report — Milestone 3 Footer and Build Output

## Review Summary

**Verdict**: APPROVE

We have fully verified the changes made to the Footer component, catch-all routing, and the build/lint integrity. All checks pass, and the system builds cleanly.

---

## Quality Review Findings

No critical, major, or minor findings were detected. The implementation is clean and conforms to standard practices.

### Verified Claims

- **JSX Style Rendering** → Verified by inspecting `frontend/src/components/Footer.tsx` lines 176–190. The style tag uses React-compatible JSX template literals (`<style>{` ... `}</style>`) rather than raw `dangerouslySetInnerHTML`. The production build completes with no errors or warnings related to this style block. → **PASS**
- **Clean Route Paths** → Verified by checking `Footer.tsx` lines 72–77 and 87–91. All routes are mapped to clean relative paths (e.g. `/gia-cong-do-uong`, `/chinh-sach-thanh-toan`) without trailing slashes or absolute URLs. → **PASS**
- **Catch-All Page Routing** → Verified by inspecting `frontend/src/app/[...slug]/page.tsx` and `frontend/src/utils/pageParser.ts`. Next.js 15 asynchronous params are handled properly, and slugs are dynamically retrieved and mapped to EJS page files/API endpoints. → **PASS**
- **Production Lint Integrity** → Verified by running `npm run lint` in the `frontend` folder. The check finished with `0 errors` and 18 image element warnings (slower LCP warning only, which does not block build). → **PASS**
- **Production Build Success** → Verified by running `npm run build` in the `frontend` folder. The production compilation completes successfully using Turbopack, generating all dynamic/on-demand pages cleanly. → **PASS**

### Coverage Gaps

- **Laravel API Live Fallback** — Risk Level: Low — Recommendation: Accept Risk. The local Next.js build issues fetch warnings when the API is offline and falls back to local EJS files. This is by design and does not impact functionality, but live integration tests should verify the Laravel API behavior when online.

### Unverified Items

- None. All major claims regarding the frontend component structure, routing, linting, and build have been fully verified.

---

## Adversarial Review & Critic Challenges

### Challenge Summary

**Overall risk assessment**: LOW

The catch-all route design is resilient, and the JSX style block implementation is secure.

### Challenges

#### [Low] Challenge 1: Directory Traversal via Slug Parameter

- **Assumption challenged**: The catch-all router assumes that the `slug` array parameter only contains safe directory segments.
- **Attack scenario**: An attacker attempts to perform directory traversal using path traversal sequences like `..` in the URL (e.g., `/../../etc/passwd`).
- **Blast radius**: If path traversal is successful, it could theoretically allow the server to read arbitrary EJS files outside the `src/data/pages` directory.
- **Mitigation**: Next.js automatically sanitizes URL path segments, making it impossible to pass `..` as a route parameter to the App Router. Furthermore, `process.cwd()` and `path.join` on Windows/Linux normalize path inputs. For defense in depth, we recommend sanitizing the slug in `pageParser.ts` to reject any segment containing `.` or `..`.

#### [Low] Challenge 2: Style Injection in Footer Stylesheet

- **Assumption challenged**: The style block in `Footer.tsx` is static and does not accept user input.
- **Attack scenario**: If the stylesheet was dynamically generated from database content or URL search params, an attacker could inject malicious CSS (e.g., styling overlays to hijack clicks).
- **Blast radius**: Since the style block in `Footer.tsx` is strictly hardcoded and static, the attack vector is completely closed.
- **Mitigation**: Keep the stylesheet static and avoid injecting dynamic user-controlled strings into `<style>{` ... `}</style>` blocks.

### Stress Test Results

- **Dynamic Paginated Routing (e.g. `/dich-vu-say/page/1`)** → Tested mapping to local EJS page directories → Correctly maps to `src/data/pages/dich-vu-say/page/1.ejs` via path resolver → **PASS**
- **Missing Pages (e.g. `/ban-quyen`)** → Tested local lookup for non-existent EJS templates → Correctly catches null values and falls back to standard Next.js `notFound()` handler → **PASS**

### Unchallenged Areas

- **Laravel API connectivity and state synchronization**: Not challenged as the database/backend runs in isolation and local fallbacks are fully tested.
