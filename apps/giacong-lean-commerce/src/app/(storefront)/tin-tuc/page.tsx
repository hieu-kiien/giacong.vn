import type { Metadata } from "next";
import Link from "next/link";

import { NewsCard } from "@/components/news/NewsCard";
import { CapturedStorefrontShell } from "@/components/site/CapturedStorefrontShell";
import { getNewsList } from "@/lib/news-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tin tức | Giacong.vn",
  description: "Tin tức, kiến thức và cập nhật mới từ Giacong.vn.",
};

type NewsSearchParams = Record<string, string | string[] | undefined>;

interface NewsPageProps {
  searchParams: Promise<NewsSearchParams>;
}

export default async function NewsPage({ searchParams }: NewsPageProps) {
  const raw = await searchParams;
  const category = firstValue(raw.category).slice(0, 120);
  const query = firstValue(raw.q).slice(0, 120);
  const page = positiveInteger(firstValue(raw.page), 1);
  const result = await getNewsList({ category, page, perPage: 9, query });

  return (
    <CapturedStorefrontShell activeNavigation="news">
      <main id="main">
        <div className="blog-wrapper blog-archive page-wrapper" id="content">
          <header className="archive-page-header">
            <div className="row">
              <div className="large-12 text-center col">
                <nav aria-label="breadcrumbs" className="rank-math-breadcrumb">
                  <p>
                    <Link href="/">Trang chủ</Link>
                    <span className="separator"> » </span>
                    <span className="last">Tin tức</span>
                  </p>
                </nav>
                <h1 className="page-title is-large uppercase"><span>Tin tức</span></h1>
              </div>
            </div>
          </header>

          <div className="row align-center">
            <div className="large-12 col">
              <section className="mx-auto max-w-[1262px] px-4 pb-14 sm:px-6" aria-label="Danh sách tin tức">
                <div className="mb-6 flex flex-col gap-4 border-b border-commerce-border pb-5 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-sm font-medium text-commerce-secondary">
                      {result.total > 0 ? `${result.total} bài viết đã xuất bản` : "Chưa có bài viết đã xuất bản"}
                    </p>
                    {query ? (
                      <p className="mt-1 text-sm text-commerce-secondary">Kết quả tìm kiếm cho “{query}”</p>
                    ) : null}
                  </div>

                  <form action="/tin-tuc/" className="flex w-full max-w-xl" method="get" role="search">
                    {category ? <input name="category" type="hidden" value={category} /> : null}
                    <label className="sr-only" htmlFor="news-query">Tìm bài viết</label>
                    <input
                      className="min-h-11 min-w-0 flex-1 rounded-l-[5px] border border-r-0 border-commerce-border bg-white px-3 text-sm text-commerce-body focus-visible:commerce-focus-ring"
                      defaultValue={query}
                      id="news-query"
                      maxLength={120}
                      name="q"
                      placeholder="Tìm trong tin tức..."
                      type="search"
                    />
                    <button
                      className="!m-0 min-h-11 rounded-r-[5px] bg-commerce-brand px-5 text-sm font-semibold text-white hover:bg-commerce-brand-dark focus-visible:commerce-focus-ring"
                      type="submit"
                    >
                      Tìm kiếm
                    </button>
                  </form>
                </div>

                <nav aria-label="Danh mục tin tức" className="mb-7 flex gap-2 overflow-x-auto pb-1">
                  <Link
                    className={categoryChipClass(!category)}
                    href={newsHref({ query })}
                  >
                    Tất cả
                  </Link>
                  {result.categories.map((item) => (
                    <Link
                      className={categoryChipClass(category === item.slug)}
                      href={newsHref({ category: item.slug, query })}
                      key={item.id}
                    >
                      {item.name}
                    </Link>
                  ))}
                </nav>

                {result.articles.length > 0 ? (
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {result.articles.map((article) => <NewsCard article={article} key={article.id} />)}
                  </div>
                ) : (
                  <div className="rounded-lg border border-commerce-border bg-white px-6 py-14 text-center">
                    <h2 className="text-xl font-bold text-commerce-body">Chưa tìm thấy bài viết phù hợp</h2>
                    <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-commerce-secondary">
                      Hãy thử bỏ bộ lọc danh mục hoặc dùng một từ khóa khác.
                    </p>
                    {(category || query) ? (
                      <Link className="mt-5 inline-flex font-semibold text-commerce-brand-dark hover:underline" href="/tin-tuc/">
                        Xem tất cả tin tức
                      </Link>
                    ) : null}
                  </div>
                )}

                {result.totalPages > 1 ? (
                  <nav aria-label="Phân trang tin tức" className="mt-9 flex items-center justify-center gap-2">
                    {result.page > 1 ? (
                      <Link
                        className="rounded-[5px] border border-commerce-border bg-white px-4 py-2 text-sm font-semibold text-commerce-body hover:border-commerce-brand hover:text-commerce-brand-dark"
                        href={newsHref({ category, page: result.page - 1, query })}
                      >
                        Trang trước
                      </Link>
                    ) : null}
                    <span className="px-3 text-sm text-commerce-secondary">
                      Trang {Math.min(result.page, result.totalPages)} / {result.totalPages}
                    </span>
                    {result.page < result.totalPages ? (
                      <Link
                        className="rounded-[5px] border border-commerce-border bg-white px-4 py-2 text-sm font-semibold text-commerce-body hover:border-commerce-brand hover:text-commerce-brand-dark"
                        href={newsHref({ category, page: result.page + 1, query })}
                      >
                        Trang sau
                      </Link>
                    ) : null}
                  </nav>
                ) : null}
              </section>
            </div>
          </div>
        </div>
      </main>
    </CapturedStorefrontShell>
  );
}

function categoryChipClass(active: boolean): string {
  return active
    ? "whitespace-nowrap rounded-full bg-commerce-brand px-4 py-2 text-sm font-semibold text-white"
    : "whitespace-nowrap rounded-full border border-commerce-border bg-white px-4 py-2 text-sm font-semibold text-commerce-body hover:border-commerce-brand hover:text-commerce-brand-dark";
}

function newsHref(input: { category?: string; page?: number; query?: string }): string {
  const params = new URLSearchParams();
  if (input.category) params.set("category", input.category);
  if (input.query) params.set("q", input.query);
  if (input.page && input.page > 1) params.set("page", String(input.page));
  const query = params.toString();
  return query ? `/tin-tuc/?${query}` : "/tin-tuc/";
}

function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function positiveInteger(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
