import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const sourceDirectory = resolve("src/data/pages");
const targetDirectory = resolve("public/captured-pages");

await rm(targetDirectory, { force: true, recursive: true });
await mkdir(resolve("public"), { recursive: true });
await cp(sourceDirectory, targetDirectory, { recursive: true });

console.log(`Prepared captured page assets in ${targetDirectory}`);
