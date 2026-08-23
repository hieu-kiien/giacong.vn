"use client";

import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, UploadCloud } from "lucide-react";
import { useState, type ChangeEvent } from "react";
import {
  ADMIN_PRODUCT_IMPORT_HEADERS,
  MAX_ADMIN_PRODUCT_IMPORT_BYTES,
  parseProductImportCsv,
  type AdminProductImportRow,
} from "@/lib/admin-product-import-csv";
import {
  AdminProductImportError,
  importAdminProducts,
  type AdminProductImportRowError,
} from "@/lib/admin-product-import-client";

interface AdminProductBulkImportProps {
  onImported: () => void;
}

export function AdminProductBulkImport({ onImported }: AdminProductBulkImportProps) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<AdminProductImportRow[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [rowErrors, setRowErrors] = useState<AdminProductImportRowError[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [inputKey, setInputKey] = useState(0);

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setNotice("");
    setRowErrors([]);
    if (file.size > MAX_ADMIN_PRODUCT_IMPORT_BYTES) {
      setRows([]);
      setFileErrors([`File không được vượt quá ${MAX_ADMIN_PRODUCT_IMPORT_BYTES / 1_000_000} MB.`]);
      return;
    }
    try {
      const result = parseProductImportCsv(await file.text());
      setRows(result.rows);
      setFileErrors(result.errors);
    } catch {
      setRows([]);
      setFileErrors(["Không thể đọc file CSV này."]);
    }
  }

  async function submitImport() {
    if (rows.length === 0 || fileErrors.length > 0 || busy) return;
    setBusy(true);
    setNotice("");
    setRowErrors([]);
    try {
      const result = await importAdminProducts(rows);
      setNotice(`Đã thêm ${result.createdCount} sản phẩm ở trạng thái Draft. Mở Sửa để thêm biến thể, MOQ, bậc giá và ảnh.`);
      clearFile();
      onImported();
    } catch (error) {
      if (error instanceof AdminProductImportError) {
        setRowErrors(error.rowErrors);
        setFileErrors(error.rowErrors.length > 0 ? [] : [error.message]);
      } else {
        setFileErrors(["Không thể nhập sản phẩm lúc này."]);
      }
    } finally {
      setBusy(false);
    }
  }

  function clearFile() {
    setFileName("");
    setRows([]);
    setFileErrors([]);
    setRowErrors([]);
    setInputKey((value) => value + 1);
  }

  function downloadTemplate() {
    const blob = new Blob([`\uFEFF${ADMIN_PRODUCT_IMPORT_HEADERS.join(",")}\r\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "mau-nhap-san-pham.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="admin-panel admin-bulk-import" aria-labelledby="bulk-product-import-heading">
      <div className="admin-bulk-import-heading">
        <div className="admin-bulk-import-title-wrap">
          <FileSpreadsheet aria-hidden="true" size={18} />
          <div>
            <div className="admin-kicker">Catalog / nhập nhanh</div>
            <h2 className="admin-panel-title" id="bulk-product-import-heading">Thêm nhiều sản phẩm cùng lúc</h2>
            <p className="admin-panel-caption">Dùng CSV UTF-8 · tối đa 50 dòng · luôn lưu Draft và ẩn để kiểm tra trước.</p>
          </div>
        </div>
        <div className="admin-bulk-import-actions">
          <button className="admin-button admin-button-quiet" data-testid="button-product-import-template" onClick={downloadTemplate} type="button"><Download size={14} /> Tải file mẫu</button>
          <button aria-expanded={open} className="admin-button admin-button-primary" data-testid="button-product-import-toggle" onClick={() => setOpen((value) => !value)} type="button">{open ? "Đóng" : "Mở nhập hàng loạt"}</button>
        </div>
      </div>
      {notice ? <div className="admin-bulk-import-success" role="status"><CheckCircle2 aria-hidden="true" size={16} />{notice}</div> : null}
      {open ? (
        <div className="admin-bulk-import-body">
          <div className="admin-bulk-import-guide">
            <strong>Quy trình an toàn</strong>
            <span>Chọn file → xem trước → sửa hết lỗi → nhập một lần. Nếu còn một lỗi, hệ thống không lưu bất kỳ dòng nào.</span>
          </div>
          <label className="admin-field admin-field-wide" htmlFor="product-import-file">
            <span>File CSV sản phẩm <b aria-hidden="true">*</b></span>
            <input accept=".csv,text/csv" className="admin-input" data-testid="input-product-import-file" id="product-import-file" key={inputKey} onChange={(event) => void chooseFile(event)} type="file" />
          </label>
          <p className="admin-bulk-import-format">Cột bắt buộc: <code>name</code>, <code>slug</code>, <code>sku</code>. <code>category_slug</code> phải trùng slug danh mục đang hoạt động; các cột còn lại có thể để trống.</p>
          {fileName ? <p className="admin-bulk-import-file"><UploadCloud aria-hidden="true" size={14} /> {fileName} · {rows.length} dòng hợp lệ</p> : null}
          {fileErrors.length > 0 ? <div className="admin-editor-error" role="alert"><AlertCircle aria-hidden="true" size={15} /><div>{fileErrors.map((error) => <div key={error}>{error}</div>)}<small>Chưa có sản phẩm nào được lưu.</small></div></div> : null}
          {rowErrors.length > 0 ? <div className="admin-editor-error" role="alert"><AlertCircle aria-hidden="true" size={15} /><div><strong>File bị từ chối, cần sửa các dòng sau:</strong><ul>{rowErrors.map((error) => <li key={`${error.row}-${error.field}`}>Dòng {error.row} · {error.field}: {error.message}</li>)}</ul><small>Chưa có sản phẩm nào được lưu.</small></div></div> : null}
          {rows.length > 0 && fileErrors.length === 0 && rowErrors.length === 0 ? (
            <>
              <div className="admin-bulk-import-preview-heading"><div><strong>Xem trước dữ liệu</strong><span>{rows.length} sản phẩm sẽ được tạo ở Draft</span></div><button className="admin-button admin-button-quiet" onClick={clearFile} type="button">Xóa file</button></div>
              <div className="admin-table-scroll admin-bulk-import-table-scroll">
                <table className="admin-table">
                  <thead><tr><th scope="col">Dòng</th><th scope="col">Tên sản phẩm</th><th scope="col">SKU</th><th scope="col">Slug</th><th scope="col">Danh mục</th></tr></thead>
                  <tbody>{rows.map((row, index) => <tr key={`${row.sku}-${index}`}><td className="admin-mono">{index + 2}</td><td>{row.name || "—"}</td><td className="admin-mono">{row.sku || "—"}</td><td className="admin-mono">{row.slug || "—"}</td><td>{row.categorySlug || "Chưa phân loại"}</td></tr>)}</tbody>
                </table>
              </div>
              <div className="admin-editor-footer">
                <p className="admin-bulk-import-draft-note">Sản phẩm mới chưa lên website. Sau khi nhập, mở từng sản phẩm để thêm biến thể, giá theo số lượng, ảnh rồi mới chuyển sang Published.</p>
                <button className="admin-button admin-button-primary" data-testid="button-product-import-submit" disabled={busy} onClick={() => void submitImport()} type="button">{busy ? "Đang nhập..." : `Nhập ${rows.length} sản phẩm`}</button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
