import assert from "node:assert/strict";
import test from "node:test";
import { createReadyInstanceCache } from "../src/lib/ready-instance-cache.ts";

test("reuse only completed instances; separate database, origin and rotated configuration", async () => {
  const cache = createReadyInstanceCache<{ id: number }>();
  const db = {};
  let count = 0;
  const create = () => ({ id: ++count });
  const ready = async () => {};
  const first = cache(db, "https://a.test", ["secret"], create, ready);
  assert.notEqual(cache(db, "https://a.test", ["secret"], create, ready), first);
  await new Promise<void>((resolve) => setImmediate(resolve));
  const reused = cache(db, "https://a.test", ["secret"], create, ready);
  assert.equal(reused.id, 2);
  assert.equal(cache(db, "https://a.test", ["secret"], create, ready), reused);
  assert.notEqual(cache({}, "https://a.test", ["secret"], create, ready), reused);
  assert.notEqual(cache(db, "https://b.test", ["secret"], create, ready), reused);
  assert.notEqual(cache(db, "https://a.test", ["rotated"], create, ready), reused);
});

test("pending initialization and failed schema checks are never shared across requests", async () => {
  const cache = createReadyInstanceCache<object>();
  const db = {};
  let complete!: () => void;
  const pending = new Promise<void>((resolve) => { complete = resolve; });
  const first = cache(db, "origin", [], () => ({}), () => pending);
  const second = cache(db, "origin", [], () => ({}), async () => { throw new Error("schema unavailable"); });
  assert.notEqual(first, second);
  await new Promise<void>((resolve) => setImmediate(resolve));
  const third = cache(db, "origin", [], () => ({}), async () => { throw new Error("schema unavailable"); });
  assert.notEqual(third, first);
  assert.notEqual(third, second);
  complete();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(cache(db, "origin", [], () => ({}), async () => {}), first);
});
