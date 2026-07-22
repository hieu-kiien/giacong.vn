import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();

async function source(path) {
  return readFile(resolve(root, path), "utf8");
}

const required = [
  "src/lib/admin-bff.ts",
  "src/lib/admin-contract.ts",
  "src/app/api/quan-tri/session/route.ts",
  "src/app/api/quan-tri/me/route.ts",
  "src/app/api/quan-tri/dashboard/route.ts",
  "src/app/api/quan-tri/san-pham/route.ts",
  "src/app/api/quan-tri/san-pham/[slug]/route.ts",
  "src/app/quan-tri/dang-nhap/page.tsx",
  "src/app/quan-tri/(protected)/layout.tsx",
  "src/app/quan-tri/(protected)/page.tsx",
  "src/app/quan-tri/(protected)/san-pham/page.tsx",
  "src/app/quan-tri/(protected)/san-pham/[slug]/page.tsx",
];

for (const path of required) {
  await source(path);
}

const bff = await source("src/lib/admin-bff.ts");
assert.match(bff, /BAGISTO_ADMIN_API_URL/);
assert.match(bff, /127\.0\.0\.1:8000\/api\/b2b\/admin\/v1/);
assert.match(bff, /X-XSRF-TOKEN/);
assert.match(bff, /getSetCookie/);
assert.match(bff, /no-store/);
assert.doesNotMatch(bff, /process\.env\[[^\]]+\]/);

const rootLayout = await source("src/app/layout.tsx");
assert.doesNotMatch(rootLayout, /next\/headers|headers\(|cookies\(|x-pathname/, "Root layout must not access request-time APIs.");

const routes = await Promise.all(required.filter((path) => path.includes("/api/")).map(source));
assert.equal(routes.join("\n").includes("8000"), false);

const login = await source("src/components/admin/LoginForm.tsx");
assert.match(login, /two_factor_required/);
assert.doesNotMatch(login.replace(/\/\/.*$/gm, ""), /(?:localStorage|sessionStorage)\s*(?:\.|\[)/, "Login must not persist credentials in browser storage.");
assert.doesNotMatch(login, /127\.0\.0\.1:8000/);

console.log("admin static contract checks passed");
