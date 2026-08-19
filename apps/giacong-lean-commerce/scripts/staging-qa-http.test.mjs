import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchQaRoute,
  isCloudflareWorkersDevPlatformNotFound,
} from "./staging-qa-http.mjs";

function platform404() {
  return new Response(
    '<!DOCTYPE html><html><head><title>Page not found</title><link rel="icon" href="https://workers.cloudflare.com/favicon.ico"></head><body></body></html>',
    {
      status: 404,
      headers: {
        server: "cloudflare",
        "content-type": "text/html; charset=UTF-8",
      },
    },
  );
}

test("recognizes only the Cloudflare workers.dev platform not-found page", async () => {
  assert.equal(await isCloudflareWorkersDevPlatformNotFound(platform404()), true);
  assert.equal(
    await isCloudflareWorkersDevPlatformNotFound(new Response("application not found", {
      status: 404,
      headers: { server: "cloudflare", "content-type": "text/html" },
    })),
    false,
  );
  assert.equal(await isCloudflareWorkersDevPlatformNotFound(new Response("ok", { status: 200 })), false);
});

test("direct workers.dev QA retries a transient platform 404 and preserves the eventual response", async () => {
  let calls = 0;
  const response = await fetchQaRoute(
    "https://giacong-vn-staging.example.workers.dev/san-pham",
    {},
    {
      delayMs: 0,
      directQa: true,
      fetchImpl: async () => {
        calls += 1;
        return calls === 1 ? platform404() : new Response("ok", { status: 200 });
      },
      maxAttempts: 3,
      sleep: async () => {},
      timeoutMs: 1000,
    },
  );

  assert.equal(calls, 2);
  assert.equal(response.status, 200);
});

test("application 404 is not retried", async () => {
  let calls = 0;
  const response = await fetchQaRoute(
    "https://giacong-vn-staging.example.workers.dev/san-pham",
    {},
    {
      delayMs: 0,
      directQa: true,
      fetchImpl: async () => {
        calls += 1;
        return new Response("application not found", {
          status: 404,
          headers: { server: "cloudflare", "content-type": "text/html" },
        });
      },
      maxAttempts: 3,
      sleep: async () => {},
      timeoutMs: 1000,
    },
  );

  assert.equal(calls, 1);
  assert.equal(response.status, 404);
});

test("custom staging hostname never uses workers.dev propagation retries", async () => {
  let calls = 0;
  const response = await fetchQaRoute(
    "https://staging.kienhieu.id.vn/san-pham",
    {},
    {
      delayMs: 0,
      directQa: true,
      fetchImpl: async () => {
        calls += 1;
        return platform404();
      },
      maxAttempts: 3,
      sleep: async () => {},
      timeoutMs: 1000,
    },
  );

  assert.equal(calls, 1);
  assert.equal(response.status, 404);
});

test("persistent workers.dev platform 404 still fails closed after the bounded attempts", async () => {
  let calls = 0;
  const response = await fetchQaRoute(
    "https://giacong-vn-staging.example.workers.dev/san-pham",
    {},
    {
      delayMs: 0,
      directQa: true,
      fetchImpl: async () => {
        calls += 1;
        return platform404();
      },
      maxAttempts: 3,
      sleep: async () => {},
      timeoutMs: 1000,
    },
  );

  assert.equal(calls, 3);
  assert.equal(response.status, 404);
});
