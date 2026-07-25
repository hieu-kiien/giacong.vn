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

    if (!validSubmission(payload)) {
      return jsonResponse({ ok: false, reference: "" });
    }

    const sheet = getContactSheet();
    const reference = createReference();
    sheet.appendRow([
      reference,
      new Date(),
      safeText(payload.name, 120),
      safeText(payload.phone, 24),
      safeText(payload.email, 254),
      safeText(payload.message, 2000),
      safeText(payload.source, 200),
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

function validSubmission(payload) {
  const name = rawText(payload.name, 120);
  const phone = rawText(payload.phone, 24);
  const email = rawText(payload.email, 254);
  return name.length >= 2
    && /^\+?\d{8,15}$/.test(phone.replace(/[\s().-]/g, ""))
    && (!email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

function rawText(value, limit) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function safeText(value, limit) {
  const normalized = rawText(value, limit);
  return /^[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
}

function jsonResponse(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
