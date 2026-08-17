import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { NewsArticleView } from "@/components/news/NewsArticleView";
import { CapturedStorefrontShell } from "@/components/site/CapturedStorefrontShell";
import { getNewsArticle, getRelatedNews } from "@/lib/news-data";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/tin-tuc/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const article = await getNewsArticle(slug);
  if (!article) {
    return {
      title: "Không tìm thấy bài viết | Giacong.vn",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: article.seoTitle || `${article.title} | Giacong.vn`,
    description: article.seoDescription || article.excerpt,
    openGraph: {
      type: "article",
      title: article.seoTitle || article.title,
      description: article.seoDescription || article.excerpt,
      publishedTime: article.publishedAt,
      images: article.thumbnailUrl ? [{ url: article.thumbnailUrl }] : undefined,
    },
  };
}

export default async function NewsArticlePage({ params }: PageProps<"/tin-tuc/[slug]">) {
  const { slug } = await params;
  const article = await getNewsArticle(slug);
  if (!article) notFound();

  const related = await getRelatedNews({
    articleId: article.id,
    categoryId: article.category?.id ?? null,
    limit: 3,
  });

  return (
    <CapturedStorefrontShell activeNavigation="news">
      <NewsArticleView article={article} related={related} />
    </CapturedStorefrontShell>
  );
}
