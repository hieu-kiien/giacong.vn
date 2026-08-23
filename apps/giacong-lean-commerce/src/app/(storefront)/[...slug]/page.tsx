import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { CapturedPage } from "@/components/CapturedPage";
import { getPublishedSiteSettings } from "@/lib/site-settings";
import type { CapturedPageData } from "@/types/captured-page";

export const dynamic = "force-dynamic";

interface CapturedRouteProps {
  params: Promise<{ slug: string[] }>;
}

interface CapturedAssetsEnv {
  ASSETS?: {
    fetch(input: string): Promise<Response>;
  };
}

const capturedAssetBaseUrl = "https://assets.local/captured-pages";
const capturedAssetFilePattern = /^[A-Za-z0-9_-]+\.json$/;

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
  const manifest = await readCapturedManifest();
  const file = manifest[path];
  if (!file) notFound();
  return readCapturedAsset<CapturedPageData>(file);
});

async function readCapturedRoute(params: CapturedRouteProps["params"]): Promise<CapturedPageData> {
  const { slug } = await params;
  return readCapturedPath(`/${slug.join("/")}/`);
}

export async function generateMetadata({ params }: CapturedRouteProps): Promise<Metadata> {
  const data = await readCapturedRoute(params);
  const settings = await getPublishedSiteSettings();
  return {
    title: data.title || settings.site_title,
    description: data.description || settings.site_description,
    icons: settings.favicon_url ? { icon: settings.favicon_url } : undefined,
  };
}

export default async function CapturedRoute({ params }: CapturedRouteProps) {
  const data = await readCapturedRoute(params);
  const settings = await getPublishedSiteSettings();
  return <CapturedPage {...data} siteSettings={settings} />;
}
