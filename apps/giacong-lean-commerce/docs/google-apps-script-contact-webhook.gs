/** @OnlyCurrentDoc */
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
var ZALO_SALE_HEADERS = [
  "sale_id", "Mã giao dịch", "Mã yêu cầu nguồn", "Thời gian chốt", "Tiền tệ",
  "Tổng tiền", "Khách hàng", "Công ty", "Email", "Điện thoại", "snapshot_sha256",
];
var ZALO_SALE_ITEM_HEADERS = [
  "sale_id", "sale_line_id", "lead_item_id", "Mã giao dịch", "product_slug",
  "service_slug", "Sản phẩm", "Biến thể", "SKU", "Đơn vị", "Số lượng",
  "Đơn giá", "Thành tiền", "Tiền tệ", "Ghi chú", "snapshot_sha256",
];
var TYPES = ["Đặt sản phẩm", "Tư vấn số lượng lớn", "Tư vấn dịch vụ"];
var STATUSES = ["Mới", "Đang tư vấn", "Chờ khách phản hồi", "Đã hoàn tất", "Không tiếp tục"];
var CACHE_SECONDS = 21600;

function doPost(event) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) return output({ ok: false, reference: "" });
  try {
    var payload = parsePayload(event);
    if (!payload || !validSecret(payload)) {
      return output({ ok: false, reference: "" });
    }
    if (payload.event === "customer.contact.updated") return writeCustomerContact(payload);
    if (payload.event === "sale.confirmed") {
      if (!validSalePayload(payload)) return output({ ok: false, sale_id: "", sale_code: "" });
      return writeConfirmedZaloSale(payload);
    }
    if (!validPayload(payload)) return output({ ok: false, reference: "" });

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

    // Phone numbers are identifiers, not numeric values (retain leading zeroes).
    var requestRow = sheet.getLastRow() + 1;
    sheet.getRange(requestRow, 8).setNumberFormats([["@"]]);
    sheet.getRange(requestRow, 1, 1, REQUEST_HEADERS.length).setValues([row]);
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
    var assignee = sheet.getRange(range.getRow(), 13).getValue();
    var hasAssignee = typeof assignee === "string" && assignee.trim() !== "";
    var valid = validTransition(oldValue, value) && (oldValue !== "Mới" || value !== "Đang tư vấn" || hasAssignee);
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
  return typeof expected === "string" && expected.length > 0
    && typeof payload.secret === "string" && payload.secret.length > 0
    && payload.secret === expected;
}

// Profiles are operational copies; a revision prevents an older queue replay overwriting new data.
function writeCustomerContact(payload) {
  if (!hasExactKeys(payload, ["event","customer_id","revision","updated_at","name","phone","company_name","email","secret"])
    || typeof payload.customer_id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(payload.customer_id)
    || !Number.isSafeInteger(payload.revision) || payload.revision < 1
    || typeof payload.updated_at !== "string" || payload.updated_at.length > 40 || !isFinite(Date.parse(payload.updated_at))
    || typeof payload.name !== "string" || !payload.name.trim() || payload.name.length > 120
    || typeof payload.phone !== "string" || !/^\+?\d{8,15}$/.test(payload.phone)
    || typeof payload.company_name !== "string" || payload.company_name.length > 160
    || typeof payload.email !== "string" || payload.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    return output({ ok: false, customer_id: "", revision: 0 });
  }
  var headers = ["Mã khách hàng","Phiên bản","Họ tên","Điện thoại","Email","Công ty","Cập nhật","Nguồn"];
  var book = workbook();
  var sheet = book.getSheetByName("Khách hàng") || book.insertSheet("Khách hàng");
  ensureHeaders(sheet, headers);
  var actualHeaders = sheet.getRange(1,1,1,headers.length).getValues()[0];
  if (!sameRow(actualHeaders,headers)) throw new Error("customer_sheet_headers_mismatch");
  protectSheet(sheet, "Lean V1: Hồ sơ khách hàng chỉ đọc", null);
  var row = findUniqueValueRow(sheet, 1, payload.customer_id);
  var values = [safeText(payload.customer_id),payload.revision,safeText(payload.name),safeText(payload.phone),safeText(payload.email),safeText(payload.company_name),safeText(payload.updated_at),"Tài khoản website"];
  if (row > 0) {
    var current = sheet.getRange(row,1,1,headers.length).getValues()[0];
    if (current[1] > payload.revision) return output({ ok: true, customer_id: payload.customer_id, revision: payload.revision });
    if (current[1] === payload.revision) {
      if (!customerContactRowMatches(current,values)) return output({ ok: false, customer_id: "", revision: 0 });
      return output({ ok: true, customer_id: payload.customer_id, revision: payload.revision });
    }
  } else row = sheet.getLastRow() + 1;
  // Sheets otherwise coerces numeric IDs and leading-zero phone numbers.
  sheet.getRange(row,1,1,headers.length).setNumberFormats([["@","0","@","@","@","@","@","@"]]);
  sheet.getRange(row,1,1,headers.length).setValues([values]);
  SpreadsheetApp.flush();
  if (!customerContactRowMatches(sheet.getRange(row,1,1,headers.length).getValues()[0],values)) return output({ ok: false, customer_id: "", revision: 0 });
  return output({ ok: true, customer_id: payload.customer_id, revision: payload.revision });
}

