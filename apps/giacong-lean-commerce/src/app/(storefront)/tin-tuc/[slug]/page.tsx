/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { NewsCard } from "@/components/news/NewsCard";
import { CapturedStorefrontShell } from "@/components/site/CapturedStorefrontShell";
import { getNewsArticle, getRelatedNews } from "@/lib/news-data";

export const dynamic = "force-dynamic";

interface NewsDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: NewsDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getNewsArticle(slug);
  if (!article) return { title: "Không tìm thấy bài viết | Giacong.vn" };

  return {
    title: article.seoTitle || `${article.title} | Giacong.vn`,
    description: article.seoDescription || article.excerpt || undefined,
  };
}

export default async function NewsDetailPage({ params }: NewsDetailPageProps) {
  const { slug } = await params;
  const article = await getNewsArticle(slug);
  if (!article) notFound();

  const related = await getRelatedNews({
    articleId: article.id,
    categoryId: article.category?.id ?? null,
    limit: 3,
  });
  const paragraphs = article.contentText
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <CapturedStorefrontShell activeNavigation="news">
      <main id="main">
        <div className="page-wrapper" id="content">
          <article className="mx-auto max-w-[980px] px-4 pb-14 pt-8 sm:px-6 lg:pt-12">
            <nav aria-label="Breadcrumb" className="mb-6 text-sm text-commerce-secondary">
              <Link className="hover:text-commerce-brand-dark hover:underline" href="/">Trang chủ</Link>
              <span aria-hidden="true"> / </span>
              <Link className="hover:text-commerce-brand-dark hover:underline" href="/tin-tuc/">Tin tức</Link>
              {article.category ? (
                <>
                  <span aria-hidden="true"> / </span>
                  <Link
                    className="hover:text-commerce-brand-dark hover:underline"
                    href={`/tin-tuc/?category=${encodeURIComponent(article.category.slug)}`}
                  >
                    {article.category.name}
                  </Link>
                </>
              ) : null}
            </nav>

            <header className="mx-auto max-w-[860px] text-center">
              <div className="mb-3 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.05em] text-commerce-brand-dark">
                {article.category ? <span>{article.category.name}</span> : null}
                {article.featured ? <span className="rounded-full bg-commerce-brand/10 px-2 py-1">Nổi bật</span> : null}
              </div>
              <h1 className="text-3xl font-bold leading-tight text-commerce-body sm:text-4xl lg:text-[42px]">
                {article.title}
              </h1>
              <p className="mt-4 text-sm text-commerce-secondary">
                <time dateTime={article.publishedAt}>Xuất bản {formatPublishedDate(article.publishedAt)}</time>
              </p>
              {article.excerpt ? (
                <p className="mx-auto mt-6 max-w-[760px] text-lg leading-8 text-commerce-secondary">{article.excerpt}</p>
              ) : null}
            </header>

            {article.thumbnailUrl ? (
              <figure className="mx-auto mt-8 max-w-[900px] overflow-hidden rounded-lg bg-neutral-100">
                <img alt="" className="h-auto w-full object-cover" src={article.thumbnailUrl} />
              </figure>
            ) : null}

            <div className="mx-auto mt-9 max-w-[760px] text-[17px] leading-8 text-commerce-body">
              {paragraphs.length > 0 ? paragraphs.map((paragraph, index) => (
                <p className="mb-6 whitespace-pre-line" key={`${article.id}-${index}`}>{paragraph}</p>
              )) : (
                <p className="text-commerce-secondary">Nội dung bài viết đang được cập nhật.</p>
              )}
            </div>
          </article>

          {related.length > 0 ? (
            <section className="border-t border-commerce-border bg-neutral-50/70 py-12" aria-labelledby="related-news-title">
              <div className="mx-auto max-w-[1262px] px-4 sm:px-6">
                <div className="mb-6 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.05em] text-commerce-brand-dark">Đọc thêm</p>
                    <h2 className="mt-1 text-2xl font-bold text-commerce-body" id="related-news-title">Bài viết liên quan</h2>
                  </div>
                  <Link className="shrink-0 text-sm font-semibold text-commerce-brand-dark hover:underline" href="/tin-tuc/">
                    Xem tất cả
                  </Link>
                </div>
                <div className="grid gap-6 md:grid-cols-3">
                  {related.map((item) => <NewsCard article={item} compact key={item.id} />)}
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </main>
    </CapturedStorefrontShell>
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
