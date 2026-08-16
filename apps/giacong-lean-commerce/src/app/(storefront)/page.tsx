import type { Metadata } from "next";

import { CapturedPage } from "@/components/CapturedPage";
import homePage from "@/data/pages/home.json";
import { getPublishedSiteSettings } from "@/lib/site-settings";
import type { CapturedPageData } from "@/types/captured-page";

export const dynamic = "force-dynamic";

const data = homePage as CapturedPageData;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublishedSiteSettings();
  return {
    title: settings.site_title || data.title,
    description: settings.site_description || data.description,
    icons: settings.favicon_url ? { icon: settings.favicon_url } : undefined,
  };
}

export default async function Home() {
  const settings = await getPublishedSiteSettings();
  return <CapturedPage {...data} siteSettings={settings} />;
}
