import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { CatalogDetail } from "@/components/catalog/CatalogDetail";
import { getCatalogProduct } from "@/lib/bagisto-catalog";
import { legacyProductRedirects } from "@/lib/catalog-legacy-redirects";

type CatalogDetailPageProps = PageProps<"/san-pham/[slug]">;

export async function generateMetadata({ params }: CatalogDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  redirectLegacyProduct(slug);
  const product = await getCatalogProduct(slug);
  if (!product) return { title: "Không tìm thấy sản phẩm | Giacong.vn" };
  return { title: `${product.name} | Giacong.vn`, description: product.shortDescription || product.name };
}

export default async function CatalogDetailPage({ params, searchParams }: CatalogDetailPageProps) {
  const { slug } = await params;
  redirectLegacyProduct(slug);
  const product = await getCatalogProduct(slug);
  if (!product) notFound();
  const requestedVariant = firstValue((await searchParams).variant);
  const selectedVariant = product.variants.find((variant) => (
    variant.sku === requestedVariant && variant.isAvailable
  ));
  return (
    <CatalogDetail
      initialVariantSku={selectedVariant?.sku ?? null}
      product={product}
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
