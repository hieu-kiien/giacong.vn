import assert from "node:assert/strict";
import test from "node:test";

const { createContactRateLimiter } = await import("../src/lib/contact-rate-limit" + ".ts");

test("allows only the configured number of attempts in one rolling window", () => {
  let now = 1_000;
  const limiter = createContactRateLimiter({
    limit: 2,
    now: () => now,
    windowMs: 10_000,
  });

  assert.equal(limiter.allow("fingerprint-a"), true);
  assert.equal(limiter.allow("fingerprint-a"), true);
  assert.equal(limiter.allow("fingerprint-a"), false);
  assert.equal(limiter.allow("fingerprint-b"), true);

  now += 10_000;
  assert.equal(limiter.allow("fingerprint-a"), true);
});
