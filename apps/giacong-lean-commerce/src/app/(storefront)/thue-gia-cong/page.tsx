import type { Metadata } from "next";

import { CapturedNewsFrame } from "@/components/CapturedNewsFrame";
import { ServiceLanding } from "@/components/services/ServiceLanding";

export const metadata: Metadata = {
  title: "Thuê gia công | Giacong.vn",
  description: "Mười ba nhóm dịch vụ gia công và các trang dịch vụ chuyên biệt trên Giacong.vn.",
};

export default function ServicePage() {
  return (
    <CapturedNewsFrame activePath="/thue-gia-cong" title="Thuê gia công">
      <ServiceLanding />
    </CapturedNewsFrame>
  );
}
