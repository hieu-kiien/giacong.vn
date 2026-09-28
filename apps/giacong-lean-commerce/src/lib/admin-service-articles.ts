export interface ServiceArticleContext {
  articleRoute: string;
  articleTitle: string;
  serviceName: string;
  serviceSlug: string;
}

export interface ServiceArticlePageSeed {
  pageKey: string;
  routePath: string;
  title: string;
}

export function buildServiceArticlePageSeed(input: {
  articleRoute: string;
  articleTitle: string;
  serviceSlug: string;
}): ServiceArticlePageSeed | null {
  const title = normalizeLabel(input.articleTitle, 240);
  const serviceSlug = input.serviceSlug.trim().toLowerCase();
  const routePath = normalizeServiceArticleRoute(input.articleRoute);
  if (!title || !routePath || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(serviceSlug)) return null;

  const routeSlug = routePath.slice(1, -1).replaceAll("/", "-");
  const candidate = `service-${serviceSlug}-${routeSlug}`;
  const pageKey = candidate.length <= 80 ? candidate : `${candidate.slice(0, 70)}-${hashRoute(routePath)}`;
  return { pageKey, routePath, title };
}

function normalizeServiceArticleRoute(value: string): string | null {
  const route = value.trim();
  if (
    route.length > 160
    || !/^\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*\/?$/.test(route)
  ) return null;
  return route.endsWith("/") ? route : `${route}/`;
}

function normalizeLabel(value: string, maxLength: number): string | null {
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength && !/[<>]/.test(normalized) ? normalized : null;
}

function hashRoute(value: string): string {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
