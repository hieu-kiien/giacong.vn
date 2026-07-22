import type { Metadata } from "next";

import { ServiceLanding } from "@/components/services/ServiceLanding";

export const metadata: Metadata = {
  title: "Thuê gia công | Giacong.vn",
  description: "Khám phá sáu nhóm dịch vụ gia công và các trang dịch vụ chuyên biệt trên Giacong.vn.",
};

export default function ServicePage() { return <ServiceLanding />; }
