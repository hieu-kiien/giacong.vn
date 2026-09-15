import manifest from "../data/pages/manifest.json" with { type: "json" };
import { serviceFamilies, type ServiceOffering } from "../data/service-families.ts";

const serviceRoutePattern = /^\/(?:dich-vu-|gia-cong-|say-|sua-|tra-|bot-gia-vi\/|thuc-pham-chuc-nang\/)/;
const paginationRoutePattern = /\/page\/\d+\/$/;

const knownLabels = new Map<string, string>([
  ...serviceFamilies.map((family) => [family.hubHref, family.name] as [string, string]),
  ...serviceFamilies.flatMap((family) => family.offerings.map((offering) => [offering.href, offering.label] as [string, string])),
]);

/** Resolve a captured service URL to the canonical family used by contact intake. */
export function getServiceFamilyForRoute(routePath: string) {
  const normalizedRoute = `/${routePath.replace(/^\/+|\/+$/g, "")}/`;
  const exact = serviceFamilies.find((family) => (
    family.hubHref === normalizedRoute || family.offerings.some((offering) => offering.href === normalizedRoute)
  ));
  if (exact) return exact;

  const slug = normalizedRoute.slice(1, -1);
  if (slug === "bot-gia-vi" || slug.startsWith("gia-cong-bot-")) {
    return slug === "gia-cong-bot-pha-che" ? serviceFamilies.find((family) => family.slug === slug) : serviceFamilies.find((family) => family.slug === "gia-cong-bot");
  }
  if (slug.startsWith("dich-vu-dong-goi-")) return serviceFamilies.find((family) => family.slug === "gia-cong-dong-goi");
  if (slug.startsWith("dich-vu-say-") || slug.startsWith("say-")) return serviceFamilies.find((family) => family.slug === "say-thuc-pham-say");
  if (slug.startsWith("sua-")) return serviceFamilies.find((family) => family.slug === "gia-cong-sua");
  if (slug.startsWith("tra-")) return serviceFamilies.find((family) => family.slug === "gia-cong-tra");
  if (slug.startsWith("rang-gia-cong-ca-phe") || slug.startsWith("gia-cong-ca-phe-")) return serviceFamilies.find((family) => family.slug === "gia-cong-ca-phe");
  if (slug.startsWith("gia-cong-ruou-")) return serviceFamilies.find((family) => family.slug === "gia-cong-ruou");
  if (slug.startsWith("gia-cong-my-pham-")) return serviceFamilies.find((family) => family.slug === "gia-cong-my-pham");
  if (slug.startsWith("gia-cong-sot-")) return serviceFamilies.find((family) => family.slug === "gia-cong-sot-cham");
  if (slug.startsWith("gia-cong-do-uong-") || slug.startsWith("gia-cong-nuoc-")) return serviceFamilies.find((family) => family.slug === "gia-cong-do-uong");
  if (slug.startsWith("gia-cong-dong-goi-")) return serviceFamilies.find((family) => family.slug === "gia-cong-dong-goi");
  if (slug.startsWith("gia-cong-thuc-pham-")) return serviceFamilies.find((family) => family.slug === "gia-cong-thuc-pham");
  return undefined;
}

const wordLabels: Record<string, string> = {
  an: "ăn",
  atiso: "atisô",
  bao: "bao",
  bo: "bơ",
  bot: "bột",
  cacao: "cacao",
  ca: "cà",
  chay: "chay",
  che: "chè",
  chua: "chua",
  chanh: "chanh",
  dong: "đông",
  duong: "đường",
  ga: "gà",
  gao: "gạo",
  gel: "gel",
  giai: "giải",
  gia: "gia",
  goi: "gói",
  hoa: "hoa",
  hong: "hồng",
  huong: "hương",
  kem: "kem",
  kho: "khô",
  lanh: "lạnh",
  la: "lá",
  matcha: "matcha",
  me: "mè",
  my: "mỹ",
  nam: "nấm",
  nep: "nếp",
  nghe: "nghệ",
  nguyen: "nguyên",
  nuoc: "nước",
  pham: "phẩm",
  phe: "phê",
  phu: "phụ",
  protein: "protein",
  ruou: "rượu",
  rau: "rau",
  say: "sấy",
  sim: "sim",
  sinh: "sinh",
  sot: "sốt",
  sua: "sữa",
  thuc: "thực",
  thang: "thăng",
  tra: "trà",
  trai: "trái",
  trung: "trứng",
  tuoi: "tươi",
  uong: "uống",
  vi: "vị",
  vien: "viên",
  vitamin: "vitamin",
  xanh: "xanh",
  xay: "xay",
};

function labelFromSlug(slug: string): string {
  if (slug === "bot-gia-vi") return "Bột gia vị";
  if (slug === "dich-vu-dong-goi-bao-tai-dua") return "Dịch vụ đóng gói bao tải dứa";
  if (slug === "sua-bot-cho-nguoi-gia") return "Sữa bột cho người già";
  if (slug.startsWith("gia-cong-")) return `Gia công ${translateWords(slug.slice("gia-cong-".length))}`;
  if (slug.startsWith("dich-vu-say-")) return `Dịch vụ sấy ${translateWords(slug.slice("dich-vu-say-".length))}`;
  if (slug.startsWith("dich-vu-dong-goi-")) return `Dịch vụ đóng gói ${translateWords(slug.slice("dich-vu-dong-goi-".length))}`;
  if (slug.startsWith("say-")) return `Sấy ${translateWords(slug.slice("say-".length))}`;
  if (slug.startsWith("sua-")) return `Sữa ${translateWords(slug.slice("sua-".length))}`;
  if (slug.startsWith("tra-")) return `Trà ${translateWords(slug.slice("tra-".length))}`;
  return translateWords(slug);
}

function translateWords(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((word) => wordLabels[word] ?? word)
    .join(" ");
}

/**
 * All captured service content routes, including pages that are only reachable
 * from an upstream archive. The UI keeps this index collapsed until requested,
 * so discoverability does not turn the service landing page into a wall of links.
 */
export function getServiceContentIndex(): readonly ServiceOffering[] {
  const seen = new Set<string>();
  return Object.keys(manifest)
    .filter((route) => serviceRoutePattern.test(route) && !paginationRoutePattern.test(route))
    .filter((route) => {
      if (seen.has(route)) return false;
      seen.add(route);
      return true;
    })
    .map((href) => ({
      href,
      label: knownLabels.get(href) ?? labelFromSlug(href.replace(/^\/+|\/+$/g, "")),
    }));
}
