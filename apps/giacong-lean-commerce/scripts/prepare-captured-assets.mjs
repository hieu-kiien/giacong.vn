import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { extractLegacyArticle } from "./legacy-article-import.mjs";

const sourceDirectory = resolve("src/data/pages");
const targetDirectory = resolve("public/captured-pages");

await rm(targetDirectory, { force: true, recursive: true });
await mkdir(resolve("public"), { recursive: true });
await cp(sourceDirectory, targetDirectory, { recursive: true });

const editableDirectory = resolve(targetDirectory, "editable-articles");
await mkdir(editableDirectory, { recursive: true });
let availableCount = 0;
let unavailableCount = 0;
for (const entry of await readdir(sourceDirectory, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".json") || entry.name === "manifest.json") continue;
  const source = JSON.parse(await readFile(resolve(sourceDirectory, entry.name), "utf8"));
  let editableArticle;
  try {
    const result = extractLegacyArticle(source);
    editableArticle = result
      ? { available: true, ...result }
      : { available: false, reason: "Không tìm thấy vùng nội dung bài viết trong trang cũ." };
  } catch (error) {
    editableArticle = {
      available: false,
      reason: error instanceof Error ? error.message : "Không thể nhập đầy đủ nội dung trang cũ.",
    };
  }
  if (editableArticle.available) availableCount += 1;
  else unavailableCount += 1;
  await writeFile(resolve(editableDirectory, entry.name), JSON.stringify(editableArticle));
}

console.log(`Prepared captured page assets in ${targetDirectory}; ${availableCount} editable, ${unavailableCount} require manual handling.`);
