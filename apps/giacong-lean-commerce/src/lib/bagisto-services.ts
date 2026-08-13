import "server-only";

import { fetchBagistoJson, getBagistoApiUrl } from "@/lib/bagisto-api";
import { mergeManagedService, parseManagedServiceResponse } from "@/lib/service-cms-contract";
import { getServiceFamily, type ServiceFamily } from "@/data/service-families";

export async function getManagedServiceFamily(slug: string): Promise<ServiceFamily | undefined> {
  const fallback = getServiceFamily(slug);
  if (!fallback) return undefined;

  try {
    const url = getBagistoApiUrl(`/api/b2b/services/${encodeURIComponent(slug)}`, true);
    url.searchParams.set("channel", process.env.BAGISTO_CHANNEL?.trim() || "default");
    url.searchParams.set("locale", process.env.BAGISTO_LOCALE?.trim() || "vi");
    const { payload, response } = await fetchBagistoJson(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (response.status === 404) return fallback;
    if (!response.ok) return fallback;
    return mergeManagedService(fallback, parseManagedServiceResponse(payload));
  } catch {
    return fallback;
  }
}
