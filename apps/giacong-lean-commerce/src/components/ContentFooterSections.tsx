import {
  BadgeCheck,
  Clock3,
  Factory,
  Handshake,
  Headphones,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Send,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";

const benefits = [
  {
    title: "Tăng giá trị sản phẩm",
    text: "Gia công giúp bạn nghiên cứu bổ sung hoàn thiện sản phẩm để đảm bảo nhu cầu sử dụng của khách hàng, người tiêu dùng.",
    icon: Sparkles,
  },
  {
    title: "Tối ưu chi phí",
    text: "Doanh nghiệp không cần đầu tư vào nhà máy, nhân sự, vẫn có thể sản xuất linh hoạt với chi phí tối ưu.",
    icon: BadgeCheck,
  },
  {
    title: "Đảm bảo chất lượng",
    text: "Các đơn vị gia công chuyên nghiệp tuân thủ các tiêu chuẩn chất lượng khắt khe để sản phẩm luôn ổn định.",
    icon: ShieldCheck,
  },
  {
    title: "Tối ưu hóa thời gian",
    text: "Dịch vụ gia công giúp rút ngắn thời gian chuẩn bị, sản xuất và đưa sản phẩm đến khách hàng.",
    icon: Clock3,
  },
  {
    title: "Mở rộng xuất khẩu",
    text: "Sản phẩm có công thức và chất lượng chuẩn hóa, đáp ứng yêu cầu của nhiều thị trường quốc tế.",
    icon: Factory,
  },
];

const stats = [
  ["1390+", "Dự án hoàn thành"],
  ["950+", "Khách hàng"],
  ["100%", "Khách hàng hài lòng"],
  ["500+", "Mẫu sản phẩm dựng sẵn"],
  ["1000+", "Khách hàng duy trì"],
];

const clientLabels = [
  "NUTRITION LAB",
  "CITY GROUP",
  "ORGANIC+",
  "FRESH DRINK",
  "MOBILE ONE",
  "VIỆT PHONG",
  "VIETTEL LAB",
  "NOVA HEALTH",
  "ULTRAWELLNESS",
  "NIBY FOODS",
  "KEPPEL LAND",
  "FPT TELECOM",
  "THẾ GIỚI KIM CƯƠNG",
  "PHUWACO",
  "KFC 50000",
  "GIA ĐÌNH WATER",
  "NHO NATIONAL HOUSING",
  "MMA MEDIA",
];

const footerColumns = [
  {
    title: "Các dịch vụ chính",
    links: [
      "Gia công đồ uống",
      "Gia công thực phẩm",
      "Gia công mỹ phẩm",
      "Gia công y tế, dược",
      "Gia công sinh học",
      "Gia công sấy",
    ],
  },
  {
    title: "Chính sách chung",
    links: [
      "Chính sách thanh toán",
      "Chính sách hoàn tiền",
      "Chính sách đổi trả",
      "Chính sách bảo hành",
      "Bản quyền thương hiệu",
      "Thanh toán",
    ],
  },
];

export function ContentFooterSections() {
  return (
    <>
      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 lg:grid-cols-[1.05fr_1.25fr] lg:items-center lg:px-8">
          <div>
            <h2 className="max-w-sm text-3xl font-bold leading-tight tracking-tight text-slate-800 sm:text-4xl">
              <span className="text-lime-600">Bắt đầu với chúng tôi</span>
              <br />
              ngay hôm nay
            </h2>
            <p className="mt-5 max-w-md text-sm leading-7 text-slate-500">
              Doanh nghiệp có thể bắt đầu hành trình tạo ra sản xuất từ ý tưởng và kết nối
              cùng chúng tôi để xây dựng sự thành công hay nhất.
            </p>
            <div className="relative mt-8 min-h-64 overflow-hidden rounded-[2rem] bg-lime-50 p-7 sm:min-h-72">
              <div className="absolute -right-8 -top-10 h-44 w-44 rounded-full bg-lime-200/60" />
              <div className="absolute -bottom-10 -left-8 h-32 w-32 rounded-full bg-emerald-100" />
              <div className="relative flex h-52 items-end justify-center gap-3">
                <div className="flex h-32 w-20 items-end rounded-t-full bg-sky-500/90 p-3">
                  <Users className="h-9 w-9 text-white" />
                </div>
                <div className="flex h-48 w-32 items-center justify-center rounded-t-[4rem] bg-lime-500 shadow-lg">
                  <Handshake className="h-16 w-16 text-white" />
                </div>
                <div className="flex h-28 w-20 items-end justify-end rounded-t-full bg-orange-300 p-3">
                  <Trophy className="h-8 w-8 text-white" />
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
            {benefits.map(({ title, text, icon: Icon }, index) => (
              <article
                className={`rounded-xl border border-slate-100 bg-white p-5 shadow-sm ${
                  index === 4 ? "sm:col-start-2" : ""
                }`}
                key={title}
              >
                <Icon className="h-7 w-7 text-lime-600" strokeWidth={1.7} />
                <h3 className="mt-4 text-base font-semibold text-slate-800">{title}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-500">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-lime-600 py-10 text-white">
        <div className="mx-auto max-w-6xl px-5 text-center lg:px-8">
          <h2 className="text-2xl font-bold sm:text-3xl">12+ năm phụng sự khách hàng</h2>
          <div className="mt-8 grid grid-cols-2 gap-7 sm:grid-cols-3 lg:grid-cols-5">
            {stats.map(([number, label]) => (
              <div key={label}>
                <p className="text-2xl font-bold sm:text-3xl">{number}</p>
                <p className="mt-1 text-xs font-medium text-lime-100">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-5 lg:px-8">
          <p className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-lime-600">
            Khách hàng của chúng tôi
          </p>
          <h2 className="mt-2 text-center text-2xl font-bold leading-tight text-slate-800 sm:text-3xl">
            Đây là những gì khách hàng nói về chúng tôi
          </h2>
          <div className="mx-auto mt-10 max-w-2xl rounded-xl bg-slate-50 p-6 sm:flex sm:gap-6 sm:p-8">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-lime-100 text-lime-700">
              <Users className="h-10 w-10" strokeWidth={1.4} />
            </div>
            <div className="mt-5 sm:mt-0">
              <p className="text-sm leading-6 text-slate-600">
                “Chúng tôi đã hợp tác với dịch vụ gia công này hơn 2 năm, và phải nói là vô
                cùng hài lòng. Sản phẩm đạt chuẩn chất lượng, giao hàng đúng hẹn và đặc biệt là
                đội ngũ luôn hỗ trợ tận tâm trong mọi khâu sản xuất.”
              </p>
              <p className="mt-4 text-sm font-bold text-slate-800">Anh Trịnh Anh Tuấn</p>
              <p className="mt-1 text-xs text-slate-400">Khách hàng của Công ty Vina Dairy</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-lime-50 py-12 sm:py-16">
        <div className="mx-auto max-w-5xl px-5 lg:px-8">
          <h2 className="text-center text-2xl font-bold text-slate-700 sm:text-3xl">
            <span className="text-lime-600">500+ doanh nghiệp</span> nổi bật
          </h2>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
            {clientLabels.map((label) => (
              <div
                className="flex min-h-12 items-center justify-center rounded-md bg-white px-2 text-center text-[10px] font-bold leading-tight text-slate-400 shadow-sm"
                key={label}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-lime-600 py-14 text-white sm:py-16">
        <div className="mx-auto max-w-5xl px-5 text-center lg:px-8">
          <h2 className="text-2xl font-bold sm:text-3xl">Hãy để Giacong.vn hiểu hơn về bạn</h2>
          <p className="mt-3 text-sm text-lime-100">
            Cùng chúng tôi sáng tạo những giải pháp giúp bạn phát triển thương hiệu và mở rộng thị trường.
          </p>
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            <a className="flex items-center gap-3 rounded-lg bg-white px-5 py-4 text-left text-slate-700" href="tel:0974124999">
              <Phone className="h-7 w-7 text-lime-600" />
              <span><span className="block text-xs text-slate-400">Hotline hỗ trợ 24/7</span><strong className="text-sm">0974 124 999</strong></span>
            </a>
            <a className="flex items-center gap-3 rounded-lg bg-white px-5 py-4 text-left text-slate-700" href="mailto:info@giacong.vn">
              <Mail className="h-7 w-7 text-lime-600" />
              <span><span className="block text-xs text-slate-400">Email tư vấn</span><strong className="text-sm">info@giacong.vn</strong></span>
            </a>
            <a className="flex items-center gap-3 rounded-lg bg-white px-5 py-4 text-left text-slate-700" href="#contact-form">
              <MessageCircle className="h-7 w-7 text-lime-600" />
              <span><span className="block text-xs text-slate-400">Chat now</span><strong className="text-sm">Zalo: /giacong</strong></span>
            </a>
          </div>
          <form className="mx-auto mt-6 grid max-w-3xl gap-3 sm:grid-cols-[1fr_1fr_auto]" id="contact-form">
            <label className="sr-only" htmlFor="name">Họ và tên</label>
            <input className="min-h-11 rounded-md border border-white/20 bg-white px-4 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-lime-200" id="name" name="name" placeholder="Họ và tên" />
            <label className="sr-only" htmlFor="phone">Số điện thoại</label>
            <input className="min-h-11 rounded-md border border-white/20 bg-white px-4 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-lime-200" id="phone" name="phone" placeholder="Số điện thoại" type="tel" />
            <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-lime-700 px-5 text-sm font-medium hover:bg-lime-800 focus:outline-none focus:ring-2 focus:ring-lime-200" type="submit">
              Gửi thông tin <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </section>

      <footer className="bg-white pt-12 text-slate-600">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 pb-10 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
          <div>
            <a className="text-3xl font-bold tracking-tight text-lime-600" href="#top">giacong<span className="text-slate-700">.vn</span></a>
            <p className="mt-1 text-[9px] font-bold tracking-wide text-slate-400">KẾT NỐI SẢN XUẤT THƯƠNG MẠI</p>
            <p className="mt-5 text-xs leading-5">Giacong.vn là nền tảng kết nối khách hàng và các đơn vị sản xuất, cung cấp giải pháp gia công toàn diện.</p>
          </div>
          {footerColumns.map((column) => (
            <div key={column.title}>
              <h2 className="text-sm font-bold text-slate-800">{column.title}</h2>
              <ul className="mt-4 space-y-2 text-xs">
                {column.links.map((link) => <li key={link}><a className="hover:text-lime-600" href="#services">{link}</a></li>)}
              </ul>
            </div>
          ))}
          <div>
            <h2 className="text-sm font-bold text-slate-800">VIỆT NAM TRADE PROMOTION DEVELOPMENT INVESTMENT.,JSC</h2>
            <div className="mt-4 space-y-3 text-xs leading-5">
              <p className="flex gap-2"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-lime-600" /> Hotline: 0974 124 999</p>
              <p className="flex gap-2"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-lime-600" /> Email: info@giacong.vn</p>
              <p className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-lime-600" /> VP Hà Nội: 108 Trần Hưng Đạo - Hoàn Kiếm - Hà Nội</p>
              <p className="flex gap-2"><Headphones className="mt-0.5 h-4 w-4 shrink-0 text-lime-600" /> Tư vấn tận tình, phản hồi nhanh chóng.</p>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-100 py-4 text-center text-[10px] text-slate-400">Copyright 2026 © Giacong.vn | Một sản phẩm của Netmedia</div>
      </footer>
    </>
  );
}
