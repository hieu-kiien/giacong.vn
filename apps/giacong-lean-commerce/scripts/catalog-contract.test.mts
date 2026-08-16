import assert from "node:assert/strict";
import test from "node:test";
import {
  catalogHref,
  DEFAULT_CATALOG_PAGE_SIZE,
  DEFAULT_CATALOG_SORT,
  parseCatalogFilters,
} from "../src/lib/catalog-query.ts";

test("normalizes catalog filters into bounded allowlisted values", () => {
  assert.deepEqual(parseCatalogFilters({
    category: ["bot-nguyen-lieu-kho"],
    direction: "desc",
    page: "999999",
    per_page: "48",
    q: "  bột  ",
    sort: "starting_price",
  }), {
    category: "bot-nguyen-lieu-kho",
    direction: "desc",
    page: 1000,
    pageSize: 48,
    query: "bột",
    sort: "starting_price",
  });
});

test("falls back for unsupported query values and produces canonical hrefs", () => {
  const filters = parseCatalogFilters({
    direction: "DROP TABLE",
    page: "-1",
    per_page: "13",
    sort: "unknown",
  });
  assert.equal(filters.sort, DEFAULT_CATALOG_SORT);
  assert.equal(filters.pageSize, DEFAULT_CATALOG_PAGE_SIZE);
  assert.equal(filters.page, 1);
  assert.equal(catalogHref({ ...filters, category: "bot-nguyen-lieu-kho", page: 2 }), "/san-pham/?category=bot-nguyen-lieu-kho&page=2");
});