import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
async function port() { const server = createNetServer(); server.listen(0, "127.0.0.1"); await once(server, "listening"); const value = server.address(); assert.ok(value && typeof value !== "string"); await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); return value.port; }
async function waitFor(url, process, logs) { for (let index = 0; index < 300; index += 1) { try { if ((await fetch(url)).ok) return; } catch {} if (process.exitCode !== null) throw new Error(logs.join("")); await delay(100); } throw new Error("Admin Next server did not start."); }
async function stop(process) { if (process.exitCode === null) process.kill("SIGTERM"); await Promise.race([once(process, "exit"), delay(3000)]); if (process.exitCode === null) spawnSync("taskkill", ["/pid", String(process.pid), "/t", "/f"], { windowsHide: true }); }
function body(response, status, payload, cookies = []) { response.writeHead(status, { "Content-Type": "application/json", "Set-Cookie": cookies }); response.end(JSON.stringify(payload)); }

const requests = [];
const upstream = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1"); const cookie = request.headers.cookie ?? ""; const xsrf = request.headers["x-xsrf-token"];
  requests.push({ path: url.pathname, method: request.method, cookie, xsrf });
  if (url.pathname.endsWith("/me")) return body(response, 401, { code: "unauthenticated", message: "x", trace_id: "00000000-0000-4000-8000-000000000000" }, ["XSRF-TOKEN=abc%2520token; Path=/; SameSite=Lax", "laravel_session=pre-session; Path=/; HttpOnly"]);
  if (url.pathname.endsWith("/session") && request.method === "POST") {
    assert.match(cookie, /XSRF-TOKEN=abc%2520token/); assert.match(cookie, /laravel_session=pre-session/); assert.equal(xsrf, "abc%20token");
    return body(response, 202, { code: "two_factor_required", message: "x", trace_id: "00000000-0000-4000-8000-000000000000" }, ["laravel_session=two-factor-session; Path=/; HttpOnly"]);
  }
  if (url.pathname.endsWith("/two-factor")) { assert.match(cookie, /laravel_session=two-factor-session/); assert.equal(xsrf, "abc%20token"); return body(response, 200, { data: { two_factor_verified: true } }, ["laravel_session=verified-session; Path=/; HttpOnly"]); }
  if (url.pathname.endsWith("/session") && request.method === "DELETE") { assert.match(cookie, /laravel_session=verified-session/); assert.equal(xsrf, "abc%20token"); response.writeHead(204, { "Set-Cookie": ["XSRF-TOKEN=rotated; Path=/; SameSite=Lax", "laravel_session=; Path=/; Max-Age=0; HttpOnly"] }); return response.end(); }
  response.writeHead(404).end();
});
const upstreamPort = await port(); upstream.listen(upstreamPort, "127.0.0.1"); await once(upstream, "listening");
const appPort = await port(); const logs = []; const app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(appPort)], { env: { ...process.env, BAGISTO_ADMIN_API_URL: `http://127.0.0.1:${upstreamPort}/api/b2b/admin/v1` }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true }); app.stdout.on("data", (chunk) => logs.push(String(chunk))); app.stderr.on("data", (chunk) => logs.push(String(chunk)));
try {
  const origin = `http://127.0.0.1:${appPort}`; await waitFor(`${origin}/`, app, logs);
  const rejected = await fetch(`${origin}/api/quan-tri/session`, { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" }, body: JSON.stringify({ email: "a@example.test", password: "correct-password" }) }); assert.equal(rejected.status, 403);
  const login = await fetch(`${origin}/api/quan-tri/session`, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify({ email: "a@example.test", password: "correct-password" }) }); assert.equal(login.status, 202); const loginCookies = login.headers.getSetCookie(); assert.equal(loginCookies.length, 3); const cookie = loginCookies.map((value) => value.split(";", 1)[0]).join("; ");
  const twoFactor = await fetch(`${origin}/api/quan-tri/two-factor`, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin, Cookie: cookie }, body: JSON.stringify({ code: "123456" }) }); assert.equal(twoFactor.status, 200); const verifiedCookie = [...loginCookies, ...twoFactor.headers.getSetCookie()].map((value) => value.split(";", 1)[0]).join("; ");
  const logout = await fetch(`${origin}/api/quan-tri/session`, { method: "DELETE", headers: { Origin: origin, Cookie: verifiedCookie } }); assert.equal(logout.status, 204); assert.equal(logout.headers.getSetCookie().length, 2);
  assert.deepEqual(requests.map((request) => `${request.method} ${request.path}`), ["GET /api/b2b/admin/v1/me", "POST /api/b2b/admin/v1/session", "POST /api/b2b/admin/v1/two-factor", "DELETE /api/b2b/admin/v1/session"]);
  console.log("admin fake-upstream cookie, CSRF, 2FA, and logout handshake passed");
} finally { await stop(app); await new Promise((resolve) => upstream.close(resolve)); }
