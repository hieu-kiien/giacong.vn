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
const REQUEST_TYPES = ["Đặt sản phẩm", "Tư vấn số lượng lớn", "Tư vấn dịch vụ"];
const REQUEST_STATUSES = ["Mới", "Đang tư vấn", "Chờ khách phản hồi", "Đã hoàn tất", "Không tiếp tục"];
const SUMMARY_SHEET_NAME = "Tổng quan";
const CART_DETAIL_SHEET_NAME = "Chi tiết giỏ hàng";
const CART_DETAIL_HEADERS = [
  "Mã",
  "Dòng",
  "Sản phẩm",
  "Biến thể",
  "Đơn vị",
  "Số lượng",
  "Đơn giá",
  "Thành tiền",
  "Ghi chú hệ thống",
];
const CART_MAX_LINES = 20;
// Must stay well under the 5s abort on the Next side, otherwise the lock itself manufactures 504s.
const CART_LOCK_TIMEOUT_MS = 2000;
const CART_REPLAY_TTL_SECONDS = 21600;
const FORM_REPLAY_TTL_SECONDS = 3600;
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function doPost(event) {
  try {
    const payload = JSON.parse(event.postData.contents);
    const expectedSecret = PropertiesService.getScriptProperties()
      .getProperty("WEBHOOK_SECRET");
    if (expectedSecret && payload.secret !== expectedSecret) {
      return jsonResponse({ ok: false, reference: "" });
    }

    if (isCartSubmission(payload)) return appendCartSubmission(payload);

    if (!validSubmission(payload)) {
      return jsonResponse({ ok: false, reference: "" });
    }

    return appendFormSubmission(payload);
  } catch (_error) {
    return jsonResponse({ ok: false, reference: "" });
  }
}

function contactRow(payload, reference, timestamp, product, variant, quantity) {
  return [
    reference,
    timestamp,
    safeText(payload.request_type, 50),
    product,
    variant,
    quantity,
    safeText(payload.name, 120),
    safeText(payload.phone, 24),
    safeText(payload.email, 254),
    safeText(payload.message, 2000),
    safeText(payload.source, 200),
    "Mới",
    "",
    "",
    timestamp,
  ];
}

function isCartSubmission(payload) {
  return Object.prototype.hasOwnProperty.call(payload, "cart");
}

/**
 * Multi-line cart intake. Detail rows are written first and the `Yêu cầu` row commits them:
 * dying in between leaves orphan detail rows the operator never sees, which is the harmless
 * direction. The reverse order would promise N lines that do not exist.
 */
function appendCartSubmission(payload) {
  if (!validCartSubmission(payload)) return jsonResponse({ ok: false, reference: "" });

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CART_LOCK_TIMEOUT_MS)) return jsonResponse({ ok: false, reference: "" });
  try {
    const cache = CacheService.getScriptCache();
    const replayKey = `cart-request:${payload.request_id}`;
    const replayed = cache.get(replayKey);
    if (replayed) return jsonResponse({ ok: true, reference: replayed });

    const reference = createReference();
    const timestamp = new Date();
    const detailSheet = getCartDetailSheet();
    const startRow = Math.max(detailSheet.getLastRow(), 1) + 1;
    detailSheet
      .getRange(startRow, 1, payload.cart.length, CART_DETAIL_HEADERS.length)
      .setValues(payload.cart.map((line, index) => [
        reference,
        index + 1,
        safeText(line.product, 200),
        safeText(line.variant, 160),
        safeText(line.unit, 24),
        safeQuantity(line.qty),
        safeMoney(line.unit_price),
        safeMoney(line.line_total),
        safeText(line.note, 200),
      ]));

    getContactSheet().appendRow(contactRow(
      payload,
      reference,
      timestamp,
      safeText(payload.product, 200),
      "",
      "",
    ));
    refreshSummarySheet();
    cache.put(replayKey, reference, CART_REPLAY_TTL_SECONDS);
    return jsonResponse({ ok: true, reference });
  } catch (_error) {
    return jsonResponse({ ok: false, reference: "" });
  } finally {
    lock.releaseLock();
  }
}

function getCartDetailSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(CART_DETAIL_SHEET_NAME)
    || spreadsheet.insertSheet(CART_DETAIL_SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(CART_DETAIL_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
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

function setupRequestWorkbook() {
  const sheet = getContactSheet();
  sheet.getRange(1, 1, 1, CONTACT_HEADERS.length).setValues([CONTACT_HEADERS]);
  sheet.setFrozenRows(1);
  const typeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(REQUEST_TYPES, true).setAllowInvalid(false).build();
  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(REQUEST_STATUSES, true).setAllowInvalid(false).build();
  const dataRows = Math.max(sheet.getMaxRows() - 1, 1);
  sheet.getRange(2, 3, dataRows, 1).setDataValidation(typeRule);
  sheet.getRange(2, 12, dataRows, 1).setDataValidation(statusRule);
  // Sheet.protect() reuses the sheet's existing protection when present.
  // https://developers.google.com/apps-script/reference/spreadsheet/sheet
  const protection = sheet.protect().setDescription("Lean V1: Chỉ vận hành L:N");
  configureProtection(protection);
  protection.setUnprotectedRanges([sheet.getRange(2, 12, dataRows, 3)]);
  setupCartDetailSheet();
  setupSummarySheet();
}

function setupCartDetailSheet() {
  const sheet = getCartDetailSheet();
  sheet.getRange(1, 1, 1, CART_DETAIL_HEADERS.length).setValues([CART_DETAIL_HEADERS]);
  sheet.setFrozenRows(1);
  // No unprotected range: every column is written by the server, the administrator only reads.
  const protection = sheet.protect().setDescription("Lean V1: Chi tiết giỏ hàng chỉ đọc");
  configureProtection(protection);
  protection.setUnprotectedRanges([]);
}

function setupSummarySheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SUMMARY_SHEET_NAME)
    || spreadsheet.insertSheet(SUMMARY_SHEET_NAME);
  refreshSummarySheet();
  const protection = sheet.protect().setDescription("Lean V1: Tổng quan chỉ đọc");
  configureProtection(protection);
}

function refreshSummarySheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const summarySheet = spreadsheet.getSheetByName(SUMMARY_SHEET_NAME)
    || spreadsheet.insertSheet(SUMMARY_SHEET_NAME);
  summarySheet.getRange(1, 1, 3, 1).setValues([
    ["Chỉ số"],
    ["Đơn mới"],
    ["Yêu cầu mới"],
  ]);
  summarySheet.getRange(1, 2, 1, 1).setValues([
    ["Số lượng"],
  ]);
  summarySheet.getRange(2, 2, 2, 1).setFormulas([
    ['=COUNTIFS(\'Yêu cầu\'!C:C,"Đặt sản phẩm",\'Yêu cầu\'!L:L,"Mới")'],
    ['=COUNTIFS(\'Yêu cầu\'!C:C,"Tư vấn số lượng lớn",\'Yêu cầu\'!L:L,"Mới")+COUNTIFS(\'Yêu cầu\'!C:C,"Tư vấn dịch vụ",\'Yêu cầu\'!L:L,"Mới")'],
  ]);
}

function appendFormSubmission(payload) {
  const requestId = rawText(payload.request_id, 36);
  if (!UUID_V4_PATTERN.test(requestId)) {
    return jsonResponse({ ok: true, reference: appendFormRow(payload) });
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CART_LOCK_TIMEOUT_MS)) return jsonResponse({ ok: false, reference: "" });
  try {
    const cache = CacheService.getScriptCache();
    const replayKey = `form-request:${requestId}`;
    const replayed = cache.get(replayKey);
    if (replayed) return jsonResponse({ ok: true, reference: replayed });

    const reference = appendFormRow(payload);
    cache.put(replayKey, reference, FORM_REPLAY_TTL_SECONDS);
    return jsonResponse({ ok: true, reference });
  } catch (_error) {
    return jsonResponse({ ok: false, reference: "" });
  } finally {
    lock.releaseLock();
  }
}

