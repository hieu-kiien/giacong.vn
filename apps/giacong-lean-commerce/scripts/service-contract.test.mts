import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getServiceFamilyImage } from "../src/components/services/service-visuals.ts";
import { getServiceFamily, serviceFamilies } from "../src/data/service-families.ts";
import { addCapturedServiceContext } from "../src/lib/captured-markup.ts";
import { getServiceContentIndex, getServiceFamilyForRoute } from "../src/lib/service-content-index.ts";

test("service taxonomy keeps stable slugs and complete fallback copy", () => {
  assert.ok(serviceFamilies.length > 0);
  for (const family of serviceFamilies) {
    assert.match(family.slug, /^[a-z0-9-]+$/);
    assert.ok(family.name.trim());
    assert.ok(family.summary.trim());
    assert.ok(family.description.trim());
    assert.equal(getServiceFamily(family.slug)?.slug, family.slug);
  }
});

test("managed service read carries an optional main image without inventing one", async () => {
  const [families, managed] = await Promise.all([
    readFile(new URL("../src/data/service-families.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/cloudflare-services.ts", import.meta.url), "utf8"),
  ]);
  assert.match(families, /imageUrl\??:/, "ServiceFamily must declare an optional imageUrl");
  assert.match(managed, /image_url/, "the D1 read must select services.image_url");
  assert.match(managed, /imageUrl:/, "the managed family must map image_url onto imageUrl");
});

test("service groups always have a local visual fallback", () => {
  for (const family of serviceFamilies) {
    assert.match(getServiceFamilyImage(family.slug), /^\/images\/services\/.+\.svg$/);
  }
  assert.match(getServiceFamilyImage("gia-cong-sua"), /service-milk\.svg$/);
  assert.match(getServiceFamilyImage("say-thuc-pham-say"), /service-drying\.svg$/);
  assert.match(getServiceFamilyImage("gia-cong-dong-goi"), /service-packaging\.svg$/);
});

test("service content index makes captured routes reachable without expanding the default cards", () => {
  const content = getServiceContentIndex();
  const hrefs = new Set(content.map((item) => item.href));

  assert.ok(content.length >= 190, `expected the captured service archive to expose at least 190 routes, got ${content.length}`);
  assert.equal(hrefs.size, content.length, "service content routes must not be duplicated");
  assert.ok(content.every((item) => /^\/(?:dich-vu-|gia-cong-|say-|sua-|tra-|bot-gia-vi\/|thuc-pham-chuc-nang\/)/.test(item.href)));
  assert.ok(content.some((item) => item.href === "/dich-vu-dong-goi-bot-hoa-tan/"));
  assert.ok(content.some((item) => item.href === "/sua-bot-cho-nguoi-gia/"));
  assert.ok(content.every((item) => item.label.trim().length > 0));
});

test("captured consultation forms carry the canonical family context", () => {
  const markup = '<form class="wpcf7-form"><input type="text"/><button type="submit">Gửi</button></form>';
  const result = addCapturedServiceContext(markup, {
    code: "gia-cong-my-pham",
    name: "Gia công mỹ phẩm",
    url: "/gia-cong-my-pham/",
  });

  assert.match(result, /name="service" value="gia-cong-my-pham"/);
  assert.match(result, /name="service_url" value="\/gia-cong-my-pham\/"/);
  assert.match(result, /Đang yêu cầu tư vấn:/);
  assert.equal(addCapturedServiceContext(result, {
    code: "gia-cong-my-pham",
    name: "Gia công mỹ phẩm",
    url: "/gia-cong-my-pham/",
  }), result, "normalization must not duplicate an existing service field");
});

test("captured consultation forms replace a blank legacy service field", () => {
  const markup = '<form class="wpcf7-form"><input type="hidden" name="service" value=""/><input type="text"/></form>';
  const result = addCapturedServiceContext(markup, {
    code: "gia-cong-ca-phe",
    name: "Gia công cà phê",
    url: "/gia-cong-ca-phe/",
  });

  assert.match(result, /name="service" value="gia-cong-ca-phe"/);
  assert.match(result, /name="service_url" value="\/gia-cong-ca-phe\/"/);
  assert.match(result, /Đang yêu cầu tư vấn: <strong>Gia công cà phê<\/strong>/);
  assert.equal((result.match(/name="service"/g) ?? []).length, 1);
});

test("service URLs resolve to a canonical family instead of becoming product or news records", () => {
  assert.equal(getServiceFamilyForRoute("/gia-cong-my-pham/",)?.slug, "gia-cong-my-pham");
  assert.equal(getServiceFamilyForRoute("/sua-bot-cho-nguoi-gia/",)?.slug, "gia-cong-sua");
  assert.equal(getServiceFamilyForRoute("/dich-vu-dong-goi-bao-jumbo/",)?.slug, "gia-cong-dong-goi");
  assert.equal(getServiceFamilyForRoute("/tin-tuc/"), undefined);
});
