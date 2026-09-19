import type { Metadata } from "next";
import Link from "next/link";

import { CapturedStorefrontShell } from "@/components/site/CapturedStorefrontShell";
import { canonicalMetadata, noIndexMetadata } from "@/lib/seo";
import { getPublishedSiteSettings } from "@/lib/site-settings";

export type PolicyKey =
  | "privacy"
  | "terms"
  | "payment"
  | "shipping"
  | "returns"
  | "purchase-process";

interface PolicyDefinition {
  description: string;
  path: string;
  sections: string[];
  title: string;
}

const policyDefinitions: Record<PolicyKey, PolicyDefinition> = {
  privacy: {
    description: "Bản nháp chính sách bảo mật cho quy trình tiếp nhận yêu cầu báo giá B2B.",
    path: "/chinh-sach-bao-mat/",
    sections: [
      "Xác nhận loại thông tin được thu thập từ biểu mẫu yêu cầu báo giá và mục đích sử dụng.",
      "Xác nhận nơi lưu trữ, thời gian lưu giữ và người được phép xử lý thông tin.",
      "Bổ sung đầu mối để khách yêu cầu xem, sửa hoặc xử lý thông tin đã gửi.",
    ],
    title: "Chính sách bảo mật",
  },
  terms: {
    description: "Bản nháp điều khoản sử dụng cho website catalogue và yêu cầu báo giá B2B.",
    path: "/dieu-khoan-su-dung/",
    sections: [
      "Xác nhận website là catalogue và kênh tiếp nhận yêu cầu, không phải quy trình thanh toán trực tuyến tự động.",
      "Nêu rõ điều kiện sử dụng nội dung, hình ảnh, tài liệu và thông tin giá tham khảo nếu có.",
      "Bổ sung thông tin pháp nhân và đầu mối chịu trách nhiệm trước khi công bố chính thức.",
    ],
    title: "Điều khoản sử dụng",
  },
  payment: {
    description: "Bản nháp chính sách thanh toán theo thỏa thuận trong quy trình B2B.",
    path: "/chinh-sach-thanh-toan/",
    sections: [
      "Xác nhận thời điểm phát sinh nghĩa vụ thanh toán: sau khi doanh nghiệp xác nhận báo giá và điều kiện giao dịch.",
      "Bổ sung phương thức nhận tiền, thông tin xuất hóa đơn và các điều kiện đối soát thực tế.",
      "Không sử dụng trang này để tạo cảm giác website đã thanh toán hoặc chốt đơn tự động.",
    ],
    title: "Chính sách thanh toán",
  },
  shipping: {
    description: "Bản nháp chính sách vận chuyển và giao nhận cho yêu cầu mua hàng B2B.",
    path: "/chinh-sach-van-chuyen/",
    sections: [
      "Xác nhận khu vực giao hàng, cách tính phí và thời gian giao theo từng sản phẩm hoặc báo giá.",
      "Bổ sung trách nhiệm kiểm đếm, biên bản giao nhận và xử lý khi hàng hóa có vấn đề.",
      "Không cam kết thời gian hoặc phí vận chuyển khi chưa có dữ liệu vận hành được chủ website duyệt.",
    ],
    title: "Chính sách vận chuyển / giao nhận",
  },
  returns: {
    description: "Bản nháp quy trình đổi trả và xử lý khiếu nại cho giao dịch B2B.",
    path: "/chinh-sach-doi-tra/",
    sections: [
      "Xác nhận cách tiếp nhận khiếu nại về sai SKU, thiếu số lượng, sai quy cách, bao bì hoặc chất lượng.",
      "Bổ sung thời hạn thông báo, hồ sơ cần cung cấp và cách kiểm tra lô hàng/specification.",
      "Không áp dụng điều khoản bán lẻ hoặc cam kết đổi trả khi chưa có quy định thực tế của doanh nghiệp.",
    ],
    title: "Đổi trả và xử lý khiếu nại",
  },
  "purchase-process": {
    description: "Quy trình mua hàng B2B từ catalogue đến báo giá và giao hàng.",
    path: "/quy-trinh-mua-hang/",
    sections: [
      "Chọn sản phẩm, kiểm tra SKU, quy cách, MOQ và điều kiện giá theo số lượng.",
      "Thêm một hoặc nhiều SKU vào giỏ yêu cầu, sau đó gửi thông tin liên hệ và địa điểm giao hàng.",
      "Doanh nghiệp xác nhận tồn kho, VAT, vận chuyển và giá cuối trước khi hai bên xác nhận giao dịch.",
    ],
    title: "Quy trình mua hàng B2B",
  },
};

export async function policyMetadata(key: PolicyKey): Promise<Metadata> {
  const policy = policyDefinitions[key];
  const settings = await getPublishedSiteSettings();
  return {
    ...canonicalMetadata(policy.path),
    ...noIndexMetadata(),
    description: policy.description,
    icons: settings.favicon_url ? { icon: settings.favicon_url } : undefined,
    title: `${policy.title} | ${settings.brand_name}`,
  };
}

export function PolicyPage({ policyKey }: { policyKey: PolicyKey }) {
  const policy = policyDefinitions[policyKey];
  return (
    <CapturedStorefrontShell>
      <main id="main">
        <div className="page-wrapper" id="content">
          <div className="row align-center">
            <div className="large-10 col">
              <nav aria-label="Breadcrumb" className="rank-math-breadcrumb" data-motion-section="policy-breadcrumb" style={{ paddingTop: 30 }}>
                <p><Link href="/">Trang chủ</Link><span className="separator"> » </span><span className="last">{policy.title}</span></p>
              </nav>
              <article className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm sm:p-8" data-motion-section="policy-content">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-commerce-brand-dark">Tài liệu cần xác nhận</p>
                <h1 className="mt-2 text-3xl font-bold text-commerce-primary">{policy.title}</h1>
                <p className="mt-3 text-base leading-7 text-commerce-secondary">{policy.description}</p>
                <div className="mt-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950" role="note">
                  Đây là khung nội dung quản trị để tránh công bố điều khoản chưa được chủ website duyệt. Vui lòng xác nhận và bổ sung thông tin thực tế trước khi bật lập chỉ mục hoặc dùng làm căn cứ giao dịch.
                </div>
                <h2 className="mt-8 text-xl font-bold text-commerce-primary">Nội dung cần hoàn thiện</h2>
                <ol className="mt-3 grid gap-3 pl-5 text-commerce-secondary">
                  {policy.sections.map((section) => <li key={section} className="leading-7">{section}</li>)}
                </ol>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link className="inline-flex min-h-11! items-center rounded-md bg-commerce-brand px-5 font-semibold text-white!" href="/san-pham/">Xem sản phẩm</Link>
                  <Link className="inline-flex min-h-11! items-center rounded-md border border-commerce-border px-5 font-semibold text-commerce-primary!" href="/lien-he/">Liên hệ</Link>
                </div>
              </article>
            </div>
          </div>
        </div>
      </main>
    </CapturedStorefrontShell>
  );
}
