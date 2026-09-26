"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";

import { AdminConfirmDialog, AdminModal } from "./AdminDialog";
import { useRegisterAdminUnsaved } from "./AdminUnsavedGuard";
import { useAdminVisualContext } from "./AdminVisualMode";
import { AdminClientError, fetchAdmin, mutateAdmin, type AdminProduct } from "@/lib/admin-client";
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

type InlineProductForm = AdminProductFormState & {
  categoryName: string;
  id: number;
  isActive: boolean;
  revision: number;
};

function toInlineForm(product: AdminProduct): InlineProductForm {
  return {
    categoryId: product.categoryId ? String(product.categoryId) : "",
    categoryName: product.categoryName ?? "Chưa phân loại",
    description: product.description,
    id: product.id,
    imageUrl: product.imageUrl ?? "",
    isActive: product.isActive,
    leadTimeDays: product.leadTimeDays === null ? "" : String(product.leadTimeDays),
    name: product.name,
    revision: product.revision,
    shortDescription: product.shortDescription,
    sku: product.sku,
    slug: product.slug,
    status: product.status,
  };
}

function isDirty(form: InlineProductForm | null, snapshot: InlineProductForm | null): boolean {
  return Boolean(form && snapshot && JSON.stringify(form) !== JSON.stringify(snapshot));
}

