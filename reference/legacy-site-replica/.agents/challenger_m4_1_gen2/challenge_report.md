# Adversarial Challenge Report — Milestone 4 Link Audit & Correction

## Challenge Summary

**Overall risk assessment**: HIGH

While the link parsing helper (`pageParser.ts`) successfully normalizes absolute WordPress domains and static paths, several critical edge cases in the client-side click interceptor (`ClientPage.tsx`) and Next.js App Router metadata structure threaten application stability and UX. Specifically, the click interceptor degrades keyboard/mouse accessibility, breaks local dropdown menus, and fails to handle dynamic routing metadata for 404 pages.

---

## Challenges

### [High] Challenge 1: Lack of Mouse Button Verification in Click Interceptor
- **Assumption challenged**: The global link click listener (`handleLinkClick`) assumes all mouse clicks on links are left-clicks intending SPA navigation.
- **Attack scenario**: A user middle-clicks a relative product link to open it in a new tab, or right-clicks to view the browser context menu.
- **Blast radius**: The native browser middle-click/right-click behaviors are intercepted and cancelled (`e.preventDefault()`). Next.js's router instead forces a page navigation inside the *current* tab, frustrating power users and breaking accessibility.
- **Mitigation**: Add checks in `handleLinkClick` to ignore clicks with buttons other than 0 (left-click) or when default behavior was already prevented.
  ```typescript
  if (e.button !== 0) return;
  ```

### [High] Challenge 2: Lack of `e.defaultPrevented` Verification
- **Assumption challenged**: All relative link click events reaching the document root should trigger Next.js SPA navigation.
- **Attack scenario**: Custom dropdowns, accordion toggles, or search triggers bind click handlers that perform custom JS behavior and invoke `e.preventDefault()`.
- **Blast radius**: The click interceptor ignores the fact that the click has already been intercepted and cancelled by another handler. It runs `router.push(href)` anyway, navigating the user away and breaking custom components (like mobile menus or dropdowns).
- **Mitigation**: Verify `e.defaultPrevented` before intercepting:
  ```typescript
  if (e.defaultPrevented) return;
  ```

### [Medium] Challenge 3: Next.js App Router Metadata vs. Inline JSX `<title>`
- **Assumption challenged**: Setting the page title using `<title>Page Not Found - Giacong.vn</title>` in `not-found.tsx`'s return JSX updates the document title.
- **Attack scenario**: Next.js App Router uses a centralized head manager. When page `/non-existent-page` is requested, it falls back to the default metadata title set in `layout.tsx`.
- **Blast radius**: The document title remains `"giacong.vn - đối tác gia công oem/odm & private label hàng đầu"` instead of showing `"Page Not Found - Giacong.vn"`, failing SEO-compliance E2E checks (`seo-brand.spec.ts:60`).
- **Mitigation**: Export a custom `metadata` object or configure `not-found.tsx` to align with Next.js App Router title mechanics:
  ```typescript
  import type { Metadata } from 'next';
  export const metadata: Metadata = {
    title: 'Page Not Found - Giacong.vn'
  };
  ```

### [Medium] Challenge 4: Mobile Drawer Hydration Mismatch & Broken Submenus
- **Assumption challenged**: Flatsome behaviors can be safely re-attached to the document after client-side hydration without DOM conflicts.
- **Attack scenario**: During client rendering, Next.js encounters different DOM classes or missing `.toggle` buttons in the sidebar drawer relative to SSR output. React discards the server HTML, triggering a hydration mismatch error.
- **Blast radius**: Re-attaching Flatsome scripts fails or leads to unattached events on mobile menu toggles, breaking mobile submenu expansions (`menus.spec.ts:98`, `workloads.spec.ts:79`).
- **Mitigation**: Ensure mobile drawer SSR markup matches client components exactly. Avoid destructive DOM mutations (like `$('.sidebar-menu .toggle').remove()`) inside `ClientPage.tsx` during initial hydration.

---

## Stress Test Results

- **Middle-Click on Relative Link** → Expected: Browser opens link in a new tab → Actual: Intercepted, current page navigates (FAIL)
- **Right-Click on Relative Link** → Expected: Browser opens context menu → Actual: Intercepted, current page navigates (FAIL)
- **Mobile Drawer Submenu Toggle** → Expected: Menu expands when toggle is clicked → Actual: Timed out, toggle button not found or click does not toggle active class (FAIL)
- **404 Page Title Check** → Expected: Document title contains "Page Not Found" → Actual: Retains home page metadata title (FAIL)
- **Database Persistence E2E Test (Running from frontend/)** → Expected: Submits and Tinker counts rows → Actual: Spawn sync ENOENT/path resolution errors (FAIL)
- **Database Persistence E2E Test (Running from root)** → Expected: Submits and Tinker counts rows → Actual: Submissions added and counted correctly (PASS)

---

## Unchallenged Areas

- **Backend Route Integrity** — The laravel API endpoints were not challenged for SQL injection or parameter pollution beyond standard CORS validation tests in the E2E suite.
