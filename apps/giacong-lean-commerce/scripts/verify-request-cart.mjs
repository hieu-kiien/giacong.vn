import { runStorefrontSmoke } from "./verify-storefront-runner.mjs";

await runStorefrontSmoke("request-cart", ["/gui-yeu-cau"]);