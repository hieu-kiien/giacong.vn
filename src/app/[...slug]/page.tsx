import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { notFound } from "next/navigation";
import { CapturedPage } from "@/components/CapturedPage";

interface CapturedData {
  markup: string;
  pageStyles: string;
  title: string;
}

export default async function CapturedRoute({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const path = `/${slug.join("/")}/`;
  const manifest = JSON.parse(await readFile(join(process.cwd(), "src", "data", "pages", "manifest.json"), "utf8")) as Record<string, string>;
  const file = manifest[path];
  if (!file) notFound();
  const data = JSON.parse(await readFile(join(process.cwd(), "src", "data", "pages", file), "utf8")) as CapturedData;
  return <CapturedPage markup={data.markup} pageStyles={data.pageStyles} />;
}
