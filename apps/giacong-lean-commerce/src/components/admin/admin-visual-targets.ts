export interface AdminVisualDirectTarget {
  inputType: "multiline" | "text";
  key: string;
  label: string;
  selector: string;
}

/**
 * Targets the nodes rendered by the real captured storefront. The selectors
 * intentionally stay homepage-specific so a similarly named paragraph on a
 * different route cannot be edited by accident.
 */
export const homepageDirectTargets = [
  {
    inputType: "text",
    key: "brand_tagline",
    label: "Khẩu hiệu thương hiệu",
    selector: '[data-site-setting="brand_tagline"]',
  },
  {
    inputType: "text",
    key: "hero_eyebrow",
    label: "Dòng giới thiệu nhỏ",
    selector: "#section_250108065 h3",
  },
  {
    inputType: "text",
    key: "hero_title",
    label: "Tiêu đề chính",
    selector: "#section_250108065 h1.entry-title",
  },
  {
    inputType: "multiline",
    key: "hero_description",
    label: "Mô tả hero",
    selector: "#section_250108065 .section-content .col-inner > p:first-of-type",
  },
  {
    inputType: "text",
    key: "hero_primary_cta_label",
    label: "Nhãn nút chính",
    selector: "#section_250108065 a.nut-xem-them1 > span",
  },
  {
    inputType: "text",
    key: "hero_secondary_cta_label",
    label: "Nhãn nút phụ",
    selector: "#section_250108065 a.nut-xem-them2 > span",
  },
  {
    inputType: "text",
    key: "about_title",
    label: "Tiêu đề phần giới thiệu",
    selector: "#section_1437980462 h2",
  },
  {
    inputType: "multiline",
    key: "about_description",
    label: "Mô tả phần giới thiệu",
    selector: "#section_1437980462 h2 + p",
  },
] as const satisfies readonly AdminVisualDirectTarget[];

export function findAdminVisualTarget(
  root: ParentNode,
  target: AdminVisualDirectTarget,
): HTMLElement | null {
  const element = root.querySelector(target.selector);
  return element instanceof HTMLElement ? element : null;
}
