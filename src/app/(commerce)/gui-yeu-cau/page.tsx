import type { Metadata } from "next";

import { RequestCartView } from "@/components/request-cart/RequestCartView";

export const metadata: Metadata = {
  title: "Giỏ yêu cầu đặt hàng | Giacong.vn",
  description: "Xem lại các mặt hàng đã chọn và gửi yêu cầu đặt hàng để được liên hệ báo giá.",
};

export default function RequestCartPage() {
  return <RequestCartView />;
}
