import { Buffer } from "node:buffer";
import { crc32 } from "node:zlib";
import type { AdminCustomerSummary } from "./admin-customers.ts";

export interface CustomerSaleExport {
  customerId: string;
  saleCode: string;
  confirmedAt: string;
  totalAmount: number;
}

function xmlText(value: string): string {
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, "")
    .replace(/_x[0-9a-f]{4}_/gi, (match) => `_x005F_${match}`)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// A small, bounded XLSX package using stored ZIP entries and native CRC32.
// No macros, formulas, links, formatting engine or third-party runtime library.
function packageWorkbook(parts: readonly [string, string][]): Buffer {
  const entries: Buffer[] = [];
  const directory: Buffer[] = [];
  let offset = 0;
  for (const [path, xml] of parts) {
    const name = Buffer.from(path);
    const data = Buffer.from(xml);
    const checksum = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x21, 12); // 1980-01-01, the ZIP epoch.
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    entries.push(local, name, data);
    directory.push(central, name);
    offset += local.length + name.length + data.length;
  }
  const directorySize = directory.reduce((size, part) => size + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(parts.length, 8);
  end.writeUInt16LE(parts.length, 10);
  end.writeUInt32LE(directorySize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...entries, ...directory, end]);
}

function sheetXml(rows: readonly (readonly (string | number | null)[])[]): string {
  const data = rows.map((row, index) => `<row r="${index + 1}">${row.map((value, column) => {
    const cell = `${String.fromCharCode(65 + column)}${index + 1}`;
    return typeof value === "number" && Number.isFinite(value)
      ? `<c r="${cell}"><v>${value}</v></c>`
      : `<c r="${cell}" t="inlineStr"><is><t xml:space="preserve">${xmlText(String(value ?? "").slice(0, 32767))}</t></is></c>`;
  }).join("")}</row>`).join("");
  return `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="9" width="24" customWidth="1"/></cols><sheetData>${data}</sheetData></worksheet>`;
}

/** Excel text cells preserve phone zeros and never interpret customer input as formulas. */
export function buildCustomerExportXlsx(customers: readonly AdminCustomerSummary[], sales: readonly CustomerSaleExport[]): Buffer {
  const byId = new Map(customers.map((customer) => [customer.id, customer]));
  const customerRows = [["Họ tên", "Email", "Tên đăng nhập", "Số điện thoại", "Số yêu cầu", "Yêu cầu gần nhất", "Giao dịch đã chốt", "Tổng tiền đã chốt (VND)", "Ngày đăng ký"],
    ...customers.map((customer) => [customer.name, customer.email, customer.username, customer.phone, customer.requestCount, customer.lastRequestAt, customer.saleCount, customer.saleTotal, customer.createdAt])];
  const saleRows = [["Mã giao dịch", "Khách hàng", "Email", "Số điện thoại", "Ngày chốt", "Tổng tiền (VND)"],
    ...sales.map((sale) => {
      const customer = byId.get(sale.customerId);
      return [sale.saleCode, customer?.name ?? "", customer?.email ?? "", customer?.phone ?? "", sale.confirmedAt, sale.totalAmount];
    })];
  const relationships = "http://schemas.openxmlformats.org/package/2006/relationships";
  const officeRelationships = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  return packageWorkbook([
    ["[Content_Types].xml", `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`],
    ["_rels/.rels", `<Relationships xmlns="${relationships}"><Relationship Id="rId1" Type="${officeRelationships}/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml", `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${officeRelationships}"><sheets><sheet name="Khách hàng" sheetId="1" r:id="rId1"/><sheet name="Giao dịch đã chốt" sheetId="2" r:id="rId2"/></sheets></workbook>`],
    ["xl/_rels/workbook.xml.rels", `<Relationships xmlns="${relationships}"><Relationship Id="rId1" Type="${officeRelationships}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${officeRelationships}/worksheet" Target="worksheets/sheet2.xml"/></Relationships>`],
    ["xl/worksheets/sheet1.xml", sheetXml(customerRows)],
    ["xl/worksheets/sheet2.xml", sheetXml(saleRows)],
  ]);
}
