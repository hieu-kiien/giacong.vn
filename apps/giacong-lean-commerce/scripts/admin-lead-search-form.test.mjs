import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pagePath = new URL("../src/app/admin/yeu-cau/page.tsx", import.meta.url);

test("nut Tim duoc noi voi form tim kiem nen bam chuot luon loc duoc", async () => {
  const source = await readFile(pagePath, "utf8");

  const formMatch =
    /<form[^>]*\bid="([^"]+)"[^>]*onSubmit=\{submitSearch\}/.exec(source) ??
    /<form[^>]*onSubmit=\{submitSearch\}[^>]*\bid="([^"]+)"/.exec(source);
  assert.ok(formMatch, "form tìm kiếm phải có id để nối nút submit");
  const formId = formMatch[1];

  const buttonMatch = /<button[^>]*data-testid="button-lead-search"[^>]*>Tìm<\/button>/.exec(source);
  assert.ok(buttonMatch, "phải còn nút Tìm");
  const buttonTag = buttonMatch[0];
  assert.match(buttonTag, /type="submit"/, "nút Tìm phải là nút gửi form");

  const insideForm = (() => {
    const formStart = source.indexOf("<form");
    const formEnd = source.indexOf("</form>", formStart);
    const buttonIndex = source.indexOf('data-testid="button-lead-search"');
    return buttonIndex > formStart && buttonIndex < formEnd;
  })();
  const linkedByFormAttr = buttonTag.includes(`form="${formId}"`);
  assert.ok(
    insideForm || linkedByFormAttr,
    "nút Tìm phải nằm trong form hoặc nối form qua thuộc tính form",
  );
});

test("nhan Enter trong o tim kiem cung kich hoat loc", async () => {
  const source = await readFile(pagePath, "utf8");

  assert.match(source, /<form[^>]*onSubmit=\{submitSearch\}/, "form phải gửi qua submitSearch");
  const formStart = source.indexOf("<form");
  const formEnd = source.indexOf("</form>", formStart);
  assert.ok(formStart !== -1 && formEnd !== -1, "phải có thẻ form tìm kiếm");
  const formBody = source.slice(formStart, formEnd);
  assert.match(formBody, /data-testid="input-lead-search"/, "ô nhập phải nằm trong form để nhấn Enter cũng lọc được");
  assert.match(
    source,
    /function submitSearch\(event: FormEvent<HTMLFormElement>\)[\s\S]*?event\.preventDefault\(\)[\s\S]*?setQuery\(inputQuery\.trim\(\)\)/,
    "submitSearch phải chặn tải lại trang rồi mới lọc",
  );
});
