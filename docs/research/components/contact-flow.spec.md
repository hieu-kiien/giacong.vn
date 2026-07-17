# Contact flow

## Routes

- `Về chúng tôi` links to `/gioi-thieu-ve-gia-cong/`.
- `Liên hệ ngay` links to `/lien-he/`.
- Both destinations stay on the local clone and return HTTP 200.

## Mock intake

- Captured Contact Form 7 forms submit `POST /api/contact`.
- The client normalizes captured field names into `name`, `phone`, `email`,
  `message`, and `source`.
- The mock endpoint validates name, phone, and optional email server-side.
- Valid submissions return HTTP 202 with a `MOCK-*` reference.
- Invalid submissions return HTTP 400 and a Vietnamese validation message.
- The mock endpoint intentionally does not persist or log personal data.
- Replacing the mock later only requires changing the route handler adapter;
  the browser-facing form contract remains stable.

## Form states

- `submitting`: disable the submit control and expose `aria-busy`.
- `sent`: reset the fields and show the server reference.
- `invalid`: keep field values and show the server validation message.
- `failed`: keep field values and show a connection error.
