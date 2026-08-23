import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import test from "node:test";

const libRoot = new URL("../src/lib/", import.meta.url);

async function exists(url) {
  try {
    await access(url);
    return true;
  } catch {
    return false;
  }
}

async function listLibFiles() {
  const entries = [];
  for (const entry of await readdir(libRoot)) {
    if (/\.(ts|tsx|mts|mjs)$/.test(entry) && (await exists(new URL(entry, libRoot)))) {
      entries.push(entry);
    }
  }
  return entries;
}

test("the retired Bagisto adapters are removed from the runtime tree", async () => {
  const removed = ["bagisto-api.ts", "bagisto-catalog.ts", "bagisto-services.ts", "service-cms-contract.ts"];
  for (const file of removed) {
    assert.equal(
      await exists(new URL(file, libRoot)),
      false,
      `${file} must be deleted; the Cloudflare-native catalog is the only boundary`,
    );
  }
});

test("no runtime source imports a Bagisto adapter or its shared contract", async () => {
  for (const file of await listLibFiles()) {
    const source = await readFile(new URL(file, libRoot), "utf8");
    assert.doesNotMatch(
      source,
      /from\s+"[^"]*bagisto-[^"]*"|from\s+"@\/lib\/service-cms-contract"/,
      `${file} still imports a retired Bagisto module`,
    );
  }
});

test("the Cloudflare catalog keeps the server-only, credential-free boundary the Bagisto adapter had", async () => {
  const source = await readFile(new URL("cloudflare-catalog.ts", libRoot), "utf8");

  assert.match(source, /^import "server-only";/m, "catalog data access must stay server-only");
  assert.doesNotMatch(source, /BAGISTO_|API_KEY|SECRET|PASSWORD/i, "catalog data must not read credential-like values");
});
