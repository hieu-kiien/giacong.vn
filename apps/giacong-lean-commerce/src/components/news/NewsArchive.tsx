/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

import type { NewsListResult } from "@/lib/news-data-core";

interface NewsArchiveProps {
  category: string;
  data: NewsListResult;
  query: string;
}

export function NewsArchive({ category, data, query }: NewsArchiveProps) {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-16 pt-4 sm:px-6 lg:px-8" aria-labelledby="news-results-heading">
      <form action="/tin-tuc" method="get" className="mb-8 grid gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_minmax(180px,260px)_auto]">
        <label className="grid gap-1 text-sm font-medium text-neutral-700">
          Tìm bài viết
          <input
            className="min-h-11 rounded-lg border border-neutral-300 px-3 py-2 text-base text-neutral-900 outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
            defaultValue={query}
            maxLength={120}
            name="q"
            placeholder="Tên bài viết hoặc chủ đề"
            type="search"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-neutral-700">
          Chuyên mục
          <select
            className="min-h-11 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
            defaultValue={category}
            name="category"
          >
            <option value="">Tất cả chuyên mục</option>
            {data.categories.map((item) => (
              <option key={item.id} value={item.slug}>{item.name}</option>
            ))}
          </select>
        </label>
        <button className="min-h-11 self-end rounded-lg bg-neutral-900 px-5 py-2 font-semibold text-white hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2" type="submit">
          Lọc tin
        </button>
      </form>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900" id="news-results-heading">Bài viết mới</h2>
          <p className="mt-1 text-sm text-neutral-600" aria-live="polite">
            {data.total === 0 ? "Chưa có bài viết phù hợp." : `${data.total} bài viết đã xuất bản`}
          </p>
        </div>
        {(query || category) ? (
          <Link className="text-sm font-semibold text-neutral-700 underline underline-offset-4 hover:text-neutral-950" href="/tin-tuc">
            Xóa bộ lọc
          </Link>
        ) : null}
      </div>

      {data.articles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-12 text-center">
          <p className="text-lg font-semibold text-neutral-800">Chưa có bài viết để hiển thị</p>
          <p className="mt-2 text-sm text-neutral-600">Hãy thử một từ khóa hoặc chuyên mục khác.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {data.articles.map((article) => (
            <article key={article.id} className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md">
              <Link className="block" href={`/tin-tuc/${article.slug}`}>
                {article.thumbnailUrl ? (
                  <div className="aspect-[16/9] overflow-hidden bg-neutral-100">
                    <img
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
                      loading="lazy"
                      src={article.thumbnailUrl}
                    />
                  </div>
                ) : (
                  <div className="flex aspect-[16/9] items-center justify-center bg-neutral-100 px-5 text-center text-sm font-medium text-neutral-500">
                    Giacong.vn
                  </div>
                )}
                <div className="p-5">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-medium text-neutral-500">
                    {article.category ? <span>{article.category.name}</span> : null}
                    {article.category ? <span aria-hidden="true">•</span> : null}
                    <time dateTime={article.publishedAt}>{formatNewsDate(article.publishedAt)}</time>
                  </div>
                  <h3 className="text-lg font-bold leading-snug text-neutral-900">{article.title}</h3>
                  {article.excerpt ? <p className="mt-3 line-clamp-3 text-sm leading-6 text-neutral-600">{article.excerpt}</p> : null}
                  <span className="mt-4 inline-block text-sm font-semibold text-neutral-900">Đọc bài viết →</span>
                </div>
              </Link>
            </article>
          ))}
        </div>
      )}

      {data.totalPages > 1 ? (
        <nav aria-label="Phân trang tin tức" className="mt-10 flex items-center justify-center gap-3">
          {data.page > 1 ? (
            <Link className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50" href={newsHref(data.page - 1, query, category)}>
              Trang trước
            </Link>
          ) : null}
          <span className="text-sm text-neutral-600">Trang {data.page} / {data.totalPages}</span>
          {data.page < data.totalPages ? (
            <Link className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50" href={newsHref(data.page + 1, query, category)}>
              Trang sau
            </Link>
          ) : null}
        </nav>
      ) : null}
    </section>
  );
}

function newsHref(page: number, query: string, category: string) {
  return {
    pathname: "/tin-tuc",
    query: {
      ...(query ? { q: query } : {}),
      ...(category ? { category } : {}),
      ...(page > 1 ? { page: String(page) } : {}),
    },
  };
}

function formatNewsDate(value: string): string {
  const date = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}
