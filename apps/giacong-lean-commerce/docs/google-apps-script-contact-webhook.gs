/*
 * Giacong.vn contact webhook.
 *
 * This script intentionally keeps the spreadsheet as a secondary operational
 * sink. The Worker validates the request before calling doPost; this file
 * repeats the boundary checks because Apps Script web apps are public URLs.
 */

var REQUEST_HEADERS = [
  "Mã", "Thời gian", "Loại", "Sản phẩm/Dịch vụ", "Biến thể", "Số lượng",
  "Họ tên", "Điện thoại", "Email", "Nội dung", "Nguồn", "Trạng thái",
  "Người phụ trách", "Ghi chú", "Cập nhật lần cuối",
];
var DETAIL_HEADERS = [
  "Mã", "Dòng", "Sản phẩm", "Biến thể", "Đơn vị", "Số lượng",
  "Đơn giá", "Thành tiền", "Ghi chú hệ thống",
];
var TYPES = ["Đặt sản phẩm", "Tư vấn số lượng lớn", "Tư vấn dịch vụ"];
var STATUSES = ["Mới", "Đang tư vấn", "Chờ khách phản hồi", "Đã hoàn tất", "Không tiếp tục"];
var CACHE_SECONDS = 21600;

function doPost(event) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) return output({ ok: false, reference: "" });
  try {
    var payload = parsePayload(event);
    if (!payload || !validSecret(payload) || !validPayload(payload)) {
      return output({ ok: false, reference: "" });
    }

    var requestId = typeof payload.request_id === "string" ? payload.request_id : "";
    var cache = CacheService.getScriptCache();
    if (requestId) {
      var previous = cache.get("request:" + requestId);
      if (previous) return output({ ok: true, reference: previous });
    }

    var reference = makeReference();
    var isCart = Array.isArray(payload.cart);
    if (isCart) {
      ensureCartDetailSheet();
      writeCartRows(payload.cart, reference);
    }
    setupRequestWorkbook();
    var sheet = workbook().getSheetByName("Yêu cầu");
    var now = new Date();
    var row = [
      reference,
      now,
      payload.request_type,
      safeText(isCart ? "Giỏ yêu cầu (" + payload.cart.length + " dòng)" : payload.product),
      safeText(payload.variant),
      payload.qty,
      safeText(payload.name),
      safeText(payload.phone),
      safeText(payload.email),
      safeText(payload.message),
      safeText(payload.source),
      "Mới",
      "",
      "",
      now,
    ];

    sheet.appendRow(row);
    refreshSummary();
    if (requestId) cache.put("request:" + requestId, reference, CACHE_SECONDS);
    return output({ ok: true, reference: reference });
  } catch (_error) {
    return output({ ok: false, reference: "" });
  } finally {
    lock.releaseLock();
  }
}

function setupRequestWorkbook() {
  var book = workbook();
  var requestSheet = book.getSheetByName("Yêu cầu") || book.insertSheet("Yêu cầu");
  ensureHeaders(requestSheet, REQUEST_HEADERS);
  requestSheet.setFrozenRows(1);
  requestSheet.getRange(2, 3, Math.max(1, requestSheet.getMaxRows() - 1), 1)
    .setDataValidation(validation(TYPES));
  requestSheet.getRange(2, 12, Math.max(1, requestSheet.getMaxRows() - 1), 1)
    .setDataValidation(validation(STATUSES));
  protectSheet(requestSheet, "Lean V1: Chỉ vận hành L:N", requestSheet.getRange(2, 12, Math.max(1, requestSheet.getMaxRows() - 1), 3));

  var summarySheet = book.getSheetByName("Tổng quan") || book.insertSheet("Tổng quan");
  ensureHeaders(summarySheet, ["Chỉ số", "Số lượng"]);
  protectSheet(summarySheet, "Lean V1: Tổng quan chỉ đọc", null);

  var detailSheet = book.getSheetByName("Chi tiết giỏ hàng") || book.insertSheet("Chi tiết giỏ hàng");
  ensureHeaders(detailSheet, DETAIL_HEADERS);
  detailSheet.setFrozenRows(1);
  protectSheet(detailSheet, "Lean V1: Chi tiết giỏ hàng chỉ đọc", null);
  refreshSummary();
}

function onEdit(event) {
  if (!event || !event.range) return;
  var range = event.range;
  var sheet = range.getSheet();
  if (!sheet || sheet.getName() !== "Yêu cầu" || range.getRow() < 2) return;
  var column = range.getColumn();
  if (column === 12) {
    var oldValue = event.oldValue || "";
    var value = event.value || range.getValue();
    var assignee = sheet.getCell(range.getRow(), 13);
    var valid = validTransition(oldValue, value) && (oldValue !== "Mới" || value !== "Đang tư vấn" || assignee !== "");
    if (!valid) {
      range.setValue(oldValue);
      workbook().toast("Trạng thái hoặc người phụ trách không hợp lệ.");
      return;
    }
    sheet.getRange(range.getRow(), 15).setValue(new Date());
    return;
  }
  if (column === 13 || column === 14) {
    sheet.getRange(range.getRow(), 15).setValue(new Date());
  }
}

function parsePayload(event) {
  try {
    var raw = event && event.postData && event.postData.contents;
    var payload = JSON.parse(raw || "{}");
    return payload && typeof payload === "object" && !Array.isArray(payload) ? payload : null;
  } catch (_error) {
    return null;
  }
}

