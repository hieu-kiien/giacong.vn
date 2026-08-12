# 07. Data & Content Models

## 1. Nguyên tắc
- UI không phụ thuộc trực tiếp CMS vendor; tạo adapter/repository.
- Dữ liệu tĩnh demo nằm trong `config/content-seed.json`.
- ID nội bộ tách khỏi slug.
- Tất cả ảnh có alt text và hotspot/crop nếu CMS hỗ trợ.

## 2. TypeScript models cốt lõi

```ts
export type ImageAsset = {
  src: string;
  alt: string;
  width: number;
  height: number;
  blurDataURL?: string;
};

export type Money = {
  amount: number;
  currency: 'VND';
};

export type ProductSummary = {
  id: string;
  slug: string;
  name: string;
  category: { id: string; name: string; slug: string };
  image: ImageAsset;
  price: Money;
  unitLabel: string;
  packageSize: string;
  inStock: boolean;
  badge?: string;
  rating?: number;
  reviewCount?: number;
};

export type Product = ProductSummary & {
  gallery: ImageAsset[];
  sku: string;
  shortDescription: string;
  origin?: string;
  shelfLife?: string;
  ingredients?: RichText;
  usage?: RichText;
  specifications: Array<{ label: string; value: string }>;
  benefits: Array<{ icon: string; title: string; description: string }>;
  tierPrices: Array<{ min: number; max?: number; unitPrice: number; discountPercent?: number }>;
  seo: SeoFields;
};
```

## 3. Service
```ts
export type Service = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  icon: string;
  hero: { eyebrow?: string; heading: string; description: string; image: ImageAsset };
  productTypes: Array<{ title: string; description?: string; image?: ImageAsset }>;
  benefits: Feature[];
  process: ProcessStep[];
  certifications: Certification[];
  faqs: FAQ[];
  seo: SeoFields;
};
```

## 4. Article
```ts
export type Article = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: Taxonomy;
  tags: Taxonomy[];
  coverImage: ImageAsset;
  author: Author;
  publishedAt: string;
  updatedAt?: string;
  readingMinutes: number;
  content: RichText;
  featured?: boolean;
  seo: SeoFields;
};
```

## 5. Global settings
- Company name/legal name.
- Address.
- Hotline.
- Sales email.
- Website URL.
- Social URLs.
- Working hours.
- Header navigation.
- Footer navigation.
- CTA labels.
- Default SEO.
- Contact channels.
- Commerce enabled flag.

## 6. Quote request
```ts
export const quoteRequestSchema = z.object({
  fullName: z.string().min(2).max(100),
  phone: z.string().min(9).max(20),
  email: z.string().email(),
  company: z.string().max(160).optional(),
  jobTitle: z.string().max(100).optional(),
  services: z.array(z.string()).min(1),
  categoryId: z.string().optional(),
  productForm: z.string().optional(),
  productDescription: z.string().min(20).max(2000),
  monthlyVolume: z.string().optional(),
  targetLaunchDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
  consent: z.literal(true),
  honeypot: z.string().max(0).optional(),
});
```

## 7. API contracts

### `POST /api/quote-requests`
Request: multipart/form-data hoặc JSON + upload token.
Response success:
```json
{ "ok": true, "requestId": "GC-2026-000123", "message": "Đã tiếp nhận yêu cầu" }
```
Error:
```json
{ "ok": false, "code": "VALIDATION_ERROR", "fieldErrors": {} }
```

### Products
Nếu dùng headless CMS/database:
- `getProducts(filters, pagination)`.
- `getProductBySlug(slug)`.
- `getRelatedProducts(productId, categoryId)`.

## 8. CMS đề xuất

### Sanity
Phù hợp editorial, preview, image pipeline, GROQ. Tạo schemas: product, productCategory, service, article, articleCategory, page, FAQ, partner, certification, siteSettings.

### Strapi
Phù hợp nếu đội quen REST/GraphQL và cần self-host.

### Không CMS ở MVP
Dùng typed local content trong `src/content`, nhưng phải giữ interface/adapters để migrate.

## 9. Commerce data
- Cart item key = productId + variant/package if có.
- Giá server là nguồn sự thật; client không tự quyết định tổng tiền production.
- Tier price tính bằng hàm dùng chung server/client và có test.
- Inventory có thể hiển thị `inStock` đơn giản nếu chưa tích hợp ERP.

## 10. Seed content
Xem `config/content-seed.json`. Đây là nội dung demo để dựng giao diện, không phải thông tin pháp lý đã xác nhận.
