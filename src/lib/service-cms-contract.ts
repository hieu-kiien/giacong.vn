export interface ManagedServiceContent {
  slug: string;
  name: string;
  summary: string;
  description: string;
  metaTitle: string;
}

interface ServiceFamilyCopy {
  slug: string;
  name: string;
  summary: string;
  description: string;
}

export function parseManagedServiceResponse(payload: unknown): ManagedServiceContent {
  const root = exactRecord(payload, ["data", "meta"]);
  const data = exactRecord(root.data, ["description", "meta_title", "name", "slug", "summary"]);
  const meta = exactRecord(root.meta, ["channel", "contract_version", "locale"]);

  if (meta.contract_version !== 1) invalid();
  string(meta.channel);
  string(meta.locale);

  return {
    slug: string(data.slug),
    name: string(data.name),
    summary: string(data.summary),
    description: string(data.description),
    metaTitle: string(data.meta_title),
  };
}

export function mergeManagedService<T extends ServiceFamilyCopy>(
  fallback: T,
  managed: ManagedServiceContent,
): T {
  if (managed.slug !== fallback.slug) invalid();

  return {
    ...fallback,
    name: managed.name,
    summary: managed.summary,
    description: managed.description,
  };
}

function exactRecord(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  const record = value as Record<string, unknown>;
  const actualKeys = Object.keys(record).sort();
  if (actualKeys.length !== keys.length || actualKeys.some((key, index) => key !== keys[index])) invalid();
  return record;
}

function string(value: unknown): string {
  if (typeof value !== "string") invalid();
  return value;
}

function invalid(): never {
  throw new TypeError("Dữ liệu dịch vụ Bagisto không hợp lệ.");
}
