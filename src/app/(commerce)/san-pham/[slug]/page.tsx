import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { ProductDetailPage } from "@/components/catalog/ProductDetailPage";
import { legacyProductRedirects } from "@/lib/catalog-legacy-redirects";
import { loadCatalogProductDetail } from "@/lib/catalog-detail-source";

type CatalogDetailPageProps = PageProps<"/san-pham/[slug]">;

export async function generateMetadata({ params }: CatalogDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  redirectLegacyProduct(slug);
  const source = await loadCatalogProductDetail(slug);
  if (!source) return { title: "Không tìm thấy sản phẩm | Giacong.vn" };
  const { product } = source;
  return { title: `${product.name} | Giacong.vn`, description: product.shortDescription || product.name };
}

export default async function CatalogDetailPage({ params, searchParams }: CatalogDetailPageProps) {
  const { slug } = await params;
  redirectLegacyProduct(slug);
  const source = await loadCatalogProductDetail(slug);
  if (!source) notFound();

  // A `?variant=` link only preselects a variant that is actually usable; anything
  // else falls back to the default selection and says so.
  const requestedVariant = firstValue((await searchParams).variant);
  const selectedVariant = source.product.variants.find((variant) => (
    variant.sku === requestedVariant && variant.isAvailable
  ));

  return (
    <ProductDetailPage
      initialVariantSku={selectedVariant?.sku ?? null}
      source={source}
      variantQueryWarning={Boolean(requestedVariant && !selectedVariant)}
    />
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
