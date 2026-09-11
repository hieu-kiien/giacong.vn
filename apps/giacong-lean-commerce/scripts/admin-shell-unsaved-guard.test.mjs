import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const shellPath = new URL("../src/components/admin/AdminShell.tsx", import.meta.url);
const guardPath = new URL("../src/components/admin/AdminUnsavedGuard.tsx", import.meta.url);
const productPagePath = new URL("../src/app/admin/san-pham/page.tsx", import.meta.url);

const readShell = () => readFile(shellPath, "utf8");
const readGuard = () => readFile(guardPath, "utf8");
const readProductPage = () => readFile(productPagePath, "utf8");

function extractFunction(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.ok(start !== -1, `phải tìm thấy function ${name}()`);
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

function loadHelper(source, name) {
  const fnSource = extractFunction(source, name);
  const jsSource = fnSource
    .replace(/:\s*UnsavedClickSignal/g, "")
    .replace(/:\s*UnsavedBlockArgs/g, "")
    .replace(/:\s*boolean/g, "")
    .replace(/:\s*string \| null/g, "")
    .replace(/:\s*number/g, "")
    .replace(/export\s+/, "");
  const factory = new Function(`${jsSource}; return ${name};`);
  return factory();
}

test("DOT2.1 guard context tồn tại: AdminUnsavedContext {isDirty, saving} + hook register", async () => {
  const guard = await readGuard();
  assert.match(guard, /AdminUnsavedContext/, "phải có AdminUnsavedContext");
  assert.match(guard, /isDirty/, "context phải có isDirty: () => boolean");
  assert.match(guard, /saving/, "context phải có saving");
  assert.match(guard, /useRegisterAdminUnsaved/, "phải có hook useRegisterAdminUnsaved cho editor đăng ký");
  assert.match(guard, /createContext/, "phải dùng createContext");
  assert.doesNotMatch(guard, /localStorage/, "không dùng localStorage");
  assert.doesNotMatch(guard, /autosave/i, "không autosave");
  assert.doesNotMatch(guard, /window\.confirm/, "không dùng window.confirm");

  const shell = await readShell();
  assert.match(shell, /AdminUnsavedContext/, "Shell phải cung cấp/tiêu thụ AdminUnsavedContext");
  assert.match(shell, /AdminConfirmDialog/, "Shell phải tái dùng AdminConfirmDialog");
  assert.match(shell, /from "@\/components\/admin\/AdminDialog"/, "Shell phải import AdminConfirmDialog từ AdminDialog");
});

test("DOT2.1 dirty → bấm link sidebar bị chặn + hiện 1 dialog (capture + preventDefault)", async () => {
  const shell = await readShell();
  assert.match(shell, /onClickCapture/, "sidebar phải intercept ở capture phase");
  assert.match(shell, /preventDefault/, "khi dirty phải preventDefault để chặn điều hướng");
  assert.match(shell, /isDirty/, "guard sidebar phải gọi isDirty()");
  assert.match(shell, /pending/, "phải có pending navigation (single-flight)");
  assert.match(shell, /<AdminConfirmDialog/, "khi chặn sidebar phải hiện AdminConfirmDialog");
  assert.match(shell, /Ở lại/, "dialog Shell phải có nút Ở lại");
  assert.match(shell, /Bỏ thay đổi/, "dialog Shell phải có nút Bỏ thay đổi");
  assert.doesNotMatch(shell, /window\.confirm/, "không dùng window.confirm ở Shell");
});

test("DOT2.1 clean → cho đi thẳng; modifier/new-tab/outside bypass", async () => {
  const guard = await readGuard();
  for (const token of ["ctrlKey", "metaKey", "shiftKey", "altKey"]) {
    assert.match(guard, new RegExp(token), `guard phải kiểm tra ${token} để bypass`);
  }
  assert.match(guard, /_blank/, "guard phải bypass target=_blank (mở tab mới)");
  assert.match(guard, /origin/, "guard phải bypass link ngoài origin");
  assert.match(guard, /shouldBypassUnsavedClick/, "phải có helper shouldBypassUnsavedClick thuần để unit-test");

  const shell = await readShell();
  assert.match(shell, /shouldBypassUnsavedClick|ctrlKey/, "Shell phải nối bypass modifier/new-tab/outside");
  assert.match(shell, /closest\(["']a/, "Shell phải tìm anchor gần nhất từ event.target");
});

test("DOT2.1 unit: shouldBypassUnsavedClick + shouldBlockUnsavedNavigation", async () => {
  const guard = await readGuard();
  const shouldBypass = loadHelper(guard, "shouldBypassUnsavedClick");
  const shouldBlock = loadHelper(guard, "shouldBlockUnsavedNavigation");

  const base = {
    altKey: false,
    button: 0,
    ctrlKey: false,
    href: "/admin/tin-tuc",
    metaKey: false,
    shiftKey: false,
    target: null,
    origin: "https://admin.test",
    currentOrigin: "https://admin.test",
  };
  assert.equal(shouldBypass({ ...base }), false, "click thường cùng origin phải không bypass (để guard xét dirty)");
  assert.equal(shouldBypass({ ...base, ctrlKey: true }), true, "Ctrl-click phải bypass");
  assert.equal(shouldBypass({ ...base, metaKey: true }), true, "meta-click phải bypass");
  assert.equal(shouldBypass({ ...base, shiftKey: true }), true, "shift-click phải bypass");
  assert.equal(shouldBypass({ ...base, altKey: true }), true, "alt-click phải bypass");
  assert.equal(shouldBypass({ ...base, button: 1 }), true, "middle-click phải bypass");
  assert.equal(shouldBypass({ ...base, target: "_blank" }), true, "target=_blank phải bypass");
  assert.equal(
    shouldBypass({ ...base, href: "https://ngoai.test/x", origin: "https://ngoai.test" }),
    true,
    "link ngoài origin phải bypass",
  );
  assert.equal(shouldBypass({ ...base, href: "#neo" }), true, "hash-only phải bypass");
  assert.equal(shouldBypass({ ...base, href: null }), true, "không href phải bypass");

  assert.equal(shouldBlock({ isDirty: true, saving: false, hasPending: false }), true, "dirty phải chặn");
  assert.equal(shouldBlock({ isDirty: false, saving: true, hasPending: false }), true, "saving phải chặn");
  assert.equal(shouldBlock({ isDirty: false, saving: false, hasPending: false }), false, "sạch phải cho đi thẳng");
  assert.equal(shouldBlock({ isDirty: true, saving: false, hasPending: true }), false, "đang có dialog (single-flight) thì không mở dialog thứ hai");
});

test("DOT2.1 saving cũng chặn điều hướng sidebar", async () => {
  const shell = await readShell();
  assert.match(shell, /saving/, "Shell guard phải xét saving (khóa khi đang lưu)");
  const guard = await readGuard();
  assert.match(guard, /saving/, "helper/context guard phải có saving");
});

test("DOT2.1 Back/Forward (popstate) khi bẩn → chặn/khôi phục history, hiện 1 dialog, không vòng lặp", async () => {
  const shell = await readShell();
  assert.match(shell, /popstate/, "Shell phải lắng nghe popstate cho Back/Forward");
  assert.match(shell, /addEventListener\("popstate", onPopState, true\)/, "guard phải bắt popstate ở capture phase trước Router");
  assert.match(shell, /removeEventListener\("popstate", onPopState, true\)/, "phải gỡ capture listener popstate khi cleanup");
  assert.match(shell, /history\.go\(-transition\.delta\)/, "popstate khi bẩn phải history.go khôi phục entry hiện tại");
  assert.match(shell, /allowPop|confirmedNav|isConfirmed|allowNext/i, "phải có cờ cho phép pop programmatic để không vòng lặp history");
  assert.match(shell, /history\.go\(pendingHistory\?\.delta \?\? -1\)/, "Bỏ thay đổi với history phải đi đúng delta programmatic");
  assert.match(shell, /useRouter|router\.push/, "Bỏ thay đổi với link phải navigate programmatic (router.push)");
  assert.match(shell, /usePathname/, "Shell phải dùng usePathname (Next 16) để biết route hiện tại");
});

test("DOT2.1 discard same-route query/hash phải remount page để bỏ draft local", async () => {
  const shell = await readShell();
  assert.match(shell, /historyDiscardRef/, "Shell phải đánh dấu pop được xác nhận là discard history");
  assert.match(shell, /historyDiscardKey/, "Shell phải có key remount riêng cho discard same-route");
  assert.match(shell, /<Fragment key=\{historyDiscardKey\}>/, "discard same-route phải remount children bằng Fragment key");
});

test("DOT2.1 Ở lại giữ form + đúng route; Bỏ thay đổi mới cho đi (programmatic sau confirm)", async () => {
  const shell = await readShell();
  assert.match(shell, /cancelLabel/, "dialog Shell phải set cancelLabel");
  assert.match(shell, /Ở lại/, "cancel phải là Ở lại");
  assert.match(shell, /Bỏ thay đổi/, "confirm phải là Bỏ thay đổi");
  assert.match(shell, /onDismiss/, "dialog phải có onDismiss (Ở lại)");
  assert.match(shell, /onConfirm/, "dialog phải có onConfirm (Bỏ thay đổi)");
  // Ở lại: chỉ xóa pending, không router.push/replace.
  const dismissIndex = shell.indexOf("onDismiss");
  assert.ok(dismissIndex !== -1, "phải tìm thấy onDismiss");
  // Bỏ: programmatic navigate nằm trong handler confirm (router.push hoặc history.back).
  assert.match(shell, /router\.push\(/, "Bỏ thay đổi phải router.push tới href đang chờ");
});

test("DOT2.1 single-flight: không hai dialog chồng, không vòng lặp push/replace", async () => {
  const shell = await readShell();
  const dialogs = shell.match(/<AdminConfirmDialog/g) ?? [];
  assert.equal(dialogs.length, 1, "Shell chỉ được render đúng 1 AdminConfirmDialog unsaved (single-flight)");
  assert.match(shell, /if \(.*pending/, "khi đã có pending phải chặn mở dialog thứ hai");
  assert.doesNotMatch(shell, /localStorage/, "không dùng localStorage");
  const pushCount = (shell.match(/router\.push\(/g) ?? []).length;
  const replaceCount = (shell.match(/router\.replace\(/g) ?? []).length;
  assert.ok(pushCount <= 1, "không vòng lặp push (tối đa 1 router.push cho confirm)");
  assert.equal(replaceCount, 0, "không dùng router.replace gây vòng lặp");
});

test("DOT2.1 beforeunload vẫn ở editor (giữ, không duplicate ở Shell)", async () => {
  const page = await readProductPage();
  assert.match(page, /beforeunload/, "san-pham editor phải giữ beforeunload cho reload/đóng tab");
  assert.match(page, /addEventListener\("beforeunload"/, "editor phải addEventListener beforeunload");
  assert.match(page, /removeEventListener\("beforeunload"/, "editor phải gỡ beforeunload khi cleanup");
  const shell = await readShell();
  assert.doesNotMatch(shell, /beforeunload/, "Shell không được duplicate beforeunload (giữ ở editor)");
});

test("DOT2.1 san-pham đăng ký dirty vào guard Shell, không phá flow Ở lại/Bỏ hiện tại", async () => {
  const page = await readProductPage();
  assert.match(page, /useRegisterAdminUnsaved/, "san-pham phải đăng ký dirty vào guard Shell");
  assert.match(page, /from "@\/components\/admin\/AdminUnsavedGuard"/, "phải import từ AdminUnsavedGuard");
  assert.match(page, /isProductEditorDirty\(editor/, "đăng ký phải dùng isProductEditorDirty(editor, snapshot) đã có");
  assert.match(page, /editorSnapshot/, "đăng ký phải nối editorSnapshot đã có");
  assert.match(page, /pendingRequest/, "phải giữ pendingRequest flow hiện tại");
  assert.match(page, /Ở lại/, "phải giữ nút Ở lại hiện tại");
  assert.match(page, /Bỏ thay đổi/, "phải giữ nút Bỏ thay đổi hiện tại");
  assert.match(page, /requestOpenEditor/, "phải giữ requestOpenEditor hiện tại");
  assert.match(page, /requestCloseEditor/, "phải giữ requestCloseEditor hiện tại");
});

test("DOT2.1 nested editor registrations được cộng dồn thay vì ghi đè", async () => {
  const guard = await readGuard();
  assert.match(guard, /useId/, "mỗi editor phải có registration id ổn định");
  assert.match(guard, /unregister/, "editor phải được gỡ riêng khi unmount");
  assert.match(guard, /register\(id/, "registration phải truyền id để không ghi đè editor khác");

  const shell = await readShell();
  assert.match(shell, /unsavedRegistrationsRef/, "Shell phải lưu nhiều registration");
  assert.match(shell, /\.some\(.*isDirty/, "Shell phải chặn nếu bất kỳ editor con nào dirty");
  assert.match(shell, /\.some\(.*saving/, "Shell phải chặn nếu bất kỳ editor con nào đang saving");

  const variant = await readFile(new URL("../src/components/admin/AdminVariantPanel.tsx", import.meta.url), "utf8");
  const media = await readFile(new URL("../src/components/admin/AdminMediaPanel.tsx", import.meta.url), "utf8");
  assert.match(variant, /useRegisterAdminUnsaved/, "variant editor phải đăng ký với guard chung");
  assert.match(variant, /draftSnapshot/, "variant phải có baseline để phân biệt mở form với đã sửa");
  assert.match(media, /useRegisterAdminUnsaved/, "media editor phải đăng ký với guard chung");
  assert.match(media, /altDrafts|file/, "media dirty state phải bao phủ draft alt/file");
});

test("DOT2.1 đổi bản ghi/đóng editor cũng giữ draft nested và beforeunload aggregate", async () => {
  const page = await readProductPage();
  assert.match(page, /useAdminUnsaved/, "product page phải đọc aggregate state của Shell");
  assert.match(page, /hasUnsavedChanges/, "flow đổi/đóng editor phải xét mọi registration");
  assert.match(page, /unsavedRevision/, "beforeunload phải re-evaluate khi panel con đổi dirty state");
  assert.match(page, /hasUnsavedChanges\(\)/, "requestOpen/requestClose và beforeunload phải dùng aggregate helper");
});
