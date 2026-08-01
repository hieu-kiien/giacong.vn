import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("keeps Bagisto development services bound to localhost", async () => {
  const compose = await readFile(new URL("bagisto/docker-compose.yml", root), "utf8");

  assert.match(compose, /127\.0\.0\.1:\$\{BAGISTO_PORT:-18001\}:80/);
  assert.match(compose, /127\.0\.0\.1:\$\{FORWARD_REDIS_PORT:-6379\}:6379/);
  assert.match(compose, /127\.0\.0\.1:9200:9200/);
  assert.match(compose, /127\.0\.0\.1:9300:9300/);
  assert.match(compose, /127\.0\.0\.1:5601:5601/);
  assert.match(compose, /127\.0\.0\.1:\$\{FORWARD_MAILPIT_DASHBOARD_PORT:-8025\}:8025/);
});
