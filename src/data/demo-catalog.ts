/**
 * Demo catalog fixture for building the commerce UI.
 *
 * Isolated from the catalog adapter on purpose: it imports nothing from the
 * upstream client, and the adapter never reads it, so no demo row can leak into a
 * production response. The master plan permits demo content at this stage
 * (`docs/COMMERCE_PLATFORM_MASTER_PLAN.md` §3) provided it is clearly temporary —
 * taxonomy, SKUs, imagery and real prices are still **Chờ xác nhận**.
 *
 * Shapes are the same `CatalogProductDetail`/`CatalogCategory` contracts the
 * adapter returns, so UI built against this fixture works unchanged once the real
 * feed is approved. Names are generic Vietnamese ingredient and packaging terms —
 * no third-party brand appears.
 *
 * Covered on purpose, because the specifications need each case:
 *  - several product groups, for the mega-menu columns and sidebar counts;
 *  - products with one usable variant, which may be added directly;
 *  - products with several variants, which must ask for `Chọn quy cách`;
 *  - an unavailable variant, so unavailable states are designable;
 *  - tier-price bands on every variant, for the detail tier table.
 */
import type { CatalogCategory, CatalogProductDetail, CatalogProductParent } from "@/types/catalog";

/** Guard rail for callers and tests: this data is never production data. */
export const IS_DEMO_CATALOG_DATA = true;

/** Prefix marking every demo SKU, so demo rows are greppable and obvious in UI. */
export const DEMO_SKU_PREFIX = "B2B-DEMO";

export const DEMO_CATALOG_CATEGORIES: readonly CatalogCategory[] = [
  { id: 9101, name: "Bột và nguyên liệu khô", slug: "bot-nguyen-lieu-kho" },
  { id: 9102, name: "Trà và thảo mộc sấy", slug: "tra-thao-moc-say" },
  { id: 9103, name: "Sốt và gia vị lỏng", slug: "sot-gia-vi-long" },
  { id: 9104, name: "Bao bì và đóng gói", slug: "bao-bi-dong-goi" },
];

const CATEGORY_BY_SLUG = new Map(DEMO_CATALOG_CATEGORIES.map((category) => [category.slug, category]));

function category(slug: string): CatalogCategory {
  const found = CATEGORY_BY_SLUG.get(slug);
  if (!found) throw new Error(`Nhóm demo không tồn tại: ${slug}`);
  return found;
}

/**
 * Single-axis option group, which is the only variant shape the specifications
 * allow. `variantIndex` mirrors the adapter's lookup: option code → option id →
 * variant id.
 */
function singleAxis(
  attributeId: number,
  code: string,
  label: string,
  variants: CatalogProductDetail["variants"],
): Pick<CatalogProductDetail, "optionGroups" | "variantIndex"> {
  const options = variants.map((variant) => {
    const value = variant.optionValues[0];
    if (!value) throw new Error(`Biến thể demo thiếu quy cách: ${variant.sku}`);
    return { id: value.optionId, label: value.optionLabel, variantIds: [variant.id] };
  });

  return {
    optionGroups: [{ attributeId, code, label, options }],
    variantIndex: {
      [code]: Object.fromEntries(
        variants.map((variant) => [String(variant.optionValues[0]?.optionId), variant.id]),
      ),
    },
  };
}

interface DemoVariantInput {
  contactFrom: number;
  id: number;
  isAvailable?: boolean;
  moq: number;
  optionId: number;
  optionLabel: string;
  sku: string;
  step: number;
  tiers: Array<[minQuantity: number, price: number]>;
  unit: string;
}

function variants(
  attributeCode: string,
  attributeId: number,
  productName: string,
  input: readonly DemoVariantInput[],
): CatalogProductDetail["variants"] {
  return input.map((item) => ({
    contactFromQuantity: item.contactFrom,
    id: item.id,
    imageUrl: null,
    isAvailable: item.isAvailable ?? true,
    minimumOrderQuantity: item.moq,
    name: `${productName} — ${item.optionLabel}`,
    optionValues: [{
      attributeCode,
      attributeId,
      optionId: item.optionId,
      optionLabel: item.optionLabel,
    }],
    quantityStep: item.step,
    sku: item.sku,
    tierPrices: item.tiers.map(([minQuantity, price]) => ({ minQuantity, price })),
    unit: item.unit,
  }));
}

interface DemoProductInput {
  categorySlug: string;
  description: string;
  id: number;
  name: string;
  optionCode?: string;
  optionLabel?: string;
  shortDescription: string;
  slug: string;
  variants: readonly DemoVariantInput[];
}

