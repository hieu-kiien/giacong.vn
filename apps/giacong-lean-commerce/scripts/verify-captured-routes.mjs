import { runStorefrontSmoke } from "./verify-storefront-runner.mjs";

await runStorefrontSmoke("captured-routes", ["/", "/gioi-thieu-ve-gia-cong/", "/lien-he/"]);