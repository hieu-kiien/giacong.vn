/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

import type { NewsArticleSummary } from "@/lib/news-data-core";

interface NewsCardProps {
  article: NewsArticleSummary;
  compact?: boolean;
}

export function NewsCard({ article, compact = false }: NewsCardProps) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-lg border border-commerce-border bg-white shadow-sm transition-shadow hover:shadow-md">
      <Link
        aria-label={`Đọc bài ${article.title}`}
        className={compact ? "block aspect-[16/9] overflow-hidden bg-neutral-100" : "block aspect-[3/2] overflow-hidden bg-neutral-100"}
        href={`/tin-tuc/${article.slug}/`}
      >
        {article.thumbnailUrl ? (
          <img
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            loading="lazy"
            src={article.thumbnailUrl}
          />
        ) : (
          <span className="flex h-full items-center justify-center px-6 text-center text-sm font-semibold uppercase tracking-[0.08em] text-commerce-secondary">
            Giacong.vn
          </span>
        )}
      </Link>

      <div className={compact ? "flex flex-1 flex-col p-4" : "flex flex-1 flex-col p-5"}>
        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold uppercase tracking-[0.04em] text-commerce-brand-dark">
          {article.category ? <span>{article.category.name}</span> : null}
          {article.featured ? <span className="rounded-full bg-commerce-brand/10 px-2 py-0.5">Nổi bật</span> : null}
        </div>

        <h2 className={compact ? "text-lg font-bold leading-snug" : "text-xl font-bold leading-snug"}>
          <Link className="text-commerce-body hover:text-commerce-brand-dark" href={`/tin-tuc/${article.slug}/`}>
            {article.title}
          </Link>
        </h2>

        {article.excerpt ? (
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-commerce-secondary">{article.excerpt}</p>
        ) : null}

        <div className="mt-auto pt-4 text-xs text-commerce-secondary">
          <time dateTime={article.publishedAt}>{formatPublishedDate(article.publishedAt)}</time>
        </div>
      </div>
    </article>
  );
}

function formatPublishedDate(value: string): string {
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}
