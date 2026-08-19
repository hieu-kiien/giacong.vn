export async function fetchQaRoute(url, init = {}, options = {}) {
  const {
    delayMs = 1500,
    directQa = false,
    fetchImpl = fetch,
    maxAttempts = 6,
    sleep = delay,
    timeoutMs = 25000,
  } = options;

  const attempts = directQa && isWorkersDevUrl(url) ? maxAttempts : 1;
  let response;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    response = await fetchImpl(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!(await isCloudflareWorkersDevPlatformNotFound(response))) return response;
    if (attempt >= attempts) return response;

    const pathname = new URL(url).pathname;
    console.warn(
      `${pathname}: temporary workers.dev platform 404 on attempt ${attempt}/${attempts}; retrying after ${delayMs}ms.`,
    );
    await sleep(delayMs);
  }

  return response;
}

export async function isCloudflareWorkersDevPlatformNotFound(response) {
  if (response.status !== 404) return false;
  if ((response.headers.get("server") ?? "").trim().toLowerCase() !== "cloudflare") return false;
  if (!(response.headers.get("content-type") ?? "").toLowerCase().includes("text/html")) return false;

  let body = "";
  try {
    body = await response.clone().text();
  } catch {
    return false;
  }

  return /<title>\s*Page not found\s*<\/title>/i.test(body)
    && /workers\.cloudflare\.com\/favicon\.ico/i.test(body);
}

function isWorkersDevUrl(value) {
  try {
    return new URL(value).hostname.toLowerCase().endsWith(".workers.dev");
  } catch {
    return false;
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
