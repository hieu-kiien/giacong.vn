export type LegacyMegaMenuOwner = "products" | "services";

export interface LegacyMegaMenuItem {
  id: string;
  owner: LegacyMegaMenuOwner;
  label: string;
  href: string;
  sortOrder: number;
  isPlaceholder: boolean;
}

const placeholderHrefs = new Set(["#", "/", "/Hoa quả sấy"]);

const productMegaMenuLinks = [] as const;

const serviceMegaMenuLinks = [
  { href: "/gia-cong-sua-bot/", label: "Gia công sữa bột" },
  { href: "/say-thang-hoa/", label: "Sấy thăng hoa" },
  { href: "/say-lanh/", label: "Sấy lạnh" },
  { href: "/say-chan-khong/", label: "Sấy chân không" },
  { href: "/say-nong/", label: "Sấy nóng" },
  { href: "/say-hong-ngoai/", label: "Sấy hồng ngoại" },
  { href: "/gia-cong-sua-hat/", label: "Gia công sữa hạt" },
  { href: "/gia-cong-sua-thuc-vat/", label: "Gia công sữa thực vật" },
  { href: "/gia-cong-nuoc-ep-trai-cay/", label: "Gia công nước ép trái cây" },
  { href: "/gia-cong-nuoc-giai-khat-co-ga/", label: "Gia công nước giải khát" },
  { href: "/gia-cong-tra-dong-chai/", label: "Gia công trà đóng chai" },
  { href: "/gia-cong-nuoc-uong-dong-chai/", label: "Gia công nước lọc" },
  { href: "/gia-cong-ca-phe-qua-tang/", label: "Gia công cà phê quà tặng" },
  { href: "/gia-cong-ca-phe-hoa-tan/", label: "Gia công cà phê hòa tan" },
  { href: "/gia-cong-tra-tui-loc/", label: "Gia công trà túi lọc" },
  { href: "/rang-gia-cong-ca-phe/", label: "Gia công rang cà phê" },
  { href: "/gia-cong-sua-tuoi/", label: "Gia công sữa tươi" },
  { href: "/gia-cong-sot-cham/", label: "Gia công sốt chấm" },
  { href: "/gia-cong-do-uong/", label: "Gia công đồ uống" },
  { href: "/gia-cong-bot-pha-che/", label: "Gia công bột pha chế" },
  { href: "/gia-cong-duoc-lieu/", label: "Gia công dược liệu" },
  { href: "/gia-cong-thuc-pham/", label: "Gia công thực phẩm" },
  { href: "/gia-cong-my-pham/", label: "Gia công mỹ phẩm" },
  { href: "/gia-cong-tra/", label: "Gia công trà" },
  { href: "/gia-cong-ca-phe/", label: "Gia công cà phê" },
  { href: "/gia-cong-bot/", label: "Gia công bột" },
  { href: "/gia-cong-ruou/", label: "Gia công rượu" },
  { href: "/gia-cong-sua/", label: "Gia công sữa" },
  { href: "/bot-gia-vi/", label: "Gia công bột gia vị" },
  { href: "/thuc-pham-chuc-nang/", label: "Thực phẩm chức năng" },
  { href: "/dich-vu-say/", label: "Dịch vụ sấy" },
  { href: "/gia-cong-dong-goi/", label: "Gia công đóng gói" },
] as const;

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildLegacyMegaMenuItems(
  owner: LegacyMegaMenuOwner,
  links: readonly Readonly<{ href: string; label: string }>[],
): LegacyMegaMenuItem[] {
  const seen = new Map<string, number>();
  return links.map((link, index) => {
    const baseId = `${owner}-${slugify(link.label)}`;
    const occurrence = seen.get(baseId) ?? 0;
    seen.set(baseId, occurrence + 1);
    return {
      id: occurrence === 0 ? baseId : `${baseId}-${occurrence + 1}`,
      owner,
      label: link.label,
      href: link.href,
      sortOrder: (index + 1) * 10,
      isPlaceholder: placeholderHrefs.has(link.href),
    };
  });
}

export const legacyMegaMenuItems: readonly LegacyMegaMenuItem[] = [
  ...buildLegacyMegaMenuItems("products", productMegaMenuLinks),
  ...buildLegacyMegaMenuItems("services", serviceMegaMenuLinks),
];

const legacyMegaMenuItemsById = new Map(legacyMegaMenuItems.map((item) => [item.id, item]));

export function getLegacyMegaMenuItem(id: string | null | undefined): LegacyMegaMenuItem | undefined {
  return id ? legacyMegaMenuItemsById.get(id) : undefined;
}

export function getLegacyMegaMenuItemId(
  owner: LegacyMegaMenuOwner,
  label: string,
  href: string,
): string | null {
  return legacyMegaMenuItems.find((item) => item.owner === owner && item.label === label && item.href === href)?.id ?? null;
}
