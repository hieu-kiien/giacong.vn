import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CatalogDetail } from "@/components/catalog/CatalogDetail";
import { getCatalogProduct } from "@/lib/bagisto-catalog";

export async function generateMetadata({ params }: PageProps<"/san-pham/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getCatalogProduct(slug);
  if (!product) return { title: "Không tìm thấy sản phẩm | Giacong.vn" };
  return { title: `${product.name} | Giacong.vn`, description: product.shortDescription || product.name };
}

export default async function CatalogDetailPage({ params }: PageProps<"/san-pham/[slug]">) {
  const { slug } = await params;
  const product = await getCatalogProduct(slug);
  if (!product) notFound();
  return <CatalogDetail product={product} />;
}
