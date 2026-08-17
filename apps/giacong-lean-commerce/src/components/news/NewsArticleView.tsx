/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

import type { NewsArticleDetail, NewsArticleSummary } from "@/lib/news-data-core";

interface NewsArticleViewProps {
  article: NewsArticleDetail;
  related: NewsArticleSummary[];
}

export function NewsArticleView({ article, related }: NewsArticleViewProps) {
  const paragraphs = article.contentText
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <main id="main" className="bg-white">
      <article className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <nav aria-label="breadcrumbs" className="mb-6 text-sm text-neutral-600">
          <Link className="hover:text-neutral-950 hover:underline" href="/">Trang chủ</Link>
          <span className="px-2" aria-hidden="true">»</span>
          <Link className="hover:text-neutral-950 hover:underline" href="/tin-tuc">Tin tức</Link>
          {article.category ? (
            <>
              <span className="px-2" aria-hidden="true">»</span>
              <Link
                className="hover:text-neutral-950 hover:underline"
                href={{ pathname: "/tin-tuc", query: { category: article.category.slug } }}
              >
                {article.category.name}
              </Link>
            </>
          ) : null}
        </nav>

        <header>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm font-medium text-neutral-500">
            {article.category ? <span>{article.category.name}</span> : null}
            {article.category ? <span aria-hidden="true">•</span> : null}
            <time dateTime={article.publishedAt}>{formatNewsDate(article.publishedAt)}</time>
          </div>
          <h1 className="text-3xl font-bold leading-tight text-neutral-950 sm:text-4xl lg:text-5xl">{article.title}</h1>
          {article.excerpt ? <p className="mt-5 text-lg leading-8 text-neutral-600">{article.excerpt}</p> : null}
        </header>

        {article.thumbnailUrl ? (
          <img
            alt=""
            className="mt-8 aspect-[16/9] w-full rounded-2xl bg-neutral-100 object-cover"
            src={article.thumbnailUrl}
          />
        ) : null}

        <div className="mt-10 space-y-5 text-base leading-8 text-neutral-800 sm:text-lg">
          {paragraphs.length > 0 ? paragraphs.map((paragraph, index) => (
            <p className="whitespace-pre-line" key={`${article.id}-${index}`}>{paragraph}</p>
          )) : (
            <p>Nội dung bài viết đang được cập nhật.</p>
          )}
        </div>
      </article>

      {related.length > 0 ? (
        <aside aria-labelledby="related-news-heading" className="border-t border-neutral-200 bg-neutral-50">
          <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-neutral-950" id="related-news-heading">Bài viết liên quan</h2>
            <div className="mt-5 grid gap-5 md:grid-cols-3">
              {related.map((item) => (
                <article key={item.id} className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
                  <time className="text-xs font-medium text-neutral-500" dateTime={item.publishedAt}>{formatNewsDate(item.publishedAt)}</time>
                  <h3 className="mt-2 text-lg font-bold leading-snug text-neutral-900">
                    <Link className="hover:underline" href={`/tin-tuc/${item.slug}`}>{item.title}</Link>
                  </h3>
                  {item.excerpt ? <p className="mt-2 line-clamp-3 text-sm leading-6 text-neutral-600">{item.excerpt}</p> : null}
                </article>
              ))}
            </div>
          </div>
        </aside>
      ) : null}
    </main>
  );
}

function formatNewsDate(value: string): string {
  const date = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "long",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}
