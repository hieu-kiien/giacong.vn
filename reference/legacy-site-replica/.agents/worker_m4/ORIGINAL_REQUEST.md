## 2026-07-16T13:54:01Z
You are the Milestone 4 Worker. Your working directory is: c:\Users\hieuk\Desktop\Tham khảo giacong.vn\.agents\worker_m4
Your mission is to perform the Link Audit & Correction (Milestone 4).

Tasks to implement:
1. **Dropdown Links & Copypasta routing correction**:
   In `frontend/src/components/SanPhamDropdown.tsx` and `DichVuDropdown.tsx`, correct all links with incorrect/placeholders or absolute mappings:
   - In `SanPhamDropdown.tsx`:
     - Map "Gia công sữa tươi" to `/gia-cong-sua-tuoi` (EJS file exists).
     - Map "Nước ép dưa hấu" to `/gia-cong-nuoc-ep-dua-hau`.
     - Map "Nước ép chanh leo" to `/gia-cong-nuoc-ep-chanh-leo`.
     - Map "Nước ép dứa" to `/gia-cong-nuoc-ep-dua`.
     - Map Yogurt sub-items (việt quất, chuối, dâu, đào, nguyên bản, truyền thống) to relative lowercase slugs like `/sua-chua-say-thang-hoa` or `/gia-cong-sua-chua` instead of `/` (Home).
     - Map Spice sub-items (gừng, hành, hành Baro, hành tây, nghệ, ớt, sả) to relative lowercase slugs like `/gia-cong-bot-cu-gung`, `/gia-cong-bot-hanh-tim`, `/gia-cong-bot-nghe`, `/gia-cong-ot-bot`, `/gia-cong-bot-cu-sa` instead of `/` (Home).
   - In `DichVuDropdown.tsx`:
     - Map Packaging sub-items: "Mít sấy" to `/dich-vu-say-mit`, "Hồng sấy" to `/dich-vu-say-hong`, "Khoai lang sấy" to `/dich-vu-say-khoai-lang`.
     - Fix the design, legal, and marketing sub-items. They currently contain copypasta text (juices under design, yogurts under legal, spices under marketing). Keep them or replace them with relevant service links, but make sure all links are lowercase relative paths with no accents/spaces (e.g. `/thiet-ke-bao-bi`, `/dang-ky-cong-bo-san-pham`, `/marketing-tron-goi` or map them to `#` with a click handler preventing default behavior if no specific page exists).
2. **Footer.tsx Links**:
   In `frontend/src/components/Footer.tsx`, correct placeholder social media links and e-mail link:
   - Email icon -> `mailto:info@giacong.vn`
   - Social media links -> Map to `#` with click handlers preventing default behavior.
3. **pageParser.ts www.giacong.vn support**:
   In `frontend/src/utils/pageParser.ts` (specifically inside `cleanLinks()`), update the regexes to support cleaning both `giacong.vn` and `www.giacong.vn` domains.
   Use:
   ```typescript
   cleaned = cleaned.replace(/https?:\/\/(www\.)?giacong\.vn\/?(?=["'\s>])/gi, '/');
   cleaned = cleaned.replace(/https?:\/\/(www\.)?giacong\.vn(?!\/wp-content|\/wp-includes)/gi, '');
   ```
4. **ClientPage.tsx SPA Link Interception**:
   In `frontend/src/components/ClientPage.tsx`, implement a global click event listener using Next.js `useRouter` to intercept click events on any relative `<a>` tags in injected HTML content.
   Ensure that:
   - It only intercepts relative links starting with `/` (excluding `//` double slashes).
   - It ignores anchor links starting with `#`, external links, `mailto:` and `tel:` links, and file/media assets (PDF, images, etc.).
   - It ignores `target="_blank"` links and modifier key clicks (Cmd/Ctrl/Shift/Alt).
   - On valid relative links, it prevents default navigation and routes via `router.push(href)`.
5. **Verifications**:
   Run `npm run build` and `npm run lint` in the `frontend` directory. Ensure they complete successfully with no TypeScript/ESLint warnings or errors.
6. Write a handoff report in c:\Users\hieuk\Desktop\Tham khảo giacong.vn\.agents\worker_m4\handoff.md documenting your changes and build outcomes.
