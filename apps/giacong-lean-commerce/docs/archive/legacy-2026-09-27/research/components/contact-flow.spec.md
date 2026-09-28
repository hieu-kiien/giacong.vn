# Contact flow

## Routes

- `Về chúng tôi` links to `/gioi-thieu-ve-gia-cong/`.
- `Liên hệ ngay` links to `/lien-he/`.
- Both destinations stay on the local clone and return HTTP 200.

## Google Sheets intake

- Captured Contact Form 7 forms submit `POST /api/contact`.
- The client normalizes captured field names into `name`, `phone`, `email`,
  `message`, and `source`.
- The Next.js route validates name, phone, and optional email server-side, then
  forwards the normalized fields as JSON to a server-only Google Apps Script
  webhook. The browser contract remains `POST /api/contact`.
- The contact email contract accepts RFC-syntax email addresses without a
  synchronous DNS lookup; the Next.js route is the validation boundary before
  forwarding to Google Apps Script.
- `GOOGLE_SHEETS_WEBHOOK_URL` is required and must be an HTTPS URL hosted by
  `script.google.com` or `script.googleusercontent.com`; credentials and URL
  fragments are rejected. `GOOGLE_SHEETS_WEBHOOK_SECRET` is optional and, when
  configured, is added only to the server-to-server JSON body.
- Redirects are handled manually for at most three hops. Every `Location` must
  meet the same allowlist; 301/302/303 continue as GET without the JSON body or
  secret, while 307/308 can retain the body only for an allowlisted destination.
- A valid webhook response is exactly JSON `{ "ok": true, "reference": "..." }`;
  only then does the BFF return HTTP 202 with that reference.
- Invalid submissions return HTTP 400 and a Vietnamese validation message.
- Unavailable or malformed upstream responses return 502, and a BFF timeout
  returns 504 without exposing configuration, secrets, or upstream details.
- Google Sheets is the staff processing inbox; this route never falls back to
  Bagisto.

## Form states

- `submitting`: disable the submit control and expose `aria-busy`.
- `sent`: reset the fields and show the server reference.
- `invalid`: keep field values and show the server validation message.
- `failed`: keep field values and show a connection error.
