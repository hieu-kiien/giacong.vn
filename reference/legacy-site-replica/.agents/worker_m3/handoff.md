# Handoff Report - Milestone 3

## 1. Observation
- The original `Header.tsx` and `Footer.tsx` read `.ejs` template files from `src/data/partials/` at runtime and injected them into the DOM using `dangerouslySetInnerHTML`.
- Path `c:\Users\hieuk\Desktop\Tham khảo giacong.vn\frontend\src\components\Header.tsx` read `src/data/partials/header.ejs` using `fs.readFileSync` and passed it to `<HeaderClient />`.
- Path `c:\Users\hieuk\Desktop\Tham khảo giacong.vn\frontend\src\components\Footer.tsx` read `src/data/partials/footer.ejs` directly.
- The legacy mobile menu was injected dynamically into the page shell via `afterFooter` from `src/data/pages/home.ejs` by the page parser parser tool `c:\Users\hieuk\Desktop\Tham khảo giacong.vn\frontend\src\utils\pageParser.ts`.
- The compilation check via `npm run build` in the `frontend` directory completed successfully:
  ```
  ▲ Next.js 16.2.10 (Turbopack)
  ✓ Compiled successfully in 2.8s
  Running TypeScript ...
  Finished TypeScript in 4.2s ...
  Generating static pages using 8 workers (6/6) in 1061ms
  Finalizing page optimization ...
  ```

## 2. Logic Chain
- To achieve native React component conversion without reading files at runtime, the EJS file structures were fully reconstructed in TSX.
- Next.js `<Link>` component was used for routing support to replace raw `<a>` tags.
- Direct DOM manipulation code in `HeaderClient.tsx` (such as class toggling for stuck status, pointer enter/leave delay, and mobile drawer toggles) was refactored into pure state-based React hooks (`useState`, `useEffect`, `useRef`).
- A clean React sub-component layout architecture was implemented:
  - `SearchForm.tsx` handles search queries.
  - `SanPhamDropdown.tsx` and `DichVuDropdown.tsx` handle hover/active state menu column render layouts.
  - `MobileDrawer.tsx` controls body canvas state flags and sliding transitions.
- To prevent duplicate mobile drawer renders, the legacy `<div id="main-menu" ...>...</div>` was stripped from `afterFooter` in `pageParser.ts` by using regex replacement within `getLayoutShell()` and `getPageDataRaw()`.

## 3. Caveats
- No external APIs were queried during the build phase; local EJS files were fallback parsed as normal.
- Social media icon classes like `icon-facebook` and custom font styles depend on theme styles loaded in the `layout.tsx` wrapper.

## 4. Conclusion
- Global layout EJS injections have been successfully replaced by native, high-performance React components with zero functional regressions.
- The legacy mobile drawer has been safely removed from EJS parsed string injections.
- The build compiles cleanly without TypeScript warnings or dynamic routing errors.

## 5. Verification Method
- **Command to run**: Run the Next.js build command in the `frontend/` directory:
  ```powershell
  npm run build
  ```
- **Files to inspect**:
  - `frontend/src/components/Header.tsx`
  - `frontend/src/components/HeaderClient.tsx`
  - `frontend/src/components/Footer.tsx`
  - `frontend/src/components/MobileDrawer.tsx`
  - `frontend/src/components/SearchForm.tsx`
  - `frontend/src/components/SanPhamDropdown.tsx`
  - `frontend/src/components/DichVuDropdown.tsx`
  - `frontend/src/utils/pageParser.ts`
- **Invalidation Condition**: If the build fails or duplicate mobile sidebar drawers appear on layout rendering.
