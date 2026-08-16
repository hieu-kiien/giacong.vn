import type { Metadata } from "next";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { notFound } from "next/navigation";
import { cache } from "react";
import { CapturedPage } from "@/components/CapturedPage";
import { getPublishedSiteSettings } from "@/lib/site-settings";
import type { CapturedPageData } from "@/types/captured-page";

export const dynamic = "force-dynamic";

interface CapturedRouteProps {
  params: Promise<{ slug: string[] }>;
}

const readCapturedPath = cache(async (path: string): Promise<CapturedPageData> => {
  const manifest = JSON.parse(await readFile(join(process.cwd(), "src", "data", "pages", "manifest.json"), "utf8")) as Record<string, string>;
  const file = manifest[path];
  if (!file) notFound();
  return JSON.parse(
    await readFile(join(process.cwd(), "src", "data", "pages", file), "utf8"),
  ) as CapturedPageData;
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
