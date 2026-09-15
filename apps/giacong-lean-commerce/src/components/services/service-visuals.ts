const DEFAULT_SERVICE_IMAGE = "/images/services/service-manufacturing.svg";

const SERVICE_IMAGE_BY_SLUG: Readonly<Record<string, string>> = {
  "gia-cong-sua": "/images/services/service-milk.svg",
  "say-thuc-pham-say": "/images/services/service-drying.svg",
  "gia-cong-dong-goi": "/images/services/service-packaging.svg",
};

export function getServiceFamilyImage(slug: string): string {
  return SERVICE_IMAGE_BY_SLUG[slug] ?? DEFAULT_SERVICE_IMAGE;
}
