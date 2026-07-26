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
    slug: "say-thuc-pham-say",
    name: "Sấy & thực phẩm sấy",
    summary: "Nhóm dịch vụ sấy theo nhiều phương pháp chế biến.",
    description: "So sánh các hướng sấy để tìm phương pháp phù hợp với nguyên liệu và thành phẩm dự kiến.",
    offerings: [
      { href: "/dich-vu-say/", label: "Dịch vụ sấy" },
      { href: "/say-thang-hoa/", label: "Sấy thăng hoa" },
      { href: "/say-nong/", label: "Sấy nóng" },
      { href: "/say-lanh/", label: "Sấy lạnh" },
      { href: "/say-chan-khong/", label: "Sấy chân không" },
      { href: "/say-hong-ngoai/", label: "Sấy hồng ngoại" },
    ],
  },
] as const satisfies readonly ServiceFamily[];

export function getServiceFamily(slug: string): ServiceFamily | undefined {
  return serviceFamilies.find((family) => family.slug === slug);
}
