import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import memoryQueue from "@opennextjs/cloudflare/overrides/queue/memory-queue";

export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  // Without a real queue (default "dummy"), stale ISR pages are never regenerated and keep being served.
  // The memory queue revalidates through the WORKER_SELF_REFERENCE service binding.
  queue: memoryQueue,
});
