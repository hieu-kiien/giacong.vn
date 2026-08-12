# Milestone 4 - Link and Routing Analysis Report

This analysis covers:
1. Scan of navigation links in header, footer, mobile drawer, and dropdown components.
2. Identification of absolute links, dead/broken links, and incorrect routing.
3. Review of server-side link cleaning in `pageParser.ts` and runtime link interception strategy in `ClientPage.tsx`.
4. Unified correction strategy.

---

## 1. Scan of Navigation Components and Link Mapping

We scanned all navigation components:
- `frontend/src/components/HeaderClient.tsx`
- `frontend/src/components/Footer.tsx`
- `frontend/src/components/MobileDrawer.tsx`
- `frontend/src/components/SanPhamDropdown.tsx`
- `frontend/src/components/DichVuDropdown.tsx`

### Findings: Navigation Links in Static Components

| Component | Text / Link Element | Current Link / Href | Problem Type | Correct Mapping / Action |
|---|---|---|---|---|
| `HeaderClient.tsx` | All navigation links | `/`, `/gioi-thieu-ve-gia-cong`, `/san-pham`, `/tin-tuc`, `/lien-he` | None | OK (valid local routes) |
| `Footer.tsx` | Facebook Icon | `http://url` | Dead/Placeholder | Map to specific Facebook page or remove |
| `Footer.tsx` | Instagram Icon | `http://url` | Dead/Placeholder | Map to specific Instagram page or remove |
| `Footer.tsx` | Twitter Icon | `http://url` | Dead/Placeholder | Map to specific Twitter page or remove |
| `Footer.tsx` | E-mail Icon | `mailto:your@email` | Dead/Placeholder | Map to `mailto:info@giacong.vn` |
| `Footer.tsx` | DMCA Status Badge | `...&refurl=https://giacong.vn/` | Absolute domain parameter | OK (DMCA verification expects absolute URL) |
| `Footer.tsx` | DMCA Compliance | `https://www.dmca.com/compliance/giacong.vn` | Domain inside external URL | OK (external compliance verification link) |
| `Footer.tsx` | Chính sách thanh toán | `/chinh-sach-thanh-toan` | Missing local EJS file | Fallback to Laravel API page or create `chinh-sach-thanh-toan.ejs` |
| `Footer.tsx` | Chính sách hoàn tiền | `/chinh-sach-hoan-tien` | Missing local EJS file | Fallback to Laravel API page or create `chinh-sach-hoan-tien.ejs` |
| `Footer.tsx` | Bản quyền phương tiện | `/ban-quyen` | Missing local EJS file | Fallback to Laravel API page or create `ban-quyen.ejs` |
| `MobileDrawer.tsx` | All navigation links | Relative paths (`/`, `/gia-cong-sua`, etc.) | None | OK (all map to valid endpoints) |

---

### Findings: Dropdown Copy-Paste and Routing Mismatches

We detected multiple major routing mismatches and copy-paste errors inside the dropdown components:

#### A. `SanPhamDropdown.tsx`
1. **Gia công sữa tươi** (Line 51): Currently maps to `/` (Home).
   - **Correction**: Map to `/gia-cong-sua-tuoi` (EJS file `gia-cong-sua-tuoi.ejs` exists).
2. **Nước ép dưa hấu** (Line 89): Currently maps to `/hoa-qua-say` (Dried fruit).
   - **Correction**: Map to `/gia-cong-nuoc-ep-dua-hau` (EJS file `gia-cong-nuoc-ep-dua-hau.ejs` exists).
3. **Nước ép chanh leo** and **Nước ép dứa** (Lines 83, 95): Currently map to `#` (Dead links).
   - **Correction**: Map to `/gia-cong-nuoc-ep-chanh-leo` and `/gia-cong-nuoc-ep-dua` if they exist, or remove.
4. **Thực phẩm sấy sub-items** (Bột phô mai, Sữa chua vị việt quất, chuối, dâu tây, đào, nguyên bản, truyền thống) (Lines 109-145): Currently map to `/` (Home).
   - **Correction**: Sữa chua items should map to their respective pages like `/sua-chua-say-thang-hoa` or `/gia-cong-sua-chua` instead of home.
5. **Bột gia vị sub-items** (Bột gừng, hành, hành Baro, hành tây, nghệ, ớt, sả) (Lines 159-195): Currently map to `/` (Home).
   - **Correction**:
     - Bột gừng -> `/gia-cong-bot-cu-gung`
     - Bột hành -> `/gia-cong-bot-hanh-tim`
     - Bột nghệ -> `/gia-cong-bot-nghe`
     - Bột ớt -> `/gia-cong-ot-bot`
     - Bột sả -> `/gia-cong-bot-cu-sa`

#### B. `DichVuDropdown.tsx`
1. **Dịch vụ đóng gói sub-items**:
   - **Mít sấy** (Line 128) maps to `#`. -> **Correction**: Map to `/dich-vu-say-mit`.
   - **Hồng sấy** (Line 134) maps to `/hoa-qua-say`. -> **Correction**: Map to `/dich-vu-say-hong`.
   - **Khoai lang sấy** (Line 140) maps to `#`. -> **Correction**: Map to `/dich-vu-say-khoai-lang`.
