import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const repoRoot = path.join(import.meta.dirname, "..");
const srcRoot = path.join(repoRoot, "src");

const LEGACY_COLOR_NAMES =
  "(?:brand-(?:50|100|200|500|600|700|800|accent-(?:50|100|600|700))|ink(?:-soft|-muted)?|hairline(?:-strong)?|surface-(?:subtle|tinted)|price|stock|focus)";
const LEGACY_THEME_DECLARATION = new RegExp(`--color-${LEGACY_COLOR_NAMES}\\b`);
const LEGACY_UTILITY = new RegExp(
  `\\b(?:bg|text|border|ring|outline|from|via|to|fill|stroke|accent|caret)-${LEGACY_COLOR_NAMES}\\b`,
);

async function sourceFiles(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await sourceFiles(target)));
    } else if (/\\.(?:css|js|jsx|mjs|mts|ts|tsx)$/.test(entry.name)) {
      files.push(target);
    }
  }
  return files;
}

test("React surfaces use only the commerce colour namespace", async () => {
  const violations = [];

  for (const file of await sourceFiles(srcRoot)) {
    const source = await readFile(file, "utf8");
    if (LEGACY_THEME_DECLARATION.test(source) || LEGACY_UTILITY.test(source)) {
      violations.push(path.relative(repoRoot, file).replaceAll("\\\\", "/"));
    }
  }

  assert.deepEqual(
    violations,
    [],
    `legacy colour tokens must stay deleted; migrate these files to commerce-* first: ${violations.join(", ")}`,
  );
});

test("globals no longer publishes the frozen legacy palette", async () => {
  const globals = await readFile(path.join(srcRoot, "app", "globals.css"), "utf8");
  const foundation = await readFile(path.join(srcRoot, "styles", "commerce-foundation.css"), "utf8");

  assert.doesNotMatch(globals, /FROZEN — do not use in new code/);
  assert.doesNotMatch(globals, LEGACY_THEME_DECLARATION);
  assert.match(foundation, /--color-commerce-brand:\s*#5aa400/i);
  assert.match(foundation, /--color-commerce-brand-dark:\s*#457f00/i);
});
