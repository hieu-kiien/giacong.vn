import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const componentPath = new URL("../src/components/admin/AdminProductImportPanel.tsx", import.meta.url);

test("panel nhap san pham co nut Tai file mau that", async () => {
  const source = await readFile(componentPath, "utf8");

  const buttonMatch = /<button[^>]*data-testid="button-product-import-sample"[^>]*>[\s\S]*?Tải file mẫu<\/button>/.exec(source);
  assert.ok(buttonMatch, "phải có nút Tải file mẫu");
  const buttonTag = buttonMatch[0];
  assert.match(buttonTag, /type="button"/, "nút tải mẫu không được gửi form");
  assert.match(buttonTag, /onClick=\{downloadSampleCsv\}/, "nút tải mẫu phải gọi hàm tải tại chỗ");
});

test("tai file mau dung noi dung mau trong code, tao file csv tai trinh duyet", async () => {
  const source = await readFile(componentPath, "utf8");

  const fnMatch = /function downloadSampleCsv\(\) \{[\s\S]*?\n  \}/.exec(source);
  assert.ok(fnMatch, "phải có hàm downloadSampleCsv");
  const fnBody = fnMatch[0];

  assert.match(fnBody, /\$\{sampleCsv\}/, "nội dung tải về phải lấy từ biến mẫu trong code");
  assert.match(fnBody, /new Blob\(\[content\], \{ type: "text\/csv;charset=utf-8" \}\)/, "phải tạo file csv tại trình duyệt");
  assert.match(fnBody, /URL\.createObjectURL\(blob\)/, "phải tạo đường dẫn tải tại chỗ");
  assert.match(fnBody, /document\.createElement\("a"\)/, "phải tải qua thẻ liên kết tạm");
  assert.match(fnBody, /\.download = ".*\.csv"/, "file tải về phải có đuôi .csv");
  assert.match(fnBody, /URL\.revokeObjectURL\(url\)/, "phải thu hồi đường dẫn tạm sau khi tải");
  assert.match(fnBody, /setTimeout\(\(\) => \{\s*anchor\.remove\(\);[\s\S]*?URL\.revokeObjectURL\(url\);\s*\}, 1000\)/, "phải giữ nút bấm tới khi tải xong mới gỡ và thu hồi muộn");
  assert.doesNotMatch(fnBody, /fetch\(/, "tải file mẫu không được gọi máy chủ");
  assert.doesNotMatch(fnBody, /\/api\//, "tải file mẫu không được gọi máy chủ");
});
