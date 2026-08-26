import type { Metadata } from "next";
import Link from "next/link";

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
    <CapturedStorefrontShell>
      <main className="giacong-news-page" id="main">
        <section aria-labelledby="news-page-title" className="giacong-page-hero">
          <div aria-hidden="true" className="giacong-page-hero__orb giacong-page-hero__orb--one" />
          <div aria-hidden="true" className="giacong-page-hero__orb giacong-page-hero__orb--two" />
          <div className="giacong-page-hero__inner">
            <p className="giacong-page-hero__eyebrow">Giacong.vn cập nhật</p>
            <h1 id="news-page-title">Tin tức</h1>
            <nav aria-label="Breadcrumb" className="giacong-page-hero__breadcrumb">
              <Link href="/">Trang chủ</Link>
              <span aria-hidden="true">»</span>
              <span aria-current="page">Tin tức</span>
            </nav>
          </div>
        </section>

        <section aria-labelledby="news-list-title" className="giacong-news-list">
          <div className="giacong-content-rail">
            <header className="giacong-news-list__header">
              <div>
                <p className="giacong-section-kicker">Góc chia sẻ</p>
                <h2 id="news-list-title">Kiến thức và hoạt động mới nhất</h2>
              </div>
              <p>Thông tin về sản phẩm, năng lực sản xuất và những cập nhật từ Giacong.vn.</p>
            </header>

            {posts.length === 0 ? (
              <div className="giacong-news-empty" data-testid="news-empty-state">
                <span aria-hidden="true" className="giacong-news-empty__mark">g.</span>
                <h3>Chưa có bài viết mới</h3>
                <p>Nội dung đang được cập nhật. Bạn có thể tìm lại tin tức theo từ khóa khi bài viết được phát hành.</p>
                <form action="/tin-tuc/" className="giacong-news-search" role="search">
                  <label className="screen-reader-text" htmlFor="news-search">Tìm trong tin tức</label>
                  <input id="news-search" name="s" placeholder="Tìm trong tin tức" type="search" />
                  <button type="submit">Tìm kiếm</button>
                </form>
              </div>
            ) : (
              <div className="giacong-news-cards">
                {posts.map((post) => (
                  <article className="giacong-news-card" key={post.slug}>
                    {post.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt="" className="giacong-news-card__image" loading="lazy" src={post.coverImageUrl} />
                    ) : null}
                    <div className="giacong-news-card__body">
                      <time dateTime={post.publishedAt ?? undefined}>{formatDate(post.publishedAt)}</time>
                      <h3><Link href={`/tin-tuc/${post.slug}/`}>{post.title}</Link></h3>
                      <p>{post.excerpt}</p>
                      <Link className="giacong-news-card__link" href={`/tin-tuc/${post.slug}/`}>Đọc bài viết <span aria-hidden="true">→</span></Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </CapturedStorefrontShell>
  );
}
