import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("muc cai dat anh co ten tro nang theo ten muc", async () => {
  const source = await readSource("../src/app/admin/noi-dung/page.tsx");

  assert.match(source, /aria-label=\{`Tải ảnh lên cho \$\{setting\.label\}`\}/);
  assert.match(source, /type="file"/);
});

test("o file anh cua thu vien media co ten tro nang", async () => {
  const source = await readSource("../src/components/admin/AdminMediaPanel.tsx");

  assert.match(source, /aria-label="Chọn file ảnh để tải lên"/);
  assert.match(source, /type="file"/);
});

test("gallery errors never turn an unknown server state into an empty collection", async () => {
  const source = await readSource("../src/components/admin/AdminProductGalleryManager.tsx");
  const loader = source.slice(source.indexOf("const loadGallery"), source.indexOf("useEffect", source.indexOf("const loadGallery")));
  const save = source.slice(source.indexOf("async function handleSaveGallery"), source.indexOf("return (", source.indexOf("async function handleSaveGallery")));

  assert.match(loader, /setLoadError/);
  assert.doesNotMatch(loader, /setImages\(\[\]\)/);
  assert.match(save, /if \(loading \|\| loadError\) return/);
  assert.match(save, /showToast\("error"/);
  assert.doesNotMatch(save, /Đã lưu thư viện ảnh tại giao diện/);
});
