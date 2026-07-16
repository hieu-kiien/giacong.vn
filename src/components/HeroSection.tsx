import { ArrowRight, Check, ChevronRight, Menu } from "lucide-react";

const navigationItems = [
  { label: "Home", href: "#home" },
  { label: "Về Giacong.vn", href: "#gioi-thieu" },
  { label: "Sản Phẩm", href: "#san-pham" },
  { label: "Dịch vụ", href: "#dich-vu" },
  { label: "Tin tức", href: "#tin-tuc" },
  { label: "Liên hệ", href: "#lien-he" },
];

const benefits = [
  "Đội ngũ chuyên gia giàu kinh nghiệm",
  "Hệ thống nhà xưởng hiện đại",
  "Quy trình sản xuất tối ưu",
];

export function HeroSection() {
  return (
    <section id="home" className="font-sans text-white">
      <div className="relative overflow-hidden bg-[#087e53]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_13%,rgba(115,203,116,0.55),transparent_25%),radial-gradient(circle_at_5%_90%,rgba(6,66,53,0.9),transparent_36%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_0%,transparent_48%,rgba(255,255,255,0.06)_48.2%,transparent_48.5%)]" />

        <header className="relative z-10 mx-auto flex h-24 max-w-[1230px] items-center justify-between px-5 lg:px-0">
          <a href="#home" className="text-[26px] font-bold tracking-[-0.06em]" aria-label="Giacong.vn trang chủ">
            Giacong<span className="text-[#bde875]">.vn</span>
          </a>
          <nav className="hidden items-center gap-7 text-[14px] font-medium lg:flex" aria-label="Điều hướng chính">
            {navigationItems.map((item) => (
              <a key={item.href} href={item.href} className="transition-colors hover:text-[#d5f58d]">
                {item.label}
              </a>
            ))}
          </nav>
          <button type="button" className="grid size-10 place-items-center rounded-full border border-white/30 lg:hidden" aria-label="Mở menu">
            <Menu className="size-5" aria-hidden="true" />
          </button>
        </header>

        <div className="relative z-10 mx-auto grid min-h-[588px] max-w-[1230px] items-center gap-12 px-5 pb-28 pt-10 md:grid-cols-[1.03fr_0.97fr] lg:px-0 lg:pb-20 lg:pt-2">
          <div className="max-w-[620px]">
            <p className="mb-4 text-[17px] font-semibold tracking-[-0.02em] text-[#d5f58d]">Giacong.vn cung cấp</p>
            <h1 className="max-w-[615px] text-4xl font-bold leading-[1.12] tracking-[-0.055em] sm:text-5xl lg:text-[58px]">
              Giải pháp gia công toàn diện chuyên nghiệp
            </h1>
            <div className="mt-6 max-w-[510px] space-y-3 text-[15px] leading-7 text-white/80">
              <p>Bất kể quy mô hay yêu cầu đặc biệt nào, chúng tôi luôn sẵn sàng đáp ứng để giúp bạn nổi bật trên thị trường.</p>
              <p>Hãy để chúng tôi đồng hành cùng bạn trong từng bước phát triển sản phẩm!</p>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#gioi-thieu" className="inline-flex items-center gap-2 rounded-full bg-[#d3ef7c] px-6 py-3.5 text-sm font-bold text-[#07533a] transition-transform hover:-translate-y-0.5">
                Về chúng tôi <ArrowRight className="size-4" aria-hidden="true" />
              </a>
              <a href="#lien-he" className="inline-flex items-center gap-2 rounded-full border border-white/55 px-6 py-3.5 text-sm font-bold transition-colors hover:bg-white hover:text-[#07533a]">
                Liên hệ ngay <ChevronRight className="size-4" aria-hidden="true" />
              </a>
            </div>
          </div>

          <div className="hidden grid-cols-2 gap-3 self-end md:grid">
            <div className="h-56 rounded-tl-[92px] rounded-br-[28px] bg-[linear-gradient(145deg,#d9e0cf_0%,#78957b_44%,#27473a_100%)] shadow-2xl shadow-[#03523a]/30" />
            <div className="mt-12 h-56 rounded-t-[28px] rounded-bl-[92px] bg-[linear-gradient(145deg,#e5e4d5_0%,#a5bf92_40%,#3b6a50_100%)] shadow-2xl shadow-[#03523a]/30" />
            <div className="-mt-7 h-56 rounded-tl-[28px] rounded-br-[92px] bg-[linear-gradient(145deg,#436d5b_0%,#99b490_47%,#e1d8bf_100%)] shadow-2xl shadow-[#03523a]/30" />
            <div className="mt-5 h-56 rounded-tr-[92px] rounded-bl-[28px] bg-[linear-gradient(145deg,#e4e5d5_0%,#809777_48%,#315443_100%)] shadow-2xl shadow-[#03523a]/30" />
          </div>
        </div>
      </div>

      <div className="relative z-20 mx-auto -mt-12 max-w-[1230px] px-5 text-[#183b31] lg:px-0">
        <div className="grid overflow-hidden rounded-[20px] bg-white shadow-[0_20px_60px_rgba(8,61,43,0.16)] md:grid-cols-[0.83fr_1.17fr]">
          <div className="relative hidden min-h-[330px] overflow-hidden bg-[#eef4e5] md:block">
            <div className="absolute -left-8 bottom-0 h-60 w-72 rounded-tr-[120px] bg-[#94c167]" />
            <div className="absolute bottom-9 left-20 h-44 w-36 rotate-[-8deg] rounded-t-[56px] rounded-br-[22px] bg-[linear-gradient(145deg,#f8f8e9_0%,#cbd8ab_53%,#59835d_100%)] shadow-xl" />
            <div className="absolute bottom-0 right-0 h-44 w-44 rounded-tl-[100px] bg-[#0a7b54]" />
          </div>
          <div className="px-7 py-9 sm:px-10 sm:py-11 lg:px-14">
            <p className="text-sm font-bold uppercase tracking-[0.13em] text-[#4f9c56]">Giacong.vn</p>
            <h2 className="mt-3 max-w-[560px] text-3xl font-bold leading-[1.18] tracking-[-0.04em] text-[#183b31] sm:text-[38px]">
              Đồng hành cùng doanh nghiệp trong thời đại mới
            </h2>
            <p className="mt-4 max-w-[570px] text-[15px] leading-7 text-[#5d7169]">
              Với đội ngũ chuyên gia giàu kinh nghiệm, hệ thống nhà xưởng hiện đại và quy trình sản xuất tối ưu, chúng tôi mang đến giải pháp gia công phù hợp cho doanh nghiệp.
            </p>
            <ul className="mt-6 grid gap-3 text-sm font-semibold text-[#315b4b] sm:grid-cols-2" role="list">
              {benefits.map((benefit) => (
                <li key={benefit} className="flex items-center gap-2.5">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#d6ef8a] text-[#14704e]">
                    <Check className="size-3.5 stroke-[3]" aria-hidden="true" />
                  </span>
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
