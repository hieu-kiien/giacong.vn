import type { Metadata } from "next";
import { headers } from "next/headers";

import { CapturedNewsFrame } from "@/components/CapturedNewsFrame";
import { ServiceLanding } from "@/components/services/ServiceLanding";
import { getManagedServiceFamilies } from "@/lib/cloudflare-services";
import { getServiceContentIndex } from "@/lib/service-content-index";
import { isStagingPreviewHost } from "@/lib/storefront-preview";
import { canonicalMetadata } from "@/lib/seo";
import { getPublishedSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublishedSiteSettings();
  return {
    ...canonicalMetadata("/thue-gia-cong/"),
    title: `Thuê gia công | ${settings.brand_name}`,
    description: `Các nhóm dịch vụ gia công và các trang dịch vụ chuyên biệt trên ${settings.brand_name}.`,
    icons: settings.favicon_url ? { icon: settings.favicon_url } : undefined,
  };
}

export default async function ServicePage() {
  const [families, requestHeaders] = await Promise.all([getManagedServiceFamilies(), headers()]);
  const contentIndex = getServiceContentIndex();
  const isStagingPreview = isStagingPreviewHost(requestHeaders.get("host"));

  return (
    <CapturedNewsFrame activePath="/thue-gia-cong" title="Thuê gia công">
      <ServiceLanding contentIndex={contentIndex} families={families} isStagingPreview={isStagingPreview} />
    </CapturedNewsFrame>
  );
}
