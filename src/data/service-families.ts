export interface ServiceOffering {
  href: string;
  label: string;
}

export interface ServiceFamily {
  slug: string;
  name: string;
  summary: string;
  description: string;
  /**
   * The hub page giacong.vn already serves for this group — a captured archive route.
   * Distinct from `/thue-gia-cong/<slug>/`, which is this project's own wrapper: the
   * index offers both, so a visitor can reach either the real archive or the grouped
   * view without one masquerading as the other.
   */
  hubHref: string;
  offerings: readonly ServiceOffering[];
}

/**
 * The thirteen groups giacong.vn's own header divides its work into, read out of the
 * captured mega-menu in `src/data/pages/san-pham.json`, with each group's offerings
 * read from that hub's captured archive loop (`post-item` → `post-title`).
 *
 * Two rules held while building this list, both enforced by `scripts/service-contract.test.mts`:
 *
 * - Every `href` is a route present in `src/data/pages/manifest.json`. The real
 *   mega-menu also carries entries pointing at `#` and at `/`; those are dropped
 *   rather than rendered as links that go nowhere.
 * - Labels come from each destination page's own title, not from the anchor text in
 *   the archive loop, which runs the title together with the article's opening
 *   sentence.
 *
 * Offerings are capped at the six the archive shows above its own paging, so an index
 * card stays scannable. The hub link is what leads to the rest.
 *
 * Two things here look like mistakes and are not. `gia-cong-duoc-lieu` has no
 * offerings because its archive genuinely renders "Nothing Found" upstream. And
 * `gia-cong-my-pham` lists a packaging page and a rượu táo mèo page because the real
 * site files them under mỹ phẩm — that is its own tagging, reproduced rather than
 * tidied.
 */
