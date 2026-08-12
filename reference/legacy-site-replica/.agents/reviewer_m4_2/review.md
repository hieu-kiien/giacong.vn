# Milestone 4 Review Report

## Review Summary

**Verdict**: APPROVE with recommendations

The changes in `frontend/src/components/ClientPage.tsx` and `frontend/src/components/Footer.tsx` have been reviewed. The click delegation for SPA routing and the fix for social media mock links are implemented correctly. Both build and lint commands compile cleanly.

---

## Quality Review

### Verified Claims

- **Lint compiles cleanly** → Verified by running `npm run lint` in the `frontend` directory → **PASS** (0 errors, 18 warnings).
- **Build compiles cleanly** → Verified by running `npm run build` in the `frontend` directory → **PASS** (compiled successfully, static pages generated).
- **SPA routing event delegation** → Verified by inspecting `ClientPage.tsx` lines 359-402 → **PASS** (uses `closest('a')` on document-level click listener, handles modifier keys, checks `target="_blank"`, and pushes to `useRouter()`).
- **Relative link filtering** → Verified by inspecting `ClientPage.tsx` lines 378-392 → **PASS** (filters out non-root-relative links, mailto/tel, and media extensions).
- **Footer mock links** → Verified by inspecting `Footer.tsx` lines 111-157 → **PASS** (social links have `onClick={(e) => e.preventDefault()}` and `href="#"`, preventing default tab behavior or page jumps).

### Findings

#### [Minor] Finding 1: Unhandled `e.defaultPrevented`
- **What**: The click interceptor does not check if the event's default behavior was already prevented.
- **Where**: `frontend/src/components/ClientPage.tsx` (lines 359-396)
- **Why**: If a custom UI element (like a modal toggle or tab) handles the click and calls `e.preventDefault()`, the SPA click interceptor will still intercept and route the user away.
- **Suggestion**: Add `if (e.defaultPrevented) return;` at the beginning of `handleLinkClick`.

#### [Minor] Finding 2: Next.js `<Image>` Component Warnings
- **What**: React/Next.js warnings regarding the use of native `<img>` instead of Next.js `<Image />` component.
- **Where**: `frontend/src/components/Footer.tsx` (lines 45, 165, 171)
- **Why**: Using standard `<img>` tags triggers warnings during the build and lint steps.
- **Suggestion**: Consider replacing `<img>` with Next.js `<Image />` for optimized layout and lazy loading.

---

## Coverage Gaps

- **Same-page hash targets** — risk level: **medium** — recommendation: **accept risk** / **monitor**
  - If a link contains a path with a hash targeting the same page (e.g. `/san-pham#specs`), the browser would normally scroll to the target. Here, it will trigger a Next.js `router.push('/san-pham#specs')` which may not scroll correctly or may disrupt tab switching systems. Since no same-page hash links were found in main footer layouts, this is acceptable but should be noted.

---

## Adversarial Challenge Report

**Overall risk assessment**: LOW

### Challenges

#### [Medium] Challenge 1: Same-Page Hash Anchor Navigation
- **Assumption challenged**: All links starting with `/` (and not starting with `#`) should trigger client-side route pushing.
- **Attack scenario**: An anchor link formatted as `/page#section` pointing to the current page is clicked. The interceptor calls `e.preventDefault()` and `router.push()`. Standard browser scrolling to the hash element is cancelled, which might break accordion/tab toggling logic or anchor animations that rely on natural hash changes.
- **Blast radius**: Specific interactive elements (tabs, accordions) using hash anchors on the same page.
- **Mitigation**: Add a check to verify if the link pathname matches the current pathname and contains a hash. If so, bypass interception:
  ```typescript
  const url = new URL(href, window.location.origin);
  if (url.pathname === window.location.pathname && url.hash) {
    return;
  }
  ```

#### [Low] Challenge 2: Non-root Relative Links
- **Assumption challenged**: All internal links are root-relative (starting with `/`).
- **Attack scenario**: If the CMS or template outputs a document-relative link like `huong-dan/` or `../ve-chung-toi`, it does not start with `/`. The check `!href.startsWith('/')` triggers, bypassing the interceptor.
- **Blast radius**: Users clicking document-relative links will experience a full page reload rather than a smooth SPA page transition.
- **Mitigation**: Resolve the link against the base URL or check the hostname of the link using the `URL` constructor:
  ```typescript
  try {
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return; // External link
    // Process local link
  } catch (e) {
    // Invalid URL
  }
  ```

#### [Low] Challenge 3: Alternate Target Attributes
- **Assumption challenged**: The only target attribute that requires bypassing is `_blank`.
- **Attack scenario**: A link with `target="_parent"` or `target="_top"` is clicked. The interceptor pushes the route via `router.push()`, bypassing the intended target frame behavior.
- **Blast radius**: UI layouts relying on framesets or specific target frames will render incorrectly.
- **Mitigation**: Check if `anchor.target` exists and is not `_self`.
  ```typescript
  if (anchor.target && anchor.target.toLowerCase() !== '_self') {
    return;
  }
  ```

---

## Stress Test Results

- **Modifier click (Ctrl+Click)** → Ignored correctly → Link opens in new tab → **PASS**
- **External link (`https://google.com`)** → Ignored correctly → Standard external navigation → **PASS**
- **Media link (`/assets/file.pdf`)** → Ignored correctly → File download/display → **PASS**
- **Mailto link (`mailto:info@giacong.vn`)** → Ignored correctly → System email client opens → **PASS**
- **Tel link (`tel:0947142999`)** → Ignored correctly → System dialer opens → **PASS**
- **Footer Facebook Link (`#`)** → Prevented default navigation and blank tab successfully → **PASS**
