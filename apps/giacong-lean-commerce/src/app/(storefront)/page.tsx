import type { Metadata } from "next";

import { CapturedPage } from "@/components/CapturedPage";
import homePage from "@/data/pages/home.json";
import type { CapturedPageData } from "@/types/captured-page";

export const dynamic = "force-static";

const data = homePage as CapturedPageData;

export const metadata: Metadata = {
  title: data.title,
  description: data.description,
};

export default function Home() {
  return <CapturedPage {...data} />;
}
