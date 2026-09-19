import {
  BadgeCheck,
  Box,
  ClipboardList,
  FlaskConical,
  Leaf,
  MessageCircle,
  PackageCheck,
  Palette,
  Send,
  Sprout,
  Truck,
} from "lucide-react"

const services = [
  {
    title: "Nghiên cứu",
    description:
      "Đội ngũ R&D giàu kinh nghiệm giúp phát triển sản phẩm từ ý tưởng đến công thức hoàn chỉnh.",
    icon: FlaskConical,
    points: [
      "Lên ý tưởng sản phẩm",
      "Nghiên cứu công thức",
      "Thử nghiệm và điều chỉnh",
      "Kiểm tra tính khả thi",
      "Phát triển sản phẩm mẫu",
      "Kiểm định an toàn",
      "Chuẩn hóa chất lượng",
    ],
  },
  {
    title: "Sản xuất",
    description:
      "Nhà máy đạt tiêu chuẩn, dây chuyền công nghệ hiện đại, đảm bảo tiến độ và chất lượng.",
    icon: ClipboardList,
    points: [
      "Nhận nguyên liệu",
      "Sơ chế nguyên liệu",
      "Pha chế và phối trộn",
      "Quy trình sản xuất chuẩn",
      "Kiểm tra chất lượng",
      "Luôn sẵn sàng phục vụ",
      "Kiểm soát và bảo quản",
    ],
  },
  {
    title: "Thiết kế",
    description:
      "Cùng đội ngũ chuyên môn, hiện thực hóa ý tưởng và xây dựng hình ảnh thương hiệu khác biệt.",
    icon: Palette,
    points: [
      "Nghiên cứu thương hiệu",
      "Phát triển ý tưởng",
      "Thiết kế bao bì",
      "Thiết kế nhãn hàng",
      "Giải mã câu chuyện",
      "Chỉnh sửa và phê duyệt",
      "In ấn và hoàn thiện",
    ],
  },
  {
    title: "Đóng gói",
    description:
      "Sản phẩm được đóng gói công nghệ cao, bảo quản tốt và tối ưu chi phí vận hành.",
    icon: PackageCheck,
    points: [
      "Kiểm tra chất lượng",
      "Lựa chọn quy cách",
      "Đóng gói sản phẩm",
      "Kiểm tra niêm phong",
      "Lưu kho bảo quản",
      "Vận chuyển an toàn",
      "Hỗ trợ sau quá trình",
    ],
  },
]

export function ServicesSection() {
  return (
    <section className="overflow-hidden bg-white">
      <div className="mx-auto max-w-[1280px] px-5 pb-20 pt-20 sm:px-8 lg:px-12 lg:pb-24 lg:pt-24">
        <header className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-[#313131] sm:text-4xl">
            Các dịch vụ của <span className="text-[#55a630]">Kienhieu</span>
          </h2>
          <p className="mt-4 text-sm leading-6 text-[#666] sm:text-base">
            Sản phẩm của chúng tôi tiêu chuẩn chất lượng cao, đáp ứng yêu cầu nghiêm ngặt của các thị trường quốc tế,
            giúp doanh nghiệp mở rộng khả năng tiếp cận thị trường ngoài nước.
          </p>
        </header>

        <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {services.map(({ title, description, icon: Icon, points }) => (
            <article
              key={title}
              className="flex min-h-[430px] flex-col rounded-2xl bg-[#eff8e8] p-5 text-[#353535] shadow-sm"
            >
              <div className="flex size-12 items-center justify-center rounded-xl bg-white text-[#55a630] shadow-sm">
                <Icon aria-hidden="true" className="size-6" strokeWidth={1.8} />
              </div>
              <h3 className="mt-5 text-xl font-bold">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#5f665e]">{description}</p>
              <ul className="mt-5 space-y-2 text-sm leading-5 text-[#4d5749]">
                {points.map((point) => (
                  <li key={point} className="flex items-start gap-2">
                    <BadgeCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[#67b537]" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              <a
                href="#lien-he"
                className="mt-auto inline-flex h-10 items-center justify-center rounded-lg border border-[#69b53d] bg-white px-4 text-sm font-semibold text-[#4d9828] transition-colors hover:bg-[#dff0d3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3d8b20]"
              >
                Xem thêm
              </a>
            </article>
          ))}
        </div>
      </div>

      <div className="relative isolate h-[400px] overflow-hidden bg-[#58ad00] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_10%,rgba(174,235,86,0.28),transparent_25%),radial-gradient(circle_at_46%_100%,rgba(34,113,0,0.44),transparent_40%)]" />
        <div className="relative mx-auto flex h-full max-w-[1280px] items-center px-5 sm:px-8 lg:px-12">
          <div className="max-w-xl pb-3">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#dcf7c8]">
              <Sprout aria-hidden="true" className="size-5" /> GIẢI PHÁP DÀNH CHO DOANH NGHIỆP
            </p>
            <h2 className="max-w-lg text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
              Sẵn sàng tiếp cận hàng triệu khách hàng tiềm năng?
            </h2>
            <p className="mt-5 max-w-md text-sm leading-6 text-[#ecffe0] sm:text-base">
              Đội ngũ chuyên gia giàu kinh nghiệm của chúng tôi luôn sẵn sàng đồng hành cùng doanh nghiệp từ ý tưởng
              đến khi sản phẩm được đưa ra thị trường.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="#lien-he"
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-[#4b9822] transition-colors hover:bg-[#e6f8d9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <MessageCircle aria-hidden="true" className="size-4" /> Chat với chuyên gia
              </a>
              <a
                href="#lien-he"
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/80 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <Send aria-hidden="true" className="size-4" /> Yêu cầu tư vấn
              </a>
            </div>
          </div>
        </div>

        <div aria-hidden="true" className="absolute -right-24 bottom-0 top-0 hidden w-[52%] overflow-hidden md:block">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_58%_42%,#f6b74b_0_7%,transparent_7.5%),radial-gradient(ellipse_at_78%_70%,#f2d04d_0_8%,transparent_8.5%),radial-gradient(ellipse_at_30%_74%,#e45732_0_9%,transparent_9.5%),radial-gradient(ellipse_at_64%_8%,#d95b34_0_8%,transparent_8.5%),radial-gradient(ellipse_at_12%_23%,#f4e0ab_0_11%,transparent_11.5%),linear-gradient(135deg,#202b17_0_42%,#334a1e_42%_100%)]" />
          <div className="absolute -right-4 top-7 size-64 rounded-full border-[20px] border-[#e7e1bf] bg-[radial-gradient(circle_at_40%_40%,#a63e1d_0_12%,#e77025_13%_28%,#f5dc81_29%_52%,#d0782a_53%_70%,#342915_71%)] shadow-2xl" />
          <div className="absolute bottom-[-34px] left-[12%] size-52 rounded-full bg-[repeating-radial-gradient(circle_at_center,#edca4f_0_4px,#9c5f1e_5px_7px,#3c2b18_8px_11px)] opacity-90" />
          <Leaf className="absolute bottom-12 left-[40%] size-28 rotate-[-28deg] text-[#89b933]" fill="currentColor" />
          <Truck className="absolute bottom-9 right-[35%] size-16 text-white/40" strokeWidth={1} />
          <Box className="absolute right-[13%] top-[43%] size-20 rotate-12 text-[#e7bf66]" strokeWidth={1.1} />
        </div>
      </div>
    </section>
  )
}
