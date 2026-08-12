## 2026-07-16T20:22:50+07:00
You are the Milestone 3 Worker. Your working directory is: c:\Users\hieuk\Desktop\Tham khảo giacong.vn\.agents\worker_m3
Your mission is to convert the EJS/HTML injected global layout components (Header.tsx, Footer.tsx) to native React components.

Tasks:
1. Reconstruct `frontend/src/components/Header.tsx`, `HeaderClient.tsx`, and `Footer.tsx` as native React components in JSX/TSX.
2. Ensure you DO NOT use `dangerouslySetInnerHTML` for the layout structure of these components, and DO NOT use `fs` or `fs.promises` to read `header.ejs` or `footer.ejs`.
3. Create the following sub-components in `frontend/src/components/` using clean TypeScript and Next.js `<Link>` components (instead of standard `<a>` tags where appropriate, to support Next.js routing):
   - `SearchForm.tsx` (the search bar widget)
   - `MobileDrawer.tsx` (the mobile drawer sliding menu)
   - `SanPhamDropdown.tsx` (the desktop hover dropdown for "Sản Phẩm")
   - `DichVuDropdown.tsx` (the desktop hover dropdown for "Dịch vụ")
4. The React components must reconstruct all desktop hover dropdowns, mobile drawer, search bar, and footer links. Use React state/hooks to replicate:
   - Sticky header class toggle on scroll (adding/removing "stuck" class).
   - Hover and click states for desktop menus.
   - Toggle behavior for the mobile drawer menu and its nested submenus.
   - Back-to-top button dynamic scroll and smooth-scroll on click in Footer.tsx.
5. In `frontend/src/utils/pageParser.ts`, update `getLayoutShell()` so it strips the legacy mobile drawer (`<div id="main-menu" ...>...</div>`) from `afterFooter` when parsing `home.ejs`, preventing duplicate mobile drawer rendering.
6. Verify your implementation by running the build command in the `frontend` directory: `npm run build`. Keep fixing any typescript or build issues until the build passes cleanly.
7. Write a handoff report in c:\Users\hieuk\Desktop\Tham khảo giacong.vn\.agents\worker_m3\handoff.md documenting the changes made, compilation output, and verification results.
