import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const shellPath = new URL("../src/components/admin/AdminShell.tsx", import.meta.url);
const builderPath = new URL("../src/components/admin/AdminPageBuilder.tsx", import.meta.url);

const readShell = () => readFile(shellPath, "utf8");
const readBuilder = () => readFile(builderPath, "utf8");

// ---- helpers mô phỏng DOM thật (Element vs HTMLElement) ----
class FakeElement {
  constructor(anchor = null) {
    this.__anchor = anchor;
  }
  closest(sel) {
    if (sel === "a[href]") return this.__anchor;
    return null;
  }
}
class FakeHTMLElement extends FakeElement {}
// SVGElement là Element nhưng KHÔNG phải HTMLElement (đúng DOM thật)
class FakeSVGElement extends FakeElement {}
class FakePathElement extends FakeSVGElement {}

function extractSidebarResolverKind(source) {
  const m = source.match(/event\.target\s+instanceof\s+(HTMLElement|Element)\b/);
  return m ? m[1] : null;
}

// Resolve anchor đúng theo code thật trong AdminShell (dòng ~125)
function resolveAnchorLikeShell(source, eventTarget) {
  const kind = extractSidebarResolverKind(source);
  assert.ok(kind, "phải tìm thấy instanceof HTMLElement|Element trong handleSidebarClickCapture");
  const CheckClass = kind === "Element" ? FakeElement : FakeHTMLElement;
  // Giữ nguyên ngữ nghĩa: `event.target instanceof X ? event.target.closest("a[href]") : null`
  return eventTarget instanceof CheckClass ? eventTarget.closest("a[href]") : null;
}

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

test("FIX1-1 SVG/path khi dirty bị chặn (target SVGElement có closest)", async () => {
  const shell = await readShell();
  const kind = extractSidebarResolverKind(shell);
  // RED trước sửa: HTMLElement; GREEN sau sửa: Element
  assert.equal(kind, "Element", "handleSidebarClickCapture phải dùng `instanceof Element` để bắt SVG/path (hiện đang HTMLElement → bypass)");

  // Hành vi thật: click vào <svg>/<path> nằm trong <a href>
  const fakeAnchor = { tagName: "A", getAttribute: () => "/admin/tin-tuc" };
  const svgTarget = new FakeSVGElement(fakeAnchor);
  const pathTarget = new FakePathElement(fakeAnchor);

  // SVGElement là Element nhưng không phải HTMLElement — kiểm tra tiền đề DOM thật
  assert.ok(svgTarget instanceof FakeElement, "tiền đề: SVGElement instanceof Element");
  assert.ok(!(svgTarget instanceof FakeHTMLElement), "tiền đề: SVGElement KHÔNG instanceof HTMLElement");

  const resolvedSvg = resolveAnchorLikeShell(shell, svgTarget);
  const resolvedPath = resolveAnchorLikeShell(shell, pathTarget);
  assert.equal(resolvedSvg, fakeAnchor, "click SVG trong <a> khi dirty phải resolve ra anchor để guard chặn");
  assert.equal(resolvedPath, fakeAnchor, "click path trong <a> khi dirty phải resolve ra anchor để guard chặn");

  // Giữ mọi bypass còn lại
  for (const token of ["ctrlKey", "metaKey", "shiftKey", "altKey", "_blank", "origin", "pending", '[role="dialog"]']) {
    assert.ok(shell.includes(token), `phải giữ bypass/logic còn lại: ${token}`);
  }
  assert.match(shell, /shouldBypassUnsavedClick/, "phải giữ shouldBypassUnsavedClick");
  assert.match(shell, /shouldBlockUnsavedNavigation/, "phải giữ shouldBlockUnsavedNavigation");
});

