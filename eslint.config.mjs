import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "bagisto/**",
    ".worktrees/**",
    "next-env.d.ts",
    // GitNexus writes its index and CommonJS runner here. Untracked via
    // .git/info/exclude, which ESLint does not read.
    ".gitnexus/**",
  ]),
]);

export default eslintConfig;
