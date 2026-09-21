import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const packageJson = require("../node_modules/@opennextjs/cloudflare/package.json");
const targetPath = require.resolve("../node_modules/@opennextjs/cloudflare/dist/cli/commands/populate-cache.js");

const EXPECTED_VERSION = "1.20.5";
const ACCEPTED_ERROR = "Failed to check whether bucket exists: Connection error.";

if (packageJson.version !== EXPECTED_VERSION) {
  throw new Error(
    "Unsupported @opennextjs/cloudflare version " + packageJson.version + "; expected " + EXPECTED_VERSION + ". Update this release workaround before changing the adapter version.",
  );
}

const source = await readFile(targetPath, "utf8");

if (source.includes('logger.warn("OpenNext R2 preflight bypass:')) {
  console.log("OpenNext R2 preflight workaround already applied.");
  process.exit(0);
}

const guardPattern = /if\s*\(!result\.success\)\s*\{\s*throw new Error\(`Failed to provision remote R2 bucket "\$\{bucketName\}" for binding "\$\{R2_CACHE_BINDING_NAME\}": \$\{result\.error\}`\);\s*\}/;

const match = source.match(guardPattern);
if (!match) {
  throw new Error("OpenNext R2 provision guard changed; refusing to patch an unknown CLI build.");
}

const replacement = [
  "if (!result.success) {",
  '  if (result.error === ' + JSON.stringify(ACCEPTED_ERROR) + ') {',
  "    logger.warn(\"OpenNext R2 preflight bypass: Cloudflare bucket-existence check failed with Connection error; continuing to the R2 Worker population path.\");",
  "  } else {",
  "    throw new Error(`Failed to provision remote R2 bucket \"${bucketName}\" for binding \"${R2_CACHE_BINDING_NAME}\": ${result.error}`);",
  "  }",
  "}",
].join("\n");

const patched = source.replace(match[0], replacement);
await writeFile(targetPath, patched);

const verify = await readFile(targetPath, "utf8");
if (
  !verify.includes('logger.warn("OpenNext R2 preflight bypass:') ||
  !verify.includes(JSON.stringify(ACCEPTED_ERROR)) ||
  verify === source
) {
  throw new Error("OpenNext R2 preflight workaround verification failed.");
}

console.log("Patched OpenNext R2 preflight for " + packageJson.version + " at " + targetPath);