/**
 * Builds a product from its variants: `startingPrice` is the lowest tier price of
 * an available variant and the counts are derived, exactly as the adapter derives
 * them. Nothing here is hand-maintained, so the fixture cannot drift internally.
 */
function product(input: DemoProductInput): CatalogProductDetail {
  const attributeId = 2_400 + (input.id % 100);
  const code = input.optionCode ?? "quy_cach";
  const built = variants(code, attributeId, input.name, input.variants);
  const available = built.filter((variant) => variant.isAvailable);
  const prices = (available.length > 0 ? available : built)
    .flatMap((variant) => variant.tierPrices.map((tier) => tier.price));

  return {
    availableVariantCount: available.length,
    category: category(input.categorySlug),
    description: input.description,
    id: input.id,
    imageUrl: null,
    name: input.name,
    shortDescription: input.shortDescription,
    sku: `${DEMO_SKU_PREFIX}-${input.slug.toUpperCase()}`,
    slug: input.slug,
    startingPrice: { currency: "VND", price: Math.min(...prices) },
    type: "configurable",
    variantCount: built.length,
    variants: built,
    ...singleAxis(attributeId, code, input.optionLabel ?? "Quy cách", built),
  };
}

export const DEMO_CATALOG_PRODUCTS: readonly CatalogProductDetail[] = [
  // Several variants → the card must ask for `Chọn quy cách`.
  product({
    categorySlug: "bot-nguyen-lieu-kho",
    description:
      "Bột gạo lứt xay mịn dùng cho bánh, thức uống dinh dưỡng và sản phẩm ngũ cốc. Đóng bao theo quy cách sản xuất, giao kèm phiếu kiểm nghiệm từng lô.",
    id: 71_001,
    name: "Bột gạo lứt xay mịn",
    shortDescription: "Bột gạo lứt mịn, ba quy cách bao công nghiệp.",
    slug: "bot-gao-lut-xay-min",
    variants: [
      {
        contactFrom: 500,
        id: 71_011,
        moq: 25,
        optionId: 5_101,
        optionLabel: "Bao 5 kg",
        sku: `${DEMO_SKU_PREFIX}-BGL-05`,
        step: 5,
        tiers: [[25, 78_000], [100, 74_500], [250, 71_000]],
        unit: "bao",
      },
      {
        contactFrom: 300,
        id: 71_012,
        moq: 10,
        optionId: 5_102,
        optionLabel: "Bao 10 kg",
        sku: `${DEMO_SKU_PREFIX}-BGL-10`,
        step: 5,
        tiers: [[10, 149_000], [60, 143_500], [150, 137_000]],
        unit: "bao",
      },
      {
        contactFrom: 120,
        id: 71_013,
        moq: 4,
        optionId: 5_103,
        optionLabel: "Bao 25 kg",
        sku: `${DEMO_SKU_PREFIX}-BGL-25`,
        step: 2,
        tiers: [[4, 358_000], [20, 344_000], [60, 330_000]],
        unit: "bao",
      },
    ],
  }),
  // One usable variant → direct add at the MOQ.
  product({
    categorySlug: "bot-nguyen-lieu-kho",
    description:
      "Tinh bột sắn biến tính dùng làm chất tạo đặc cho sốt, súp và thực phẩm đóng gói. Một quy cách bao tiêu chuẩn.",
    id: 71_002,
    name: "Tinh bột sắn biến tính",
    shortDescription: "Chất tạo đặc, bao tiêu chuẩn 25 kg.",
    slug: "tinh-bot-san-bien-tinh",
    variants: [{
      contactFrom: 200,
      id: 71_021,
      moq: 8,
      optionId: 5_111,
      optionLabel: "Bao 25 kg",
      sku: `${DEMO_SKU_PREFIX}-TBS-25`,
      step: 4,
      tiers: [[8, 296_000], [40, 285_000], [120, 272_000]],
      unit: "bao",
    }],
  }),
  product({
    categorySlug: "bot-nguyen-lieu-kho",
    description:
      "Bột đậu nành rang tách vỏ, độ mịn ổn định giữa các lô, dùng cho sữa hạt và bột dinh dưỡng.",
    id: 71_003,
    name: "Bột đậu nành rang",
    shortDescription: "Bột đậu nành rang, hai quy cách bao.",
    slug: "bot-dau-nanh-rang",
    variants: [
      {
        contactFrom: 400,
        id: 71_031,
        moq: 20,
        optionId: 5_121,
        optionLabel: "Bao 5 kg",
        sku: `${DEMO_SKU_PREFIX}-BDN-05`,
        step: 5,
        tiers: [[20, 92_000], [80, 88_500], [200, 84_000]],
        unit: "bao",
      },
      {
        contactFrom: 150,
        id: 71_032,
        moq: 6,
        optionId: 5_122,
        optionLabel: "Bao 20 kg",
        sku: `${DEMO_SKU_PREFIX}-BDN-20`,
        step: 3,
        tiers: [[6, 349_000], [30, 336_000], [90, 322_000]],
        unit: "bao",
      },
    ],
  }),
  product({
    categorySlug: "tra-thao-moc-say",
    description:
      "Hoa cúc sấy nguyên bông, giữ màu và hương tự nhiên, dùng cho trà túi lọc và trà đóng chai.",
    id: 71_004,
    name: "Hoa cúc sấy nguyên bông",
    shortDescription: "Hoa cúc sấy, hai quy cách thùng.",
    slug: "hoa-cuc-say-nguyen-bong",
    variants: [
      {
        contactFrom: 90,
        id: 71_041,
        moq: 5,
        optionId: 5_131,
        optionLabel: "Thùng 2 kg",
        sku: `${DEMO_SKU_PREFIX}-HCS-02`,
        step: 1,
        tiers: [[5, 615_000], [25, 592_000], [60, 568_000]],
        unit: "thùng",
      },
      {
        contactFrom: 60,
        id: 71_042,
        moq: 2,
        optionId: 5_132,
        optionLabel: "Thùng 5 kg",
        sku: `${DEMO_SKU_PREFIX}-HCS-05`,
        step: 1,
        tiers: [[2, 1_485_000], [12, 1_432_000], [36, 1_378_000]],
        unit: "thùng",
      },
    ],
  }),
  product({
    categorySlug: "tra-thao-moc-say",
    description:
      "Lá tía tô sấy lạnh, giữ tinh dầu và màu lá, dùng cho trà thảo mộc và bột uống hòa tan.",
    id: 71_005,
    name: "Lá tía tô sấy lạnh",
    shortDescription: "Lá tía tô sấy lạnh, một quy cách thùng.",
    slug: "la-tia-to-say-lanh",
    variants: [{
      contactFrom: 80,
      id: 71_051,
      moq: 3,
      optionId: 5_141,
      optionLabel: "Thùng 3 kg",
      sku: `${DEMO_SKU_PREFIX}-LTT-03`,
      step: 1,
      tiers: [[3, 742_000], [18, 715_000], [45, 688_000]],
      unit: "thùng",
    }],
  }),
  product({
    categorySlug: "sot-gia-vi-long",
    description:
      "Sốt me chua ngọt pha sẵn theo công thức tiêu chuẩn, dùng cho bếp công nghiệp và sản phẩm đóng gói.",
    id: 71_006,
    name: "Sốt me chua ngọt",
    shortDescription: "Sốt me pha sẵn, ba quy cách can.",
    slug: "sot-me-chua-ngot",
    variants: [
      {
        contactFrom: 260,
        id: 71_061,
        moq: 12,
        optionId: 5_151,
        optionLabel: "Can 2 lít",
        sku: `${DEMO_SKU_PREFIX}-SME-02`,
        step: 6,
        tiers: [[12, 118_000], [60, 113_000], [180, 108_500]],
        unit: "can",
      },
      {
        contactFrom: 150,
        id: 71_062,
        moq: 6,
        optionId: 5_152,
        optionLabel: "Can 5 lít",
        sku: `${DEMO_SKU_PREFIX}-SME-05`,
        step: 3,
        tiers: [[6, 278_000], [30, 267_000], [90, 256_000]],
        unit: "can",
      },
      {
        contactFrom: 80,
        id: 71_063,
        moq: 2,
        optionId: 5_153,
        optionLabel: "Can 20 lít",
        sku: `${DEMO_SKU_PREFIX}-SME-20`,
        step: 1,
        tiers: [[2, 1_068_000], [10, 1_029_000], [30, 986_000]],
        unit: "can",
      },
    ],
  }),
  // Available and unavailable variants together, so unavailable states are designable.
  product({
    categorySlug: "sot-gia-vi-long",
    description:
      "Nước mắm cốt pha loãng theo độ đạm đặt trước. Quy cách can 30 lít tạm hết hàng trong giai đoạn demo.",
    id: 71_007,
    name: "Nước mắm cốt pha loãng",
    shortDescription: "Nước mắm cốt, một quy cách đang cung cấp.",
    slug: "nuoc-mam-cot-pha-loang",
    variants: [
      {
        contactFrom: 140,
        id: 71_071,
        moq: 6,
        optionId: 5_161,
        optionLabel: "Can 10 lít",
        sku: `${DEMO_SKU_PREFIX}-NMC-10`,
        step: 3,
        tiers: [[6, 412_000], [30, 397_000], [90, 381_000]],
        unit: "can",
      },
      {
        contactFrom: 70,
        id: 71_072,
        isAvailable: false,
        moq: 2,
        optionId: 5_162,
        optionLabel: "Can 30 lít",
        sku: `${DEMO_SKU_PREFIX}-NMC-30`,
        step: 1,
        tiers: [[2, 1_186_000], [10, 1_142_000], [30, 1_098_000]],
        unit: "can",
      },
    ],
  }),
  product({
    categorySlug: "bao-bi-dong-goi",
    description:
      "Túi zipper tráng nhôm, in theo yêu cầu, dùng cho bột và thực phẩm sấy. Đóng theo thùng nghìn túi.",
    id: 71_008,
    name: "Túi zipper tráng nhôm",
    shortDescription: "Túi zipper tráng nhôm, hai kích cỡ.",
    slug: "tui-zipper-trang-nhom",
    optionLabel: "Kích cỡ",
    variants: [
      {
        contactFrom: 120,
        id: 71_081,
        moq: 5,
        optionId: 5_171,
        optionLabel: "100 × 150 mm",
        sku: `${DEMO_SKU_PREFIX}-TZN-100`,
        step: 5,
        tiers: [[5, 845_000], [25, 812_000], [75, 778_000]],
        unit: "thùng",
      },
      {
        contactFrom: 90,
        id: 71_082,
        moq: 5,
        optionId: 5_172,
        optionLabel: "160 × 240 mm",
        sku: `${DEMO_SKU_PREFIX}-TZN-160`,
        step: 5,
        tiers: [[5, 1_284_000], [25, 1_238_000], [75, 1_186_000]],
        unit: "thùng",
      },
    ],
  }),
  product({
    categorySlug: "bao-bi-dong-goi",
    description:
      "Thùng carton 5 lớp in một màu, chịu tải cho hàng bột và hàng lỏng đóng can.",
    id: 71_009,
    name: "Thùng carton 5 lớp",
    shortDescription: "Thùng carton 5 lớp, một quy cách kiện.",
    slug: "thung-carton-5-lop",
    variants: [{
      contactFrom: 200,
      id: 71_091,
      moq: 10,
      optionId: 5_181,
      optionLabel: "Kiện 50 thùng",
      sku: `${DEMO_SKU_PREFIX}-TC5-50`,
      step: 5,
      tiers: [[10, 685_000], [50, 658_000], [150, 632_000]],
      unit: "kiện",
    }],
  }),
];

