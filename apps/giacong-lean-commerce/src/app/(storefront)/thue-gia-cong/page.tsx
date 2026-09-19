import type { Metadata } from "next";

import { CapturedNewsFrame } from "@/components/CapturedNewsFrame";
import { ServiceLanding } from "@/components/services/ServiceLanding";
import { getManagedServiceFamilies } from "@/lib/cloudflare-services";
import { getServiceContentIndex } from "@/lib/service-content-index";
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
  const families = await getManagedServiceFamilies();
  const contentIndex = getServiceContentIndex();

  return (
    <CapturedNewsFrame activePath="/thue-gia-cong" title="Thuê gia công">
      <ServiceLanding contentIndex={contentIndex} families={families} />
    </CapturedNewsFrame>
  );
}
