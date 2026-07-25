import Link from "next/link";

const links = [
  { href: "/", label: "Trang chủ" },
  { href: "/san-pham", label: "Sản phẩm" },
  { href: "/thue-gia-cong", label: "Dịch vụ gia công" },
  { href: "/lien-he", label: "Gửi yêu cầu" },
];

export function StorefrontShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-stone-50 text-stone-900">
      <a className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2" href="#main">Bỏ qua nội dung</a>
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <Link className="text-xl font-bold tracking-tight text-emerald-800" href="/">Giacong.vn</Link>
          <nav aria-label="Điều hướng chính" className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-stone-700">
            {links.map((link) => <Link className="hover:text-emerald-800" href={link.href} key={link.href}>{link.label}</Link>)}
          </nav>
        </div>
      </header>
      {children}
      <footer className="border-t border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-7 text-sm text-stone-600 sm:flex-row sm:items-center sm:justify-between">
          <p>Giacong.vn · Kết nối nhu cầu sản phẩm và gia công.</p>
          <Link className="font-medium text-emerald-800 hover:underline" href="/lien-he">Gửi yêu cầu tư vấn</Link>
        </div>
      </footer>
    </div>
  );
}
