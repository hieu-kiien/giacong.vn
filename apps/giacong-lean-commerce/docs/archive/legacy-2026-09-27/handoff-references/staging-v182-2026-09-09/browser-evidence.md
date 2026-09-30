# Staging v182 browser evidence — 2026-09-09

Deployment under test: `giacong-vn-staging`, version `182`, UUID
`53ab71f4-d211-4e24-a8c4-981172bd095b`.

This artifact was captured from the approved Chrome profile through CUA. It is
limited to transient UI edits and read-only inspection. No draft was saved, no
file was uploaded, no cookie/token/storage state was exported, and no Worker or
production resource was changed.

## Public storefront

Targets were `#menu-item-1742` (Sản phẩm) and `#menu-item-5166` (Dịch vụ).

- With the pointer over each trigger, `Escape` set
  `data-dropdown-dismissed="true"` and `pointer-events: none`.
- The computed transition was `opacity, visibility` over `0.25s`.
- Product samples were `opacity=1` at t0, `0.423663` at 50 ms, and `0`
  with `visibility=hidden` at 400 ms.
- Service samples were `opacity=0.872384` at t0, `0.349694` at 50 ms, and
  `0` with `visibility=hidden` at 400 ms.
- Moving the pointer away and back cleared the marker and returned both menus
  to `opacity=1`, `visibility=visible`, and `pointer-events=auto`.
- Public reload: 0 console warnings/errors; 50 responses from 51 network
  events, none HTTP 400+. One canceled browser Fetch was observed as
  `net::ERR_ABORTED`; it was not an HTTP response failure.

See the visual observation card: [menu-escape-observation.svg](./menu-escape-observation.svg).

## Admin R1 guards

All edits below used synthetic values and were discarded.

- Sidebar navigation from `/admin/noi-dung` opened `Bỏ thay đổi chưa lưu?`;
  `Ở lại` preserved the exact URL and field value; `Bỏ thay đổi` navigated to
  `/admin/tin-tuc` and unmounted the editor.
- Browser `forward` and `back` from a dirty content editor both showed the
  same guard, kept the editor URL while the dialog was open, and retained the
  synthetic draft. Discard returned to `/admin/tin-tuc` and unmounted the
  editor.
- Query/hash traversal from `?tab=b#beta` back toward `?tab=a#alpha` showed
  the guard and `Ở lại` preserved the current URL and draft. After
  `Bỏ thay đổi`, the URL returned to `?tab=a#alpha`, but the same-page editor
  still displayed `Chưa lưu` and retained the synthetic value. This case is
  recorded as a limitation/follow-up, not a pass claim.
- Editing a nested variant name and then using the parent product cancel action
  showed the guard; discard returned to the product list and removed the
  synthetic value.
- Editing nested media alt text produced the same parent cancel guard; discard
  returned to the product list and removed the synthetic value.
- Admin network reload: 27 responses from 29 network events, none HTTP 400+;
  two canceled Fetches were `net::ERR_ABORTED`. The captured console included
  one `AbortError: Transition was skipped`, so admin console cleanliness is not
  claimed.

The machine-readable transcript is [browser-evidence.json](./browser-evidence.json).

## Interpretation

The public Escape/re-entry behavior and route-level dirty guards have direct
runtime evidence on v182. Query/hash discard needs a follow-up before it can be
called fully passing. The admin `AbortError` is recorded as an observed runtime
signal from this reload/navigation sequence; no code change was made in this
artifact-only pass.
