const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const ALLOWED_PLATFORM_TELEMETRY_PATHS = new Set(["/cdn-cgi/rum"]);

export function isUnexpectedMutationRequest(method, requestUrl, baseUrl) {
  if (!MUTATING_METHODS.has(method)) return false;

  let request;
  let base;
  try {
    request = new URL(requestUrl, baseUrl);
    base = new URL(baseUrl);
  } catch {
    return true;
  }

  if (request.origin !== base.origin) return false;
  return !ALLOWED_PLATFORM_TELEMETRY_PATHS.has(request.pathname);
}
