import type { Metadata } from "next";

import { CapturedNewsFrame } from "@/components/CapturedNewsFrame";
import { ServiceLanding } from "@/components/services/ServiceLanding";
import { getManagedServiceFamilies } from "@/lib/cloudflare-services";
import { getServiceContentIndex } from "@/lib/service-content-index";
import { canonicalMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  ...canonicalMetadata("/thue-gia-cong/"),
  title: "Thuê gia công | Giacong.vn",
  description: "Các nhóm dịch vụ gia công và các trang dịch vụ chuyên biệt trên Giacong.vn.",
};

export default async function ServicePage() {
  const families = await getManagedServiceFamilies();
  const contentIndex = getServiceContentIndex();

  return (
    <CapturedNewsFrame activePath="/thue-gia-cong" title="Thuê gia công">
      <ServiceLanding contentIndex={contentIndex} families={families} />
    </CapturedNewsFrame>
  );
}
