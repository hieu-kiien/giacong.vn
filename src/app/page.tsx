import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const dynamic = "force-static";

export default async function Home() {
  const markup = await readFile(join(process.cwd(), "src", "data", "giacong.html"), "utf8");

  return (
    <div dangerouslySetInnerHTML={{ __html: markup }} />
  );
}
