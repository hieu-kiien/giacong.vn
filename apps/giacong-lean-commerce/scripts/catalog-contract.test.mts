import assert from "node:assert/strict";
import test from "node:test";

const { catalogHref, parseCatalogFilters } = await import("../src/lib/catalog-query" + ".ts");

test("normalises every data-affecting catalog parameter server-side", () => {
  const filters = parseCatalogFilters({
    category: "  dinh-duong  ",
    direction: "desc",
    page: "3",
    per_page: "24",
    q: "  bột  ",
    sort: "starting_price",
  });

  assert.deepEqual(filters, {
    category: "dinh-duong",
    direction: "desc",
    page: 3,
    pageSize: 24,
    query: "bột",
    sort: "starting_price",
  });
});

test("falls back to the canonical defaults when parameters are absent", () => {
  assert.deepEqual(parseCatalogFilters({}), {
    category: "",
    direction: "asc",
    page: 1,
    pageSize: 12,
    query: "",
    sort: "name",
  });
});

test("rejects sort and direction outside the server allowlist", () => {
  for (const sort of ["catalog_name; DROP TABLE products", "products.id", "", "NAME", "unknown"]) {
    assert.equal(parseCatalogFilters({ sort }).sort, "name", `sort ${JSON.stringify(sort)} must fall back`);
  }
  for (const direction of ["ASC", "descending", "; --", "", "rand()"]) {
    assert.equal(
      parseCatalogFilters({ direction }).direction,
      "asc",
      `direction ${JSON.stringify(direction)} must fall back`,
    );
  }
});

test("accepts every allowlisted sort column and direction", () => {
  for (const sort of ["available_variant_count", "id", "name", "starting_price", "variant_count"]) {
    assert.equal(parseCatalogFilters({ sort }).sort, sort);
  }
  for (const direction of ["asc", "desc"]) {
    assert.equal(parseCatalogFilters({ direction }).direction, direction);
  }
});

test("rejects a page size outside the server allowlist", () => {
  for (const perPage of ["7", "0", "-1", "49", "1000", "abc", "12.5", ""]) {
    assert.equal(
      parseCatalogFilters({ per_page: perPage }).pageSize,
      12,
      `per_page ${JSON.stringify(perPage)} must fall back to the default`,
    );
  }
  for (const perPage of ["12", "24", "48"]) {
    assert.equal(parseCatalogFilters({ per_page: perPage }).pageSize, Number(perPage));
  }
});

test("clamps the page number so untrusted input cannot explode the cache key", () => {
  for (const page of ["0", "-3", "abc", "", "1e5", "1.5", "NaN"]) {
    assert.equal(parseCatalogFilters({ page }).page, 1, `page ${JSON.stringify(page)} must fall back to 1`);
  }
  assert.equal(parseCatalogFilters({ page: "1000" }).page, 1000);
  assert.equal(parseCatalogFilters({ page: "1001" }).page, 1000, "page must clamp to the documented ceiling");
  assert.equal(parseCatalogFilters({ page: "999999999" }).page, 1000);
});

test("caps free-text search and category length before they reach the upstream API", () => {
  assert.equal(parseCatalogFilters({ q: "a".repeat(400) }).query.length, 100);
  assert.equal(parseCatalogFilters({ category: "c".repeat(400) }).category.length, 120);
});

test("reads only the first value of a repeated parameter", () => {
  const filters = parseCatalogFilters({
    direction: ["desc", "asc"],
    page: ["2", "9"],
    per_page: ["48", "12"],
    q: ["bột", "khác"],
    sort: ["id", "name"],
  });

  assert.equal(filters.direction, "desc");
  assert.equal(filters.page, 2);
  assert.equal(filters.pageSize, 48);
  assert.equal(filters.query, "bột");
  assert.equal(filters.sort, "id");
});

test("round-trips normalised filters through the catalog URL", () => {
  const filters = parseCatalogFilters({
    category: "dinh-duong",
    direction: "desc",
    page: "4",
    per_page: "24",
    q: "bột",
    sort: "starting_price",
  });
  const href = catalogHref(filters);
  const parsed = new URL(href, "http://localhost");

  assert.equal(parsed.pathname, "/san-pham/");
  assert.deepEqual(parseCatalogFilters(Object.fromEntries(parsed.searchParams)), filters);
});

test("omits default values from the catalog URL to keep one canonical address", () => {
  assert.equal(catalogHref(parseCatalogFilters({})), "/san-pham/");
  assert.equal(catalogHref({ ...parseCatalogFilters({}), sort: "name", direction: "asc" }), "/san-pham/");
  assert.equal(
    catalogHref({ ...parseCatalogFilters({}), sort: "starting_price" }),
    "/san-pham/?sort=starting_price",
  );
  assert.equal(catalogHref({ ...parseCatalogFilters({}), direction: "desc" }), "/san-pham/?direction=desc");
  assert.equal(catalogHref({ ...parseCatalogFilters({}), pageSize: 24 }), "/san-pham/?per_page=24");
});
