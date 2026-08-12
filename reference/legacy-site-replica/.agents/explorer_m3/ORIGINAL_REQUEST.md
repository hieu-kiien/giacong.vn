## 2026-07-16T13:21:18Z
You are the Milestone 3 Explorer. Your working directory is: c:\Users\hieuk\Desktop\Tham khảo giacong.vn\.agents\explorer_m3
Your task:
1. Explore the frontend components for the global header and footer:
   - frontend/src/components/Header.tsx
   - frontend/src/components/HeaderClient.tsx
   - frontend/src/components/Footer.tsx
   - frontend/src/data/partials/header.ejs
   - frontend/src/data/partials/footer.ejs
2. Identify where the mobile drawer structure is defined (it might be inside header.ejs, footer.ejs, layout.tsx, or elsewhere). Find any relevant CSS files or other scripts.
3. Propose a precise structure and layout for the converted Header.tsx and Footer.tsx using native JSX/TSX React components.
4. The React components must reconstruct all desktop hover dropdowns, mobile drawers, search bars, and footer links natively (no dangerouslySetInnerHTML, no fs.readFileSync, no cleanLinks).
5. Outline any React state/hooks or dynamic logic needed for:
   - Sticky header class toggle on scroll.
   - Hover and click states for desktop menus ("Sản Phẩm", "Dịch vụ" dropdowns).
   - Toggle behavior for mobile drawer menu and its nested submenus.
   - Active styling for links.
6. Search for any other occurrences of dangerouslySetInnerHTML or fs.readFileSync for header/footer and report them.
7. Write your analysis and implementation strategy to c:\Users\hieuk\Desktop\Tham khảo giacong.vn\.agents\explorer_m3\analysis.md and send a completion message back.
