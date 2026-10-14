import type { E2EConfig } from "e2e";
import { web } from "@e2e-dev/web";

const cdpUrl = process.env.E2E_CDP_URL ?? "http://127.0.0.1:9222";
const useLiveChrome = process.env.E2E_USE_CDP !== "false";

export default {
  tests: "tests/**/*.e2e.ts",
  workers: 1,
  timeout: 120_000,
  actionTimeout: 30_000,
  assertionTimeout: 10_000,
  trace: "on",
  targets: [
    {
      name: "chrome-live",
      engine: web(
        useLiveChrome
          ? {
              viewport: null,
              connect: {
                cdpEndpoint: async () => cdpUrl,
                reconnectEndpoint: async () => cdpUrl,
              },
            }
          : {
              viewport: null,
            },
      ),
      app: {
        url: process.env.E2E_BASE_URL ?? "https://kienhieu.id.vn",
        environment: "production",
      },
    },
  ],
} satisfies E2EConfig;
