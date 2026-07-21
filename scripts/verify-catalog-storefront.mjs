import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";

const REQUEST_TIMEOUT_MS = 5_000;
const SERVER_START_TIMEOUT_MS = 30_000;

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchWithTimeout(url, options = {}, label = url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    throw new Error(`Timed out or failed fetching ${label}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    clearTimeout(timeout);
  }
}

function logsText(logs) {
  return logs.join("").slice(-8_000);
}

async function waitForServer(url, child, logs) {
  const deadline = Date.now() + SERVER_START_TIMEOUT_MS;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      if ((await fetchWithTimeout(url, {}, "server startup")).ok) return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    if (child.exitCode !== null) throw new Error(`Next exited before startup: ${lastError}\n${logsText(logs)}`);
    await delay(100);
  }
  throw new Error(`Next did not start: ${lastError}\n${logsText(logs)}`);
}

async function waitForPortToClose(port) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const probe = createNetServer();
    try {
      probe.listen(port, "127.0.0.1");
      await once(probe, "listening");
      await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
      return;
    } catch {
      probe.close();
      await delay(100);
    }
  }
  throw new Error(`Port ${port} remained open after cleanup.`);
}

async function stopChild(child, port, logs) {
  if (child.exitCode !== null) {
    await waitForPortToClose(port);
    return;
  }
  if (child.exitCode === null) child.kill("SIGTERM");
  const stopped = await Promise.race([once(child, "exit").then(() => true), delay(5_000).then(() => false)]);
  if (!stopped && child.exitCode === null) {
    if (process.platform === "win32") {
      const result = spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { windowsHide: true });
      if (result.status !== 0 && child.exitCode === null) throw new Error(`Could not stop Next process: ${logsText(logs)}`);
    } else {
      child.kill("SIGKILL");
    }
    await Promise.race([once(child, "exit"), delay(5_000).then(() => { throw new Error(`Next did not stop: ${logsText(logs)}`); })]);
  }
  await waitForPortToClose(port);
}

async function port() {
  const server = createNetServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

const category = { id: 2, parent_id: 1, slug: "nguyen-lieu", name: "Nguyên liệu", description: null, image: null };
const product = {
  id: 10, sku: "CACAO-10", slug: "bot-cacao", name: "Bột cacao", description: "Nguyên chất", image: null,
  categories: [category], unit: "kg", moq: 20, quantity_step: 5,
  tier_prices: [{ min_quantity: 20, unit_price: 100000, currency: "VND" }],
};
const listMeta = { current_page: 1, last_page: 1, per_page: 12, total: 1, channel: "default", locale: "vi", currency: "VND" };

function json(response, body) {
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

const seenQueries = [];
const fakeSockets = new Set();
const fake = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  if (url.pathname === "/api/b2b/catalog/categories") return json(response, { data: [category], meta: { channel: "default", locale: "vi" } });
  if (url.pathname === "/api/b2b/catalog/products/bot-cacao") return json(response, { data: product, meta: { channel: "default", locale: "vi", currency: "VND" } });
  if (url.pathname === "/api/b2b/catalog/products/detail-bad-channel") return json(response, { data: product, meta: { channel: "", locale: "vi", currency: "VND" } });
  if (url.pathname === "/api/b2b/catalog/products/detail-bad-locale") return json(response, { data: product, meta: { channel: "default", locale: "", currency: "VND" } });
  if (url.pathname === "/api/b2b/catalog/products/detail-bad-currency") return json(response, { data: product, meta: { channel: "default", locale: "vi", currency: "USD" } });
  if (url.pathname.startsWith("/api/b2b/catalog/products/")) return response.writeHead(404).end();
  if (url.pathname !== "/api/b2b/catalog/products") return response.writeHead(404).end();
  const query = url.searchParams.get("q") ?? "";
  seenQueries.push(query);
  if (query === "redirect") return response.writeHead(302, { Location: "/api/b2b/catalog/products" }).end();
  if (query === "timeout") return;
  if (query === "bad-root") return json(response, { data: [] });
  if (query === "bad-list-channel") return json(response, { data: [product], meta: { ...listMeta, channel: "" } });
  if (query === "bad-list-locale") return json(response, { data: [product], meta: { ...listMeta, locale: "" } });
  if (query === "bad-list-currency") return json(response, { data: [product], meta: { ...listMeta, currency: "USD" } });
  if (query === "bad-item") return json(response, { data: [{ ...product, name: 7 }], meta: listMeta });
  if (query === "bad-tier") return json(response, { data: [{ ...product, tier_prices: [{ min_quantity: 20, unit_price: 1, currency: "USD" }] }], meta: listMeta });
  if (query === "bad-image") return json(response, { data: [{ ...product, image: { url: "ftp://bad", alt: "x" } }], meta: listMeta });
  if (query === "bad-image-shape") return json(response, { data: [{ ...product, image: { url: "/storage/a.webp", alt: "x", extra: true } }], meta: listMeta });
  if (query === "valid-image") return json(response, { data: [{ ...product, image: { url: "/storage/a.webp", alt: "Bột cacao" } }], meta: listMeta });
  return json(response, { data: [product], meta: listMeta });
});
fake.on("connection", (socket) => {
  fakeSockets.add(socket);
  socket.on("close", () => fakeSockets.delete(socket));
});

const fakePort = await port();
fake.listen(fakePort, "127.0.0.1");
await once(fake, "listening");
const appPort = await port();
const logs = [];
const app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(appPort)], {
  env: { ...process.env, BAGISTO_API_URL: `http://127.0.0.1:${fakePort}`, BAGISTO_API_TIMEOUT_MS: "100", NODE_ENV: "production" },
  stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
});
app.stdout.on("data", (chunk) => logs.push(chunk.toString()));
app.stderr.on("data", (chunk) => logs.push(chunk.toString()));

