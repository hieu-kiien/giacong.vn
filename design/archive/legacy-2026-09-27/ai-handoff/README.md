# GIACONG.VN - AI DEVELOPMENT HANDOFF PACKAGE

Bộ tài liệu này là nguồn sự thật duy nhất để AI coding agent hoặc đội lập trình xây dựng lại website Giacong.vn bằng Next.js. Mục tiêu là tái tạo đúng hệ thống giao diện trong thư mục `references/new-design`, đồng thời bảo đảm mã nguồn có cấu trúc tốt, dễ bảo trì, có animation mượt và đạt chuẩn production.

## 1. Thứ tự đọc bắt buộc

1. `AGENTS.md` - luật làm việc dành cho AI agent.
2. `docs/01-product-requirements.md` - mục tiêu và phạm vi.
3. `docs/02-information-architecture.md` - sitemap, route, menu.
4. `docs/03-design-system.md` - màu sắc, typography, grid, token.
5. `docs/04-component-specification.md` - component và trạng thái.
6. `docs/05-page-specifications.md` - đặc tả từng trang.
7. `docs/06-motion-animation.md` - animation và chuyển động.
8. `docs/07-data-content-models.md` - model dữ liệu, CMS, form.
9. `docs/08-technical-architecture.md` - kiến trúc Next.js.
10. `docs/09-implementation-plan.md` - lộ trình triển khai.
11. `docs/10-acceptance-tests.md` - tiêu chí nghiệm thu.
12. `docs/11-ai-agent-master-prompt.md` - prompt tổng để dán vào agent.

## 2. Tài nguyên hình ảnh

- `references/new-design/01-home.png`
- `references/new-design/02-about.png`
- `references/new-design/03-services.png`
- `references/new-design/04-product-list.png`
- `references/new-design/05-product-detail.png`
- `references/new-design/06-news.png`
- `references/new-design/07-contact.png`
- `references/new-design/08-design-system-board.png`

Ảnh trong `current-site/` chỉ dùng để hiểu nội dung cũ, không được dùng làm chuẩn giao diện.

## 3. Lệnh khởi tạo đề xuất

```bash
pnpm create next-app@latest giacong-web \
  --ts --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --turbopack
cd giacong-web
pnpm add motion lucide-react clsx tailwind-merge class-variance-authority \
  @radix-ui/react-accordion @radix-ui/react-dialog @radix-ui/react-dropdown-menu \
  @radix-ui/react-navigation-menu @radix-ui/react-select @radix-ui/react-tabs \
  @hookform/resolvers react-hook-form zod swiper sonner
pnpm add -D prettier prettier-plugin-tailwindcss @playwright/test vitest @testing-library/react
```

Không khóa cứng phiên bản bằng tay trong bước đầu; để trình quản lý gói lấy bản stable tương thích, sau đó commit lockfile. Khi triển khai production phải audit bảo mật và nâng bản vá mới nhất.

## 4. Definition of Done cấp dự án

- Giao diện desktop bám sát ảnh tham chiếu, sai lệch bố cục không quá 4 px ở các vùng chính khi so ảnh cùng viewport.
- Responsive hoàn chỉnh ở 360, 390, 768, 1024, 1280, 1440 và 1920 px.
- Animation mượt, không gây layout shift, hỗ trợ `prefers-reduced-motion`.
- Lighthouse mục tiêu: Performance >= 90, Accessibility >= 95, Best Practices >= 95, SEO >= 95 trên trang chủ production.
- Không có lỗi TypeScript, ESLint, build hoặc hydration.
- Form báo giá có validation, trạng thái loading/success/error, chống spam cơ bản.
- Metadata, sitemap, robots, canonical, OpenGraph và JSON-LD đầy đủ.
- Tất cả component chính có trạng thái hover, focus, disabled, loading và empty/error khi phù hợp.

## 5. Quy tắc quan trọng

- Không lấy text trong ảnh AI làm dữ liệu tuyệt đối. Dùng nội dung trong tài liệu này; chỗ nào chưa xác nhận phải để trong CMS/config, không hard-code sai.
- Không dùng animation nặng liên tục trên toàn trang. Chuyển động phải có mục đích, thời lượng ngắn và không ảnh hưởng Core Web Vitals.
- Không tự tạo logo mới. Dùng logo thật do chủ website cung cấp; trong lúc chờ có thể dùng placeholder SVG tương thích kích thước.
- Không copy ảnh thương hiệu bên thứ ba nếu chưa có quyền. Tất cả ảnh sản phẩm/nhà máy/đối tác phải thay bằng tài sản hợp pháp trước khi xuất bản.
