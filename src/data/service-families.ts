export interface ServiceOffering {
  href: string;
  label: string;
}

export interface ServiceFamily {
  slug: string;
  name: string;
  summary: string;
  description: string;
  offerings: readonly ServiceOffering[];
}

export const serviceFamilies = [
  {
    slug: "do-uong-sua",
    name: "Đồ uống & sữa",
    summary: "Các hướng gia công đồ uống, sữa và sản phẩm đóng chai.",
    description: "Khám phá các dịch vụ gia công theo nhóm đồ uống và sữa để chọn đúng hướng trao đổi cho sản phẩm của bạn.",
    offerings: [
      { href: "/gia-cong-do-uong/", label: "Gia công đồ uống" },
      { href: "/gia-cong-sua/", label: "Gia công sữa" },
      { href: "/gia-cong-sua-bot/", label: "Gia công sữa bột" },
      { href: "/gia-cong-sua-tuoi/", label: "Gia công sữa tươi" },
      { href: "/gia-cong-sua-hat/", label: "Gia công sữa hạt" },
      { href: "/gia-cong-sua-thuc-vat/", label: "Gia công sữa thực vật" },
      { href: "/gia-cong-sua-chua/", label: "Gia công sữa chua" },
      { href: "/gia-cong-nuoc-ep-trai-cay/", label: "Gia công nước ép trái cây" },
      { href: "/gia-cong-nuoc-giai-khat-co-ga/", label: "Gia công nước giải khát có ga" },
      { href: "/gia-cong-tra-dong-chai/", label: "Gia công trà đóng chai" },
      { href: "/gia-cong-nuoc-uong-dong-chai/", label: "Gia công nước uống đóng chai" },
      { href: "/gia-cong-ruou/", label: "Gia công rượu" },
    ],
  },
  {
    slug: "say-thuc-pham-say",
    name: "Sấy & thực phẩm sấy",
    summary: "Nhóm dịch vụ sấy theo nhiều phương pháp chế biến.",
    description: "So sánh các hướng sấy đang có nội dung chuyên biệt để tìm phương pháp phù hợp với nguyên liệu và thành phẩm dự kiến.",
    offerings: [
      { href: "/dich-vu-say/", label: "Dịch vụ sấy" },
      { href: "/say-thang-hoa/", label: "Sấy thăng hoa" },
      { href: "/say-nong/", label: "Sấy nóng" },
      { href: "/say-lanh/", label: "Sấy lạnh" },
      { href: "/say-chan-khong/", label: "Sấy chân không" },
      { href: "/say-hong-ngoai/", label: "Sấy hồng ngoại" },
    ],
  },
  {
    slug: "thuc-pham-bot-gia-vi",
    name: "Thực phẩm, bột & gia vị",
    summary: "Gia công thực phẩm, bột, bột pha chế và sốt chấm.",
    description: "Các dịch vụ trong nhóm hỗ trợ định hướng từ thực phẩm chế biến đến sản phẩm dạng bột, gia vị và sốt.",
    offerings: [
      { href: "/gia-cong-thuc-pham/", label: "Gia công thực phẩm" },
      { href: "/thuc-pham-chuc-nang/", label: "Thực phẩm chức năng" },
      { href: "/bot-gia-vi/", label: "Bột gia vị" },
      { href: "/gia-cong-bot/", label: "Gia công bột" },
      { href: "/gia-cong-bot-pha-che/", label: "Gia công bột pha chế" },
      { href: "/gia-cong-sot-cham/", label: "Gia công sốt chấm" },
    ],
  },
  {
    slug: "tra-ca-phe-duoc-lieu",
    name: "Trà, cà phê & dược liệu",
    summary: "Các hướng chế biến trà, cà phê và dược liệu.",
    description: "Đi đến nội dung chuyên biệt cho trà, cà phê, rang xay, sản phẩm hòa tan và dược liệu.",
    offerings: [
      { href: "/gia-cong-tra/", label: "Gia công trà" },
      { href: "/gia-cong-ca-phe/", label: "Gia công cà phê" },
      { href: "/gia-cong-duoc-lieu/", label: "Gia công dược liệu" },
      { href: "/rang-gia-cong-ca-phe/", label: "Rang gia công cà phê" },
      { href: "/gia-cong-ca-phe-hoa-tan/", label: "Gia công cà phê hòa tan" },
      { href: "/gia-cong-ca-phe-qua-tang/", label: "Gia công cà phê quà tặng" },
      { href: "/gia-cong-tra-tui-loc/", label: "Gia công trà túi lọc" },
    ],
  },
  {
    slug: "my-pham-cham-soc-ca-nhan",
    name: "Mỹ phẩm & chăm sóc cá nhân",
    summary: "Điểm bắt đầu cho nhu cầu gia công mỹ phẩm.",
    description: "Tìm hiểu nội dung gia công mỹ phẩm hiện có và gửi yêu cầu để trao đổi phạm vi sản phẩm cụ thể.",
    offerings: [{ href: "/gia-cong-my-pham/", label: "Gia công mỹ phẩm" }],
  },
  {
    slug: "dong-goi-hoan-thien",
    name: "Đóng gói & hoàn thiện",
    summary: "Các hình thức đóng gói từ bao lớn đến gói nhỏ và viên.",
    description: "Chọn nhóm đóng gói phù hợp với dạng thành phẩm để đi đến nội dung dịch vụ đã được xác minh.",
    offerings: [
      { href: "/gia-cong-dong-goi/", label: "Gia công đóng gói" },
      { href: "/dich-vu-dong-goi-bao-jumbo/", label: "Đóng gói bao jumbo" },
      { href: "/dich-vu-dong-goi-bot-hoa-tan/", label: "Đóng gói bột hòa tan" },
      { href: "/dich-vu-dong-goi-dang-long-goi-nho/", label: "Đóng gói dạng lỏng gói nhỏ" },
      { href: "/dich-vu-dong-goi-dang-ong-stick/", label: "Đóng gói dạng ống stick" },
      { href: "/dich-vu-dong-goi-vien-nen-vien-nang/", label: "Đóng gói viên nén, viên nang" },
    ],
  },
] as const satisfies readonly ServiceFamily[];

export function getServiceFamily(slug: string): ServiceFamily | undefined {
  return serviceFamilies.find((family) => family.slug === slug);
}
