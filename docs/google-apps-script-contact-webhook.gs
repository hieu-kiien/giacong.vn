/**
 * Google Apps Script receiver for POST /api/contact.
 * Bind this script to the target spreadsheet, then deploy it as a Web app.
 */
const CONTACT_SHEET_NAME = "Yeu cau";
const CONTACT_HEADERS = [
  "Mã",
  "Thời gian",
  "Họ tên",
  "Điện thoại",
  "Email",
  "Nội dung",
  "Nguồn",
  "Trạng thái",
];

function doPost(event) {
  try {
    const payload = JSON.parse(event.postData.contents);
    const expectedSecret = PropertiesService.getScriptProperties()
      .getProperty("WEBHOOK_SECRET");
    if (expectedSecret && payload.secret !== expectedSecret) {
      return jsonResponse({ ok: false, reference: "" });
    }

    const sheet = getContactSheet();
    const reference = createReference();
    sheet.appendRow([
      reference,
      new Date(),
      text(payload.name, 120),
      text(payload.phone, 24),
      text(payload.email, 254),
      text(payload.message, 2000),
      text(payload.source, 200),
      "Mới",
    ]);
    return jsonResponse({ ok: true, reference });
  } catch (_error) {
    return jsonResponse({ ok: false, reference: "" });
  }
}

function getContactSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(CONTACT_SHEET_NAME)
    || spreadsheet.insertSheet(CONTACT_SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(CONTACT_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function createReference() {
  const timestamp = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyyMMdd-HHmmss",
  );
  return `YC-${timestamp}-${Utilities.getUuid().slice(0, 8).toUpperCase()}`;
}

function text(value, limit) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function jsonResponse(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
