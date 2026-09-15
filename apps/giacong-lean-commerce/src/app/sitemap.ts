import type { MetadataRoute } from "next";

import manifest from "@/data/pages/manifest.json";
import { getCatalogProducts } from "@/lib/cloudflare-catalog";
import { getPublishedNews } from "@/lib/news-public";
import { getServiceContentIndex } from "@/lib/service-content-index";
import { getManagedServiceFamilies } from "@/lib/cloudflare-services";
import { PUBLIC_SITE_ORIGIN } from "@/lib/seo";
import type { CatalogFilters } from "@/types/catalog";

export const dynamic = "force-dynamic";

const paginationRoute = /\/page\/\d+\/$|\/page\/\d+$/;
const excludedRoutes = new Set(["/", "/san-pham/", "/tin-tuc/", "/gui-yeu-cau/"]);
const catalogFilters: CatalogFilters = {
  category: "",
  direction: "asc",
  page: 1,
  pageSize: 48,
  query: "",
  sort: "name",
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [catalogRoutes, newsRoutes, managedFamilies] = await Promise.all([
    readCatalogRoutes(),
    readNewsRoutes(),
    getManagedServiceFamilies(),
  ]);
  const capturedRoutes = Object.keys(manifest as Record<string, unknown>)
    .filter((route) => route.startsWith("/") && !excludedRoutes.has(route) && !paginationRoute.test(route));
  const serviceRoutes = [
    "/thue-gia-cong/",
    ...managedFamilies.map(({ slug }) => `/thue-gia-cong/${slug}/`),
    ...getServiceContentIndex().map(({ href }) => href),
  ];
  const paths = new Set([
    "/",
    "/san-pham/",
    "/tin-tuc/",
    "/lien-he/",
    "/gioi-thieu-ve-gia-cong/",
    ...capturedRoutes,
    ...serviceRoutes,
    ...catalogRoutes,
    ...newsRoutes,
  ]);

  return [...paths].map((path) => ({
    changeFrequency: "weekly" as const,
    url: new URL(path, PUBLIC_SITE_ORIGIN).toString(),
  }));
}

async function readCatalogRoutes(): Promise<string[]> {
  const routes: string[] = [];
  let page = 1;
  try {
    while (page <= 100) {
      const result = await getCatalogProducts({ ...catalogFilters, page });
      routes.push(...result.products.map(({ slug }) => `/san-pham/${slug}/`));
      if (page >= result.pagination.lastPage) break;
      page += 1;
    }
  } catch (error) {
    console.warn("Catalog sitemap entries unavailable; keeping static public routes.", error);
  }
  return routes;
}

async function readNewsRoutes(): Promise<string[]> {
  try {
    const posts = await getPublishedNews(500);
    return posts.map(({ slug }) => `/tin-tuc/${slug}/`);
  } catch (error) {
    console.warn("News sitemap entries unavailable; keeping static public routes.", error);
    return [];
  }
}