export function AdminCatalogContextualAction({ productId }: { productId: number }) {
  const { session, status } = useAdminVisualContext();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<InlineProductForm | null>(null);
  const [snapshot, setSnapshot] = useState<InlineProductForm | null>(null);
  const [error, setError] = useState<AdminClientError | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [slugFollowsName, setSlugFollowsName] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const hasUnsavedChanges = useCallback(() => isDirty(form, snapshot), [form, snapshot]);
  useRegisterAdminUnsaved(hasUnsavedChanges, saving);

  if (status !== "ready" || !session || !editableRoles.has(session.role)) return null;

  function resetEditor() {
    setOpen(false);
    setLoading(false);
    setForm(null);
    setSnapshot(null);
    setError(null);
    setFieldErrors({});
    setNotice(null);
    setSlugFollowsName(true);
    setConfirmClose(false);
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
    setOpen(true);
    setLoading(true);
    setError(null);
    setFieldErrors({});
    setNotice(null);
    setSlugFollowsName(true);
    try {
      const result = await fetchAdmin<{ product: AdminProduct }>(`/api/admin/products/${productId}`);
      const next = toInlineForm(result.product);
      setForm(next);
      setSnapshot(next);
    } catch (reason: unknown) {
      setError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể tải sản phẩm.", 0));
    } finally {
      setLoading(false);
    }
  }

  function update<K extends keyof InlineProductForm>(key: K, value: InlineProductForm[K]) {
    setForm((current) => current ? { ...current, [key]: value } : current);
    setNotice(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || saving) return;
    const requestId = crypto.randomUUID();
    const payload = {
      ...buildAdminProductPayload(form, requestId),
      requestId,
      revision: form.revision,
    };
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
      const result = await mutateAdmin<{ product: AdminProduct }>(`/api/admin/products/${form.id}`, {
        body: payload,
        method: "PATCH",
      });
      const next = toInlineForm(result.product);
      setForm(next);
      setSnapshot(next);
      setFieldErrors({});
      setNotice("Đã lưu bản nháp sản phẩm. Website chỉ đổi sau khi bản ghi được xuất bản và bật hiển thị.");
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
      <div className="mt-2 flex w-full" data-testid={`admin-catalog-contextual-action-${productId}`}>
        <button
          aria-haspopup="dialog"
          aria-label="Sửa sản phẩm"
          className="flex min-h-9 w-full items-center justify-center rounded-commerce-control border border-commerce-brand px-3 text-[11px] font-bold text-commerce-brand-dark hover:bg-commerce-active-surface focus-visible:commerce-focus-ring"
          onClick={() => void openEditor()}
          type="button"
        >
          Sửa sản phẩm
        </button>
      </div>

      {open ? (
        <AdminModal labelledBy={`admin-inline-product-title-${productId}`} onClose={requestClose} title="Sửa sản phẩm" width="wide">
          <div className="admin-editor" data-testid="admin-inline-product-editor">
            <div className="admin-editor-heading">
              <div>
                <div className="admin-kicker">Mua hàng / đang xem</div>
                <h2 className="admin-panel-title" id={`admin-inline-product-title-${productId}`}>{form?.name ?? "Đang tải sản phẩm"}</h2>
                <p className="admin-panel-caption">Lưu bản nháp trước; website chỉ hiển thị sản phẩm đã xuất bản và bật hiển thị.</p>
              </div>
              {form ? <span className="admin-stamp">Mã {form.id}</span> : null}
            </div>

            {loading ? <p className="admin-item-meta" role="status">Đang tải dữ liệu sản phẩm…</p> : null}
            {error ? (
              <div className="admin-editor-error" role="alert">
                <p>{error.message}</p>
                <button className="admin-button admin-button-quiet" onClick={() => void openEditor()} type="button">Thử lại</button>
              </div>
            ) : null}
            {notice ? <p className="admin-content-notice" role="status">{notice}</p> : null}

            {form ? (
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
                    <input className="admin-input" disabled value={form.categoryName} />
                    <input name="categoryId" type="hidden" value={form.categoryId} />
                  </label>
                  <label className="admin-field">
                    <span>Trạng thái phát hành</span>
                    <select className="admin-select" disabled={saving} onChange={(event) => {
                      const status = event.target.value;
                      update("status", status);
                      if (status !== "published") update("isActive", false);
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
                    <input className="admin-input" disabled={saving} onChange={(event) => update("imageUrl", event.target.value)} placeholder="/media/products/... hoặc https://..." value={form.imageUrl} />
                    {fieldErrors.imageUrl ? <small className="admin-field-error">{fieldErrors.imageUrl}</small> : null}
                  </label>
                  <label className="admin-field admin-field-wide">
                    <span>Mô tả ngắn</span>
                    <textarea className="admin-textarea" disabled={saving} onChange={(event) => update("shortDescription", event.target.value)} rows={2} value={form.shortDescription} />
                    {fieldErrors.shortDescription ? <small className="admin-field-error">{fieldErrors.shortDescription}</small> : null}
                  </label>
                  <label className="admin-field admin-field-wide">
                    <span>Mô tả chi tiết</span>
                    <textarea className="admin-textarea" disabled={saving} onChange={(event) => update("description", event.target.value)} rows={5} value={form.description} />
                    {fieldErrors.description ? <small className="admin-field-error">{fieldErrors.description}</small> : null}
                  </label>
                </div>
                <div className="admin-editor-footer">
                  <label className={`admin-check${form.status !== "published" ? " is-disabled" : ""}`}>
                    <input checked={form.isActive} disabled={saving || form.status !== "published"} onChange={(event) => update("isActive", event.target.checked)} type="checkbox" />
                    <span><strong>Hiển thị trên trang web</strong><small>{form.status === "published" ? "Khách vào trang web sẽ thấy sản phẩm." : "Chỉ sản phẩm đã xuất bản mới có thể hiển thị."}</small></span>
                  </label>
                  <div className="admin-editor-actions">
                    <Link className="admin-button admin-button-quiet" href={`/admin/san-pham?edit=${form.id}`} prefetch={false}>Mở quản trị đầy đủ</Link>
                    <button className="admin-button admin-button-quiet" disabled={saving} onClick={requestClose} type="button">Đóng</button>
                    <button className="admin-button admin-button-primary" disabled={saving} type="submit">{saving ? "Đang lưu…" : "Lưu sản phẩm"}</button>
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
