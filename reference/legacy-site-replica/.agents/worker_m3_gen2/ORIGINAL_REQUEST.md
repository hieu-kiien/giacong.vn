## 2026-07-16T13:26:51Z
You are the Milestone 3 Worker Gen 2. Your working directory is: c:\Users\hieuk\Desktop\Tham khảo giacong.vn\.agents\worker_m3_gen2
Your mission is to fix the issues identified by Reviewer 1 and Reviewer 2 in the Milestone 3 header/footer React components.

Tasks to implement:
1. **Footer dangerouslySetInnerHTML removal**:
   In `frontend/src/components/Footer.tsx`, remove the `dangerouslySetInnerHTML` attribute from the `<style>` tag. Instead, render the CSS rules inside a standard JSX style string, e.g. `<style>{`...`}</style>`.
2. **Robust Mobile Sidebar Stripping in Page Parser**:
   In `frontend/src/utils/pageParser.ts` (specifically inside `getLayoutShell()` and `getPageDataRaw()`), fix the regular expression used to strip the `#main-menu` mobile drawer. Since the mobile drawer `<div id="main-menu"` is located at the very bottom of the HTML, replace it and everything following it up to the end of the text. For example, use a regex like `/<div\s+id="main-menu"[\s\S]*$/i` to cleanly remove the mobile drawer without leaving malformed unclosed tags.
3. **HeaderClient closeTimeout unmount cleanup**:
   In `frontend/src/components/HeaderClient.tsx`, add a `useEffect` cleanup hook that clears `closeTimeout.current` when the component unmounts to prevent memory leaks and state updates on unmounted components.
4. **Invalid Dropdown routes**:
   In `SanPhamDropdown.tsx` and `DichVuDropdown.tsx`, locate any links using routes with spaces or uppercase characters (e.g. `/Hoa quả sấy`, `/Hoa%20qu%E1%BA%A3%20s%E1%BA%A5y`) and replace them with proper lowercase hyphenated slugs (like `/hoa-qua-say`).
5. **Hash Anchor default prevention**:
   Add `onClick={(e) => e.preventDefault()}` to any link anchor in `HeaderClient.tsx`, `SanPhamDropdown.tsx`, `DichVuDropdown.tsx`, and `MobileDrawer.tsx` that has `href="#"` or acts as a dynamic dropdown/drawer trigger, to avoid viewport jumping to top and appending hashes to the URL.
6. **MobileDrawer accessibility lint fix**:
   In `MobileDrawer.tsx`, remove the `aria-expanded` attribute from the `<li>` wrapper element (since `aria-expanded` is not supported on listitem elements and causes lint warnings) and ensure it is placed correctly on the interactive child elements (`button.toggle` or `a.toggle`).
7. **Mobile Drawer submenu state reset**:
   In `MobileDrawer.tsx`, ensure all expanded submenu states are reset to closed when the mobile drawer is closed (`isOpen === false`).
8. **Verifications**:
   Verify your code by running `npm run build` in the `frontend` directory. Make sure it compiles successfully with no TypeScript errors or warnings.
9. Write a handoff report at c:\Users\hieuk\Desktop\Tham khảo giacong.vn\.agents\worker_m3_gen2\handoff.md documenting your changes and build outcomes.

MANDATORY INTEGRITY WARNING: DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
