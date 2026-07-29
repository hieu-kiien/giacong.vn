import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import capturedRoutes from "../src/data/pages/manifest.json" with { type: "json" };
import { serviceFamilies } from "../src/data/service-families.ts";

const capturedRouteSet = new Set(Object.keys(capturedRoutes as Record<string, string>));

test("publishes the thirteen service hubs the real site groups its work into", () => {
  assert.deepEqual(serviceFamilies.map((family) => family.slug), [
    "gia-cong-sot-cham",
    "gia-cong-do-uong",
    "gia-cong-bot-pha-che",
    "gia-cong-duoc-lieu",
    "gia-cong-thuc-pham",
    "gia-cong-my-pham",
    "gia-cong-tra",
    "gia-cong-ca-phe",
    "gia-cong-dong-goi",
    "gia-cong-bot",
    "gia-cong-ruou",
    "gia-cong-sua",
    "say-thuc-pham-say",
  ]);
});

/**
 * The index is only worth having if every link on it lands somewhere. `/thue-gia-cong`
 * links exclusively into captured pages, so the manifest is the authority on whether a
 * href resolves — a slug typo would otherwise ship as a 404 the unit suite never sees.
 */
test("every hub and offering href resolves to a captured route", () => {
  for (const family of serviceFamilies) {
    assert.ok(
      capturedRouteSet.has(family.hubHref),
      `${family.slug} hub href ${family.hubHref} is not a captured route`,
    );
    for (const offering of family.offerings) {
      assert.ok(
        capturedRouteSet.has(offering.href),
        `${family.slug} offering ${offering.href} is not a captured route`,
      );
    }
  }
});

test("the drying family keeps the slug its prerendered route was built on", () => {
  const drying = serviceFamilies.find((family) => family.slug === "say-thuc-pham-say");
  assert.ok(drying, "say-thuc-pham-say must survive the expansion to thirteen hubs");
  assert.deepEqual(
    drying.offerings.map((offering) => offering.href),
    [
      "/dich-vu-say/",
      "/say-thang-hoa/",
      "/say-nong/",
      "/say-lanh/",
      "/say-chan-khong/",
      "/say-hong-ngoai/",
    ],
  );
});

/**
 * `gia-cong-duoc-lieu` is a real hub in the site's own header, and its archive really
 * does render "Nothing Found" upstream — the category has no posts. It is carried with
 * an empty offering list rather than dropped, so the index matches the site's own
 * taxonomy, and the directory has to render that case without collapsing the card.
 */
test("the one genuinely empty hub is carried rather than dropped", () => {
  const empty = serviceFamilies.filter((family) => family.offerings.length === 0);
  assert.deepEqual(empty.map((family) => family.slug), ["gia-cong-duoc-lieu"]);
});

test("service calls to action carry the service context they actually have", async () => {
  const landing = await readFile(new URL("../src/components/services/ServiceLanding.tsx", import.meta.url), "utf8");
  const detail = await readFile(new URL("../src/components/services/ServiceFamilyDetail.tsx", import.meta.url), "utf8");

  // A family page knows which family it is, so it passes that slug through.
  assert.match(detail, /<ContactBand service=\{family\.slug\}/);
  assert.match(landing, /service\?\s*:\s*string/);
  // The index spans thirteen hubs, so its own band must not claim one of them.
  assert.doesNotMatch(landing, /service=say-thuc-pham-say/);
});

test("the index content is inserted beneath the complete captured News frame", async () => {
  const landing = await readFile(new URL("../src/components/services/ServiceLanding.tsx", import.meta.url), "utf8");
  const indexStyles = await readFile(new URL("../src/components/services/service-index.module.css", import.meta.url), "utf8");
  const page = await readFile(new URL("../src/app/(storefront)/thue-gia-cong/page.tsx", import.meta.url), "utf8");

  assert.match(page, /CapturedNewsFrame/, "the full News frame leads the page");
  assert.match(page, /title="Thuê gia công"/, "the route title remains explicit");
  assert.doesNotMatch(landing, /CapturedCommerceHero/, "the content component no longer carries a partial imitation");
  assert.match(indexStyles, /max-width:\s*1115px/, "the index uses the approved reference rail");
  assert.doesNotMatch(landing, /<main/, "the commerce shell owns the main landmark");
});

test("the directory lists every hub as a card with a live result count", async () => {
  const directory = await readFile(new URL("../src/components/services/ServiceDirectory.tsx", import.meta.url), "utf8");

  assert.match(directory, /aria-live="polite"/, "the result count stays announced");
  assert.match(directory, /normalizeSearch/, "Vietnamese diacritic folding is reused, not rewritten");
  assert.match(directory, /data-service-group/, "each hub is addressable for the QA harness");
  assert.match(directory, /data-service-offering/, "each offering stays addressable");
});

test("the approved service index presents every service group in the reference card style", async () => {
  const directory = await readFile(new URL("../src/components/services/ServiceDirectory.tsx", import.meta.url), "utf8");

  assert.match(
    directory,
    /FEATURED_SERVICE_COUNT\s*=\s*3/,
    "the first three cards remain the approved featured groups",
  );
  assert.match(
    directory,
    /featuredFamilies\s*=\s*filteredFamilies\.slice\(0,\s*FEATURED_SERVICE_COUNT\)/,
    "the featured section is derived from the same filtered data",
  );
  assert.match(
    directory,
    /remainingFamilies\s*=\s*filteredFamilies\.slice\(FEATURED_SERVICE_COUNT\)/,
    "the ten remaining groups stay visible below the featured row",
  );
  assert.match(
    directory,
    /Tất cả nhóm dịch vụ/,
    "the full directory has a clear continuation heading",
  );
  assert.match(directory, /aria-label="Tìm dịch vụ"/, "the search control retains the visible search button");
  assert.match(directory, /data-service-icon/, "each featured card carries the icon treatment from the reference");
  for (const slug of serviceFamilies.map((family) => family.slug)) {
    assert.match(directory, new RegExp(`"${slug}"`), `${slug} receives its own semantic icon mapping`);
  }
});
