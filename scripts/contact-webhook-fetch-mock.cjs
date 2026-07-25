if (process.env.CONTACT_WEBHOOK_TEST_MODE === "1") {
  const nativeFetch = globalThis.fetch;
  const allowedHosts = new Set(["script.google.com", "script.googleusercontent.com"]);

  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    if (!allowedHosts.has(url.hostname)) return nativeFetch(input, init);

    const body = String(init.body ?? "");
    if (body.includes("__unavailable__")) {
      throw new Error("unavailable");
    }
    if (body.includes("__timeout__")) {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new Error("timeout")), { once: true });
      });
    }
    if (body.includes("__headers_then_hang__")) {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"ok":true,"reference":"'));
        },
      });
      return new Response(stream, { headers: { "Content-Type": "application/json" } });
    }
    if (body.includes("__redirect__")) {
      return new Response(null, { headers: { Location: "https://attacker.example/collect" }, status: 302 });
    }
    if (body.includes("__upstream_4xx__")) {
      return new Response(JSON.stringify({ ok: false, message: "upstream validation detail" }), {
        headers: { "Content-Type": "application/json" },
        status: 422,
      });
    }
    if (body.includes("__upstream_5xx__")) {
      return new Response(JSON.stringify({ ok: false, message: "secret upstream failure" }), {
        headers: { "Content-Type": "application/json" },
        status: 500,
      });
    }
    if (body.includes("__malformed_json__")) {
      return new Response("{", { headers: { "Content-Type": "application/json" } });
    }
    if (body.includes("__missing_reference__")) {
      return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
    }
    if (body.includes("__blank_reference__")) {
      return new Response(JSON.stringify({ ok: true, reference: "   " }), { headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ ok: true, reference: "YC-CAPTURED-001" }), {
      headers: { "Content-Type": "application/json" },
    });
  };
}
