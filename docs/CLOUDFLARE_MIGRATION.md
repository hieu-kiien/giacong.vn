# Cloudflare migration plan

This document tracks the move of Giacong.vn toward a Cloudflare-first runtime without interrupting the existing storefront or Bagisto administration.

## Target architecture

- **Cloudflare Workers + OpenNext**: Next.js storefront, server routes, and edge request handling.
- **D1**: products, categories, variants, quote requests, status history, and operational metadata after the data contract is finalized.
- **R2**: product media, customer design files, and the OpenNext incremental cache.
- **Queues / Durable Objects**: asynchronous notifications, import jobs, idempotency, and cache revalidation coordination.
- **Turnstile + WAF + Rate Limiting**: protection for contact and quote-request endpoints.
- **Workers Analytics / Web Analytics**: performance and conversion visibility.

## Safe migration sequence

1. **Storefront hardening (current milestone)** — improve quote UX, metadata, cache headers, and keep Bagisto as the source of truth.
2. **Cloudflare preview runtime** — validate the OpenNext Worker preview without changing DNS or production traffic.
3. **Edge data boundary** — add a typed Workers adapter around the existing Bagisto catalog API; cache only read-only catalog responses.
4. **D1/R2 shadow data** — import a copy of catalog and media data and compare responses before switching reads.
5. **Quote workflow on Workers** — move quote persistence, idempotency, Turnstile verification, and notifications to Workers, D1, R2, and Queues.
6. **Admin replacement** — build a focused catalog and quote operations console; keep Bagisto available during the cutover window.
7. **Cutover and decommissioning** — switch reads, then writes, verify backups and audit logs, and only then retire Bagisto/PHP.

## Required resources before preview deployment

- A Cloudflare zone for `giacong.vn` in the connected account.
- A Worker named `giacong-vn` (or an explicitly chosen preview name).
- An R2 bucket named `giacong-vn-next-cache` for the OpenNext incremental cache.
- D1 databases for shadow catalog and quote data, provisioned in a later migration stage.
- Turnstile site/secret keys stored outside source control before enabling form verification.
- A Cloudflare API token or GitHub deployment connection with Workers deployment permissions.

## Important boundary

Bagisto/Laravel/PHP cannot run unchanged inside Cloudflare Workers. It remains in the transition architecture until its catalog, media, and admin responsibilities have been replaced and verified. No production data or DNS should be deleted as part of the storefront migration.

## Validation gates

Each stage must pass the existing catalog, quote, service, lint, typecheck, and build checks. The DNS cutover is the final step, not a prerequisite for local or preview validation.
