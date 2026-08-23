# Historical implementation decisions

This is an old discovery handoff, not the current deployment plan. The authoritative deployment decision is Cloudflare Workers through OpenNext; see `apps/giacong-lean-commerce/docs/CLOUDFLARE_DEPLOYMENT.md` and `docs/CLOUDFLARE_NATIVE_V1_PLAN.md`.

- [ ] CMS: Sanity / Strapi / local content.
- [ ] Có bán hàng và thanh toán trực tiếp hay chỉ catalog + báo giá?
- [ ] Giỏ hàng lưu local hay user account/database?
- [ ] Cổng thanh toán nào nếu có?
- [ ] Nơi nhận lead: email, Supabase, CRM hay Google Sheet webhook?
- [ ] Upload provider.
- [ ] Analytics provider.
- [ ] Chat/Zalo integration URL.
- [ ] i18n Việt/Anh trong phase nào?
- [x] Hosting: Cloudflare Workers through OpenNext. Other hosting platforms are not deployment targets for this project.
- [ ] Nội dung/chứng nhận/đối tác đã được duyệt.