function customerContactRowMatches(actual,expected) {
  return actual.length === expected.length && expected.every(function (value,index) {
    // Sheets may omit the protective apostrophe when reading a literal text cell.
    return actual[index] === value || typeof value === "string" && /^'[=+\-@]/.test(value) && actual[index] === value.slice(1);
  });
}

function validSalePayload(payload) {
  if (!hasExactKeys(payload, [
    "event", "sale_id", "sale_code", "source_lead_id", "confirmed_at", "currency",
    "total_amount", "customer", "items", "snapshot_sha256", "secret",
  ]) || payload.event !== "sale.confirmed" || !isUuid(payload.sale_id)
    || !/^ZL-[0-9]{8}-[0-9A-F]{8}$/.test(payload.sale_code)
    || !isUuid(payload.source_lead_id) || typeof payload.confirmed_at !== "string"
    || !payload.confirmed_at || payload.currency !== "VND"
    || !validMoney(payload.total_amount)
    || !/^[0-9a-f]{64}$/.test(payload.snapshot_sha256)) return false;
  if (!payload.customer || typeof payload.customer !== "object" || Array.isArray(payload.customer)
    || !hasExactKeys(payload.customer, ["full_name", "company_name", "email", "phone"])
    || !validRequiredText(payload.customer.full_name)
    || !validOptionalText(payload.customer.company_name)
    || !validOptionalText(payload.customer.email)
    || !validOptionalText(payload.customer.phone)) return false;
  if (!Array.isArray(payload.items) || payload.items.length < 1 || payload.items.length > 50) return false;

  var lineIds = {};
  var total = 0;
  for (var index = 0; index < payload.items.length; index += 1) {
    var item = payload.items[index];
    if (!item || typeof item !== "object" || Array.isArray(item)
      || !hasExactKeys(item, [
        "sale_line_id", "source_lead_item_id", "product_slug", "service_slug", "product_name",
        "variant_name", "variant_sku", "unit", "quantity", "unit_price", "line_total", "currency", "notes",
      ]) || !isUuid(item.sale_line_id) || !isUuid(item.source_lead_item_id)
      || lineIds[item.sale_line_id] || !validOptionalText(item.product_slug)
      || !validOptionalText(item.service_slug) || !validRequiredText(item.product_name)
      || !validOptionalText(item.variant_name) || !validOptionalText(item.variant_sku)
      || !validOptionalText(item.unit) || !Number.isSafeInteger(item.quantity) || item.quantity < 1
      || !validMoney(item.unit_price) || !validMoney(item.line_total)
      || item.quantity * item.unit_price !== item.line_total || item.currency !== "VND"
      || !validOptionalText(item.notes)) return false;
    lineIds[item.sale_line_id] = true;
    total += item.line_total;
    if (!Number.isSafeInteger(total)) return false;
  }
  return total === payload.total_amount && saleSnapshotHash(payload) === payload.snapshot_sha256;
}

