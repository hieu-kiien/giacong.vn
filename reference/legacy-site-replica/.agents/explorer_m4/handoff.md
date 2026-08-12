# Handoff Report - explorer_m4

## 1. Observation
We observed that the project contains React components in the frontend:
- `frontend/src/components/HeaderClient.tsx`
- `frontend/src/components/Footer.tsx`
- `frontend/src/components/MobileDrawer.tsx`
- `frontend/src/components/SanPhamDropdown.tsx`
- `frontend/src/components/DichVuDropdown.tsx`

We scanned the links inside these components and found several issues:
- `Footer.tsx` contains placeholder link URLs (`http://url`) and a placeholder email (`mailto:your@email`).
- `SanPhamDropdown.tsx` contains links pointing to `/` (Home) instead of their actual sub-item EJS page equivalents (e.g. "Gia công sữa tươi" maps to `/`, but `gia-cong-sua-tuoi.ejs` exists).
- `SanPhamDropdown.tsx` has a routing mismatch for "Nước ép dưa hấu", mapping it to `/hoa-qua-say` instead of `/gia-cong-nuoc-ep-dua-hau`.
- `DichVuDropdown.tsx` has severe copy-paste menu layout errors where fruit juices are rendered under "Dịch vụ thiết kế", yogurts are rendered under "Dịch vụ pháp lý", and spices are rendered under "Dịch vụ marketing".
- `pageParser.ts`'s `cleanLinks` function converts absolute `giacong.vn` URLs to relative paths on the server side, but it completely misses any potential links using `www.giacong.vn`.
- EJS template files (in `src/data/pages`) contain a total of 27,465 absolute references to `https://giacong.vn/`.
- Dynamic EJS content rendered in `dangerouslySetInnerHTML` does not have any click interception, which triggers full browser page reloads when relative links are clicked in the SPA.

## 2. Logic Chain
- Clicking relative anchors in injected HTML bypasses Next.js client router, causing full-page refreshes.
- By listening to all document click events and filtering for relative anchors that do not point to static assets or target `_blank`, we can intercept clicks and call `router.push(href)`. This keeps navigation within Next.js's stateful routing.
- The `cleanLinks` server-side function lacks `www.` in its regex. EJS scan shows that while CMS content currently uses non-www URLs, this is a future vulnerability.
- Correcting copy-paste sub-menus to point to actual EJS pages (which we verified exist in `src/data/pages/`) will fix dead navigation pathways.

## 3. Caveats
- We did not verify if the Laravel API is currently online or if it serves these pages, but local EJS files exist as a fallback.
- We assumed that the sub-menus for Dịch vụ thiết kế, pháp lý, and marketing do not have sub-pages in EJS (since none were found in search).

## 4. Conclusion
- The navigation components have copy-paste errors, dead placeholders, and incorrect route mappings.
- The EJS link cleaning works for non-www domains but is vulnerable to `www.giacong.vn`.
- Raw EJS content requires runtime click interception in `ClientPage.tsx` to prevent full browser reloads.

## 5. Verification Method
- **Routing Correction Verification**: After applying corrections to the dropdowns, verify that clicking "Gia công sữa tươi" routes to `/gia-cong-sua-tuoi` and "Nước ép dưa hấu" routes to `/gia-cong-nuoc-ep-dua-hau`.
- **Runtime Interception Verification**: Insert `<a href="/gioi-thieu-ve-gia-cong">Test</a>` into a dynamic page's content, click it, and verify that it loads the page instantly without a browser reload spinner.