/**
 * Product-list projection: the parent fields only, as the list endpoint returns.
 *
 * Written out field by field rather than by dropping the detail keys with a rest
 * pattern, so that adding a field to `CatalogProductParent` is a type error here
 * instead of silently widening what the list is allowed to render.
 */
export const DEMO_CATALOG_LIST: readonly CatalogProductParent[] = DEMO_CATALOG_PRODUCTS.map(
  (product) => ({
    availableVariantCount: product.availableVariantCount,
    category: product.category,
    description: product.description,
    id: product.id,
    imageUrl: product.imageUrl,
    name: product.name,
    shortDescription: product.shortDescription,
    sku: product.sku,
    slug: product.slug,
    startingPrice: product.startingPrice,
    type: product.type,
    variantCount: product.variantCount,
  }),
);

export function findDemoCatalogProduct(slug: string): CatalogProductDetail | null {
  return DEMO_CATALOG_PRODUCTS.find((item) => item.slug === slug) ?? null;
}

export function demoCatalogProductsByCategory(categorySlug: string): readonly CatalogProductDetail[] {
  return DEMO_CATALOG_PRODUCTS.filter((item) => item.category?.slug === categorySlug);
}

/** Category counts for the sidebar and mega-menu columns. */
export function demoCatalogCategoryCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const category of DEMO_CATALOG_CATEGORIES) counts[category.slug] = 0;
  for (const item of DEMO_CATALOG_PRODUCTS) {
    if (item.category) counts[item.category.slug] += 1;
  }
  return counts;
}
