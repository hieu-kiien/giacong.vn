import type { Metadata } from "next";

import { CapturedNewsFrame } from "@/components/CapturedNewsFrame";
import { ServiceLanding } from "@/components/services/ServiceLanding";
import { serviceFamilies } from "@/data/service-families";
import { getManagedServiceImageMap } from "@/lib/cloudflare-services";

export const metadata: Metadata = {
  title: "Thuê gia công | Giacong.vn",
  description: "Mười ba nhóm dịch vụ gia công và các trang dịch vụ chuyên biệt trên Giacong.vn.",
};

export default async function ServicePage() {
  // Managed rows only ever add images (and later copy) on top of the static
  // taxonomy; an unavailable D1 keeps the icon fallback for every family.
  const imageMap = await getManagedServiceImageMap(serviceFamilies.map(({ slug }) => slug));
  const families = serviceFamilies.map((family) => (
    imageMap[family.slug] ? { ...family, imageUrl: imageMap[family.slug] } : family
  ));

  return (
    <CapturedNewsFrame activePath="/thue-gia-cong" title="Thuê gia công">
      <ServiceLanding families={families} />
    </CapturedNewsFrame>
  );
}