function appendFormRow(payload) {
  const sheet = getContactSheet();
  const reference = createReference();
  const timestamp = new Date();
  sheet.appendRow(contactRow(
    payload,
    reference,
    timestamp,
    safeText(payload.product || payload.service, 200),
    safeText(payload.variant, 160),
    safeQuantity(payload.qty),
  ));
  refreshSummarySheet();
  return reference;
}

function configureProtection(protection) {
  // Keep the effective user as a direct editor before removing group-derived editors.
  // https://developers.google.com/apps-script/reference/spreadsheet/protection
  protection.addEditor(Session.getEffectiveUser());
  protection.removeEditors(protection.getEditors());
  if (protection.canDomainEdit()) protection.setDomainEdit(false);
  protection.setWarningOnly(false);
  protection.getTargetAudiences().forEach((audienceId) => protection.removeTargetAudience(audienceId));
}

function onEdit(event) {
  if (!event || !event.range) return;
  const range = event.range;
  const sheet = range.getSheet();
  const row = range.getRow();
  const column = range.getColumn();
  if (sheet.getName() !== CONTACT_SHEET_NAME || row < 2 || column < 12 || column > 14) return;
  if (column === 12) {
    const previous = event.oldValue || "Mới";
    const next = String(event.value || "").trim();
    const assignee = String(sheet.getRange(row, 13).getValue() || "").trim();
    if (!validStatusChange(previous, next, assignee)) {
      range.setValue(previous);
      SpreadsheetApp.getActiveSpreadsheet().toast("Trạng thái hoặc người phụ trách không hợp lệ.");
      return;
    }
  }
  sheet.getRange(row, 15).setValue(new Date());
  refreshSummarySheet();
}

function validStatusChange(previous, next, assignee) {
  if (previous === next) return true;
  if (previous === "Mới") return next === "Đang tư vấn" && Boolean(assignee);
  if (previous === "Đang tư vấn") return ["Chờ khách phản hồi", "Đã hoàn tất", "Không tiếp tục"].includes(next);
  if (previous === "Chờ khách phản hồi") return ["Đang tư vấn", "Đã hoàn tất", "Không tiếp tục"].includes(next);
  return false;
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

function validCartSubmission(payload) {
  const name = rawText(payload.name, 120);
  const phone = rawText(payload.phone, 24);
  const email = rawText(payload.email, 254);
  const requestType = rawText(payload.request_type, 50);
  const validContact = name.length >= 2
    && /^\+?\d{8,15}$/.test(phone.replace(/[\s().-]/g, ""))
    && (!email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  if (!validContact) return false;
  if (requestType !== "Đặt sản phẩm" && requestType !== "Tư vấn số lượng lớn") return false;
  if (!UUID_V4_PATTERN.test(rawText(payload.request_id, 36))) return false;
  // A cart row summarizes in D and leaves E:F empty; variant, qty and service must stay blank.
  if (!rawText(payload.product, 200)) return false;
  if (rawText(payload.variant, 160) || rawText(payload.service, 80)) return false;
  if (payload.qty !== "") return false;
  if (!Array.isArray(payload.cart) || payload.cart.length < 1 || payload.cart.length > CART_MAX_LINES) return false;
  return payload.cart.every(validCartLine);
}

function validCartLine(line) {
  if (!line || typeof line !== "object") return false;
  if (!validQuantity(line.index) || line.index > CART_MAX_LINES) return false;
  if (!validQuantity(line.qty)) return false;
  if (!rawText(line.product, 200) || !rawText(line.unit, 24)) return false;
  return validMoney(line.unit_price) && validMoney(line.line_total);
}

function validMoney(value) {
  return value === "" || (typeof value === "number" && Number.isSafeInteger(value) && value > 0);
}

function safeMoney(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : "";
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