function writeConfirmedZaloSale(payload) {
  try {
    var sheets = ensureZaloSaleWorkbook();
    var salesSheet = sheets.sales;
    var itemsSheet = sheets.items;
    var saleRow = findUniqueValueRow(salesSheet, 1, payload.sale_id);
    if (saleRow > 0) {
      var oldHash = salesSheet.getRange(saleRow, ZALO_SALE_HEADERS.length).getValue();
      if (oldHash !== payload.snapshot_sha256) {
        return output({ ok: false, sale_id: "", sale_code: "" });
      }
    }

    upsertZaloSaleItems(itemsSheet, payload);
    var saleValues = [[
      safeText(payload.sale_id), safeText(payload.sale_code), safeText(payload.source_lead_id),
      safeText(payload.confirmed_at), "VND", payload.total_amount,
      safeText(payload.customer.full_name), sheetText(payload.customer.company_name),
      sheetText(payload.customer.email), sheetText(payload.customer.phone), payload.snapshot_sha256,
    ]];
    var targetSaleRow = saleRow > 0 ? saleRow : salesSheet.getLastRow() + 1;
    salesSheet.getRange(targetSaleRow, 10).setNumberFormats([["@"]]);
    salesSheet.getRange(targetSaleRow, 1, 1, ZALO_SALE_HEADERS.length).setValues(saleValues);

    SpreadsheetApp.flush();
    var committedRow = findUniqueValueRow(salesSheet, 1, payload.sale_id);
    if (committedRow < 2
      || salesSheet.getRange(committedRow, ZALO_SALE_HEADERS.length).getValue() !== payload.snapshot_sha256
      || !zaloSaleItemsMatch(itemsSheet, payload)) {
      return output({ ok: false, sale_id: "", sale_code: "" });
    }
    return output({ ok: true, sale_id: payload.sale_id, sale_code: payload.sale_code, reference: payload.sale_code });
  } catch (_error) {
    return output({ ok: false, sale_id: "", sale_code: "" });
  }
}

function ensureZaloSaleWorkbook() {
  var book = workbook();
  var sales = book.getSheetByName("Giao dịch đã chốt") || book.insertSheet("Giao dịch đã chốt");
  var items = book.getSheetByName("Chi tiết giao dịch") || book.insertSheet("Chi tiết giao dịch");
  ensureExactHeaders(sales, ZALO_SALE_HEADERS);
  ensureExactHeaders(items, ZALO_SALE_ITEM_HEADERS);
  sales.setFrozenRows(1);
  items.setFrozenRows(1);
  protectSheet(sales, "Lean V1: Giao dịch đã chốt chỉ đọc", null);
  protectSheet(items, "Lean V1: Chi tiết giao dịch chỉ đọc", null);
  return { sales: sales, items: items };
}

function upsertZaloSaleItems(sheet, payload) {
  var existingRows = sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues()
    : [];
  var rowByLineId = {};
  var expectedIds = {};
  payload.items.forEach(function (item) { expectedIds[item.sale_line_id] = true; });
  existingRows.forEach(function (row, index) {
    if (row[0] !== payload.sale_id) return;
    var lineId = row[1];
    if (!expectedIds[lineId] || rowByLineId[lineId]) throw new Error("sale_detail_snapshot_conflict");
    rowByLineId[lineId] = index + 2;
  });

  var firstAppendRow = sheet.getLastRow() + 1;
  var appendRows = [];
  payload.items.forEach(function (item) {
    var row = zaloSaleItemRow(payload, item);
    var existingRow = rowByLineId[item.sale_line_id];
    if (existingRow) {
      var oldValues = sheet.getRange(existingRow, 1, 1, ZALO_SALE_ITEM_HEADERS.length).getValues()[0];
      if (!sameRow(oldValues, row)) {
        sheet.getRange(existingRow, 1, 1, ZALO_SALE_ITEM_HEADERS.length).setValues([row]);
      }
    } else {
      appendRows.push(row);
    }
  });
  if (appendRows.length) {
    sheet.getRange(firstAppendRow, 1, appendRows.length, ZALO_SALE_ITEM_HEADERS.length).setValues(appendRows);
  }
}