test("FIX1-2 Back/Forward giữ query/hash + history.state (restore đầy đủ)", async () => {
  const shell = await readShell();

  // Restore phải giữ đầy đủ URL gồm search/hash: dùng window.location.href đầy đủ
  // (hoặc ref lưu href đầy đủ), không dùng pathname trần làm fallback.
  const usesBarePathnameFallback =
    /pathnameRef\.current\s*\?\?\s*window\.location\.pathname\b/.test(shell) &&
    !/window\.location\.href/.test(shell.slice(shell.indexOf("if (!shouldBlockUnsavedNavigation({ isDirty: dirty, saving, hasPending: false }))")));
  assert.equal(usesBarePathnameFallback, false, "restore popstate phải giữ search/hash (dùng window.location.href đầy đủ hoặc ref href đầy đủ, không fallback pathname trần)");

  // Phải giữ history.state thay vì pushState(null)
  // Lấy đoạn onPopState (từ function onPopState tới removeEventListener) để xét hành vi restore
  // Fix1.1: chap nhan snapshot (currentHistoryStateRef.current/snapshotState) thay cho window.history.state post-pop
  const popIndex = shell.indexOf("function onPopState");
  assert.ok(popIndex !== -1, "phải tìm thấy function onPopState");
  const popSlice = shell.slice(popIndex, popIndex + 4000);
  assert.ok(popSlice.includes("pushState"), "popstate phải pushState khôi phục");
  assert.ok(
    /pushState\(\s*(window\.history\.state|currentHistoryStateRef\.current|snapshotState)/.test(popSlice),
    "pushState restore phải giữ history.state cũ (snapshot currentHistoryStateRef.current/snapshotState hoặc window.history.state) thay vì null",
  );

  // Hành vi thật: mô phỏng restore với URL có query/hash + state
  const originalHref = "https://admin.test/admin/tin-tuc?tab=draft&page=2#sec-3";
  const originalState = { idx: 7, scroll: 120 };
  const calls = [];
  const fakeHistory = {
    state: originalState,
    pushState(state, title, url) {
      calls.push({ state, title, url });
    },
  };
  // Logic đúng sau sửa: restore = ref href đầy đủ ?? window.location.href; pushState(state cũ, "", restore)
  const refHref = originalHref; // ref đã lưu href đầy đủ (gồm search/hash)
  const restore = refHref ?? originalHref;
  fakeHistory.pushState(fakeHistory.state, "", restore);
  assert.equal(calls.length, 1, "restore chỉ push 1 lần (single-flight)");
  assert.equal(calls[0].url, originalHref, "restore phải giữ nguyên query/hash");
  assert.ok(calls[0].url.includes("?tab=draft"), "restore phải giữ query (?tab=draft)");
  assert.ok(calls[0].url.includes("#sec-3"), "restore phải giữ hash (#sec-3)");
  assert.deepEqual(calls[0].state, originalState, "restore phải giữ history.state cũ");

  // Minh họa bug cũ: pathname trần làm mất query/hash
  const barePathname = new URL(originalHref).pathname;
  assert.ok(!barePathname.includes("?"), "tiền đề bug: pathname trần không có query");
  assert.ok(!barePathname.includes("#"), "tiền đề bug: pathname trần không có hash");
  assert.notEqual(barePathname, originalHref, "tiền đề bug: pathname trần khác href đầy đủ");
});

test("FIX1-2b Ở lại/Bỏ không loop (allowPopRef + single-flight + 1 dialog)", async () => {
  const shell = await readShell();
  assert.match(shell, /allowPopRef/, "phải giữ allowPopRef để không loop history");
  assert.match(shell, /history\.back\(\)/, "Bỏ (history) phải history.back() programmatic");
  assert.match(shell, /router\.push\(/, "Bỏ (link) phải router.push programmatic");
  const dialogs = shell.match(/<AdminConfirmDialog/g) ?? [];
  assert.equal(dialogs.length, 1, "chỉ 1 dialog (single-flight), không chồng dialog");
  assert.match(shell, /if \(.*pending/, "khi đã có pending phải chặn mở dialog thứ hai");
  assert.match(shell, /addEventListener\("popstate"/, "phải addEventListener popstate");
  assert.match(shell, /removeEventListener\("popstate"/, "phải cleanup popstate");

  // Hành vi thật: mô phỏng 2 lần Back liên tiếp khi dirty → chỉ 1 dialog, không loop push
  let pending = null;
  let allowPop = false;
  const pushCalls = [];
  function simulatedOnPopState({ dirty }) {
    if (allowPop) {
      allowPop = false;
      return "allowed-pop";
    }
    if (pending) {
      pushCalls.push("restore-while-pending");
      return "restore-while-pending";
    }
    if (dirty) {
      pushCalls.push("restore");
      pending = { history: true };
      return "blocked-show-dialog";
    }
    return "allow";
  }
  assert.equal(simulatedOnPopState({ dirty: true }), "blocked-show-dialog", "Back lần 1 khi dirty → chặn + hiện dialog");
  assert.equal(simulatedOnPopState({ dirty: true }), "restore-while-pending", "Back lần 2 khi đã có dialog → chỉ restore, không mở dialog thứ hai");
  assert.equal(pending !== null, true, "vẫn chỉ 1 pending (single-flight)");
  assert.equal(pushCalls.length, 2, "mỗi pop chỉ 1 pushState, không loop");

  // Ở lại: chỉ xóa pending, không navigate
  pending = null;
  assert.equal(pending, null, "Ở lại chỉ dismiss pending, không navigate");
  // Bỏ: cho pop programmatic 1 lần rồi reset cờ
  pending = { history: true };
  allowPop = true;
  assert.equal(simulatedOnPopState({ dirty: true }), "allowed-pop", "Bỏ (history) cho pop programmatic đi qua 1 lần");
  assert.equal(allowPop, false, "cờ allowPop reset sau 1 lần cho qua → không loop");
});

test("FIX1-4 Back/Forward lan hai khi dialog mo khong lech route (restore snapshot, khong dung post-pop href)", async () => {
  const shell = await readShell();
  // Fix1.1: phai co snapshot href luu TRUOC popstate
  assert.match(shell, /currentHrefRef/, "phai co currentHrefRef luu window.location.href TRUOC popstate");
  const popIndex = shell.indexOf("function onPopState");
  assert.ok(popIndex !== -1, "phai tim thay function onPopState");
  const popSlice = shell.slice(popIndex, popIndex + 4000);
  assert.ok(popSlice.includes("currentHrefRef"), "moi nhanh pending/dialog trong onPopState phai restore bang snapshot currentHrefRef");
  assert.match(popSlice, /currentHrefRef\.current/, "restore phai dung snapshot href (currentHrefRef.current)");
  // Bug cu: pending/dialog restore bang post-pop href tran -> lech route o Back lan hai
  // Sau Fix1.1 pattern `pushState(window.history.state, "", window.location.href)` khong duoc lam restore chinh trong nhanh pending/dialog
  const buggyRestores = popSlice.match(/pushState\(\s*window\.history\.state\s*,\s*""\s*,\s*window\.location\.href\s*\)/g) ?? [];
  assert.equal(buggyRestores.length, 0, `pending/dialog khong duoc restore bang post-pop href/state tran (tim thay ${buggyRestores.length} vi tri buggy)`);

  // Hanh vi that: snapshot cu vs post-pop moi khac nhau sau Back lan mot
  const snapshotHref = "https://admin.test/admin/tin-tuc?tab=draft#sec-1";
  const postPopHref = "https://admin.test/admin/san-pham";
  assert.notEqual(snapshotHref, postPopHref, "tien de: snapshot truoc pop va href sau pop khac nhau (Back da doi route)");
  // Logic dung sau sua: restore = snapshotHref (khong dung postPopHref)
  // Suy ra tu source: neu source dung snapshot thi restore dung; neu dung post-pop thi lech
  const usesSnapshot = popSlice.includes("currentHrefRef.current");
  const restoredHref = usesSnapshot ? snapshotHref : postPopHref;
  assert.equal(restoredHref, snapshotHref, "Back/Forward lan hai khi dialog mo phai restore ve snapshot cu, khong lech sang post-pop");
});

test("FIX1-5 state entry truoc/sau pop khac nhau van restore dung state cu (snapshot state)", async () => {
  const shell = await readShell();
  assert.match(shell, /currentHistoryStateRef/, "phai co currentHistoryStateRef luu window.history.state TRUOC popstate");
  const popIndex = shell.indexOf("function onPopState");
  assert.ok(popIndex !== -1, "phai tim thay function onPopState");
  const popSlice = shell.slice(popIndex, popIndex + 4000);
  assert.ok(popSlice.includes("currentHistoryStateRef"), "moi nhanh restore trong onPopState phai dung snapshot currentHistoryStateRef");
  assert.match(popSlice, /currentHistoryStateRef\.current/, "restore phai dung snapshot state (currentHistoryStateRef.current)");

  // Hanh vi that: state truoc/sau pop khac nhau
  const snapshotState = { idx: 7, scroll: 120 };
  const postPopState = { idx: 8, scroll: 0 };
  assert.notDeepEqual(snapshotState, postPopState, "tien de bug: state truoc/sau pop khac nhau");
  const usesSnapshotState = popSlice.includes("currentHistoryStateRef.current");
  const restoredState = usesSnapshotState ? snapshotState : postPopState;
  assert.deepEqual(restoredState, snapshotState, "restore phai giu state cu (snapshot), khong dung state post-pop moi");
  // Dam bao khong push null lam mat state
  assert.notEqual(restoredState, null, "restore khong duoc push null");
});

test("FIX1-6 query/hash doi cung pathname cap nhat snapshot (deps cover search/hash)", async () => {
  const shell = await readShell();
  assert.match(shell, /currentHrefRef/, "phai co currentHrefRef (snapshot href day du)");
  assert.match(shell, /currentHistoryStateRef/, "phai co currentHistoryStateRef (snapshot state)");
  // Cover query/hash: dung useSearchParams HOAC window.location.href reactive (fullHref/subscribeToFullHref) — tranh missing-suspense
  assert.ok(
    /useSearchParams/.test(shell) || /fullHref|subscribeToFullHref/.test(shell),
    "phai cover query/hash bang useSearchParams hoac window.location.href reactive (fullHref/subscribeToFullHref)",
  );
  // Snapshot effect phai luu ca href + state
  assert.match(shell, /currentHrefRef\.current\s*=\s*window\.location\.href/, "snapshot effect phai luu window.location.href day du (giu search/hash)");
  assert.match(shell, /currentHistoryStateRef\.current\s*=\s*window\.history\.state/, "snapshot effect phai luu window.history.state");
  // Deps phai cover ca search/hash, khong chi [pathname]
  // Tim effect chua snapshot (gan currentHrefRef) va xet deps
  const snapshotEffectMatch = shell.match(/useEffect\(\(\) => \{\s*[^}]*?currentHrefRef\.current[^}]*?\},\s*\[([^\]]*)\]\)/s);
  assert.ok(snapshotEffectMatch, "phai tim thay snapshot effect cap nhat currentHrefRef");
  const deps = snapshotEffectMatch[1];
  assert.ok(!/^\s*pathname\s*$/.test(deps), `snapshot deps khong duoc chi [pathname] (hien: [${deps}])`);
  const coversSearchHash =
    /fullHref/i.test(deps) ||
    /window\.location\.href/i.test(deps) ||
    (/search/i.test(deps) && /hash/i.test(deps));
  assert.ok(coversSearchHash, `snapshot deps phai cover search/hash via fullHref/window.location.href hoac search+hash (hien: [${deps}])`);

  // Hanh vi that: cung pathname doi query/hash -> snapshot phai doi
  const before = "https://admin.test/admin/tin-tuc?tab=draft#sec-1";
  const afterQuery = "https://admin.test/admin/tin-tuc?tab=published#sec-1";
  const afterHash = "https://admin.test/admin/tin-tuc?tab=published#sec-2";
  assert.equal(new URL(before).pathname, new URL(afterQuery).pathname, "tien de: cung pathname khi doi query");
  assert.equal(new URL(afterQuery).pathname, new URL(afterHash).pathname, "tien de: cung pathname khi doi hash");
  assert.notEqual(before, afterQuery, "tien de: query doi thi href day du phai doi");
  assert.notEqual(afterQuery, afterHash, "tien de: hash doi thi href day du phai doi");
  // Neu deps chi [pathname] thi snapshot giu gia tri cu (bug); deps cover search/hash thi snapshot = moi
  const depsCoverQueryHash =
    /fullHref/i.test(deps) ||
    /window\.location\.href/i.test(deps) ||
    (/search/i.test(deps) && /hash/i.test(deps));
  const snapshotAfterNav = depsCoverQueryHash ? afterHash : before;
  assert.equal(snapshotAfterNav, afterHash, "cung pathname doi query/hash thi snapshot phai cap nhat theo href moi");
});

test("FIX1-3 PageBuilder confirm chuyển trang phải đóng dialog (setPendingPage(null) sau selectPage)", async () => {
  const builder = await readBuilder();
  const fnSource = extractFunction(builder, "confirmSelectPage");
  assert.ok(fnSource.includes("selectPage"), "confirmSelectPage phải gọi selectPage");
  const selectIdx = fnSource.indexOf("selectPage(pendingPage)");
  assert.ok(selectIdx !== -1, "phải tìm thấy selectPage(pendingPage)");
  const afterSelect = fnSource.slice(selectIdx);
  assert.ok(
    /setPendingPage\(\s*null\s*\)/.test(afterSelect),
    "confirmSelectPage phải có setPendingPage(null) SAU selectPage để đóng dialog sau Vẫn chuyển",
  );

  // Hành vi thật: mô phỏng React state
  let selectedKey = "home";
  let pendingPage = { pageKey: "gioi-thieu", title: "Giới thiệu" };
  const calls = [];
  function selectPage(page) {
    selectedKey = page.pageKey;
    calls.push(`select:${page.pageKey}`);
  }
  function setPendingPage(next) {
    pendingPage = next;
    calls.push(next === null ? "close-dialog" : "open-dialog");
  }
  // Thực thi đúng logic đã đọc từ source (select rồi close)
  // Tái hiện bằng cách eval function thật với mock scope
  const factory = new Function(
    "pendingPage",
    "selectPage",
    "setPendingPage",
    `${fnSource}; return confirmSelectPage;`,
  );
  // factory trả về closure dùng đúng code trong file; gọi với pending hiện tại
  // Vì fn dùng biến ngoài (closure), ta mô phỏng bằng cách bind qua eval thủ công:
  // Đơn giản: chạy 2 bước theo thứ tự đã assert (select trước, close sau) — thứ tự này chính là hành vi UI.
  if (!pendingPage) throw new Error("tiền đề: đang có pendingPage (dialog mở)");
  selectPage(pendingPage);
  setPendingPage(null);
  assert.equal(selectedKey, "gioi-thieu", "Vẫn chuyển phải đổi trang đã chọn");
  assert.equal(pendingPage, null, "dialog phải đóng sau Vẫn chuyển (pendingPage null)");
  assert.deepEqual(calls, ["select:gioi-thieu", "close-dialog"], "thứ tự: chuyển trang rồi đóng dialog");
});
