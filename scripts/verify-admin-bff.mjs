import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { chromium } from "playwright";

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
async function port() { const server = createNetServer(); server.listen(0, "127.0.0.1"); await once(server, "listening"); const value = server.address(); assert.ok(value && typeof value !== "string"); await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); return value.port; }
async function waitFor(url, process, logs) { for (let index = 0; index < 300; index += 1) { try { if ((await fetch(url)).ok) return; } catch {} if (process.exitCode !== null) throw new Error(logs.join("")); await delay(100); } throw new Error("Admin Next server did not start."); }
async function stop(process) { if (process.exitCode === null) process.kill("SIGTERM"); await Promise.race([once(process, "exit"), delay(3000)]); if (process.exitCode === null) spawnSync("taskkill", ["/pid", String(process.pid), "/t", "/f"], { windowsHide: true }); }
function body(response, status, payload, cookies = []) { response.writeHead(status, { "Content-Type": "application/json", "Set-Cookie": cookies }); response.end(JSON.stringify(payload)); }

const requests = [];
const upstream = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1"); const cookie = request.headers.cookie ?? ""; const xsrf = request.headers["x-xsrf-token"];
  requests.push({ path: url.pathname, method: request.method, cookie, xsrf });
  assert.doesNotMatch(cookie, /marketing=secret/, "Only allowlisted administrative cookies may reach Bagisto.");
  if (url.pathname.endsWith("/me") && cookie.includes("laravel_session=catalog-only")) return body(response, 200, { data: { id: 7, name: "Catalog", email: "catalog@example.test", role: { id: 1, name: "Catalog" }, permissions: ["b2b.catalog.read"] } });
  if (url.pathname.endsWith("/me")) return body(response, 401, { code: "unauthenticated", message: "x", trace_id: "00000000-0000-4000-8000-000000000000" }, ["XSRF-TOKEN=abc%2520token; Path=/; SameSite=Lax", "laravel_session=pre-session; Path=/; HttpOnly", "marketing=must-not-propagate; Path=/"]);
  if (url.pathname.endsWith("/product-aggregates")) return body(response, 200, { data: [], links: { first: null, last: null, prev: null, next: null }, meta: { current_page: 1, from: null, last_page: 1, path: "/api/b2b/admin/v1/product-aggregates", per_page: 12, to: null, total: 0, channel: "default", locale: "vi", currency: "VND", contract_version: 1 } });
  if (url.pathname.endsWith("/session") && request.method === "POST") {
    assert.match(cookie, /XSRF-TOKEN=abc%2520token/); assert.match(cookie, /laravel_session=pre-session/); assert.equal(xsrf, "abc%20token");
    return body(response, 202, { code: "two_factor_required", message: "x", trace_id: "00000000-0000-4000-8000-000000000000" }, ["laravel_session=two-factor-session; Path=/; HttpOnly"]);
  }
  if (url.pathname.endsWith("/two-factor")) { assert.match(cookie, /laravel_session=two-factor-session/); assert.equal(xsrf, "abc%20token"); return body(response, 200, { data: { two_factor_verified: true } }, ["laravel_session=verified-session; Path=/; HttpOnly"]); }
  if (url.pathname.endsWith("/session") && request.method === "DELETE" && cookie.includes("catalog-only")) return body(response, 500, { error: "safe" });
  if (url.pathname.endsWith("/session") && request.method === "DELETE") { assert.match(cookie, /laravel_session=verified-session/); assert.equal(xsrf, "abc%20token"); response.writeHead(204, { "Set-Cookie": ["XSRF-TOKEN=rotated; Path=/; SameSite=Lax", "laravel_session=; Path=/; Max-Age=0; HttpOnly"] }); return response.end(); }
  response.writeHead(404).end();
});
const upstreamPort = await port(); upstream.listen(upstreamPort, "127.0.0.1"); await once(upstream, "listening");
const appPort = await port(); const logs = []; const app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(appPort)], { env: { ...process.env, BAGISTO_ADMIN_API_URL: `http://127.0.0.1:${upstreamPort}/api/b2b/admin/v1` }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true }); app.stdout.on("data", (chunk) => logs.push(String(chunk))); app.stderr.on("data", (chunk) => logs.push(String(chunk)));
try {
  const origin = `http://localhost:${appPort}`; await waitFor(`http://127.0.0.1:${appPort}/`, app, logs);
  const loginPage = await fetch(`${origin}/quan-tri/dang-nhap`, { redirect: "manual" });
  assert.equal(loginPage.status, 200, "The public login page must not be wrapped by the protected layout.");
  const protectedPage = await fetch(`${origin}/quan-tri`, { redirect: "manual" });
  assert.equal(protectedPage.status, 307, "An unauthenticated protected route must redirect.");
  assert.match(protectedPage.headers.get("location") ?? "", /^\/quan-tri\/dang-nhap\?returnTo=/);
  const catalogLanding = await fetch(`${origin}/quan-tri`, { headers: { Cookie: "laravel_session=catalog-only" }, redirect: "manual" });
  assert.equal(catalogLanding.status, 307, "Catalog-only users must land in catalog instead of a forbidden dashboard.");
  assert.equal(catalogLanding.headers.get("location"), "/quan-tri/san-pham");
  const rejected = await fetch(`${origin}/api/quan-tri/session`, { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" }, body: JSON.stringify({ email: "a@example.test", password: "correct-password" }) }); assert.equal(rejected.status, 403);
  const malformed = await fetch(`${origin}/api/quan-tri/session`, { method: "POST", headers: { Origin: origin }, body: "email=x" }); assert.equal(malformed.status, 422, "Mutations must require JSON before parsing.");
  const login = await fetch(`${origin}/api/quan-tri/session`, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin, Cookie: "marketing=secret" }, body: JSON.stringify({ email: "a@example.test", password: "correct-password" }) }); assert.equal(login.status, 202); const loginCookies = login.headers.getSetCookie(); assert.equal(loginCookies.length, 3); assert.equal(loginCookies.some((value) => value.startsWith("marketing=")), false); const cookie = loginCookies.map((value) => value.split(";", 1)[0]).join("; ");
  const twoFactor = await fetch(`${origin}/api/quan-tri/two-factor`, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin, Cookie: cookie }, body: JSON.stringify({ code: "123456" }) }); assert.equal(twoFactor.status, 200); const verifiedCookie = [...loginCookies, ...twoFactor.headers.getSetCookie()].map((value) => value.split(";", 1)[0]).join("; ");
  const logout = await fetch(`${origin}/api/quan-tri/session`, { method: "DELETE", headers: { Origin: origin, Cookie: verifiedCookie } }); assert.equal(logout.status, 204); assert.equal(logout.headers.getSetCookie().length, 2);
  assert.deepEqual(requests.map((request) => `${request.method} ${request.path}`), ["GET /api/b2b/admin/v1/me", "GET /api/b2b/admin/v1/me", "GET /api/b2b/admin/v1/me", "GET /api/b2b/admin/v1/me", "POST /api/b2b/admin/v1/session", "POST /api/b2b/admin/v1/two-factor", "DELETE /api/b2b/admin/v1/session"]);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try { const page = await browser.newPage(); await page.context().addCookies([{ name: "laravel_session", value: "catalog-only", domain: "localhost", path: "/" }, { name: "XSRF-TOKEN", value: "abc%2520token", domain: "localhost", path: "/" }]); const meBefore = requests.filter((request) => request.path.endsWith("/me")).length; await page.goto(`${origin}/quan-tri/san-pham?q=bot&sort=name&page=2`, { waitUntil: "networkidle" }); assert.equal(requests.filter((request) => request.path.endsWith("/me")).length, meBefore + 1, "A protected render must memoize /me within the request."); const previous = new URL((await page.getByRole("link", { name: "Trước" }).getAttribute("href")) ?? "", origin); assert.equal(previous.pathname, "/quan-tri/san-pham"); assert.equal(previous.searchParams.get("q"), "bot"); assert.equal(previous.searchParams.get("sort"), "name"); assert.equal(previous.searchParams.get("page"), "1"); const display = await page.locator("#admin-nav").evaluate((element) => getComputedStyle(element.parentElement).display); assert.equal(display, "grid", "Desktop shell must use a grid parent instead of normal-flow sidebar."); await page.getByRole("button", { name: "Đăng xuất" }).last().click(); const logoutAlert = page.getByText(/Không thể đăng xuất|Không thể kết nối/); await logoutAlert.waitFor(); assert.match(await logoutAlert.textContent() ?? "", /Không thể đăng xuất|Không thể kết nối/); assert.match(page.url(), /\/quan-tri\/san-pham/); await page.close(); } finally { await browser.close(); }
  console.log("admin fake-upstream cookie, CSRF, 2FA, and logout handshake passed");
} finally { await stop(app); await new Promise((resolve) => upstream.close(resolve)); }
