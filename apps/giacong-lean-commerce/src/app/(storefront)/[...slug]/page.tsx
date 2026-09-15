import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { CapturedPage } from "@/components/CapturedPage";
import { CapturedStorefrontShell } from "@/components/site/CapturedStorefrontShell";
import { getStorefrontNavigationForPath } from "@/components/site/storefront-navigation";
import { PageBlocks } from "@/components/site/PageBlocks";
import aboutPage from "@/data/pages/gioi-thieu-ve-gia-cong.json";
import contactPage from "@/data/pages/lien-he.json";
import { resolveCapturedActiveMenuId } from "@/lib/captured-markup";
import { getPublishedSiteNavigation } from "@/lib/site-navigation";
import { getPublishedSitePage } from "@/lib/site-pages";
import { getPublishedSiteSettings } from "@/lib/site-settings";
import { getServiceFamilyForRoute } from "@/lib/service-content-index";
import { getManagedServiceFamily } from "@/lib/cloudflare-services";
import type { CapturedPageData } from "@/types/captured-page";
import { canonicalMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

interface CapturedRouteProps {
  params: Promise<{ slug: string[] }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

interface CapturedAssetsEnv {
  ASSETS?: {
    fetch(input: string): Promise<Response>;
  };
}

const capturedAssetBaseUrl = "https://assets.local/captured-pages";
const capturedAssetFilePattern = /^[A-Za-z0-9_-]+\.json$/;
const localCapturedPages: Readonly<Record<string, CapturedPageData>> = {
  "/gioi-thieu-ve-gia-cong/": aboutPage as CapturedPageData,
  "/lien-he/": contactPage as CapturedPageData,
};

async function readCapturedAsset<T>(file: string): Promise<T> {
  if (!capturedAssetFilePattern.test(file)) {
    throw new Error("Captured page asset name is invalid.");
  }

  const { env } = getCloudflareContext();
  const assets = (env as unknown as CapturedAssetsEnv).ASSETS;
  if (!assets) throw new Error("Missing ASSETS binding for captured pages.");

  const response = await assets.fetch(`${capturedAssetBaseUrl}/${file}`);
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Captured page asset unavailable: ${file}`);
  }

  const payload: unknown = await response.json();
  return payload as T;
}

const readCapturedManifest = cache(async (): Promise<Record<string, string>> => (
  readCapturedAsset<Record<string, string>>("manifest.json")
));

const readCapturedPath = cache(async (path: string): Promise<CapturedPageData> => {
  const localPage = localCapturedPages[path];
  try {
    const manifest = await readCapturedManifest();
    const file = manifest[path];
    if (!file) notFound();
    return await readCapturedAsset<CapturedPageData>(file);
  } catch (error) {
    if (!localPage) throw error;
    console.warn(`Captured page asset unavailable for ${path}; using the local captured fixture.`, error);
    return localPage;
  }
});

export async function generateMetadata({ params }: CapturedRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const routePath = `/${slug.join("/")}/`;
  const [managedPage, settings] = await Promise.all([getPublishedSitePage(routePath), getPublishedSiteSettings()]);
  if (managedPage?.blocks.length) {
    return {
      ...canonicalMetadata(routePath),
      title: managedPage.seoTitle || managedPage.title || settings.site_title,
      description: managedPage.seoDescription || settings.site_description,
      icons: settings.favicon_url ? { icon: settings.favicon_url } : undefined,
    };
  }
  const data = await readCapturedPath(routePath);
  return {
    ...canonicalMetadata(routePath),
    title: data.title || settings.site_title,
    description: data.description || settings.site_description,
    icons: settings.favicon_url ? { icon: settings.favicon_url } : undefined,
  };
}

export default async function CapturedRoute({ params, searchParams }: CapturedRouteProps) {
  const { slug } = await params;
  const routePath = `/${slug.join("/")}/`;
  const [managedPage, settings] = await Promise.all([getPublishedSitePage(routePath), getPublishedSiteSettings()]);
  if (managedPage?.blocks.length) {
    return (
      <CapturedStorefrontShell activeNavigation={getStorefrontNavigationForPath(routePath)?.key}>
        <PageBlocks blocks={managedPage.blocks} />
      </CapturedStorefrontShell>
    );
  }
  const [data, navigation] = await Promise.all([
    readCapturedPath(routePath),
    getPublishedSiteNavigation(),
  ]);
  const query = searchParams ? await searchParams : {};
  const requestedService = typeof query.service === "string" ? query.service : "";
  const serviceFamily = getServiceFamilyForRoute(routePath)
    ?? (routePath === "/lien-he/" && requestedService
      ? await getManagedServiceFamily(requestedService)
      : undefined);
  const serviceContextUrl = serviceFamily && routePath === "/lien-he/"
    ? `/thue-gia-cong/${serviceFamily.slug}/`
    : routePath;
  return (
    <CapturedPage
      {...data}
      siteSettings={settings}
      activeCapturedMenuId={resolveCapturedActiveMenuId(routePath)}
      navigation={navigation}
      serviceContext={serviceFamily ? {
        code: serviceFamily.slug,
        name: serviceFamily.name,
        url: serviceContextUrl,
      } : undefined}
      contactPageAction={routePath === "/lien-he/"}
    />
  );
}