function zaloSaleItemsMatch(sheet, payload) {
  var rows = sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, ZALO_SALE_ITEM_HEADERS.length).getValues()
    : [];
  var actual = {};
  rows.forEach(function (row) {
    if (row[0] !== payload.sale_id) return;
    if (actual[row[1]]) throw new Error("duplicate_sale_line_id");
    actual[row[1]] = row;
  });
  if (Object.keys(actual).length !== payload.items.length) return false;
  return payload.items.every(function (item) {
    return actual[item.sale_line_id]
      && sameRow(actual[item.sale_line_id], zaloSaleItemRow(payload, item));
  });
}

function zaloSaleItemRow(payload, item) {
  return [
    safeText(payload.sale_id), safeText(item.sale_line_id), safeText(item.source_lead_item_id),
    safeText(payload.sale_code), sheetText(item.product_slug), sheetText(item.service_slug),
    safeText(item.product_name), sheetText(item.variant_name), sheetText(item.variant_sku),
    sheetText(item.unit), item.quantity, item.unit_price, item.line_total, "VND",
    sheetText(item.notes), payload.snapshot_sha256,
  ];
}

function findUniqueValueRow(sheet, column, value) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var values = sheet.getRange(2, column, lastRow - 1, 1).getValues();
  var found = -1;
  values.forEach(function (row, index) {
    if (row[0] !== value) return;
    if (found > 0) throw new Error("duplicate_sale_id");
    found = index + 2;
  });
  return found;
}

function saleSnapshotHash(payload) {
  var canonical = {
    sale_id: payload.sale_id,
    sale_code: payload.sale_code,
    source_lead_id: payload.source_lead_id,
    confirmed_at: payload.confirmed_at,
    currency: "VND",
    total_amount: payload.total_amount,
    customer: {
      full_name: payload.customer.full_name,
      company_name: payload.customer.company_name,
      email: payload.customer.email,
      phone: payload.customer.phone,
    },
    items: payload.items.map(function (item) {
      return {
        sale_line_id: item.sale_line_id,
        source_lead_item_id: item.source_lead_item_id,
        product_slug: item.product_slug,
        service_slug: item.service_slug,
        product_name: item.product_name,
        variant_name: item.variant_name,
        variant_sku: item.variant_sku,
        unit: item.unit,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: item.line_total,
        currency: "VND",
        notes: item.notes,
      };
    }),
  };
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    JSON.stringify(canonical),
    Utilities.Charset.UTF_8,
  );
  return bytes.map(function (byte) {
    return ("0" + ((byte + 256) % 256).toString(16)).slice(-2);
  }).join("");
}

function ensureExactHeaders(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    return;
  }
  if (sheet.getLastColumn() !== headers.length) throw new Error("sale_sheet_column_count_mismatch");
  var actual = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  if (headers.some(function (header, index) { return actual[index] !== header; })) {
    throw new Error("sale_sheet_headers_mismatch");
  }
}

function hasExactKeys(value, keys) {
  var actual = Object.keys(value);
  return actual.length === keys.length && actual.every(function (key) { return keys.includes(key); });
}

function validRequiredText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validOptionalText(value) {
  return value === null || typeof value === "string";
}

function validMoney(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function sheetText(value) {
  return value === null ? "" : safeText(value);
}

function sameRow(left, right) {
  return left.length === right.length && left.every(function (value, index) {
    return value === right[index];
  });
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
    if (!["Đặt sản phẩm", "Tư vấn số lượng lớn"].includes(payload.request_type) || typeof payload.product !== "string" || payload.product === ""
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
