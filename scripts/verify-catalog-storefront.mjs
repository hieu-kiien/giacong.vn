import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";

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
const fake = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  if (url.pathname === "/api/b2b/catalog/categories") return json(response, { data: [category], meta: { channel: "default", locale: "vi" } });
  if (url.pathname === "/api/b2b/catalog/products/bot-cacao") return json(response, { data: product, meta: { channel: "default", locale: "vi", currency: "VND" } });
  if (url.pathname.startsWith("/api/b2b/catalog/products/")) return response.writeHead(404).end();
  if (url.pathname !== "/api/b2b/catalog/products") return response.writeHead(404).end();
  const query = url.searchParams.get("q") ?? "";
  seenQueries.push(query);
  if (query === "redirect") return response.writeHead(302, { Location: "/api/b2b/catalog/products" }).end();
  if (query === "timeout") return;
  if (query === "bad-root") return json(response, { data: [] });
  if (query === "bad-item") return json(response, { data: [{ ...product, name: 7 }], meta: listMeta });
  if (query === "bad-tier") return json(response, { data: [{ ...product, tier_prices: [{ min_quantity: 20, unit_price: 1, currency: "USD" }] }], meta: listMeta });
  if (query === "bad-image") return json(response, { data: [{ ...product, image: { url: "ftp://bad", alt: "x" } }], meta: listMeta });
  if (query === "bad-image-shape") return json(response, { data: [{ ...product, image: { url: "/storage/a.webp", alt: "x", extra: true } }], meta: listMeta });
  if (query === "valid-image") return json(response, { data: [{ ...product, image: { url: "/storage/a.webp", alt: "Bột cacao" } }], meta: listMeta });
  return json(response, { data: [product], meta: listMeta });
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
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { if ((await fetch(`${origin}/`)).ok) break; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (app.exitCode !== null) throw new Error(logs.join(""));
  }
  for (const [path, status] of [
    ["/san-pham/", 200], ["/san-pham/bot-cacao/", 200], ["/san-pham/missing/", 404],
    ["/san-pham/a/b/", 404], ["/sua-bot-cho-nguoi-gia/", 200],
    ["/san-pham/?q=bad-root", 500], ["/san-pham/?q=bad-item", 500], ["/san-pham/?q=bad-tier", 500],
    ["/san-pham/?q=bad-image", 500], ["/san-pham/?q=bad-image-shape", 500], ["/san-pham/?q=valid-image", 200],
    ["/san-pham/?q=redirect", 500], ["/san-pham/?q=timeout", 500],
  ]) {
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.status, status, `${path} returned ${response.status}`);
  }
  await fetch(`${origin}/san-pham/?q=${"a".repeat(101)}`);
  assert.equal(seenQueries.at(-1)?.length, 100, "Catalog query must cap at 100 characters");
  const listHtml = await (await fetch(`${origin}/san-pham/`)).text();
  assert.match(listHtml, /maxLength="100"/i, "Catalog search input must cap at 100 characters");
} finally {
  app.kill("SIGTERM");
  if (app.exitCode === null) await once(app, "exit");
  await new Promise((resolve, reject) => fake.close((error) => error ? reject(error) : resolve()));
}
