import assert from "node:assert/strict";

const origin = requiredEnv("ADMIN_STAGING_ORIGIN").replace(/\/$/, "");
const accessHeaders = {
  "CF-Access-Client-Id": requiredEnv("CLOUDFLARE_ACCESS_CLIENT_ID"),
  "CF-Access-Client-Secret": requiredEnv("CLOUDFLARE_ACCESS_CLIENT_SECRET"),
};

let lastFailure = "";
for (let attempt = 1; attempt <= 20; attempt += 1) {
  try {
    const response = await fetch(new URL("/api/admin/news?page=1&pageSize=1", `${origin}/`), {
      headers: accessHeaders,
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
    });
    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    const mitigated = (response.headers.get("cf-mitigated") ?? "").toLowerCase();
    const body = contentType.includes("application/json") ? await response.json().catch(() => null) : null;
    const requestId = typeof body?.requestId === "string" ? body.requestId.trim() : "";

    if (mitigated === "challenge") {
      throw new Error(`Preview request was challenged before Access/Worker admission (HTTP ${response.status}).`);
    }

    const reachedWorker = requestId && (
      (response.ok && body?.ok === true)
      || (response.status === 403 && body?.ok === false && body?.code === "FORBIDDEN")
    );
    if (reachedWorker) {
      console.log(`Access-protected G2 preview reached the Worker admin boundary on attempt ${attempt} (HTTP ${response.status}, requestId ${requestId}).`);
      process.exit(0);
    }

    lastFailure = `HTTP ${response.status}, content-type=${contentType || "unknown"}, cf-mitigated=${mitigated || "none"}`;
  } catch (error) {
    lastFailure = error instanceof Error ? error.message.slice(0, 220) : String(error).slice(0, 220);
  }

  if (attempt < 20) await delay(1500);
}

assert.fail(`Access-protected G2 preview did not reach a recognizable Worker admin response: ${lastFailure}`);

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for G2 preview preflight.`);
  return value;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
