## Challenge Summary

**Overall risk assessment**: MEDIUM

## Challenges

### [Medium] Challenge 1: Path Traversal via Catch-All Slug Route
- **Assumption challenged**: Slug parameters from Next.js catch-all router are always clean and cannot traverse directories.
- **Attack scenario**: If a client bypasses standard routing or if a script invokes `getPageData` with path traversal segments (e.g. `../../` or `%2e%2e%2f`), `path.join(process.cwd(), 'src/data/pages', `${name}.ejs`)` could resolve to paths outside of the intended pages directory.
- **Blast radius**: Medium. Reading and rendering arbitrary `.ejs` files on the host filesystem.
- **Mitigation**: Sanitize and normalize slug strings inside `pageParser.ts` to strip directory traversal sequences (`..`, `/`, `\`).

### [High] Challenge 2: Cross-Site Scripting (XSS) via Unsanitized EJS Content Injection
- **Assumption challenged**: Content served by the Laravel API or read from local fallback EJS files is safe and contains no malicious scripts.
- **Attack scenario**: If the Laravel database is compromised or an editor saves malicious markup, or if a fallback EJS file has vulnerable client-side script blocks, Next.js will render it directly using `dangerouslySetInnerHTML={{ __html: data.content }}`.
- **Blast radius**: High. Direct client-side JavaScript execution (XSS) leading to credential theft or page defacement.
- **Mitigation**: Use a sanitizer library (such as `dompurify` or `sanitize-html`) on the server/client side before passing HTML to `dangerouslySetInnerHTML`.

### [Medium] Challenge 3: Next.js De-optimization to Dynamic Rendering due to `{ cache: 'no-store' }`
- **Assumption challenged**: Catch-all routes build and scale efficiently as static pages.
- **Attack scenario**: In `pageParser.ts` line 191, the Laravel API query uses `{ cache: 'no-store' }`. Under Next.js, this forces the route `/ [slug]` to opt-out of static page generation (SSG) and use server-side rendering (SSR) on every single request.
- **Blast radius**: Medium. High server CPU/memory load and database query count during heavy traffic.
- **Mitigation**: Change to Incremental Static Regeneration (ISR) with `revalidate: 60` or on-demand revalidation to cache pages on Next.js edge/server while allowing updates.

## Stress Test Results

- **Traversal input check** -> `getPageData('../../package')` -> returns `null` because `package.ejs` does not exist, but it attempts to resolve `c:\Users\hieuk\Desktop\Tham khảo giacong.vn\package.ejs` -> PASS (limited to `.ejs` extension, but directory traversal is physically possible in the path resolution logic).

## Unchallenged Areas

- **Laravel API DB performance** — Out of scope.
