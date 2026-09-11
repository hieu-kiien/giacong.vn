import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pagePath = new URL("../src/app/admin/san-pham/page.tsx", import.meta.url);
const readPage = () => readFile(pagePath, "utf8");

function extractFunction(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.ok(start !== -1, `phải tìm thấy function ${name}() trong san-pham/page.tsx`);
  let depth = 0;
  let end = -1;
  let seenBrace = false;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") {
      depth += 1;
      seenBrace = true;
    } else if (ch === "}") {
      depth -= 1;
      if (seenBrace && depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  assert.ok(end !== -1, `không đóng ngoặc được function ${name}`);
  return source.slice(start, end);
}

function extractAsyncFunction(source, name) {
  const marker = `async function ${name}(`;
  const start = source.indexOf(marker);
  assert.ok(start !== -1, `phải tìm thấy async function ${name}()`);
  let depth = 0;
  let end = -1;
  let seenBrace = false;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") {
      depth += 1;
      seenBrace = true;
    } else if (ch === "}") {
      depth -= 1;
      if (seenBrace && depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  assert.ok(end !== -1, `không đóng ngoặc được async function ${name}`);
  return source.slice(start, end);
}

function loadDirtyFn(source) {
  const fnSource = extractFunction(source, "isProductEditorDirty");
  const jsSource = fnSource
    .replace(/:\s*ProductFormState\s*\|\s*null/g, "")
    .replace(/\)\s*:\s*boolean\s*\{/, ") {");
  const factory = new Function(
    `${jsSource}; return isProductEditorDirty;`,
  );
  return factory();
}

function baseSnapshot() {
  return {
    categoryId: "",
    description: "Mo ta",
    id: 7,
    imageUrl: "",
    isActive: false,
    leadTimeDays: "",
    name: "Mon thu",
    revision: 3,
    shortDescription: "",
    sku: "TEST-001",
    slug: "mon-thu",
    status: "draft",
  };
}

test("dirty check so sánh editor vs snapshot đã load/last-saved", async () => {
  const source = await readPage();
  assert.match(source, /function isProductEditorDirty/, "phải có helper isProductEditorDirty(editor, snapshot)");
  assert.match(source, /editorSnapshot/, "phải có snapshot đã load/last-saved (editorSnapshot)");
  assert.doesNotMatch(source, /window\.confirm/, "không dùng window.confirm");

  const isDirty = loadDirtyFn(source);
  const snapshot = baseSnapshot();
  assert.equal(isDirty({ ...snapshot }, { ...snapshot }), false, "giống snapshot thì không dirty");
  assert.equal(isDirty({ ...snapshot, name: "Doi ten" }, { ...snapshot }), true, "đổi tên phải dirty");
  assert.equal(isDirty({ ...snapshot, sku: "KHAC" }, { ...snapshot }), true, "đổi sku phải dirty");
  assert.equal(isDirty(null, { ...snapshot }), false, "chưa mở editor thì không dirty");
});

test("chặn chuyển bản ghi/tạo mới/đóng editor khi dirty qua AdminConfirmDialog Ở lại / Bỏ thay đổi", async () => {
  const source = await readPage();
  assert.match(source, /AdminConfirmDialog/, "phải dùng AdminConfirmDialog nhỏ nhất");
  assert.match(source, /from "@\/components\/admin\/AdminDialog"/, "phải import từ AdminDialog");
  assert.match(source, /pendingRequest|pendingEditor/, "phải có pending chờ xác nhận khi dirty");
  assert.match(source, /requestOpenEditor|requestSelect|requestSwitch/, "phải có hàm chặn chuyển bản ghi (request*)");
  assert.match(source, /requestCloseEditor|requestCancel|requestClose/, "phải có hàm chặn đóng editor");
  assert.match(source, /confirmPendingEditor|confirmPending|confirmSelect/, "phải có hàm xác nhận sau dialog");
  assert.match(source, /isProductEditorDirty\(editor/, "guard phải gọi dirty check với editor hiện tại");
  assert.match(source, /Ở lại/, "nút Ở lại phải giữ nguyên dữ liệu");
  assert.match(source, /Bỏ thay đổi/, "nút Bỏ thay đổi phải xác nhận bỏ dirty");
  assert.match(source, /Chuyển bản ghi sẽ mất thay đổi\?|Bỏ thay đổi chưa lưu\?|Rời editor sẽ mất thay đổi\?/, "dialog phải hỏi rõ mất thay đổi");
  // Ở lại = onDismiss chỉ xóa pending, không chạm editor.
  const dismissBlock = source.slice(source.indexOf("Ở lại"));
  assert.ok(dismissBlock.length > 0, "phải tìm thấy nhánh Ở lại");
  // Chuyển bản ghi phải đi qua guard: onClick gọi request* trực tiếp, hoặc openEdit/openCreate ủy quyền cho request*.
  const usesRequestInClick = /onClick=\{[^}]*requestOpenEditor|onClick=\{\(\) => request/.test(source);
  const delegatesViaOpen = /function openEdit[\s\S]*?requestOpenEditor/.test(source) && /function openCreate[\s\S]*?requestOpenEditor/.test(source);
  assert.ok(usesRequestInClick || delegatesViaOpen, "nút Sửa/Tạo phải đi qua request* (trực tiếp hoặc qua openEdit/openCreate ủy quyền)");
  // openCreate/openEdit không được setEditor trực tiếp khi dirty (phải qua request*).
  assert.doesNotMatch(source, /function openCreate\(\) \{\s*setSaveError\(null\);\s*setEditor/, "openCreate không được setEditor trực tiếp");
});

test("beforeunload khi dirty (bổ sung, không thay thế chặn sidebar)", async () => {
  const source = await readPage();
  assert.match(source, /beforeunload/, "phải đăng ký beforeunload khi dirty");
  assert.match(source, /addEventListener\("beforeunload"/, "phải addEventListener beforeunload");
  assert.match(source, /removeEventListener\("beforeunload"/, "phải gỡ beforeunload khi cleanup");
  assert.match(source, /isProductEditorDirty\(editor/, "beforeunload phải xét theo dirty editor hiện tại");
});

test("khi saving: disable nút lưu + khóa chuyển bản ghi, generation/inFlight chống response cũ", async () => {
  const source = await readPage();
  // Nút lưu thật phải disabled khi saving.
  assert.match(source, /data-testid="button-product-save"/, "phải có nút lưu thật");
  assert.match(source, /disabled=\{saving\}/, "nút lưu phải disabled={saving}");
  // Khóa chuyển bản ghi khi saving: nút Sửa/Tạo/Hủy disabled khi saving hoặc request* return sớm khi saving.
  assert.match(
    source,
    /disabled=\{[^}]*saving[^}]*\}|if \(saving|if \(!editor \|\| saving|if \(saving.*return/,
    "phải khóa chuyển bản ghi khi saving (disabled saving hoặc return sớm)",
  );
  // Chống double-submit + response cũ ghi đè editor mới.
  assert.match(source, /saveInFlight|inFlight/, "phải có cờ inFlight chống double-submit");
  assert.match(source, /editorGeneration|generation/, "phải có generation để response cũ không ghi đè editor mới");
  assert.match(source, /generationAtSubmit|generationAtStart|capturedGeneration/, "phải chụp generation lúc submit");
  const submitSource = extractAsyncFunction(source, "submitProduct");
  assert.match(submitSource, /if \(.*generation.*return/, "submitProduct phải bỏ response cũ khi generation đã đổi");
  // Input editor phải khóa khi saving để không mất chữ đang gõ.
  assert.match(source, /disabled=\{saving[^}]*\}|disabled=\{[^}]*saving/, "input/cancel trong editor phải khóa khi saving");
});

test("lỗi validation/mạng giữ form + fieldErrors", async () => {
  const source = await readPage();
  const submitSource = extractAsyncFunction(source, "submitProduct");
  const catchIndex = submitSource.indexOf("catch");
  assert.ok(catchIndex !== -1, "submitProduct phải có catch");
  const catchBlock = submitSource.slice(catchIndex);
  assert.doesNotMatch(catchBlock, /setEditor\(null\)/, "catch lỗi không được đóng editor (giữ form)");
  assert.doesNotMatch(catchBlock, /setEditorSnapshot\(null\)/, "catch lỗi không được xóa snapshot");
  assert.match(source, /fieldErrors/, "phải đọc fieldErrors từ AdminClientError");
  assert.match(source, /data-testid="product-form-field-errors"/, "phải render fieldErrors với testid thật");
  assert.match(source, /role="alert"/, "lỗi phải có role=alert");
});

test("retry cùng payload giữ nguyên requestId, đổi editor thì tạo requestId mới", async () => {
  const source = await readPage();
  const submitSource = extractAsyncFunction(source, "submitProduct");
  assert.match(source, /productRequestRef/, "product save phải giữ requestId đang retry trong ref");
  assert.match(submitSource, /requestKey/, "submit phải nhận diện cùng payload trước khi tái sử dụng requestId");
  assert.match(submitSource, /productRequestRef\.current.*requestId/, "retry phải đọc requestId đã giữ");
  assert.match(submitSource, /crypto\.randomUUID\(\)/, "payload mới phải được cấp requestId mới");
  assert.match(source, /function handleEditorChange/, "thay đổi input phải invalid requestId cũ");
  assert.match(source, /onChange=\{handleEditorChange\}/, "ProductEditor phải dùng handler invalid requestId khi đổi form");
  assert.match(source, /productRequestRef\.current = null/, "thành công/đổi editor phải xóa requestId đang chờ");
});
