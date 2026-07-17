import type { Metadata } from "next";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { CapturedPage } from "@/components/CapturedPage";
import type { CapturedPageData } from "@/types/captured-page";

export const dynamic = "force-static";

async function readHome(): Promise<CapturedPageData> {
  return JSON.parse(
    await readFile(join(process.cwd(), "src", "data", "pages", "home.json"), "utf8"),
  ) as CapturedPageData;
}

export async function generateMetadata(): Promise<Metadata> {
  const data = await readHome();
  return { title: data.title, description: data.description };
}

export default async function Home() {
  const data = await readHome();
  return <CapturedPage {...data} />;
}
