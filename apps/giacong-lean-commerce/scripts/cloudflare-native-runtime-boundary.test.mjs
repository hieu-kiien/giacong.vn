import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const appRoot = fileURLToPath(new URL("../src/app/", import.meta.url));
const libRoot = fileURLToPath(new URL("../src/lib/", import.meta.url));

async function sourceFiles(root) {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(absolute));
    else if (/\.(?:ts|tsx)$/.test(entry.name)) files.push(absolute);
  }
  return files;
}

test("runtime source does not reintroduce Bagisto client dependencies", async () => {
  const files = [...await sourceFiles(appRoot), ...await sourceFiles(libRoot)];
  const violations = [];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    if (/@\/lib\/bagisto-|BAGISTO_API_URL|BAGISTO_PROXY_ORIGIN/.test(source)) {
      violations.push(path.relative(path.dirname(appRoot), file));
    }
  }

  assert.deepEqual(violations, [], `Bagisto runtime boundary violations: ${violations.join(", ")}`);
});
