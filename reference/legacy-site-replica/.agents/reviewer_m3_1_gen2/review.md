# Milestone 3 Review Report — Header Components & Page Parser

## Quality Review Summary

**Verdict**: REQUEST_CHANGES

The worker has successfully addressed the majority of the requirements, including regex cleanups, timeout ref cleanup, lowercase slug conversion in navigation headers, hash anchor scroll prevention, and ARIA accessibility. However, a blocking ESLint error was introduced in `MobileDrawer.tsx` when implementing the submenu reset logic inside a `useEffect` hook, which fails the project's linting check (`npm run lint`). Therefore, changes are requested to clean up the linting violation.

---

## Findings

### [Major] Finding 1: ESLint error `react-hooks/set-state-in-effect` in MobileDrawer.tsx

- **What**: The linter reports an error for calling `setState` inside an effect.
- **Where**: `frontend/src/components/MobileDrawer.tsx`, line 26
- **Why**: Calling `setIsDichVuOpen(false)` synchronously inside the `useEffect` body causes cascading renders and is flagged as an ESLint compilation error (`react-hooks/set-state-in-effect`), which blocks clean builds.
- **Suggestion**: Avoid calling `setState` synchronously within the `useEffect` callback. Instead, implement a wrapper close handler or handle state synchronization during the render phase:
  ```tsx
  // Option 1: Wrapper handler in MobileDrawer
  const handleClose = () => {
    setIsDichVuOpen(false);
    onClose();
  };
  
  // And call handleClose instead of onClose on the overlay and links.
  ```

### [Minor] Finding 2: EJS Fallback filename mismatch for dried fruit

- **What**: EJS fallback file is still named with percent-encoding and uppercase.
- **Where**: `frontend/src/data/pages/Hoa%20qu%E1%BA%A3%20s%E1%BA%A5y.ejs`
- **Why**: Dropdown menus have correctly updated the link to `/hoa-qua-say`. However, the local fallback file was not renamed. If the Laravel API is offline, the page parser fallback will try to load `/hoa-qua-say.ejs` (which does not exist), rather than mapping it to `Hoa%20qu%E1%BA%A3%20s%E1%BA%A5y.ejs`.
- **Suggestion**: Rename `Hoa%20qu%E1%BA%A3%20s%E1%BA%A5y.ejs` to `hoa-qua-say.ejs` in `frontend/src/data/pages/` to align with the new lowercase navigation slugs.

---

## Verified Claims

- **Claim 1**: Fix regex to cleanly strip the mobile sidebar without leaving malformed unclosed tags.
  - *Status*: PASS
  - *Method*: Inspected `frontend/src/utils/pageParser.ts` (lines 153 and 264). The regex `replace(/<div\s+id="main-menu"[\s\S]*$/i, '')` successfully removes the mobile sidebar and everything after it. Since the `#wrapper` closing tag appears before the mobile sidebar in the EJS layout, it is preserved and closed correctly, leaving no unclosed layout tags.
- **Claim 2**: Add cleanup for the `closeTimeout` ref on unmount.
  - *Status*: PASS
  - *Method*: Inspected `frontend/src/components/HeaderClient.tsx` (lines 19-23). The cleanup function clears the active timeout ref correctly when the header client component unmounts.
- **Claim 3**: Were routes with spaces and uppercase letters fixed to proper lowercase slugs.
  - *Status*: PASS
  - *Method*: Inspected navigation routes in `HeaderClient.tsx`, `SanPhamDropdown.tsx`, `DichVuDropdown.tsx`, and `MobileDrawer.tsx`. All links point to clean lowercase URLs (e.g., `/hoa-qua-say`, `/gioi-thieu-ve-gia-cong`).
- **Claim 4**: Are click handlers added on hash anchors to prevent top scroll.
  - *Status*: PASS
  - *Method*: Inspected dropdowns and navigation items. All anchors containing `href="#"` now implement `onClick={(e) => e.preventDefault()}` to prevent browser scroll jump behavior.
- **Claim 5**: Resolve `aria-expanded` accessibility issue on `<li>` in `MobileDrawer.tsx`.
  - *Status*: PASS
  - *Method*: Inspected `MobileDrawer.tsx` (lines 92-102). The `aria-expanded` attribute has been removed from the `<li>` element itself and correctly placed on the interactive child elements (`<a>` and `<button>`).
- **Claim 6**: Submenu state resets when the drawer is closed.
  - *Status*: PASS (Functional behavior works, but triggers a lint error)
  - *Method*: Inspected the sync hook in `MobileDrawer.tsx`. The state variable `isDichVuOpen` is set to `false` when `isOpen` transitions to `false`.

---

## Coverage Gaps & Unexplored Areas

- **Backend page api dynamic resolution** — *Risk Level: Low* — The backend database matches slugs case-sensitively. Since all navigation slugs were updated to lowercase, the database page entries must also be imported or updated with lowercase slugs. The seeder and page importer commands were inspected and found capable of handling decoded names, but it is recommended to ensure database consistency.

---

## Adversarial Review & Critic Report

**Overall Risk Assessment**: LOW

### Challenges & Stress Tests

#### [Medium] Challenge 1: Cascading render loops in MobileDrawer
- **Assumption challenged**: Synchronously calling state setters in `useEffect` to reset drawer submenus is safe.
- **Attack scenario**: Frequent toggling or fast clicks on the mobile drawer button can trigger multiple cascading renders because React needs to schedule another render phase when `setState` is called inside `useEffect`. This degrades mobile performance.
- **Blast radius**: Low-end mobile devices may experience lag or stutter during drawer closing animation.
- **Mitigation**: Move the state resetting logic out of `useEffect` and into the callbacks that close the drawer, or reset during the rendering phase before commit if detecting a prop transition.

#### [Low] Challenge 2: Local EJS Fallback mismatch when API goes down
- **Assumption challenged**: Fallback pages map directly to navigation slugs.
- **Attack scenario**: If the Laravel API service goes offline and a user clicks `/hoa-qua-say` in the menu, the page parser will try to locate `hoa-qua-say.ejs` locally and fail (resulting in 404), despite the raw EJS file `Hoa%20qu%E1%BA%A3%20s%E1%BA%A5y.ejs` being present.
- **Mitigation**: Standardize EJS filenames to use clean lowercase, URL-safe names matching their exact menu slugs.
