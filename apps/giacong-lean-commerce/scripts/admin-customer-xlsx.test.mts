import assert from "node:assert/strict";
import test from "node:test";
import { crc32 } from "node:zlib";
import { buildCustomerExportXlsx } from "../src/lib/admin-customer-xlsx.ts";

test("Excel export contains customers and confirmed sales as separate sheets with literal text", () => {
  const file = buildCustomerExportXlsx([{ id: "u1", name: "=HYPERLINK(\"bad\")", email: "a@example.test", phone: "0900000001", username: null, createdAt: "2026-10-05", lastRequestAt: null, requestCount: 2, saleCount: 1, saleTotal: 250000 }], [{ customerId: "u1", saleCode: "GD-1", confirmedAt: "2026-10-05", totalAmount: 250000 }]);
  const parts = new Map<string, string>();
  let offset = 0;
  while (file.readUInt32LE(offset) === 0x04034b50) {
    const size = file.readUInt32LE(offset + 18);
    const nameLength = file.readUInt16LE(offset + 26);
    const name = file.subarray(offset + 30, offset + 30 + nameLength).toString();
    const bytes = file.subarray(offset + 30 + nameLength, offset + 30 + nameLength + size);
    assert.equal(crc32(bytes), file.readUInt32LE(offset + 14));
    parts.set(name, bytes.toString());
    offset += 30 + nameLength + size;
  }
  assert.equal(file.readUInt32LE(offset), 0x02014b50);
  assert.match(parts.get("xl/workbook.xml")!, /Khách hàng/);
  assert.match(parts.get("xl/workbook.xml")!, /Giao dịch đã chốt/);
  assert.match(parts.get("xl/worksheets/sheet1.xml")!, /t="inlineStr"[\s\S]*=HYPERLINK/);
  assert.match(parts.get("xl/worksheets/sheet1.xml")!, /0900000001/);
  assert.match(parts.get("xl/worksheets/sheet2.xml")!, /GD-1/);
  assert.match(parts.get("xl/worksheets/sheet2.xml")!, /<v>250000<\/v>/);
  for (const xml of parts.values()) assert.doesNotMatch(xml, /<f[ >]/);
});