try {
  const origin = `http://127.0.0.1:${appPort}`;
  await waitForServer(`${origin}/`, app, logs);
  for (const [path, status] of [
    ["/san-pham/", 200], ["/san-pham/bot-cacao/", 200], ["/san-pham/missing/", 404],
    ["/san-pham/detail-bad-channel/", 500], ["/san-pham/detail-bad-locale/", 500], ["/san-pham/detail-bad-currency/", 500],
    ["/san-pham/a/b/", 404], ["/sua-bot-cho-nguoi-gia/", 200],
    ["/san-pham/?q=bad-root", 500], ["/san-pham/?q=bad-list-channel", 500], ["/san-pham/?q=bad-list-locale", 500],
    ["/san-pham/?q=bad-list-currency", 500], ["/san-pham/?q=bad-item", 500], ["/san-pham/?q=bad-tier", 500],
    ["/san-pham/?q=bad-image", 500], ["/san-pham/?q=bad-image-shape", 500], ["/san-pham/?q=valid-image", 200],
    ["/san-pham/?q=redirect", 500], ["/san-pham/?q=timeout", 500],
  ]) {
    const response = await fetchWithTimeout(`${origin}${path}`, {}, path);
    assert.equal(response.status, status, `${path} returned ${response.status}`);
  }
  await fetchWithTimeout(`${origin}/san-pham/?q=${"a".repeat(101)}`, {}, "101 character query");
  assert.equal(seenQueries.at(-1)?.length, 100, "Catalog query must cap at 100 characters");
  const listHtml = await (await fetchWithTimeout(`${origin}/san-pham/`, {}, "catalog input markup")).text();
  assert.match(listHtml, /maxLength="100"/i, "Catalog search input must cap at 100 characters");
} finally {
  await stopChild(app, appPort, logs);
  fakeSockets.forEach((socket) => socket.destroy());
  await new Promise((resolve, reject) => fake.close((error) => error ? reject(error) : resolve()));
  await waitForPortToClose(fakePort);
}
