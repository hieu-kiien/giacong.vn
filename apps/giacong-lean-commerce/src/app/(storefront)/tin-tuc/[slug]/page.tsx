import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CapturedStorefrontShell } from "@/components/site/CapturedStorefrontShell";
import { AdminNewsContextualAction } from "@/components/admin/AdminNewsContextualAction";
import { getPublishedNewsPost } from "@/lib/news-public";

export const dynamic = "force-dynamic";

interface NewsDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: NewsDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedNewsPost(slug);
  if (!post) return { title: "Không tìm thấy bài viết | Giacong.vn" };
  return { description: post.excerpt, title: `${post.title} | Giacong.vn` };
}

function formatDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export default async function NewsDetailPage({ params }: NewsDetailPageProps) {
  const { slug } = await params;
  const post = await getPublishedNewsPost(slug);
  if (!post) notFound();

  return (
    <CapturedStorefrontShell>
      <main className="giacong-news-detail" id="main">
        <article>
        <AdminNewsContextualAction newsId={post.id} />
        <p style={{ color: "#84918a", fontSize: 13, margin: "0 0 6px" }}>
          <Link href="/tin-tuc/" style={{ color: "#4d770f", textDecoration: "none" }}>← Tin tức</Link>
          {post.publishedAt ? ` · ${formatDate(post.publishedAt)}` : ""}
        </p>
        <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.25, margin: "0 0 14px" }}>{post.title}</h1>
        {post.coverImageUrl
          ? // eslint-disable-next-line @next/next/no-img-element
            <img alt="" src={post.coverImageUrl} style={{ borderRadius: 10, height: "auto", marginBottom: 20, maxWidth: "100%" }} />
          : null}
        <div style={{ color: "#2c3833", fontSize: 16, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{post.content}</div>
        </article>
      </main>
    </CapturedStorefrontShell>
  );
}