function validSecret(payload) {
  var expected = PropertiesService.getScriptProperties().getProperty("CONTACT_WEBHOOK_SECRET");
  return typeof payload.secret === "string" && payload.secret === (expected || "shared-secret");
}

function validPayload(payload) {
  if (typeof payload.name !== "string" || typeof payload.phone !== "string"
    || typeof payload.email !== "string" || typeof payload.message !== "string"
    || typeof payload.source !== "string" || typeof payload.request_type !== "string") return false;
  if (!TYPES.includes(payload.request_type)) return false;
  if (payload.request_type === "Tư vấn dịch vụ") {
    return payload.product === "" && payload.variant === "" && payload.qty === "" && typeof payload.service === "string" && payload.service !== "";
  }
  if (Array.isArray(payload.cart)) {
    if (payload.request_type !== "Tư vấn số lượng lớn" || typeof payload.product !== "string" || payload.product === ""
      || payload.service !== "" || payload.variant !== "" || payload.qty !== "" || payload.cart.length < 1 || payload.cart.length > 20
      || typeof payload.request_id !== "string" || !isUuid(payload.request_id)) return false;
    if (typeof payload.cart_subtotal !== "number" || typeof payload.cart_price_incomplete !== "boolean") return false;
    return payload.cart.every(validCartLine);
  }
  if (payload.service !== "" || typeof payload.product !== "string" || typeof payload.variant !== "string"
    || typeof payload.qty !== "number" || !Number.isSafeInteger(payload.qty) || payload.qty < 1) return false;
  return payload.product !== "" && payload.variant !== "";
}

function validCartLine(line) {
  return line && typeof line === "object"
    && Number.isSafeInteger(line.index) && line.index > 0
    && typeof line.product === "string" && line.product !== ""
    && typeof line.variant === "string" && line.variant !== ""
    && typeof line.unit === "string" && line.unit !== ""
    && typeof line.qty === "number" && Number.isSafeInteger(line.qty) && line.qty > 0
    && typeof line.note === "string"
    && (line.unit_price === "" || (typeof line.unit_price === "number" && Number.isFinite(line.unit_price)))
    && (line.line_total === "" || (typeof line.line_total === "number" && Number.isFinite(line.line_total)));
}

function writeCartRows(cart, reference) {
  var sheet = workbook().getSheetByName("Chi tiết giỏ hàng");
  var firstRow = sheet.getLastRow() + 1;
  var values = cart.map(function (line) {
    return [
      reference,
      line.index,
      safeText(line.product),
      safeText(line.variant),
      safeText(line.unit),
      line.qty,
      line.unit_price,
      line.line_total,
      safeText(line.note),
    ];
  });
  sheet.getRange(firstRow, 1, values.length, DETAIL_HEADERS.length).setValues(values);
}

function ensureCartDetailSheet() {
  var sheet = workbook().getSheetByName("Chi tiết giỏ hàng") || workbook().insertSheet("Chi tiết giỏ hàng");
  ensureHeaders(sheet, DETAIL_HEADERS);
}

function refreshSummary() {
  var book = workbook();
  var requestSheet = book.getSheetByName("Yêu cầu");
  var summarySheet = book.getSheetByName("Tổng quan");
  if (!requestSheet || !summarySheet) return;
  var lastRow = requestSheet.getLastRow();
  var rows = lastRow > 1 ? requestSheet.getRange(2, 3, lastRow - 1, 10).getValues() : [];
  var orders = rows.filter(function (row) { return row[0] === "Đặt sản phẩm"; }).length;
  var volume = rows.filter(function (row) { return row[0] === "Tư vấn số lượng lớn"; }).length;
  summarySheet.getRange(1, 1, 3, 2).setValues([
    ["Chỉ số", "Số lượng"],
    ["Đơn mới", orders],
    ["Yêu cầu mới", volume],
  ]);
}

function protectSheet(sheet, description, editableRange) {
  var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
  var protection = protections.length ? protections[0] : sheet.protect();
  protection.setDescription(description);
  var self = Session.getEffectiveUser();
  var selfEmail = typeof self === "string" ? self : self.getEmail();
  protection.removeEditors(protection.getEditors().filter(function (u) {
    var email = typeof u === "string" ? u : u.getEmail();
    return email !== selfEmail;
  }));
  protection.addEditor(self);
  try { protection.setDomainEdit(false); } catch (domainEditIgnored) { /* consumer accounts have no domain */ }
  protection.setWarningOnly(false);
  protection.getTargetAudiences().forEach(function (audience) {
    protection.removeTargetAudience(audience);
  });
  if (editableRange) protection.setUnprotectedRanges([editableRange]);
}

function ensureHeaders(sheet, headers) {
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
}

function validation(values) {
  return SpreadsheetApp.newDataValidation().requireValueInList(values).setAllowInvalid(false).build();
}

function validTransition(oldValue, value) {
  if (!STATUSES.includes(value)) return false;
  if (!oldValue) return value === "Mới";
  var allowed = {
    "Mới": ["Đang tư vấn"],
    "Đang tư vấn": ["Chờ khách phản hồi", "Đã hoàn tất", "Không tiếp tục"],
    "Chờ khách phản hồi": ["Đang tư vấn", "Đã hoàn tất", "Không tiếp tục"],
  };
  return (allowed[oldValue] || []).includes(value);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function safeText(value) {
  if (typeof value !== "string") return value;
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}

function makeReference() {
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd-HHmmss");
  var suffix = Utilities.getUuid().replace(/-/g, "").slice(0, 8).toUpperCase();
  return "YC-" + stamp + "-" + suffix;
}

function workbook() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function output(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
