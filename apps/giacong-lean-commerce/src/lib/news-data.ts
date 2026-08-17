import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cache } from "react";

import {
  getPublishedNewsArticle,
  listPublishedNews,
  listRelatedPublishedNews,
  type NewsArticleDetail,
  type NewsArticleSummary,
  type NewsD1Database,
  type NewsListResult,
} from "./news-data-core.ts";

interface CloudflareNewsEnv {
  GIACONG_VN_CATALOG?: NewsD1Database;
}

export const getNewsList = cache(async (input: {
  category?: string | null;
  page?: number;
  perPage?: number;
  query?: string | null;
} = {}): Promise<NewsListResult> => {
  return listPublishedNews(requireNewsDatabase(), input);
});

export const getNewsArticle = cache(async (slug: string): Promise<NewsArticleDetail | null> => {
  return getPublishedNewsArticle(requireNewsDatabase(), slug);
});

export const getRelatedNews = cache(async (input: {
  articleId: number;
  categoryId: number | null;
  limit?: number;
}): Promise<NewsArticleSummary[]> => {
  return listRelatedPublishedNews(requireNewsDatabase(), input);
});

function requireNewsDatabase(): NewsD1Database {
  let env: CloudflareNewsEnv;
  try {
    env = getCloudflareContext().env as unknown as CloudflareNewsEnv;
  } catch {
    throw new Error("Cloudflare D1 context is unavailable for News.");
  }

  if (!env.GIACONG_VN_CATALOG) {
    throw new Error("GIACONG_VN_CATALOG binding is unavailable for News.");
  }
  return env.GIACONG_VN_CATALOG;
}
