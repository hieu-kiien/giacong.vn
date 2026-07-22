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
function body(response, status, payload, cookies = [], headers = {}) { response.writeHead(status, { "Content-Type": "application/json", "Set-Cookie": cookies, ...headers }); response.end(JSON.stringify(payload)); }

const requests = [];
const catalogAdmin = { data: { id: 7, name: "Catalog", email: "catalog@example.test", role: { id: 1, name: "Catalog" }, permissions: ["b2b.catalog.read"] } };
const detail = {
  data: {
    id: 11, type: "configurable", sku: "BOT-001", slug: "bot-nghe", name: "Bột nghệ", description: null, image: null,
    categories: [{ id: 1, name: "Bột", slug: "bot", description: null, image: null, parent_id: null }],
    variant_count: 1, available_variant_count: 1, starting_price: { unit_price: 10000, currency: "VND" }, published: true, resource_version: '"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"', validation_errors: [],
    option_groups: [{ attribute_id: 1, code: "size", label: "Kích cỡ", options: [{ option_id: 2, label: "100g", variant_ids: [21] }] }],
    variant_index: { 21: { size: 2 } },
    variants: [{ id: 21, sku: "BOT-001-100", name: "Bột nghệ 100g", published: true, option_values: [{ attribute_id: 1, attribute_code: "size", option_id: 2, option_label: "100g" }], image: null, unit: "gói", moq: 1, quantity_step: 1, contact_from_quantity: 100, availability: { is_available: true }, tier_prices: [{ min_quantity: 1, unit_price: 10000, currency: "VND" }], validation_errors: [] }],
  },
  meta: { channel: "default", locale: "vi", currency: "VND", contract_version: 1, resource_version: '"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"' },
};
const upstream = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1"); const cookie = request.headers.cookie ?? ""; const xsrf = request.headers["x-xsrf-token"];
  requests.push({ path: url.pathname, method: request.method, cookie, xsrf });
  assert.doesNotMatch(cookie, /marketing=secret/, "Only allowlisted administrative cookies may reach Bagisto.");
  if (url.pathname.endsWith("/me") && cookie.includes("laravel_session=network-failure")) return request.socket.destroy();
  if (url.pathname.endsWith("/me") && cookie.includes("laravel_session=html-failure")) { response.writeHead(503, { "Content-Type": "text/html" }); return response.end("<h1>upstream</h1>"); }
  if (url.pathname.endsWith("/me") && /laravel_session=catalog-(?:only|detail|product-network|list-extra)/.test(cookie)) return body(response, 200, catalogAdmin);
  if (url.pathname.endsWith("/me")) return body(response, 401, { code: "unauthenticated", message: "x", trace_id: "00000000-0000-4000-8000-000000000000" }, ["XSRF-TOKEN=abc%2520token; Path=/; SameSite=Lax", "laravel_session=pre-session; Path=/; HttpOnly", "marketing=must-not-propagate; Path=/"]);
  if (url.pathname.endsWith("/product-aggregates/bot-nghe") && cookie.includes("laravel_session=catalog-product-network")) return request.socket.destroy();
  if (url.pathname.endsWith("/product-aggregates/bot-nghe")) return body(response, 200, detail, [], { ETag: detail.meta.resource_version });
  if (url.pathname.endsWith("/product-aggregates/khong-co")) return body(response, 404, { code: "not_found", message: "x", trace_id: "00000000-0000-4000-8000-000000000000" });
  if (url.pathname.endsWith("/product-aggregates")) {
    const payload = { data: [], links: { first: null, last: null, prev: null, next: null }, meta: { current_page: 1, from: null, last_page: 1, path: "/api/b2b/admin/v1/product-aggregates", per_page: 12, to: null, total: 0, channel: "default", locale: "vi", currency: "VND", contract_version: 1 } };
    if (cookie.includes("laravel_session=catalog-list-extra")) payload.data = [{ id: 11, type: "configurable", sku: "BOT-001", slug: "bot-nghe", name: "Bột nghệ", description: null, image: null, categories: [], variant_count: 1, available_variant_count: 1, starting_price: { unit_price: 10000, currency: "VND" }, unexpected: true }];
    return body(response, 200, payload);
  }
  if (url.pathname.endsWith("/session") && request.method === "POST") {
    assert.match(cookie, /XSRF-TOKEN=abc%2520token/); assert.match(cookie, /laravel_session=pre-session/); assert.equal(xsrf, "abc%20token");
    let raw = ""; for await (const chunk of request) raw += chunk; assert.equal(JSON.parse(raw).password, " secret ", "Passwords must retain their original bytes.");
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
  for (const session of ["network-failure", "html-failure"]) { const unavailable = await fetch(`${origin}/quan-tri`, { headers: { Cookie: `laravel_session=${session}` } }); assert.equal(unavailable.status, 200); assert.match(await unavailable.text(), /Dịch vụ quản trị tạm thời không khả dụng/); }
  const validDetail = await fetch(`${origin}/quan-tri/san-pham/bot-nghe`, { headers: { Cookie: "laravel_session=catalog-detail" } });
  assert.equal(validDetail.status, 200, "A valid full detail payload must render.");
  assert.match(await validDetail.text(), /Bột nghệ/);
  const missingDetail = await fetch(`${origin}/quan-tri/san-pham/khong-co`, { headers: { Cookie: "laravel_session=catalog-detail" } });
  assert.equal(missingDetail.status, 404, "Only an upstream 404 may render not found.");
  const unavailableDetail = await fetch(`${origin}/quan-tri/san-pham/bot-nghe`, { headers: { Cookie: "laravel_session=catalog-product-network" } });
  assert.equal(unavailableDetail.status, 200, "An upstream detail outage must not masquerade as not found.");
  assert.match(await unavailableDetail.text(), /Dịch vụ quản trị tạm thời không khả dụng/);
  const listExtra = await fetch(`${origin}/api/quan-tri/san-pham`, { headers: { Cookie: "laravel_session=catalog-list-extra" } });
  assert.equal(listExtra.status, 502, "List products must continue rejecting surplus fields.");
  const rejected = await fetch(`${origin}/api/quan-tri/session`, { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" }, body: JSON.stringify({ email: "a@example.test", password: "correct-password" }) }); assert.equal(rejected.status, 403);
  const malformed = await fetch(`${origin}/api/quan-tri/session`, { method: "POST", headers: { Origin: origin }, body: "email=x" }); assert.equal(malformed.status, 422, "Mutations must require JSON before parsing.");
  const jsonx = await fetch(`${origin}/api/quan-tri/session`, { method: "POST", headers: { "Content-Type": "application/jsonx", Origin: origin }, body: "{}" }); assert.equal(jsonx.status, 422, "Only the exact JSON media type is accepted.");
  const oversized = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode("x".repeat(1_000_001))); controller.close(); } });
  const oversizedResponse = await fetch(`${origin}/api/quan-tri/session`, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: oversized, duplex: "half" }); assert.equal(oversizedResponse.status, 422, "Chunked mutation bodies must stop at 1MB.");
  const login = await fetch(`${origin}/api/quan-tri/session`, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin, Cookie: "marketing=secret" }, body: JSON.stringify({ email: "a@example.test", password: " secret " }) }); assert.equal(login.status, 202); const loginCookies = login.headers.getSetCookie(); assert.equal(loginCookies.length, 3); assert.equal(loginCookies.some((value) => value.startsWith("marketing=")), false); const cookie = loginCookies.map((value) => value.split(";", 1)[0]).join("; ");
  const twoFactor = await fetch(`${origin}/api/quan-tri/two-factor`, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin, Cookie: cookie }, body: JSON.stringify({ code: "123456" }) }); assert.equal(twoFactor.status, 200); const verifiedCookie = [...loginCookies, ...twoFactor.headers.getSetCookie()].map((value) => value.split(";", 1)[0]).join("; ");
  const logout = await fetch(`${origin}/api/quan-tri/session`, { method: "DELETE", headers: { Origin: origin, Cookie: verifiedCookie } }); assert.equal(logout.status, 204); assert.equal(logout.headers.getSetCookie().length, 2);
  assert.deepEqual(requests.map((request) => `${request.method} ${request.path}`), ["GET /api/b2b/admin/v1/me", "GET /api/b2b/admin/v1/me", "GET /api/b2b/admin/v1/me", "GET /api/b2b/admin/v1/me", "GET /api/b2b/admin/v1/me", "GET /api/b2b/admin/v1/me", "GET /api/b2b/admin/v1/product-aggregates/bot-nghe", "GET /api/b2b/admin/v1/me", "GET /api/b2b/admin/v1/product-aggregates/khong-co", "GET /api/b2b/admin/v1/me", "GET /api/b2b/admin/v1/product-aggregates/bot-nghe", "GET /api/b2b/admin/v1/product-aggregates", "GET /api/b2b/admin/v1/me", "POST /api/b2b/admin/v1/session", "POST /api/b2b/admin/v1/two-factor", "DELETE /api/b2b/admin/v1/session"]);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try { const page = await browser.newPage(); await page.context().addCookies([{ name: "laravel_session", value: "catalog-only", domain: "localhost", path: "/" }, { name: "XSRF-TOKEN", value: "abc%2520token", domain: "localhost", path: "/" }]); const meBefore = requests.filter((request) => request.path.endsWith("/me")).length; await page.goto(`${origin}/quan-tri/san-pham?q=bot&sort=name&page=2`, { waitUntil: "networkidle" }); assert.equal(requests.filter((request) => request.path.endsWith("/me")).length, meBefore + 1, "A protected render must memoize /me within the request."); const styles = await page.locator('link[rel="stylesheet"]').evaluateAll((links) => links.map((link) => link.getAttribute("href"))); assert.equal(styles.some((href) => href?.startsWith("/styles/")), false, "Admin must not load storefront stylesheets."); const previous = page.getByText("Trước", { exact: true }); assert.equal(await previous.evaluate((element) => element.tagName), "SPAN"); assert.equal(await previous.getAttribute("aria-disabled"), "true"); const display = await page.locator("#admin-nav").evaluate((element) => getComputedStyle(element.parentElement).display); assert.equal(display, "grid", "Desktop shell must use a grid parent instead of normal-flow sidebar."); await page.getByRole("button", { name: "Đăng xuất" }).last().click(); const logoutAlert = page.getByText(/Không thể đăng xuất|Không thể kết nối/); await logoutAlert.waitFor(); assert.match(await logoutAlert.textContent() ?? "", /Không thể đăng xuất|Không thể kết nối/); assert.match(page.url(), /\/quan-tri\/san-pham/); await page.close(); const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } }); await mobile.context().addCookies([{ name: "laravel_session", value: "catalog-only", domain: "localhost", path: "/" }]); await mobile.goto(`${origin}/quan-tri/san-pham`, { waitUntil: "networkidle" }); const menu = mobile.getByRole("button", { name: "Mở menu quản trị" }); await menu.press("Enter"); const closeMenu = mobile.getByRole("button", { name: "Đóng menu quản trị" }); assert.equal(await closeMenu.getAttribute("aria-expanded"), "true"); assert.equal(await mobile.locator("#admin-nav").isVisible(), true); await mobile.keyboard.press("Tab"); assert.equal(await mobile.locator("#admin-nav").evaluate((element) => element.contains(document.activeElement)), true); await mobile.keyboard.press("Escape"); assert.equal(await mobile.locator("#admin-nav").isVisible(), false); const reopenedMenu = mobile.getByRole("button", { name: "Mở menu quản trị" }); assert.equal(await reopenedMenu.evaluate((element) => document.activeElement === element), true, "Escape must return focus to the menu trigger."); await mobile.close(); } finally { await browser.close(); }
  console.log("admin fake-upstream cookie, CSRF, 2FA, and logout handshake passed");
} finally { await stop(app); await new Promise((resolve) => upstream.close(resolve)); }
