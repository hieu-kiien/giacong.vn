import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { ProductDetailPage } from "@/components/catalog/ProductDetailPage";
import { CapturedStorefrontTabFrame } from "@/components/site/CapturedStorefrontTabFrame";
import { legacyProductRedirects } from "@/lib/catalog-legacy-redirects";
import { loadCatalogProductDetail } from "@/lib/catalog-detail-source";
import {
  buildProductMetadata,
  buildProductStructuredData,
  serializeJsonLd,
} from "@/lib/product-seo";

type CatalogDetailPageProps = PageProps<"/san-pham/[slug]">;

export async function generateMetadata({ params }: CatalogDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  redirectLegacyProduct(slug);
  const source = await loadCatalogProductDetail(slug);
  if (!source) return { title: "Không tìm thấy sản phẩm | Giacong.vn" };
  return buildProductMetadata({ gallery: source.gallery, product: source.product });
}

export default async function CatalogDetailPage({ params, searchParams }: CatalogDetailPageProps) {
  const { slug } = await params;
  redirectLegacyProduct(slug);
  const source = await loadCatalogProductDetail(slug);
  if (!source) notFound();

  const requestedVariant = firstValue((await searchParams).variant);
  const requestedCartEdit = firstValue((await searchParams).editCart);
  const selectedVariant = source.product.variants.find((variant) => (
    variant.sku === requestedVariant && variant.isAvailable
  ));
  const editingCartVariantSku = source.product.variants.some((variant) => variant.sku === requestedCartEdit)
    ? requestedCartEdit
    : null;
  const structuredData = buildProductStructuredData({ gallery: source.gallery, product: source.product });

  return (
    <>
      <script
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
        type="application/ld+json"
      />
      <CapturedStorefrontTabFrame activePath="/san-pham">
        <ProductDetailPage
          initialVariantSku={selectedVariant?.sku ?? null}
          editingCartVariantSku={editingCartVariantSku}
          source={source}
          variantQueryWarning={Boolean(requestedVariant && !selectedVariant)}
        />
      </CapturedStorefrontTabFrame>
    </>
  );
}

function redirectLegacyProduct(slug: string) {
  const destination = legacyProductRedirects[slug];
  if (!destination) return;
  const query = new URLSearchParams({ variant: destination.variantSku });
  permanentRedirect(`/san-pham/${destination.parentSlug}/?${query}`);
}

function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}
