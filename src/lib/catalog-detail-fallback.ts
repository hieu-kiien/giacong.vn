// Gate for the demo product-detail fallback.
//
// Split out of `catalog-detail-source.ts` so the rule is testable without pulling
// in `server-only`: the source module is the only place that reads demo rows, and
// this is the only place that decides whether it may.
//
// The master plan permits demo content while the real catalog data is still
// **Chờ xác nhận**, provided it can never be mistaken for production data. So the
// gate is one-way: outside production a missing Bagisto lets the UI render against
// the demo fixture; in production it never does, and no environment flag can turn
// it back on.

export interface DemoDetailFallbackEnvironment {
  /**
   * Present so an operator flag cannot quietly widen the gate: it is read, but
   * production ignores it.
   */
  allowDemoCatalog?: string;
  nodeEnv?: string;
}

export function isDemoDetailFallbackAllowed(env: DemoDetailFallbackEnvironment): boolean {
  return env.nodeEnv !== "production";
}
