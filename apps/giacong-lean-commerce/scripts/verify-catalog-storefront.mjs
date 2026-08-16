import { runStorefrontSmoke } from "./verify-storefront-runner.mjs";

await runStorefrontSmoke("catalog-storefront", ["/san-pham", "/san-pham/bot-gao-lut-xay-min"]);