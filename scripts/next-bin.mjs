import { createRequire } from "node:module";

/**
 * Absolute path to the Next CLI entry point.
 *
 * Resolving through the package instead of a `node_modules/...` string keeps the
 * QA harnesses runnable from an isolated git worktree, where the dependency tree
 * may be hoisted to the parent checkout rather than sitting under `process.cwd()`.
 */
export const nextBinPath = createRequire(import.meta.url).resolve("next/dist/bin/next");
