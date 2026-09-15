import type { Metadata } from "next";

import { CapturedHomePage } from "@/components/site/CapturedHomePage";
import { PageBlocks } from "@/components/site/PageBlocks";
import { CapturedStorefrontShell } from "@/components/site/CapturedStorefrontShell";
import homePage from "@/data/pages/home.json";
import { getPublishedSiteSettings } from "@/lib/site-settings";
import { getPublishedSitePage } from "@/lib/site-pages";
import { canonicalMetadata } from "@/lib/seo";
import type { CapturedPageData } from "@/types/captured-page";

export const dynamic = "force-dynamic";

const data = homePage as CapturedPageData;

export async function generateMetadata(): Promise<Metadata> {
  const [settings, managedPage] = await Promise.all([getPublishedSiteSettings(), getPublishedSitePage("/")]);
  return {
    ...canonicalMetadata("/"),
    title: managedPage?.seoTitle || settings.site_title || data.title,
    description: managedPage?.seoDescription || settings.site_description || data.description,
    icons: settings.favicon_url ? { icon: settings.favicon_url } : undefined,
  };
}

export default async function Home() {
  const [settings, managedPage] = await Promise.all([getPublishedSiteSettings(), getPublishedSitePage("/")]);
  if (managedPage?.blocks.length) {
    return (
      <CapturedStorefrontShell>
        <PageBlocks blocks={managedPage.blocks} />
      </CapturedStorefrontShell>
    );
  }
  return <CapturedHomePage {...data} siteSettings={settings} />;
}
