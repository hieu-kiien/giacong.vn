import { runStorefrontSmoke } from "./verify-storefront-runner.mjs";

await runStorefrontSmoke("service-information-architecture", ["/thue-gia-cong", "/thue-gia-cong/say-thuc-pham-say"]);