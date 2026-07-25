import Link from "next/link";

export default function Home() {
  return <main id="main">
    <section className="border-b border-emerald-950 bg-emerald-900 text-white">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
        <p className="text-sm font-semibold text-emerald-200">SẢN PHẨM VÀ DỊCH VỤ GIA CÔNG</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">Xem sản phẩm, chọn số lượng và gửi yêu cầu tư vấn.</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-emerald-100">Website giúp khách để lại đúng nhu cầu. Nhân viên tiếp nhận và tư vấn bên ngoài website.</p>
        <div className="mt-8 flex flex-wrap gap-3"><Link className="rounded bg-white px-5 py-3 font-semibold text-emerald-900" href="/san-pham">Xem sản phẩm</Link><Link className="rounded border border-emerald-300 px-5 py-3 font-semibold text-white" href="/lien-he">Gửi yêu cầu</Link></div>
      </div>
    </section>
    <section className="mx-auto grid max-w-6xl gap-5 px-5 py-14 md:grid-cols-3">
      {[['1', 'Xem sản phẩm', 'Xem giá theo số lượng và lựa chọn phù hợp.'], ['2', 'Gửi yêu cầu', 'Thông tin được chuyển cho đội tư vấn xử lý.'], ['3', 'Trao đổi trực tiếp', 'Tư vấn viên xác nhận nhu cầu và phương án tiếp theo.']].map(([number, title, text]) => <article className="rounded border border-stone-200 bg-white p-6" key={number}><p className="text-sm font-bold text-emerald-800">Bước {number}</p><h2 className="mt-3 text-xl font-bold">{title}</h2><p className="mt-2 leading-7 text-stone-600">{text}</p></article>)}
    </section>
  </main>;
}
