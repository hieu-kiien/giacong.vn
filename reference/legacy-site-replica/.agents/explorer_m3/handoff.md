# Handoff Report — Milestone 3 Explorer

## 1. Observation

* **Header/Footer implementation**:
  * In `frontend/src/components/Header.tsx`, the component reads `src/data/partials/header.ejs` synchronously:
    ```tsx
    7:   const filePath = path.join(process.cwd(), 'src/data/partials/header.ejs');
    ...
    11:     html = fs.readFileSync(filePath, 'utf8');
    ```
  * In `frontend/src/components/Footer.tsx`, the component reads `src/data/partials/footer.ejs` synchronously:
    ```tsx
    6:   const filePath = path.join(process.cwd(), 'src/data/partials/footer.ejs');
    ...
    10:     html = fs.readFileSync(filePath, 'utf8');
    ```
  * In `frontend/src/components/HeaderClient.tsx`, the HTML string is rendered using `dangerouslySetInnerHTML`:
    ```tsx
    350:       dangerouslySetInnerHTML={{ __html: initialHtml }}
    ```

* **Mobile Drawer Location**:
  * In `frontend/src/data/pages/home.ejs` (lines 1780-1829), the mobile sidebar `#main-menu` is defined:
    ```html
    1780: <div id="main-menu" class="mobile-sidebar no-scrollbar mfp-hide">
    ```
  * This drawer layout is extracted by `getLayoutShell()` in `frontend/src/utils/pageParser.ts` (lines 151-155):
    ```typescript
    layoutShell = {
      beforeHeader: parsedHtml.substring(0, headerIdx),
      afterFooter: parsedHtml.substring(footerIdx + footerInclude.length),
      bodyClass: bodyClass
    };
    ```

* **CSS / Scripts**:
  * Global stylesheets in `frontend/src/app/layout.tsx` (lines 25-28):
    ```tsx
    25:         <link rel="stylesheet" href="/assets/css/flatsome_1a697c57.css" type="text/css" media="all" />
    26:         <link rel="stylesheet" href="/assets/css/flatsome-shop_1f236790.css" type="text/css" media="all" />
    27:         <link rel="stylesheet" href="/assets/css/style_a70a3410.css" type="text/css" media="all" />
    28:         <link rel="stylesheet" href="/assets/css/styles_a86a383a.css" type="text/css" media="all" />
    ```

* **Other `dangerouslySetInnerHTML` and `fs.readFileSync` occurrences**:
  * Verified using PowerShell command scans. Found occurrences of `dangerouslySetInnerHTML` in page files (`page.tsx`, `[...slug]/page.tsx`, `search/page.tsx`, `tin-tuc/page.tsx`, `not-found.tsx`) and layout inline code block scripts/styles.
  * Found `fs.readFileSync` occurrences in `search/page.tsx` (lines 45, 54 reading products/services JSON files) and in `pageParser.ts` (via `fs.promises.readFile`).

---

## 2. Logic Chain

1. **Static and Dynamic separation**: The current application uses EJS templates as raw string outputs which it injects into the DOM using `dangerouslySetInnerHTML`. Because Next.js handles server rendering and client hydration, this creates layout shifts and hydration mismatches.
2. **Reconstruction**: By converting the static EJS template files (`header.ejs`, `footer.ejs`) and the appended mobile drawer from `home.ejs` to native TSX React elements, we completely remove the dependency on `fs.readFileSync` and `dangerouslySetInnerHTML` for the global header and footer.
3. **Interactive behaviors**: To preserve Flatsome theme's exact UI design without the overhead of heavy jQuery scripts, we reconstruct stuck, active pathname classes, hover close-timeouts, and mobile accordion toggle states using standard React state hooks (`useState`, `useEffect`, `useRef`, and `usePathname`).
4. **Link Cleanups**: Native links can utilize Next.js `<Link>` components with relative paths directly, eliminating the need for runtime regex corrections via `cleanLinks()`.

---

## 3. Caveats

* **CSS dependency**: The native React JSX layout depends on classes like `.header-main`, `.stuck`, `.nav-dropdown`, and `.mobile-sidebar` defined inside the assets stylesheet `/assets/css/flatsome_1a697c57.css`. Changes to class names or removing these assets would break the header/footer layouts.
* **Other EJS Content**: While header and footer are fully converted, other content pages still use `dangerouslySetInnerHTML` for their body markup (`data.content`) and wrapper layouts. Fully eliminating `dangerouslySetInnerHTML` from the entire application is outside the scope of Milestone 3 but is planned for future milestones.

---

## 4. Conclusion

A native conversion of the global header, footer, and mobile drawer into React components is feasible, safe, and highly beneficial. By mirroring the EJS class structure in JSX and implementing state variables for stickiness, desktop hover menus, and the mobile sidebar, we can achieve identical behavior without runtime file operations. 

---

## 5. Verification Method

* **Check the Analysis Artifact**:
  * Inspect the file `c:\Users\hieuk\Desktop\Tham khảo giacong.vn\.agents\explorer_m3\analysis.md` to see the proposed native JSX structure and dynamic React hook implementation details.
* **Code Audit Validation**:
  * You can rerun the PowerShell search commands to verify all files containing `dangerouslySetInnerHTML` and `fs.readFileSync`:
    ```powershell
    # To check dangerouslySetInnerHTML:
    Get-ChildItem -Path "frontend/src" -Recurse -Include *.ts,*.tsx | Select-String -Pattern "dangerouslySetInnerHTML"
    
    # To check readFileSync:
    Get-ChildItem -Path "frontend/src" -Recurse -Include *.ts,*.tsx | Select-String -Pattern "readFileSync"
    ```