2. **Dịch vụ thiết kế sub-items** (Lines 147-167):
   - **Problem**: Renders fruit juice links ("Nước ép chanh leo", "Nước ép dưa hấu", "Nước ép dứa"). This is a copy-paste error from the Products menu.
   - **Correction**: Remove these items or replace with design sub-services.
3. **Dịch vụ pháp lý sub-items** (Lines 173-217):
   - **Problem**: Renders yogurt flavors ("Bột phô mai tách muối", "Sữa chua vị việt quất", etc.). This is a copy-paste error from the Yogurt section.
   - **Correction**: Remove these items or replace with actual legal service links.
4. **Dịch vụ marketing sub-items** (Lines 221-267):
   - **Problem**: Renders spices ("Bột gừng", "Bột hành", etc.). This is a copy-paste error from the Spice section.
   - **Correction**: Remove these items or replace with marketing sub-services.

---

## 2. Review of Link Cleaning in `pageParser.ts`

The `cleanLinks` function processes HTML text before rendering. 

### Current Logic
1. **Unescapes slashes** in URLs: `https?:\\\/\\\/...` -> `https://...`
2. **Converts absolute `giacong.vn` URLs** to relative URLs:
   - Matches exactly domain (`https?://giacong.vn/`) and replaces with `/`.
   - Matches other internal links (`https?://giacong.vn/...`) and strips the domain prefix to leave relative paths.
3. **Preserves remote asset domains** for `/wp-content` and `/wp-includes` paths:
   - Does not strip the domain for assets to ensure they fall back to retrieving them from the live site (as local media folders do not contain all WordPress uploads).
4. **Removes trailing slashes**: `href="/path/"` -> `href="/path"`.
5. **Rewrites search form actions** to point to Next.js route `/search`.
6. **Re-converts `/wp-content` and `/wp-includes` paths** to point to `https://giacong.vn` to prevent broken local assets.

### Gaps and Vulnerabilities
- **No `www.giacong.vn` handling**: The regexes look for `https?:\/\/giacong\.vn` but do not account for `www.giacong.vn`. If a content writer enters a link with `www.giacong.vn` in the CMS, it will bypass `cleanLinks` and result in a full-domain redirect to the live site.
- **Correction**: Update regexes in `pageParser.ts` to include optional `www.` group:
  ```typescript
  cleaned = cleaned.replace(/https?:\/\/(www\.)?giacong\.vn\/?(?=["'\s>])/gi, '/');
  cleaned = cleaned.replace(/https?:\/\/(www\.)?giacong\.vn(?!\/wp-content|\/wp-includes)/gi, '');
  ```

---

## 3. Runtime Route Correction Strategy for EJS Body Content

The dynamic EJS body content is rendered using:
```tsx
<div dangerouslySetInnerHTML={{ __html: data.content }} />
```

### The Problem
Since this is injected raw HTML, standard `<a>` tags (even when cleaned to relative paths like `/gioi-thieu-ve-gia-cong`) will trigger a **browser page reload** when clicked, completely defeating the benefit of a Next.js Single Page Application (SPA).

### Solution: Event Delegation Interception
We should add a client-side click event listener in `ClientPage.tsx` that catches clicks on any relative links inside `#original-content` and routes them using Next.js `useRouter`.

### Recommended Implementation in `frontend/src/components/ClientPage.tsx`
Add the following hook in `ClientPage.tsx`'s `useEffect`:

```typescript
import { useRouter } from 'next/navigation';

// Inside ClientPage component:
const router = useRouter();

useEffect(() => {
  const handleLinkClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    
    if (!anchor) return;
    
    const href = anchor.getAttribute('href');
    if (!href) return;
    
    // Check if it is a relative link (starts with '/')
    // Ignore external links, mailto/tel, anchors/hashes, and media assets
    const isRelative = href.startsWith('/') && !href.startsWith('//');
    const isAnchor = href.startsWith('#');
    const isMailOrTel = href.startsWith('mailto:') || href.startsWith('tel:');
    const isFile = /\.(pdf|png|jpg|jpeg|gif|svg|zip|gz|mp4|mp3)$/i.test(href);
    
    if (!isRelative || isAnchor || isMailOrTel || isFile) {
      return;
    }
    
    // Ignore target="_blank" and modifier key clicks
    const targetAttr = anchor.getAttribute('target');
    if (targetAttr && targetAttr.toLowerCase() === '_blank') {
      return;
    }
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    
    // Intercept navigation and route via Next.js client-side router
    e.preventDefault();
    router.push(href);
  };

  document.addEventListener('click', handleLinkClick);
  return () => {
    document.removeEventListener('click', handleLinkClick);
  };
}, [router]);
```

### Verification
This will intercept clicks on:
1. Dynamic EJS anchors injected in `content`.
2. Static links that might be loaded inside `beforeHeader` or `afterFooter`.
3. Standard relative links, while bypassing external assets, downloads, new tabs, and modifier clicks.
