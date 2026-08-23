# CSP staging audit

Status: **in progress** — source policy added, runtime acceptance pending on the next accepted master staging deployment.

Observed on staging on 2026-08-23 before this policy was deployed:

- Next/OpenNext assets load from the same origin under `/_next/` and `/media/`;
- captured storefront content references image assets under `https://giacong.vn/wp-content/`;
- the captured footer references badge images under `https://images.dmca.com/`;
- Cloudflare Insights injects a module from `https://static.cloudflareinsights.com/`;
- Cloudflare edge challenge pages can add challenge resources outside the Worker response;
- Next and the captured page runtime include inline script/style output; no `unsafe-eval` requirement was found in the source policy.

The source policy in `next.config.ts` therefore uses a narrow allowlist for the observed image, Insights and challenge origins, keeps `object-src 'none'`, `frame-ancestors 'none'`, `form-action 'self'` and `base-uri 'self'`, and does not allow `unsafe-eval`. `unsafe-inline` remains temporarily required for the current static Next/captured runtime. This is a documented compatibility boundary, not a claim that the legacy captured asset origins are ideal.

G4 cannot close until the policy is observed on the same accepted master staging deployment and the security/deep-QA run passes. The follow-up hardening trigger is to move captured assets to the approved Cloudflare/R2 media boundary and replace the inline compatibility allowance with a nonce/hash strategy without disabling edge caching unnecessarily.

Required evidence after merge:

1. `npm run test:acceptance` passes the source and staging-QA contracts;
2. the master staging security QA observes `Content-Security-Policy` on public routes and confirms the required directives;
3. the matching deep-QA run has no browser page/console errors and is recorded in issue #70.
