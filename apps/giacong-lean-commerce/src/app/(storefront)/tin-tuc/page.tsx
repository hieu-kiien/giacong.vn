import type { Metadata } from "next";

import { CapturedStorefrontShell } from "@/components/site/CapturedStorefrontShell";
import { getPublishedNews } from "@/lib/news-public";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tin tức | Giacong.vn",
  description: "Thông tin mới nhất về sản phẩm, năng lực sản xuất và hoạt động của Giacong.vn.",
};

function formatDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export default async function NewsListingPage() {
  const posts = await getPublishedNews();

  return (
    <CapturedStorefrontShell activeNavigation="products">
      <section className="catalog" style={{ margin: "0 auto", maxWidth: 1180, padding: "28px 16px 56px" }}>
        <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 6px" }}>Tin tức</h1>
        <p style={{ color: "#55635d", margin: "0 0 24px" }}>Thông tin mới nhất về sản phẩm và năng lực sản xuất.</p>
        {posts.length === 0 ? (
          <p style={{ color: "#55635d" }}>Chưa có bài viết nào được xuất bản.</p>
        ) : (
          <div style={{ display: "grid", gap: 18 }}>
            {posts.map((post) => (
              <article key={post.slug} style={{ background: "#fff", border: "1px solid #e2e8df", borderRadius: 10, display: "flex", gap: 16, overflow: "hidden", padding: 14 }}>
                {post.coverImageUrl
                  ? // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" src={post.coverImageUrl} style={{ borderRadius: 8, flex: "0 0 168px", height: 112, objectFit: "cover", width: 168 }} />
                  : null}
                <div style={{ minWidth: 0 }}>
                  <h2 style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.3, margin: "0 0 6px" }}>
                    <a href={`/tin-tuc/${post.slug}/`} style={{ color: "inherit", textDecoration: "none" }}>{post.title}</a>
                  </h2>
                  <p style={{ color: "#55635d", fontSize: 14, lineHeight: 1.5, margin: "0 0 8px" }}>{post.excerpt}</p>
                  <time style={{ color: "#84918a", fontSize: 12.5 }}>{formatDate(post.publishedAt)}</time>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </CapturedStorefrontShell>
  );
}
