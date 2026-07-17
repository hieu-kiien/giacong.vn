import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { CapturedPage } from "@/components/CapturedPage";

export const dynamic = "force-static";

export default async function Home() {
  const data = JSON.parse(await readFile(join(process.cwd(), "src", "data", "pages", "home.json"), "utf8")) as { markup: string; pageStyles: string };
  return <CapturedPage markup={data.markup} pageStyles={data.pageStyles} />;
}
