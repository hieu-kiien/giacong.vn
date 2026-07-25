import { ContactRequestForm } from "@/components/storefront/ContactRequestForm";

export default function ContactPage() {
  return <main id="main" className="mx-auto grid max-w-6xl gap-10 px-5 py-12 lg:grid-cols-[1fr_minmax(0,560px)] lg:py-16">
    <section>
      <p className="text-sm font-semibold text-emerald-800">YÊU CẦU TƯ VẤN</p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight">Cho chúng tôi biết nhu cầu của bạn</h1>
      <p className="mt-5 max-w-xl leading-8 text-stone-600">Điền thông tin liên hệ và sản phẩm hoặc dịch vụ bạn quan tâm. Nhân viên sẽ tiếp nhận để tư vấn trực tiếp.</p>
    </section>
    <section className="rounded border border-stone-200 bg-stone-100 p-5 sm:p-7"><ContactRequestForm /></section>
  </main>;
}
