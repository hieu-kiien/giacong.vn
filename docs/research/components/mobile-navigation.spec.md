# Mobile navigation

Source of truth:

- `C:\Users\hieuk\Desktop\cào giacong.vn\mirror\index.html`
- `public/styles/flatsome.css`
- `public/styles/giacong-sections.css`
- User reference: `codex-clipboard-4a4fb314-1d18-4345-a565-6d2ebad17b4b.png`

## Structure

- A fixed, 260px-wide green drawer opens from the left.
- A full-viewport 60% black backdrop covers the page behind it.
- The close control remains fixed at the top-right of the viewport.
- Drawer content uses the original Flatsome spacing: 30px vertical sidebar
  padding, then 20px around the search row.
- Search is 220px wide and 42px high; its orange submit button is 42px wide.
- Top-level menu links are 16px, bold, white, title case, with 13px vertical
  and 20px left padding.
- The cloned drawer replaces the mixed raster artwork with a consistent
  21px white outline SVG set for all six primary navigation rows.
- The service item uses a right-aligned down chevron and expands its submenu
  in the drawer.
- A Product accordion is inserted before Service on mobile. Its choices are
  derived from the captured desktop Product mega menu so mobile and desktop
  use the same local routes and real labels.

## Interaction

- Menu trigger opens the drawer and updates `aria-expanded`.
- The header search control opens the same drawer, focuses the product search
  field, and restores focus to the search control when the drawer closes.
- Submitting the search form stays on the local clone and preserves the search
  query in the URL.
- Close button, backdrop click, and Escape close the drawer.
- The service chevron toggles its submenu and `aria-expanded`.
- Tapping the full Product or Service row toggles its submenu; the small
  chevron is not the only touch target.
- Open submenus remain inside the 260px drawer and expose selectable links.
- Opening Product closes Service and vice versa.
- Drawer scrolling is independent from the locked page body.
