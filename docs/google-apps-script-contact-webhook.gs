/**
 * Google Apps Script receiver for POST /api/contact.
 * Bind this script to the target spreadsheet, then deploy it as a Web app.
 */
const CONTACT_SHEET_NAME = "Yêu cầu";
const CONTACT_HEADERS = [
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
    const timestamp = new Date();
    sheet.appendRow([
      reference,
      timestamp,
      safeText(payload.request_type, 50),
      safeText(payload.product || payload.service, 200),
      safeText(payload.variant, 160),
      safeQuantity(payload.qty),
      safeText(payload.name, 120),
      safeText(payload.phone, 24),
      safeText(payload.email, 254),
      safeText(payload.message, 2000),
      safeText(payload.source, 200),
      "Mới",
      "",
      "",
      timestamp,
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
  const requestType = rawText(payload.request_type, 50);
  const product = rawText(payload.product, 200);
  const service = rawText(payload.service, 80);
  const variant = rawText(payload.variant, 160);
  const qty = validQuantity(payload.qty);
  const validContact = name.length >= 2
    && /^\+?\d{8,15}$/.test(phone.replace(/[\s().-]/g, ""))
    && (!email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  if (!validContact) return false;
  if (requestType === "Đặt sản phẩm" || requestType === "Tư vấn số lượng lớn") {
    return Boolean(product && variant && qty && !service);
  }
  return requestType === "Tư vấn dịch vụ"
    && !product
    && !variant
    && payload.qty === ""
    && (!service || service === "Sấy & thực phẩm sấy");
}

function rawText(value, limit) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function safeText(value, limit) {
  const normalized = rawText(value, limit);
  return /^[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
}

function validQuantity(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function safeQuantity(value) {
  return validQuantity(value) ? value : "";
}

function jsonResponse(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
