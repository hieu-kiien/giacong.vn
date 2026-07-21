# Contact flow

## Routes

- `Về chúng tôi` links to `/gioi-thieu-ve-gia-cong/`.
- `Liên hệ ngay` links to `/lien-he/`.
- Both destinations stay on the local clone and return HTTP 200.

## Bagisto BFF intake

- Captured Contact Form 7 forms submit `POST /api/contact`.
- The client normalizes captured field names into `name`, `phone`, `email`,
  `message`, and `source`.
- The Next.js route validates name, phone, and optional email server-side, then
  forwards only normalized fields to Bagisto at `POST /api/b2b/briefs`.
- The contact email contract accepts RFC-syntax email addresses without a
  synchronous DNS lookup; Bagisto is the final validation authority for this
  syntactic rule.
- `BAGISTO_API_URL` and `BAGISTO_API_TIMEOUT_MS` remain server-only variables;
  a missing configuration returns HTTP 503.
- Valid Bagisto responses must include `ok: true` and a non-empty reference;
  only then does the BFF return HTTP 202 with that reference.
- Invalid submissions return HTTP 400 and a Vietnamese validation message.
- Upstream validation 4xx responses keep their status, unavailable upstreams
  return 502, and a BFF timeout returns 504 without exposing upstream details.
- The browser-facing form contract remains stable while Bagisto owns persistence.

## Form states

- `submitting`: disable the submit control and expose `aria-busy`.
- `sent`: reset the fields and show the server reference.
- `invalid`: keep field values and show the server validation message.
- `failed`: keep field values and show a connection error.
