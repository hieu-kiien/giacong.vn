export interface ContactRateLimiter {
  allow(key: string): boolean;
}

interface ContactRateLimiterOptions {
  limit: number;
  maxEntries?: number;
  now?: () => number;
  windowMs: number;
}

export function createContactRateLimiter({
  limit,
  maxEntries = 5_000,
  now = Date.now,
  windowMs,
}: ContactRateLimiterOptions): ContactRateLimiter {
  const attemptsByKey = new Map<string, number[]>();

  return {
    allow(key) {
      const currentTime = now();
      const windowStart = currentTime - windowMs;
      const attempts = (attemptsByKey.get(key) ?? []).filter((attempt) => attempt > windowStart);
      if (attempts.length >= limit) {
        attemptsByKey.set(key, attempts);
        return false;
      }

      if (!attemptsByKey.has(key) && attemptsByKey.size >= maxEntries) {
        for (const [existingKey, existingAttempts] of attemptsByKey) {
          if (existingAttempts.every((attempt) => attempt <= windowStart)) {
            attemptsByKey.delete(existingKey);
          }
          if (attemptsByKey.size < maxEntries) break;
        }
        if (attemptsByKey.size >= maxEntries) {
          const oldestKey = attemptsByKey.keys().next().value;
          if (oldestKey) attemptsByKey.delete(oldestKey);
        }
      }

      attempts.push(currentTime);
      attemptsByKey.set(key, attempts);
      return true;
    },
  };
}
