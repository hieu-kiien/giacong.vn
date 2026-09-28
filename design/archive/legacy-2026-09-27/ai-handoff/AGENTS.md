# AGENTS.md - Quy tắc bắt buộc cho AI coding agent

## Nhiệm vụ
Xây dựng website Giacong.vn mới theo bộ ảnh trong `references/new-design` và toàn bộ đặc tả trong `docs/`. Ưu tiên độ chính xác giao diện, hiệu năng, khả năng truy cập và kiến trúc dễ mở rộng.

## Nguồn sự thật theo độ ưu tiên
1. Tài liệu Markdown trong `docs/`.
2. `config/design-tokens.json`, `config/route-map.json`, `config/content-seed.json`.
3. Ảnh `references/new-design`.
4. Ảnh `references/current-site` chỉ để hiểu nội dung cũ.

Nếu có xung đột, dừng và ghi vấn đề vào `IMPLEMENTATION_NOTES.md`; không tự đoán các thông tin pháp lý, số liệu công ty, chứng nhận hoặc đối tác.

## Ràng buộc kỹ thuật
- Next.js App Router, TypeScript strict, React Server Components mặc định.
- Chỉ thêm `"use client"` cho component thực sự cần state, browser API hoặc animation tương tác.
- Tailwind CSS dùng token từ CSS variables; không rải màu hex tùy ý trong JSX.
- Motion for React cho animation; CSS keyframes cho loop nền rất nhẹ.
- React Hook Form + Zod cho form.
- `next/image` cho ảnh; luôn có `sizes`, width/height hoặc `fill` với container xác định.
- Icon dùng Lucide hoặc SVG của thương hiệu; không dùng emoji làm icon UI.
- Không thêm dependency nếu có thể giải quyết bằng API sẵn có hoặc component nhỏ.
- Tất cả route công khai phải có metadata.
- Không đưa secret vào client bundle.

## Quy tắc giao diện
- Desktop max content width: 1280px; gutter 24px; mobile gutter 16px.
- Header 80px desktop, 64px mobile; shrink khi cuộn còn 68px desktop.
- Card radius 16px mặc định; hero/card lớn 24px; pill 999px.
- Tông nền chủ đạo trắng, xanh rất nhạt; xanh đậm chỉ dùng footer/CTA lớn.
- Màu đỏ chỉ dành cho giá, lỗi hoặc cảnh báo.
- Chỉ một CTA chính nổi bật trong mỗi cụm hành động.
- Trạng thái focus-visible phải rõ ràng.

## Quy tắc animation
- Chuyển trang 220-320ms.
- Scroll reveal 400-600ms, translateY tối đa 24px.
- Hover card nâng tối đa 6px, scale tối đa 1.015.
- Floating leaf loop 8-18 giây, biên độ nhỏ, không quá 4 phần tử chuyển động trong một viewport.
- Tắt parallax, loop và stagger khi `prefers-reduced-motion: reduce`.
- Không animation height thủ công gây giật; dùng layout animation hoặc Radix Accordion.

## Quy trình thực thi
1. Tạo design tokens, font, globals và layout shell.
2. Xây header, mega menu, mobile navigation, footer.
3. Xây component primitives và compound components.
4. Xây trang chủ trước, sau đó About, Services, Product Listing, Product Detail, News, Contact.
5. Thêm CMS/data adapters sau khi UI static chính xác.
6. Thêm form/API, SEO, test, performance.
7. Chụp screenshot Playwright và so với ảnh tham chiếu ở 1440px.

## Mỗi pull request/commit phải bảo đảm
```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
Không đánh dấu hoàn thành nếu một lệnh thất bại.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **giacong_ai_handoff** (268 symbols, 260 relationships, 0 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/giacong_ai_handoff/context` | Codebase overview, check index freshness |
| `gitnexus://repo/giacong_ai_handoff/clusters` | All functional areas |
| `gitnexus://repo/giacong_ai_handoff/processes` | All execution flows |
| `gitnexus://repo/giacong_ai_handoff/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
