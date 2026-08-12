# BRIEFING — 2026-07-16T20:25:00+07:00

## Mission
Convert the EJS/HTML injected global layout components (Header.tsx, Footer.tsx) to native React components.

## 🔒 My Identity
- Archetype: React Developer
- Roles: implementer, qa, specialist
- Working directory: c:\Users\hieuk\Desktop\Tham khảo giacong.vn\.agents\worker_m3
- Original parent: 8efead4e-1eb9-475e-8cb5-3126055138d1
- Milestone: Milestone 3

## 🔒 Key Constraints
- Reconstruct frontend/src/components/Header.tsx, HeaderClient.tsx, and Footer.tsx as native React components in JSX/TSX.
- Ensure you DO NOT use dangerouslySetInnerHTML for the layout structure of these components.
- DO NOT use fs or fs.promises to read header.ejs or footer.ejs.
- Create sub-components in frontend/src/components/ (SearchForm.tsx, MobileDrawer.tsx, SanPhamDropdown.tsx, DichVuDropdown.tsx) using TypeScript and Next.js <Link>.
- Replicate sticky header toggle class on scroll ("stuck" class), desktop hover/click states, mobile drawer toggle, back-to-top dynamic scroll/smooth-scroll in Footer.tsx.
- Update pageParser.ts:getLayoutShell() to strip the legacy mobile drawer (<div id="main-menu" ...>...</div>) from afterFooter when parsing home.ejs.
- Verify implementation via npm run build in frontend directory.

## Current Parent
- Conversation ID: 0d628bb4-8673-4de4-aade-f0143bc81e1b
- Updated: 2026-07-16T20:25:00+07:00

## Task Summary
- **What to build**: Native React components for Header, HeaderClient, Footer, SearchForm, MobileDrawer, SanPhamDropdown, DichVuDropdown.
- **Success criteria**: Successful npm run build, correct functionality (sticky header, desktop menus, mobile drawer, back-to-top), and legacy mobile drawer stripped from home.ejs shell.
- **Interface contracts**: frontend/src/components/Header.tsx, HeaderClient.tsx, Footer.tsx
- **Code layout**: React component layout in frontend/src/components/

## Key Decisions Made
- Reconstruct the legacy HTML/EJS structures into clean TSX components using standard React structure.
- Used Next.js Link instead of raw <a> tags to match next-generation routing requirement.
- Implemented state-based show/hide for dropdowns and mobile drawer instead of direct DOM class toggles.

## Change Tracker
- **Files modified**:
  - frontend/src/components/Header.tsx: converted to native wrapper
  - frontend/src/components/HeaderClient.tsx: reconstructed header in JSX/TSX with React states
  - frontend/src/components/Footer.tsx: reconstructed footer layout and back-to-top component
  - frontend/src/components/SearchForm.tsx: search bar component using Next.js routing
  - frontend/src/components/MobileDrawer.tsx: drawer component with state-driven slide toggling
  - frontend/src/components/SanPhamDropdown.tsx: Products megamenu hover dropdown
  - frontend/src/components/DichVuDropdown.tsx: Services megamenu hover dropdown
  - frontend/src/utils/pageParser.ts: modified getLayoutShell and getPageDataRaw to strip legacy mobile menu
- **Build status**: Compiled successfully (pass)
- **Pending issues**: None

## Quality Status
- **Build/test result**: Build compiles successfully without typescript errors.
- **Lint status**: 0 violations.
- **Tests added/modified**: Covered by Next.js compilation check.

## Loaded Skills
- **Source**: C:\Users\hieuk\.gemini\config\skills\ui-styling\SKILL.md
- **Local copy**: none
- **Core methodology**: Provides token architecture, Tailwind/shadcn component implementations, and layout guidelines.

## Artifact Index
- c:\Users\hieuk\Desktop\Tham khảo giacong.vn\.agents\worker_m3\ORIGINAL_REQUEST.md — Original User Request
- c:\Users\hieuk\Desktop\Tham khảo giacong.vn\.agents\worker_m3\BRIEFING.md — This briefing file
- c:\Users\hieuk\Desktop\Tham khảo giacong.vn\.agents\worker_m3\progress.md — Progress tracker
- c:\Users\hieuk\Desktop\Tham khảo giacong.vn\.agents\worker_m3\handoff.md — Handoff report
