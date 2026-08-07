import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

export default defineCloudflareConfig({
  // Shared ISR/data cache for the Workers runtime. Provision the R2 binding before deploy.
  incrementalCache: r2IncrementalCache,
});
