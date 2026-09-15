import type { Metadata } from "next";
import Link from "next/link";

import { AdminNewsContextualAction, AdminNewsCreateContextualAction } from "@/components/admin/AdminNewsContextualAction";
import { CapturedStorefrontShell } from "@/components/site/CapturedStorefrontShell";
import { getPublishedNewsPage } from "@/lib/news-public";
import { canonicalMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  ...canonicalMetadata("/tin-tuc/"),
  title: "Tin tức | Giacong.vn",
  description: "Thông tin mới nhất về sản phẩm, năng lực sản xuất và hoạt động của Giacong.vn.",
};

function formatDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function buildNewsPageHref(query: string, page: number): string {
  const params = new URLSearchParams();
  if (query) params.set("s", query);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `/tin-tuc/?${search}` : "/tin-tuc/";
}

type NewsListingPageProps = PageProps<"/tin-tuc">;

export default async function NewsListingPage({ searchParams }: NewsListingPageProps) {
  const params = await searchParams;
  const queryValue = params.s;
  const pageValue = params.page;
  const query = (Array.isArray(queryValue) ? queryValue[0] : queryValue)?.trim().slice(0, 100) ?? "";
  const requestedPageValue = Array.isArray(pageValue) ? pageValue[0] : pageValue;
  const requestedPage = Number(requestedPageValue);
  const newsPage = await getPublishedNewsPage(
    Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
    query,
  );
  const { lastPage, page: currentPage, posts, total } = newsPage;

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

            <div className="giacong-news-list__tools">
              <form action="/tin-tuc/" className="giacong-news-search giacong-news-search--toolbar" role="search">
                <label className="screen-reader-text" htmlFor="news-search">Tìm trong tin tức</label>
                <input defaultValue={query} id="news-search" name="s" placeholder="Tìm bài viết theo từ khóa" type="search" />
                <button type="submit">Tìm kiếm</button>
              </form>
              <AdminNewsCreateContextualAction />
              {query ? <Link className="giacong-news-search__clear" href="/tin-tuc/">Xóa tìm kiếm</Link> : null}
            </div>

            {total > 0 ? <p aria-live="polite" className="giacong-news-result-count">Hiển thị {(currentPage - 1) * newsPage.pageSize + 1}–{Math.min(currentPage * newsPage.pageSize, total)} trong {total} bài viết</p> : null}

            {posts.length === 0 ? (
              <div className="giacong-news-empty" data-testid="news-empty-state">
                <span aria-hidden="true" className="giacong-news-empty__mark">g.</span>
                <h3>{query ? `Không tìm thấy bài viết cho “${query}”` : "Chưa có bài viết mới"}</h3>
                <p>{query ? "Thử một từ khóa khác hoặc xóa bộ lọc để xem toàn bộ bài viết đã phát hành." : "Nội dung đang được cập nhật. Bạn có thể tìm lại tin tức theo từ khóa khi bài viết được phát hành."}</p>
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
                      <AdminNewsContextualAction label="Sửa bài viết" newsId={post.id} />
                    </div>
                  </article>
                ))}
              </div>
            )}

            {lastPage > 1 ? (
              <nav aria-label="Phân trang tin tức" className="giacong-news-pagination">
                {currentPage > 1 ? <Link href={buildNewsPageHref(query, currentPage - 1)} prefetch={false}>Trang trước</Link> : <span aria-disabled="true">Trang trước</span>}
                <span aria-current="page">Trang {currentPage} / {lastPage}</span>
                {currentPage < lastPage ? <Link href={buildNewsPageHref(query, currentPage + 1)} prefetch={false}>Trang sau</Link> : <span aria-disabled="true">Trang sau</span>}
              </nav>
            ) : null}
          </div>
        </section>
      </main>
    </CapturedStorefrontShell>
  );
}
