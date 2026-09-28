# 04. Component Specification

## 1. Component hierarchy

### Layout
- `SiteHeader`
- `DesktopNavigation`
- `ProductMegaMenu`
- `ServicesMegaMenu`
- `MobileMenuDrawer`
- `SiteFooter`
- `PageShell`
- `Section`
- `Container`
- `Breadcrumbs`
- `FloatingContactDock`

### Primitives
- `Button`
- `IconButton`
- `Badge`
- `Input`, `Textarea`, `Select`
- `Checkbox`, `RadioGroup`, `ChipGroup`
- `Card`
- `Tabs`
- `Accordion`
- `Dialog/Sheet`
- `Skeleton`
- `EmptyState`
- `Pagination`

### Marketing
- `HeroCollage`
- `StatStrip`
- `ServiceCard`
- `ProcessTimeline`
- `CertificationCard`
- `PartnerLogoCarousel`
- `QuoteCtaBand`
- `NewsletterForm`
- `ArticleCard`
- `TestimonialCard` (optional)

### Commerce
- `ProductCard`
- `ProductGallery`
- `QuantityStepper`
- `TierPricingTable`
- `ProductMetaList`
- `ProductBenefits`
- `ProductTabs`
- `ProductFilters`
- `FilterDrawer`
- `SortSelect`
- `CartButton`
- `MiniCart` (phase 2)

## 2. SiteHeader

### Props
```ts
type SiteHeaderProps = {
  navigation: NavigationItem[];
  hotline: string;
  quoteHref: string;
  cartCount?: number;
  commerceEnabled?: boolean;
};
```

### States
- Top.
- Scrolled/shrunk.
- Mega menu open.
- Mobile drawer open.
- Active route.

### Accessibility
- Logo link có aria-label.
- `nav` rõ ràng.
- Menu button có `aria-expanded`, `aria-controls`.
- Mega menu keyboard navigation.

## 3. ProductCard

### Variant
- `catalog`: đầy đủ stepper + actions.
- `featured`: ảnh lớn, ít thông tin hơn.
- `compact`: mega menu/related products.

### Props chính
```ts
type ProductCardProps = {
  product: ProductSummary;
  variant?: 'catalog' | 'featured' | 'compact';
  showQuantity?: boolean;
  showWishlist?: boolean;
  onAddToCart?: (quantity: number) => void;
};
```

### Nội dung bắt buộc
- Category badge.
- Ảnh có alt.
- Tên sản phẩm tối đa 2 dòng.
- Quy cách.
- Giá hiện tại và đơn vị.
- Stock state.
- Action.

### States
- Default/hover/focus.
- Out-of-stock: button disabled, badge xám/đỏ nhẹ.
- Loading: skeleton.
- Add success: toast và animation cart icon ngắn.

## 4. ServiceCard
- Icon trong nền xanh nhạt.
- Title 18px/600.
- Description 2-4 dòng.
- Link `Tìm hiểu thêm`.
- Hover icon rotate/scale rất nhẹ, card lift 4px.

## 5. ArticleCard
- Image 16:9.
- Category badge.
- Title 2-3 dòng.
- Excerpt 2-3 dòng.
- Date + read time.
- Link.
- Có variant `featured`, `grid`, `compact`.

## 6. StatStrip
- Mỗi stat: icon, value, label.
- Counter chỉ animate lần đầu khi 40% visible.
- Value phải vẫn hiển thị ngay nếu JS tắt/reduced motion.

## 7. ProcessTimeline
- Desktop horizontal; tablet/mobile vertical.
- Step có index, icon, title, description.
- Connector là CSS, không dùng ảnh.
- Scroll reveal stagger 80ms, tối đa 6 steps.

## 8. ProductGallery
- Main media aspect 1:1 hoặc 4:3 tùy ảnh.
- Thumbnail 72-84px.
- Keyboard arrows cho carousel.
- Zoom dialog có focus trap, close button.
- Không tải toàn bộ ảnh full-res ngay; lazy thumbnails.

## 9. TierPricingTable
- Desktop 3-4 columns.
- Highlight current tier theo quantity.
- Discount badge.
- Mobile stacked hoặc horizontal scroll.
- Giá format bằng `Intl.NumberFormat('vi-VN')`.

## 10. ProductFilters
- Desktop sticky sidebar, top offset header + 24px.
- Group collapsible nếu nhiều.
- Count cạnh option.
- Apply price range.
- Clear all.
- Mobile dùng Sheet bottom/side, có sticky footer `Áp dụng`.
- Query state phải sync URL.

## 11. QuoteForm

### Sections
1. Thông tin liên hệ.
2. Dịch vụ quan tâm.
3. Thông tin sản phẩm.
4. Sản lượng và thời gian.
5. Yêu cầu khác.
6. Consent.

### Fields
- Họ tên, điện thoại, email.
- Doanh nghiệp, vị trí.
- Service multi-select.
- Category, form factor.
- Description.
- Attachment.
- Expected monthly volume.
- Target launch date.
- Notes.

### States
- Default.
- Validation error.
- Upload progress.
- Submitting.
- Success.
- Server error/retry.

## 12. FloatingContactDock
- Desktop fixed right center/bottom: call, email, Zalo, Messenger/chat.
- Mobile chỉ giữ 1-2 action thiết yếu, tránh che CTA.
- Tooltip trên desktop; aria-label đầy đủ.

## 13. Footer
- Responsive columns.
- Newsletter form độc lập.
- Social links mở tab mới với `rel="noopener noreferrer"`.
- Không để text quá nhỏ dưới 13px.

## 14. Component state matrix
Mỗi component tương tác phải có:
- Default.
- Hover.
- Focus-visible.
- Active/selected.
- Disabled.
- Loading nếu có async.
- Error/empty nếu có data.

## 15. Storybook (khuyến nghị)
Nếu dùng Storybook, tạo stories cho Button, Input, ProductCard, ServiceCard, ArticleCard, Header, MegaMenu, QuoteForm states. Không bắt buộc cho MVP nhưng rất hữu ích khi AI agent triển khai nhiều trang.
