import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  parseProductImportCsv,
  prepareAdminProductImportRows,
} from "../src/lib/admin-product-import.ts";

const componentPath = new URL("../src/components/admin/AdminProductImportPanel.tsx", import.meta.url);

function extractSampleCsv(source) {
  const match = /const sampleCsv = "(?<raw>(?:[^"\\]|\\.)*)"/.exec(source);
  assert.ok(match?.groups?.raw !== undefined, "phải tìm thấy const sampleCsv trong component");
  // Giải mã literal JS (\\n, \\uFEFF, ...) đúng như runtime thấy.
  return JSON.parse(`"${match.groups.raw}"`);
}

test("sample CSV that: 8 header = 8 o du lieu", async () => {
  const source = await readFile(componentPath, "utf8");
  const sampleCsv = extractSampleCsv(source);
  const lines = sampleCsv.split("\n").filter((line) => line.length > 0);
  assert.equal(lines.length, 2, "sample phải có đúng 2 dòng: header + 1 dòng dữ liệu");
  const headerCells = lines[0].split(",");
  const dataCells = lines[1].split(",");
  assert.equal(headerCells.length, 8, `header phải có 8 cột, thấy ${headerCells.length}: ${lines[0]}`);
  assert.equal(
    dataCells.length,
    headerCells.length,
    `dòng dữ liệu phải có ${headerCells.length} ô như header, thấy ${dataCells.length}: ${lines[1]}`,
  );
});

test("sample CSV that chay qua parser/validator that khong loi file", async () => {
  const source = await readFile(componentPath, "utf8");
  const sampleCsv = extractSampleCsv(source);
  const parsed = parseProductImportCsv(sampleCsv);
  assert.deepEqual(parsed.errors, [], `parser that phải không báo lỗi file, thấy: ${JSON.stringify(parsed.errors)}`);
  assert.equal(parsed.rows.length, 1, "parser phải cho đúng 1 dòng dữ liệu");

  const row = parsed.rows[0];
  assert.equal(row.shortDescription, "Mô tả ngắn dùng thử", "short_description phải đúng cột mẫu");
  assert.equal(row.description, "", "description mẫu phải trống");
  assert.equal(row.imageUrl, "", "image_url mẫu phải trống");
  assert.equal(row.leadTimeDays, "7", "lead_time_days mẫu phải là 7");

  const prepared = prepareAdminProductImportRows(parsed.rows, []);
  assert.deepEqual(prepared.errors, [], `validator that phải không báo lỗi, thấy: ${JSON.stringify(prepared.errors)}`);
  assert.equal(prepared.entries.length, 1, "prepare phải cho 1 valid row để nhập");
});
