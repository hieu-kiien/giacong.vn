# Header navigation

Source of truth:

- `C:\Users\hieuk\Desktop\cào giacong.vn\mirror\index.html`
- `public/styles/flatsome.css`
- `public/styles/giacong-sections.css`

## Sticky state

- Interaction model: scroll-driven.
- At the top of the page, `.header-wrapper` remains in its original layout.
- Once the page scrolls below the 70px header, `.header-wrapper` receives
  `.stuck`.
- The existing Flatsome `.stuck` rules make it fixed at `top: 0`, full width,
  with the green header background and sticky shadow.
- The original `sticky-jump` animation settles into place over 0.6 seconds.
- Returning to the top removes `.stuck`.
- The behavior applies to desktop, tablet, and mobile.

## Desktop mega menus

- Interaction model: hover, focus, and click.
- Hover or keyboard focus previews the Product or Service mega menu.
- Clicking either top-level trigger prevents navigation and pins that mega menu
  open so a customer can move the pointer into it and choose an item.
- Clicking the same trigger again, clicking outside, or pressing Escape closes
  the pinned menu.
- Opening one mega menu closes the other.
- Links inside each mega menu retain their normal navigation behavior.