export const serviceFamilies = [
  {
    slug: "gia-cong-sot-cham",
    name: "Gia công sốt chấm",
    summary: "Sốt chấm và sốt trộn theo công thức riêng.",
    description: "Các dòng sốt chấm, sốt trộn và sốt salad gia công theo công thức và khẩu vị đặt hàng.",
    hubHref: "/gia-cong-sot-cham/",
    offerings: [
      { href: "/gia-cong-sot-bo-dau-phong/", label: "Gia công sốt bơ đậu phộng" },
      { href: "/gia-cong-sot-me-rang-nhat-ban/", label: "Gia công sốt mè rang Nhật Bản" },
      { href: "/gia-cong-sot-goi-cuon-tom-thit/", label: "Gia công sốt gỏi cuốn tôm thịt" },
      { href: "/gia-cong-sot-goi-thai/", label: "Gia công sốt gỏi Thái" },
      { href: "/gia-cong-sot-nom-chua-ngot-viet-nam/", label: "Gia công sốt nộm chua ngọt Việt Nam" },
      { href: "/gia-cong-sot-hummus/", label: "Gia công sốt hummus" },
    ],
  },
  {
    slug: "gia-cong-do-uong",
    name: "Gia công đồ uống",
    summary: "Nước uống, kem và đồ uống đông lạnh.",
    description: "Nhóm đồ uống trải từ nước ép, nước bổ sung vi chất đến kem và sản phẩm đông lạnh.",
    hubHref: "/gia-cong-do-uong/",
    offerings: [
      { href: "/gia-cong-nuoc-ep-trai-cay/", label: "Gia công nước ép trái cây" },
      { href: "/gia-cong-nuoc-giai-khat-co-ga/", label: "Gia công nước giải khát có ga" },
      { href: "/gia-cong-nuoc-uong-dong-chai/", label: "Gia công nước uống đóng chai" },
      { href: "/gia-cong-sinh-to-dong-lanh/", label: "Gia công sinh tố đông lạnh" },
      { href: "/gia-cong-nuoc-trai-cay-dong-lanh-iqf/", label: "Gia công nước trái cây đông lạnh (IQF)" },
      { href: "/gia-cong-nuoc-vitamin-tong-hop/", label: "Gia công nước vitamin tổng hợp" },
    ],
  },
  {
    slug: "gia-cong-bot-pha-che",
    name: "Gia công bột pha chế",
    summary: "Bột nền và bột pha chế cho quầy đồ uống.",
    description: "Bột pha chế dùng cho quầy đồ uống và bếp bánh, đóng gói theo quy cách đặt hàng.",
    hubHref: "/gia-cong-bot-pha-che/",
    offerings: [
      { href: "/gia-cong-bot-tra-xanh/", label: "Gia công bột trà xanh" },
      { href: "/gia-cong-bot-kem/", label: "Gia công bột kem" },
      { href: "/gia-cong-bot-nep/", label: "Gia công bột nếp" },
      { href: "/gia-cong-bot-banh/", label: "Gia công bột bánh" },
      { href: "/gia-cong-bot-dau-xanh/", label: "Gia công bột đậu xanh" },
      { href: "/gia-cong-bot-caramel/", label: "Gia công bột caramel" },
    ],
  },
  {
    slug: "gia-cong-duoc-lieu",
    name: "Gia công dược liệu",
    summary: "Nhóm dược liệu — hiện chưa có trang dịch vụ riêng.",
    description: "Nhóm dược liệu trong hệ thống dịch vụ. Trang nhóm trên site gốc hiện chưa có bài dịch vụ nào, nên hãy liên hệ để trao đổi yêu cầu cụ thể.",
    hubHref: "/gia-cong-duoc-lieu/",
    offerings: [],
  },
  {
    slug: "gia-cong-thuc-pham",
    name: "Gia công thực phẩm",
    summary: "Rau củ, gia vị và nguyên liệu thực phẩm sấy.",
    description: "Gia công thực phẩm tập trung vào rau củ, gia vị và nguyên liệu qua xử lý sấy.",
    hubHref: "/gia-cong-thuc-pham/",
    offerings: [
      { href: "/dich-vu-say-la-tia-to/", label: "Dịch vụ sấy lá tía tô" },
      { href: "/dich-vu-say-nam/", label: "Dịch vụ sấy nấm" },
      { href: "/dich-vu-say-rau-cai-kale-bo-xoi-cai-xanh/", label: "Dịch vụ sấy rau cải" },
      { href: "/dich-vu-say-ot/", label: "Dịch vụ sấy ớt" },
      { href: "/dich-vu-say-nghe/", label: "Dịch vụ sấy nghệ" },
      { href: "/dich-vu-say-gung/", label: "Dịch vụ sấy gừng" },
    ],
  },
  {
    slug: "gia-cong-my-pham",
    name: "Gia công mỹ phẩm",
    summary: "Chăm sóc da, chăm sóc tóc và sản phẩm dưỡng thể.",
    description: "Nhóm mỹ phẩm gồm sản phẩm chăm sóc da, chăm sóc tóc và dưỡng thể theo nhãn riêng.",
    hubHref: "/gia-cong-my-pham/",
    offerings: [
      { href: "/gia-cong-sua-duong-the-chong-lao-hoa/", label: "Gia công sữa dưỡng thể" },
      { href: "/gia-cong-gel-lam-mat-da/", label: "Gia công gel làm mát da" },
      { href: "/gia-cong-dau-goi-kho/", label: "Gia công dầu gội khô" },
      { href: "/gia-cong-kem-duong-toc/", label: "Gia công kem dưỡng tóc" },
      { href: "/gia-cong-kem-duong-da-chong-viem/", label: "Gia công kem dưỡng da chống viêm" },
      { href: "/gia-cong-sua-tam-lam-sang-da/", label: "Gia công sữa tắm làm sáng da" },
    ],
  },
  {
    slug: "gia-cong-tra",
    name: "Gia công trà",
    summary: "Trà thảo mộc, trà túi lọc và trà đóng chai.",
    description: "Gia công trà từ nguyên liệu thảo mộc, đóng gói dạng túi lọc, hộp hoặc đóng chai.",
    hubHref: "/gia-cong-tra/",
    offerings: [
      { href: "/gia-cong-tra-tui-loc/", label: "Gia công trà túi lọc" },
      { href: "/gia-cong-tra-dong-chai/", label: "Gia công trà đóng chai" },
      { href: "/gia-cong-tra-thao-moc/", label: "Gia công trà thảo mộc" },
      { href: "/gia-cong-tra-detox/", label: "Gia công trà detox" },
      { href: "/gia-cong-tra-bup-oi/", label: "Gia công trà búp ổi" },
      { href: "/gia-cong-tra-ca-gai-leo/", label: "Gia công trà cà gai leo" },
    ],
  },
  {
    slug: "gia-cong-ca-phe",
    name: "Gia công cà phê",
    summary: "Rang gia công, cà phê hòa tan và cà phê quà tặng.",
    description: "Gia công cà phê từ rang theo yêu cầu đến cà phê hòa tan và dòng quà tặng.",
    hubHref: "/gia-cong-ca-phe/",
    offerings: [
      { href: "/rang-gia-cong-ca-phe/", label: "Rang gia công cà phê" },
      { href: "/gia-cong-ca-phe-hoa-tan/", label: "Gia công cà phê hòa tan" },
      { href: "/gia-cong-ca-phe-qua-tang/", label: "Gia công cà phê quà tặng" },
    ],
  },
  {
    slug: "gia-cong-dong-goi",
    name: "Gia công đóng gói",
    summary: "Đóng gói theo dạng thành phẩm và quy cách bao bì.",
    description: "Dịch vụ đóng gói theo dạng thành phẩm: bột, lỏng, gel, viên, stick và bao bì công nghiệp.",
    hubHref: "/gia-cong-dong-goi/",
    offerings: [
      { href: "/dich-vu-dong-goi-bot-hoa-tan/", label: "Đóng gói bột hòa tan" },
      { href: "/dich-vu-dong-goi-dang-ong-stick/", label: "Đóng gói dạng ống stick" },
      { href: "/dich-vu-dong-goi-dang-long-goi-nho/", label: "Đóng gói dạng lỏng gói nhỏ" },
      { href: "/dich-vu-dong-goi-dang-gel/", label: "Đóng gói dạng gel" },
      { href: "/dich-vu-dong-goi-vien-nen-vien-nang/", label: "Đóng gói viên nén, viên nang" },
      { href: "/dich-vu-dong-goi-hop-giay-carton/", label: "Đóng gói hộp giấy carton" },
    ],
  },
  {
    slug: "gia-cong-bot",
    name: "Gia công bột",
    summary: "Bột dinh dưỡng, bột chức năng và bột nguyên liệu.",
    description: "Gia công các dòng bột dinh dưỡng, bột chức năng và bột nguyên liệu theo công thức đặt hàng.",
    hubHref: "/gia-cong-bot/",
    offerings: [
      { href: "/gia-cong-bot-ngu-coc-dinh-duong/", label: "Gia công bột ngũ cốc dinh dưỡng" },
      { href: "/gia-cong-bot-bo-sung-vitamin-khoang-chat/", label: "Gia công bột bổ sung vitamin, khoáng chất" },
      { href: "/gia-cong-bot-collagen/", label: "Gia công bột collagen" },
      { href: "/gia-cong-bot-protein/", label: "Gia công bột protein" },
      { href: "/gia-cong-bot-cacao/", label: "Gia công bột cacao" },
      { href: "/gia-cong-bot-matcha-2/", label: "Gia công bột matcha" },
    ],
  },
  {
    slug: "gia-cong-ruou",
    name: "Gia công rượu",
    summary: "Rượu ngâm, rượu pha và cocktail đóng sẵn.",
    description: "Gia công rượu ngâm truyền thống, rượu pha hương và cocktail đóng sẵn theo nhãn riêng.",
    hubHref: "/gia-cong-ruou/",
    offerings: [
      { href: "/gia-cong-ruou-tao-meo/", label: "Gia công rượu táo mèo" },
      { href: "/gia-cong-ruou-chuoi-hot-mix-mat-ong/", label: "Gia công rượu chuối hột mix mật ong" },
      { href: "/gia-cong-ruou-sim-mix-tonic/", label: "Gia công rượu sim mix tonic" },
      { href: "/gia-cong-ruou-mo-pha-tra-xanh/", label: "Gia công rượu mơ pha trà xanh" },
      { href: "/gia-cong-ruou-nep-uop-hoa-nhai/", label: "Gia công rượu nếp ướp hoa nhài" },
      { href: "/gia-cong-cocktail-ruou-mo/", label: "Gia công cocktail rượu mơ" },
    ],
  },
  {
    slug: "gia-cong-sua",
    name: "Gia công sữa",
    summary: "Sữa bột, sữa tươi, sữa chua và sữa thực vật.",
    description: "Gia công sữa trải từ sữa bột và sữa tươi đến sữa chua, sữa hạt và sữa thực vật.",
    hubHref: "/gia-cong-sua/",
    offerings: [
      { href: "/gia-cong-sua-bot/", label: "Gia công sữa bột" },
      { href: "/gia-cong-sua-tuoi/", label: "Gia công sữa tươi" },
      { href: "/gia-cong-sua-chua/", label: "Gia công sữa chua" },
      { href: "/gia-cong-sua-hat/", label: "Gia công sữa hạt" },
      { href: "/gia-cong-sua-thuc-vat/", label: "Gia công sữa thực vật" },
      { href: "/sua-chua-say-thang-hoa/", label: "Sữa chua sấy thăng hoa" },
    ],
  },
  {
    slug: "say-thuc-pham-say",
    name: "Sấy & thực phẩm sấy",
    summary: "Nhóm dịch vụ sấy theo nhiều phương pháp chế biến.",
    description: "So sánh các hướng sấy để tìm phương pháp phù hợp với nguyên liệu và thành phẩm dự kiến.",
    hubHref: "/dich-vu-say/",
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
