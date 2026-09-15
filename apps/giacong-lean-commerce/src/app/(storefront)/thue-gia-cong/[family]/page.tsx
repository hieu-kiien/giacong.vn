import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ServiceFamilyDetail } from "@/components/services/ServiceFamilyDetail";
import { CapturedStorefrontTabFrame } from "@/components/site/CapturedStorefrontTabFrame";
import { serviceFamilies } from "@/data/service-families";
import { getManagedServiceFamily, getManagedServiceRedirect } from "@/lib/cloudflare-services";
import { canonicalMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

interface ServiceFamilyPageProps { params: Promise<{ family: string }> }

export function generateStaticParams() { return serviceFamilies.map(({ slug }) => ({ family: slug })); }

export async function generateMetadata({ params }: ServiceFamilyPageProps): Promise<Metadata> {
  const requestedSlug = (await params).family;
  const redirectSlug = await getManagedServiceRedirect(requestedSlug);
  const family = await getManagedServiceFamily(redirectSlug ?? requestedSlug);
  if (!family) return {};
  return {
    ...canonicalMetadata(`/thue-gia-cong/${family.slug}/`),
    title: `${family.name} | Thuê gia công`,
    description: family.description,
  };
}

export default async function ServiceFamilyPage({ params }: ServiceFamilyPageProps) {
  const requestedSlug = (await params).family;
  const redirectSlug = await getManagedServiceRedirect(requestedSlug);
  if (redirectSlug) redirect(`/thue-gia-cong/${encodeURIComponent(redirectSlug)}/`);

  const family = await getManagedServiceFamily(requestedSlug);
  if (!family) notFound();

  return (
    <CapturedStorefrontTabFrame activePath="/thue-gia-cong">
      <ServiceFamilyDetail family={family} />
    </CapturedStorefrontTabFrame>
  );
}
