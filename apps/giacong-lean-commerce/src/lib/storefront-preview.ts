const STAGING_PREVIEW_HOSTS = new Set(["staging.kienhieu.id.vn"]);

export function isStagingPreviewHost(host: string | null | undefined): boolean {
  const value = host?.trim().toLowerCase().replace(/\.$/, "");
  if (!value) return false;

  const hostname = value.replace(/:\d+$/, "");
  return STAGING_PREVIEW_HOSTS.has(hostname);
}
