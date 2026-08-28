"use client";

import { FileSpreadsheet, Upload } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import { AdminClientError } from "@/lib/admin-client";
import {
  MAX_ADMIN_PRODUCT_IMPORT_BYTES,
  parseProductImportCsv,
  prepareAdminProductImportRows,
  type AdminProductImportError,
  type AdminProductImportRow,
} from "@/lib/admin-product-import";
import type { AdminCategory } from "@/lib/admin-client";

interface ImportResult {
  createdCount: number;
  productIds: number[];
  replayed: boolean;
}

interface AdminProductImportPanelProps {
  categories: AdminCategory[];
  onImported: () => void;
  role: string;
}

const sampleCsv = "name,slug,sku,category_slug,short_description,description,image_url,lead_time_days";

export function AdminProductImportPanel({ categories, onImported, role }: AdminProductImportPanelProps) {
  const canImport = role === "owner" || role === "catalog_manager";
  const [rows, setRows] = useState<AdminProductImportRow[]>([]);
  const [validRows, setValidRows] = useState<AdminProductImportRow[]>([]);
  const [errors, setErrors] = useState<AdminProductImportError[]>([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setMessage(null);
    setError(null);
    if (file.size > MAX_ADMIN_PRODUCT_IMPORT_BYTES) {
      setRows([]);
      setValidRows([]);
      setErrors([{ field: "file", message: "File vượt quá giới hạn 64 KiB của lần nhập.", row: 0 }]);
      return;
    }
    const parsed = parseProductImportCsv(await file.text());
    const prepared = prepareAdminProductImportRows(parsed.rows, categories);
    const rowErrors = prepared.errors;
    const invalidRows = new Set(rowErrors.filter((item) => item.row > 0).map((item) => item.row - 2));
    setRows(parsed.rows);
    setValidRows(parsed.rows.filter((_, index) => !invalidRows.has(index)));
    setErrors([
      ...parsed.errors.map((message) => ({ field: "file", message, row: 0 })),
      ...rowErrors,
    ]);
  }

  async function submitImport() {
    if (!canImport || validRows.length === 0) return;
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const requestId = crypto.randomUUID();
      const response = await fetch("/api/admin/products/import", {
        body: JSON.stringify({ rows: validRows }),
        credentials: "include",
        headers: { Accept: "application/json", "Content-Type": "application/json", "Idempotency-Key": requestId },
        method: "POST",
      });
      const body = await response.json() as { ok?: boolean; data?: ImportResult; message?: string; code?: string };
      if (!response.ok || body.ok === false || !body.data) {
        throw new AdminClientError(body.message ?? "Không thể nhập sản phẩm.", response.status, body.code);
      }
      const result = body.data;
      const replayLabel = result.replayed ? "Đây là lần gửi lại an toàn. " : "";
      setMessage(result.createdCount < validRows.length
        ? `${replayLabel}Kết quả nhập một phần: đã tạo ${result.createdCount}/${validRows.length} sản phẩm; ${validRows.length - result.createdCount} dòng chưa được tạo.`
        : `${replayLabel}Đã nhập ${result.createdCount} sản phẩm ở trạng thái bản nháp và tạm ẩn.`);
      onImported();
    } catch (reason: unknown) {
      setError(reason instanceof AdminClientError ? `${reason.code ? `${reason.code} · ` : ""}${reason.message}` : "Không thể kết nối tới máy chủ admin.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section aria-busy={loading} aria-labelledby="product-import-heading" className="admin-panel admin-import-panel">
      <div className="admin-panel-heading">
        <div>
          <div className="admin-kicker">Catalog / nhập hàng loạt</div>
          <h2 className="admin-panel-title" id="product-import-heading">Nhập nhiều sản phẩm từ CSV</h2>
          <p className="admin-panel-caption">Tải file mẫu, xem trước lỗi, rồi chỉ gửi các dòng hợp lệ. Sản phẩm mới luôn là bản nháp và tạm ẩn.</p>
        </div>
        <FileSpreadsheet aria-hidden="true" size={21} />
      </div>
      {!canImport ? <p className="admin-field-hint" role="note">Bạn đang ở quyền chỉ xem hoặc không thuộc nhóm quản lý catalog. Chỉ owner và catalog manager được nhập sản phẩm.</p> : null}
      <div className="admin-import-instructions">
        <strong>Định dạng CSV</strong>
        <p>Dòng bắt buộc: <code>name</code>, <code>slug</code>, <code>sku</code>. Các cột khác có thể để trống; danh mục dùng slug, tối đa 50 dòng.</p>
        <code className="admin-import-sample">{sampleCsv}</code>
      </div>
      <button className="admin-button admin-button-quiet admin-import-file-label" disabled={!canImport || loading} onClick={() => inputRef.current?.click()} type="button"><Upload aria-hidden="true" size={15} /> Chọn file CSV</button>
      <input ref={inputRef} accept=".csv,text/csv" disabled={!canImport || loading} hidden id="product-import-file" onChange={(event) => void handleFile(event)} type="file" />
      {fileName ? <p className="admin-field-hint">Đã chọn: {fileName} · {rows.length} dòng dữ liệu · {validRows.length} dòng hợp lệ</p> : null}
      {errors.length > 0 ? <div className="admin-import-errors" role="alert"><strong>{errors.length} cảnh báo cần xem lại</strong><ul>{errors.slice(0, 12).map((item, index) => <li key={`${item.row}-${item.field}-${index}`}>{item.row > 0 ? `Dòng ${item.row}: ` : "File: "}{item.message}</li>)}</ul>{errors.length > 12 ? <p>Còn {errors.length - 12} cảnh báo khác.</p> : null}</div> : null}
      {message ? <p className="admin-import-success" role="status">{message}</p> : null}
      {error ? <p className="admin-editor-error" role="alert">{error}</p> : null}
      <div className="admin-editor-footer"><span className="admin-field-hint">{validRows.length > 0 ? `Sẽ nhập ${validRows.length} dòng hợp lệ; dòng lỗi sẽ được bỏ qua.` : "Chưa có dòng hợp lệ để nhập."}</span><button className="admin-button admin-button-primary" disabled={!canImport || validRows.length === 0 || loading} onClick={() => void submitImport()} type="button">{loading ? "Đang nhập…" : "Chỉ nhập dòng hợp lệ"}</button></div>
    </section>
  );
}
