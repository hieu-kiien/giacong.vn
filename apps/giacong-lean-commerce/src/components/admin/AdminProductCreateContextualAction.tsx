"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";

import { AdminConfirmDialog, AdminModal } from "./AdminDialog";
import { AdminMediaPickerModal } from "./AdminMediaPickerModal";
import { useRegisterAdminUnsaved } from "./AdminUnsavedGuard";
import { useAdminVisualContext } from "./AdminVisualMode";
import { AdminClientError, fetchAdmin, mutateAdmin, type AdminCategory, type AdminProduct } from "@/lib/admin-client";
import { buildAdminProductPayload, type AdminProductFormState } from "@/lib/admin-product-form";
import { parseAdminProductPayload } from "@/lib/admin-product-input";

const editableRoles = new Set(["owner"]);

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

const emptyForm: AdminProductFormState = {
  categoryId: "",
  description: "",
  imageUrl: "",
  isActive: false,
  leadTimeDays: "",
  name: "",
  shortDescription: "",
  sku: "",
  slug: "",
  status: "draft",
};

function isDirty(form: AdminProductFormState | null, snapshot: AdminProductFormState | null): boolean {
  return Boolean(form && snapshot && JSON.stringify(form) !== JSON.stringify(snapshot));
}

export function AdminProductCreateContextualAction() {
  const { session, status } = useAdminVisualContext();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [form, setForm] = useState<AdminProductFormState | null>(null);
  const [snapshot, setSnapshot] = useState<AdminProductFormState | null>(null);
  const [createdProduct, setCreatedProduct] = useState<AdminProduct | null>(null);
  const [error, setError] = useState<AdminClientError | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [slugFollowsName, setSlugFollowsName] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const hasUnsavedChanges = useCallback(() => isDirty(form, snapshot), [form, snapshot]);
  useRegisterAdminUnsaved(hasUnsavedChanges, saving);

  if (status !== "ready" || !session || !editableRoles.has(session.role)) return null;

  function resetEditor() {
    setOpen(false);
    setLoading(false);
    setCategories([]);
    setCategoryError(null);
    setForm(null);
    setSnapshot(null);
    setCreatedProduct(null);
    setError(null);
    setFieldErrors({});
    setNotice(null);
    setPickerOpen(false);
    setConfirmClose(false);
    setSlugFollowsName(true);
  }

  function requestClose() {
    if (saving) return;
    if (isDirty(form, snapshot)) {
      setConfirmClose(true);
      return;
    }
    resetEditor();
  }

  async function openEditor() {
    const next = { ...emptyForm };
    setOpen(true);
    setLoading(true);
    setCategories([]);
    setCategoryError(null);
    setForm(next);
    setSnapshot(next);
    setCreatedProduct(null);
    setError(null);
    setFieldErrors({});
    setNotice(null);
    setSlugFollowsName(true);
    try {
      const result = await fetchAdmin<{ categories?: AdminCategory[] }>("/api/admin/categories");
      setCategories(result.categories ?? []);
    } catch (reason: unknown) {
      setCategoryError(reason instanceof AdminClientError ? reason.message : "Không thể tải danh mục; bạn vẫn có thể lưu bản nháp rồi phân loại trong admin.");
    } finally {
      setLoading(false);
    }
  }

  function update<K extends keyof AdminProductFormState>(key: K, value: AdminProductFormState[K]) {
    setForm((current) => current ? { ...current, [key]: value } : current);
    setNotice(null);
    setError(null);
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || saving) return;
    const requestId = crypto.randomUUID();
    const payload = { ...buildAdminProductPayload(form, requestId), requestId };
    const parsed = parseAdminProductPayload(payload);
    setFieldErrors(parsed.fieldErrors);
    setError(null);
    setNotice(null);
    if (!parsed.input) {
      setError(new AdminClientError("Dữ liệu sản phẩm chưa hợp lệ.", 422, "VALIDATION_ERROR", parsed.fieldErrors));
      return;
    }

    setSaving(true);
    try {
      const result = await mutateAdmin<{ product: AdminProduct }>("/api/admin/products", {
        body: payload,
        method: "POST",
      });
      setCreatedProduct(result.product);
      setForm(null);
      setSnapshot(null);
      setFieldErrors({});
      setNotice("Đã lưu bản nháp sản phẩm. Sản phẩm chưa xuất hiện công khai cho tới khi được xuất bản và bật hiển thị.");
      router.refresh();
    } catch (reason: unknown) {
      const clientError = reason instanceof AdminClientError
        ? reason
        : new AdminClientError("Không thể lưu sản phẩm.", 0);
      setError(clientError);
      setFieldErrors(clientError.fieldErrors ?? {});
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        aria-haspopup="dialog"
        aria-label="Thêm sản phẩm"
        className="flex min-h-11 items-center rounded-commerce-control border border-commerce-brand px-4 text-sm font-bold text-commerce-brand-dark hover:bg-commerce-active-surface focus-visible:commerce-focus-ring"
        data-testid="admin-product-create-contextual-action"
        onClick={() => void openEditor()}
        type="button"
      >
        Thêm sản phẩm
      </button>

      {open ? (
        <AdminModal labelledBy="admin-inline-product-create-title" onClose={requestClose} title="Thêm sản phẩm" width="wide">
          <div className="admin-editor" data-testid="admin-inline-product-create-editor">
            <div className="admin-editor-heading">
              <div>
                <div className="admin-kicker">Mua hàng / tạo mới</div>
                <h2 className="admin-panel-title" id="admin-inline-product-create-title">Sản phẩm mới</h2>
                <p className="admin-panel-caption">Lưu dưới dạng bản nháp trước; chỉ sản phẩm đã xuất bản và bật hiển thị mới hiện ra website.</p>
              </div>
              <span className="admin-stamp">BẢN GHI MỚI</span>
            </div>

            {loading ? <p className="admin-item-meta" role="status">Đang tải danh mục…</p> : null}
            {categoryError ? <p className="admin-editor-error" role="alert">{categoryError}</p> : null}
            {error ? <div className="admin-editor-error" role="alert"><p>{error.message}</p></div> : null}
            {notice ? <p className="admin-content-notice" role="status">{notice}</p> : null}

            {createdProduct ? (
              <div className="admin-modal-footer" data-testid="admin-inline-product-create-success">
                <p className="admin-item-meta">Mã sản phẩm: <strong>{createdProduct.id}</strong> · {createdProduct.name}</p>
                <div className="admin-editor-actions">
                  <Link className="admin-button admin-button-quiet" href={`/admin/san-pham?edit=${createdProduct.id}`} prefetch={false}>Mở quản trị đầy đủ</Link>
                  <button className="admin-button admin-button-primary" onClick={resetEditor} type="button">Đóng</button>
                </div>
              </div>
            ) : form ? (
              <form noValidate onSubmit={(event) => void submit(event)}>
                <div className="admin-editor-grid">
                  <label className="admin-field">
                    <span>Tên sản phẩm <b aria-hidden="true">*</b></span>
                    <input
                      className="admin-input"
                      disabled={saving}
                      onChange={(event) => {
                        const name = event.target.value;
                        update("name", name);
                        if (slugFollowsName) update("slug", toSlug(name));
                      }}
                      required
                      value={form.name}
                    />
                    {fieldErrors.name ? <small className="admin-field-error">{fieldErrors.name}</small> : null}
                  </label>
                  <label className="admin-field">
                    <span>Đường dẫn (slug) <b aria-hidden="true">*</b></span>
                    <input
                      className="admin-input admin-mono"
                      disabled={saving}
                      onChange={(event) => {
                        const slug = event.target.value;
                        update("slug", slug);
                        setSlugFollowsName(slug.trim() === "");
                      }}
                      required
                      value={form.slug}
                    />
                    {fieldErrors.slug ? <small className="admin-field-error">{fieldErrors.slug}</small> : null}
                    <small className="admin-field-hint">Tự tạo theo tên; nhập slug riêng để giữ đường dẫn tùy chỉnh.</small>
                  </label>
                  <label className="admin-field">
                    <span>Mã hàng (SKU) <b aria-hidden="true">*</b></span>
                    <input className="admin-input admin-mono" disabled={saving} onChange={(event) => update("sku", event.target.value)} required value={form.sku} />
                    {fieldErrors.sku ? <small className="admin-field-error">{fieldErrors.sku}</small> : null}
                  </label>
                  <label className="admin-field">
                    <span>Danh mục</span>
                    <select className="admin-select" disabled={saving} onChange={(event) => update("categoryId", event.target.value)} value={form.categoryId}>
                      <option value="">Chưa phân loại</option>
                      {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                    </select>
                    {fieldErrors.categoryId ? <small className="admin-field-error">{fieldErrors.categoryId}</small> : null}
                  </label>
                  <label className="admin-field">
                    <span>Trạng thái</span>
                    <select className="admin-select" disabled={saving} onChange={(event) => {
                      const nextStatus = event.target.value;
                      setForm((current) => current ? { ...current, isActive: nextStatus === "published" ? current.isActive : false, status: nextStatus } : current);
                    }} value={form.status}>
                      <option value="draft">Bản nháp</option>
                      <option value="review">Chờ duyệt</option>
                      <option value="published">Đã xuất bản</option>
                      <option value="archived">Lưu trữ</option>
                    </select>
                    {fieldErrors.status ? <small className="admin-field-error">{fieldErrors.status}</small> : null}
                  </label>
                  <label className="admin-field">
                    <span>Thời gian làm hàng (ngày)</span>
                    <input className="admin-input admin-mono" disabled={saving} inputMode="numeric" min="0" onChange={(event) => update("leadTimeDays", event.target.value)} type="number" value={form.leadTimeDays} />
                    {fieldErrors.leadTimeDays ? <small className="admin-field-error">{fieldErrors.leadTimeDays}</small> : null}
                  </label>
                  <label className="admin-field admin-field-wide">
                    <span>Ảnh sản phẩm</span>
                    <div className="admin-input-actions">
                      <input className="admin-input" disabled={saving} onChange={(event) => update("imageUrl", event.target.value)} placeholder="/media/products/... hoặc https://..." value={form.imageUrl} />
                      <button className="admin-button admin-button-quiet" disabled={saving} onClick={() => setPickerOpen(true)} type="button">Chọn từ thư viện</button>
                    </div>
                    {fieldErrors.imageUrl ? <small className="admin-field-error">{fieldErrors.imageUrl}</small> : null}
                    {pickerOpen ? (
                      <AdminMediaPickerModal
                        onClose={() => setPickerOpen(false)}
                        onSelect={(publicUrl) => {
                          update("imageUrl", publicUrl);
                          setPickerOpen(false);
                        }}
                      />
                    ) : null}
                  </label>
                  <label className="admin-field admin-field-wide">
                    <span>Mô tả ngắn</span>
                    <textarea className="admin-textarea" disabled={saving} onChange={(event) => update("shortDescription", event.target.value)} rows={3} value={form.shortDescription} />
                    {fieldErrors.shortDescription ? <small className="admin-field-error">{fieldErrors.shortDescription}</small> : null}
                  </label>
                  <label className="admin-field admin-field-wide">
                    <span>Mô tả chi tiết</span>
                    <textarea className="admin-textarea" disabled={saving} onChange={(event) => update("description", event.target.value)} rows={6} value={form.description} />
                    {fieldErrors.description ? <small className="admin-field-error">{fieldErrors.description}</small> : null}
                  </label>
                </div>
                <div className="admin-editor-footer">
                  <label className={`admin-check${form.status !== "published" ? " is-disabled" : ""}`}>
                    <input checked={form.isActive} disabled={saving || form.status !== "published"} onChange={(event) => update("isActive", event.target.checked)} type="checkbox" />
                    <span><strong>Hiển thị trên website</strong><small>{form.status === "published" ? "Khách có thể nhìn thấy sản phẩm." : "Chỉ sản phẩm đã xuất bản mới có thể hiển thị."}</small></span>
                  </label>
                  <div className="admin-editor-actions">
                    <button className="admin-button admin-button-quiet" disabled={saving} onClick={requestClose} type="button">Hủy</button>
                    <button className="admin-button admin-button-primary" disabled={saving} type="submit">{saving ? "Đang lưu…" : "Lưu bản nháp"}</button>
                  </div>
                </div>
              </form>
            ) : null}
          </div>
        </AdminModal>
      ) : null}

      {confirmClose ? (
        <AdminConfirmDialog
          cancelLabel="Ở lại"
          confirmLabel="Bỏ thay đổi"
          message="Sản phẩm còn thay đổi chưa lưu. Bỏ thay đổi sẽ mất nội dung đang nhập."
          onConfirm={resetEditor}
          onDismiss={() => setConfirmClose(false)}
          title="Bỏ thay đổi chưa lưu?"
        />
      ) : null}
    </>
  );
}
