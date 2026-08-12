# Original User Request

## 2026-07-16T13:16:17Z

An enhanced replica of the giacong.vn website, converting legacy HTML/EJS injections into robust React/Next.js components, auditing/fixing links, syncing fresh crawl data, and preparing configurations for production deployment (SEO, forms, domain, security).

Working directory: c:\Users\hieuk\Desktop\Tham khảo giacong.vn
Integrity mode: demo

## Requirements

### R1. Data Crawling and Completeness
- Crawl the missing pages, media assets, and product/service data from `https://giacong.vn` to ensure the replica is fully populated.
- Save assets (images, stylesheets, icons) to `frontend/public/assets` and store structural content/metadata in the SQLite database or Next.js static data files.

### R2. React Component Conversion
- Replace the legacy EJS/HTML injected global layout components (`Header.tsx`, `Footer.tsx`) with native React components.
- The new Header and Footer components must construct the menus (including desktop hover dropdowns, mobile drawer, search bar, and footer links) using JSX rather than importing and injecting raw HTML files via `dangerouslySetInnerHTML`.
- Page content wrappers can remain as parsed HTML/React markdown where clean, but must be styled properly.

### R3. Link Audit and Correction
- Scan and repair all navigation links in the menus, footer, and sidebar.
- Replace any dead links or placeholders (like `#`, `javascript:void(0)`) with actual valid routing paths corresponding to the replica pages (e.g. `/san-pham`, `/tin-tuc`, `/lien-he`).

### R4. Production Configurations and Deployment Setup
- Configure CORS in the Laravel backend to support production domains.
- Provide a configuration template and logic for form submissions (Contact/Quotation) to send SMTP emails and store messages in the SQLite database.
- Establish SEO metadata (Meta titles, descriptions, H1 headings) for all core pages, sitemap.xml, robots.txt, and redirection logic.
- Add a trademark/brand usage guide document detailing constraints on using the official giacong.vn logo and assets in production.

## Acceptance Criteria

### Technical Build & Parity
- [ ] Next.js frontend builds cleanly (`npm run build` inside `frontend/`) with no TypeScript or ESLint errors.
- [ ] Laravel backend tests pass successfully (`php artisan test` inside `backend/`).
- [ ] No browser console errors occur when navigating the replica site.

### Component Conversion & Links
- [ ] `Header.tsx` and `Footer.tsx` are fully written as native React components with no file reads or `dangerouslySetInnerHTML` for the layout structure.
- [ ] All menu links in the header, footer, and mobile navigation are validated and contain no broken placeholders or absolute URLs pointing back to the live site (except when explicitly intended).

### Production Settings & Forms
- [ ] Valid `.env.production` files exist for both frontend and backend projects.
- [ ] Contact/Quotation form submissions work correctly, saving data to SQLite database and attempting to send an email via configured SMTP settings.
- [ ] SEO audit shows correct unique meta titles/descriptions, dynamic `sitemap.xml`, and valid `robots.txt` in the frontend production output.

## 2026-07-16T15:40:15Z

Due to a server restart, all background runners and monitoring tasks were stopped. Please resume the project execution. Check the current state of the workspace (c:\Users\hieuk\Desktop\Tham khảo giacong.vn), assess what has been completed, resume both the Implementation and Testing tracks, restart any necessary monitoring crons or sub-orchestrators, and continue working on the remaining requirements until all Acceptance Criteria are met. Report back when you are active.

## 2026-07-16T16:32:26Z

We have updated the prompt with a new requirement for Visual Parity (R5) and clarified R2. Please review the updated prompt_draft.md (C:\Users\hieuk\.gemini\antigravity\brain\491de670-e050-41fb-82a4-1a81bace6c8f\prompt_draft.md). 

You must pivot the team's efforts immediately:
1. De-prioritize the complex E2E testing framework/suite setup (Tier 1-4 tests).
2. Direct all available subagent resources (especially the implementation track) to focus on Visual Parity: ensure the new React/JSX Header, Footer, and navigation dropdowns (SanPhamDropdown, DichVuDropdown, MobileDrawer) match the exact styles, HTML/CSS class names (Flatsome theme classes), branding colors (#5aa400 and #eb892d), fonts (SF Pro Display), alignments, and responsive layout behavior of the live giacong.vn website.
3. Re-audit all converted components to ensure they do not look generic or simplified compared to the live site.

Instruct the implementation and testing sub-orchestrators to update their plans and focus on this visual alignment immediately.

## 2026-07-16T16:35:03Z

The user has added a critical new requirement (R5) and updated the Acceptance Criteria for visual parity. Additionally, due to a server restart, all background runners and monitoring tasks were stopped.

Please resume the project execution and incorporate the following requirement:

### R5. Visual Parity and Layout Match (Flatsome Theme Alignment)
- Ensure the converted React Header, Footer, and dropdown menus (SanPhamDropdown, DichVuDropdown) match the exact visual layout, typography (SF Pro Display), color scheme (#5aa400 and #eb892d), hover animations, spacing, and CSS classes of the original WordPress Flatsome theme.
- Avoid simplifying or stripping layout classes from the original EJS files. Prioritize identical visual styling and CSS layout fidelity over generic Tailwind/custom component rewrites.

### Updated Acceptance Criteria:
- [ ] Converted Header/Footer layout, hover dropdowns, and mobile drawers look visually identical to giacong.vn, preserving the original class structure and styling of the Flatsome theme.

Revive both the Implementation and Testing tracks, update your internal milestones (incorporate R5), restart the necessary subagents or sub-orchestrators, and continue working. Report back when you are active.

## 2026-07-16T16:41:59Z

Another server restart occurred, stopping all background tasks. Please resume the project execution. Verify that the visual parity alignment (R5) is fully integrated into the working directory (c:\Users\hieuk\Desktop\Tham khảo giacong.vn), restore all implementation and testing tracks, restart the monitoring crons, and continue working towards completion. Report back when active.

## 2026-07-16T16:46:49Z

A server restart occurred again and background tasks were stopped. Please revive the implementation and testing sub-orchestrators, resume project execution, and keep prioritizing requirement R5 (Visual Parity and Flatsome Theme Alignment) alongside other project requirements. Let us know when you have resumed.

## 2026-07-16T17:02:56Z

A server restart occurred again. Please assess the current project state, revive all the implementation and testing sub-orchestrators, and resume project execution. Make sure to keep prioritizing requirement R5 (Visual Parity and Flatsome Theme Alignment) along with the other requirements. Report back once active.
