"use client";

// Category CRUD against the locked /api/admin/categories contract. The products
// form consumes the same list, so any change here bumps the product query too.

import { EyeOff, Pencil, Plus } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AdminConfirmDialog } from "@/components/admin/AdminDialog";
import { AdminMediaPickerModal } from "@/components/admin/AdminMediaPickerModal";
import { AdminField } from "@/components/admin/AdminField";
import { useAdminSession } from "@/components/admin/AdminShell";
import { useAdminToast } from "@/components/admin/AdminToast";
import { fetchAdmin, mutateAdmin, AdminClientError } from "@/lib/admin-client";

interface AdminCategoryDetail {
  description: string;
  id: number;
  imageUrl: string | null;
  isActive: boolean;
  name: string;
  revision: number;
  slug: string;
  sortOrder: number;
}

interface CategoryFormState {
  description: string;
  id?: number;
  imageUrl: string;
  isActive: boolean;
  name: string;
  revision?: number;
  slug: string;
  sortOrder: string;
}

interface CategoryBatchSnapshot {
  id: number;
  isActive: boolean;
  revision: number;
}

interface CategoryBatchResult {
  changedCount: number;
  replayed: boolean;
  selectedCount: number;
  skipped: Array<{ id: number; reason: string }>;
}

interface PendingCategoryBatch {
  items: Array<{ expectedRevision: number; id: number }>;
  requestId: string;
}

const emptyForm: CategoryFormState = {
  description: "",
  imageUrl: "",
  isActive: true,
  name: "",
  slug: "",
  sortOrder: "0",
};

export function AdminCategoryPanel({ onChanged }: { onChanged: () => void }) {
  const session = useAdminSession();
  const canManage = session.role === "owner" || session.role === "catalog_manager";
  const { showToast } = useAdminToast();

  const [categories, setCategories] = useState<AdminCategoryDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editor, setEditor] = useState<CategoryFormState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingArchive, setPendingArchive] = useState<AdminCategoryDetail | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchArchiving, setBatchArchiving] = useState(false);
  const [confirmBatchArchive, setConfirmBatchArchive] = useState(false);
  const [pendingBatch, setPendingBatch] = useState<PendingCategoryBatch | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const activeCategories = categories.filter((category) => category.isActive);
  const allVisibleSelected = canManage && activeCategories.length > 0 && activeCategories.every((category) => selectedIds.has(category.id));

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await fetchAdmin<{ categories: AdminCategoryDetail[] }>("/api/admin/categories");
      setCategories(result.categories ?? []);
    } catch (reason: unknown) {
      setLoadError(reason instanceof AdminClientError ? reason.message : "Không thể tải danh mục.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    setSaving(true);
    setFieldErrors({});
    setFormError(null);
    try {
      await mutateAdmin<{ category: AdminCategoryDetail }>(
        editor.id ? `/api/admin/categories/${editor.id}` : "/api/admin/categories",
        {
          body: {
            description: editor.description,
            imageUrl: editor.imageUrl || null,
            isActive: editor.isActive,
            name: editor.name,
            revision: editor.revision,
            slug: editor.slug,
            sortOrder: editor.sortOrder === "" ? 0 : Number(editor.sortOrder),
          },
          method: editor.id ? "PATCH" : "POST",
        },
      );
      showToast("success", editor.id ? "Đã cập nhật danh mục." : "Đã tạo danh mục.");
      setEditor(null);
      await reload();
      onChanged();
    } catch (reason: unknown) {
      if (reason instanceof AdminClientError) {
        if (reason.status === 409 && /revision/i.test(reason.message)) {
          setFormError("Danh mục đã được cập nhật ở nơi khác. Hãy đóng form, tải lại rồi thử lại.");
        } else if (reason.status === 422 && reason.fieldErrors) {
          setFieldErrors(reason.fieldErrors);
        } else {
          setFormError(reason.message);
        }
      } else {
        setFormError("Không thể lưu danh mục.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function confirmArchive() {
    if (!pendingArchive) return;
    try {
      await mutateAdmin<{ category: AdminCategoryDetail }>(`/api/admin/categories/${pendingArchive.id}`, {
        body: {
          description: pendingArchive.description,
          imageUrl: pendingArchive.imageUrl,
          isActive: false,
          name: pendingArchive.name,
          revision: pendingArchive.revision,
          slug: pendingArchive.slug,
          sortOrder: pendingArchive.sortOrder,
        },
        method: "PATCH",
      });
      showToast("success", `Đã ẩn danh mục “${pendingArchive.name}” khỏi storefront.`);
      setPendingArchive(null);
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(pendingArchive.id);
        return next;
      });
      await reload();
      onChanged();
    } catch (reason: unknown) {
      setPendingArchive(null);
      showToast("error", reason instanceof AdminClientError ? reason.message : "Không thể ẩn danh mục.");
    }
  }

  async function prepareBatchArchive() {
    if (!canManage || selectedIds.size === 0 || batchArchiving) return;
    const ids = [...selectedIds].sort((left, right) => left - right);
    try {
      const result = await fetchAdmin<{ categories: CategoryBatchSnapshot[] }>(`/api/admin/categories/batch?ids=${ids.join(",")}`);
      const revisions = new Map((result.categories ?? []).map((category) => [category.id, category.revision]));
      setPendingBatch({
        items: ids.map((id) => ({ expectedRevision: revisions.get(id) ?? 1, id })),
        requestId: crypto.randomUUID(),
      });
      setConfirmBatchArchive(true);
    } catch (reason: unknown) {
      showToast("error", reason instanceof AdminClientError ? reason.message : "Không thể chuẩn bị thao tác ẩn danh mục.");
    }
  }

  async function archiveSelectedCategories() {
    if (!pendingBatch) return;
    setBatchArchiving(true);
    try {
      const result = await mutateAdmin<CategoryBatchResult>("/api/admin/categories/batch", {
        body: pendingBatch,
        method: "POST",
      });
      const skipped = result.skipped?.length ?? 0;
      showToast(
        skipped > 0 ? "error" : "success",
        `Đã ẩn ${result.changedCount} / ${result.selectedCount} danh mục.${skipped > 0 ? ` ${skipped} mục chưa xử lý, hãy tải lại để xem lý do.` : ""}`,
      );
      setSelectedIds(new Set());
      setPendingBatch(null);
      setConfirmBatchArchive(false);
      await reload();
      onChanged();
    } catch (reason: unknown) {
      showToast("error", reason instanceof AdminClientError ? reason.message : "Không thể ẩn hàng loạt danh mục.");
    } finally {
      setBatchArchiving(false);
    }
  }

  function toggleSelected(id: number) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        for (const category of activeCategories) next.delete(category.id);
      } else {
        for (const category of activeCategories) next.add(category.id);
      }
      return next;
    });
  }

  return (
    <div aria-busy={loading || batchArchiving}>
      <div className="admin-modal-footer" style={{ justifyContent: "space-between", margin: "0 0 14px" }}>
        <span className="admin-panel-caption">{categories.length} danh mục · sắp theo thứ tự hiển thị</span>
        {canManage ? <div className="admin-content-toolbar-actions">
          {selectedIds.size > 0 ? <>
            <span aria-live="polite" className="admin-item-meta" data-testid="category-selection-count">Đã chọn {selectedIds.size}</span>
            <button className="admin-button admin-button-danger" data-testid="button-category-batch-archive" disabled={batchArchiving} onClick={() => void prepareBatchArchive()} type="button">{batchArchiving ? "Đang ẩn…" : "Ẩn danh mục đã chọn"}</button>
          </> : null}
          <button
            className="admin-button admin-button-primary"
            data-testid="button-category-create"
            onClick={() => {
              setFieldErrors({});
              setFormError(null);
              setEditor({ ...emptyForm });
            }}
            type="button"
          >
            <Plus size={14} /> Thêm danh mục
          </button>
        </div> : null}
      </div>

      {loadError ? <p className="admin-editor-error" role="alert">{loadError}</p> : null}

      {!loading && !loadError ? (
        <div className="admin-table-scroll">
          <table className="admin-table" data-testid="table-admin-categories">
            <thead>
              <tr>
                {canManage ? <th scope="col"><input aria-label="Chọn tất cả danh mục trong trang" checked={allVisibleSelected} disabled={batchArchiving} onChange={toggleAllVisible} type="checkbox" /></th> : null}
                <th scope="col">Ảnh</th>
                <th scope="col">Danh mục</th>
                <th scope="col">Thứ tự</th>
                <th scope="col">Hiển thị</th>
                {canManage ? <th scope="col">Thao tác</th> : null}
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr data-testid={`row-category-${category.id}`} key={category.id}>
                  {canManage ? <td><input aria-label={`Chọn danh mục ${category.name}`} checked={selectedIds.has(category.id)} disabled={!category.isActive || batchArchiving} onChange={() => toggleSelected(category.id)} type="checkbox" /></td> : null}
                  <td>
                    <span className="admin-thumb">
                      {category.imageUrl
                        ? // eslint-disable-next-line @next/next/no-img-element
                          <img alt={`Ảnh danh mục ${category.name}`} src={category.imageUrl} />
                        : <span>{category.name.slice(0, 2).toUpperCase()}</span>}
                    </span>
                  </td>
                  <td>
                    <div className="admin-item-name">{category.name}</div>
                    <div className="admin-item-meta">{category.slug}{category.description ? ` · ${category.description}` : ""}</div>
                  </td>
                  <td className="admin-mono">{category.sortOrder}</td>
                  <td>{category.isActive ? "Có" : "Ẩn"}</td>
                  {canManage ? (
                    <td>
                      <div className="admin-table-actions">
                        <button
                          aria-label={`Sửa danh mục ${category.name}`}
                          className="admin-button admin-button-quiet"
                          onClick={() => {
                            setFieldErrors({});
                            setFormError(null);
                            setEditor({
                              description: category.description,
                              id: category.id,
                              imageUrl: category.imageUrl ?? "",
                              isActive: category.isActive,
                              name: category.name,
                              revision: category.revision,
                              slug: category.slug,
                              sortOrder: String(category.sortOrder),
                            });
                          }}
                          type="button"
                        >
                          <Pencil size={13} /> Sửa
                        </button>
                        {category.isActive ? <button
                          data-testid={`button-category-archive-${category.id}`}
                          aria-label={`Ẩn danh mục ${category.name}`}
                          className="admin-button admin-button-danger"
                          onClick={() => setPendingArchive(category)}
                          type="button"
                        >
                          <EyeOff size={13} /> Ẩn danh mục
                        </button> : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
              {categories.length === 0 ? (
                <tr><td colSpan={canManage ? 6 : 4}>Chưa có danh mục nào.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {editor ? (
        <form onSubmit={submitCategory} style={{ marginTop: 16 }}>
          <h3 className="admin-panel-title" style={{ marginBottom: 12 }}>{editor.id ? `Sửa danh mục #${editor.id}` : "Danh mục mới"}</h3>
          {formError ? <p className="admin-editor-error" role="alert">{formError}</p> : null}
          <AdminField error={fieldErrors.name} id="category-name" label="Tên danh mục">
            <input
              className="admin-input"
              data-testid="input-category-name"
              id="category-name"
              onChange={(event) => setEditor({ ...editor, name: event.target.value })}
              value={editor.name}
            />
          </AdminField>
          <AdminField error={fieldErrors.slug} hint="Chữ thường, số và gạch ngang. Dùng trong URL storefront." id="category-slug" label="Slug">
            <input
              className="admin-input admin-mono"
              data-testid="input-category-slug"
              id="category-slug"
              onChange={(event) => setEditor({ ...editor, slug: event.target.value })}
              value={editor.slug}
            />
          </AdminField>
          <AdminField error={fieldErrors.description} id="category-description" label="Mô tả" optional>
            <textarea
              className="admin-textarea"
              data-testid="input-category-description"
              id="category-description"
              onChange={(event) => setEditor({ ...editor, description: event.target.value })}
              rows={2}
              value={editor.description}
            />
          </AdminField>
          <AdminField error={fieldErrors.imageUrl} id="category-image" label="Ảnh danh mục" optional>
            <input
              className="admin-input"
              data-testid="input-category-image"
              id="category-image"
              onChange={(event) => setEditor({ ...editor, imageUrl: event.target.value })}
              placeholder="https://..."
              value={editor.imageUrl}
            />
            <span className="admin-image-preview">
              {editor.imageUrl
                ? // eslint-disable-next-line @next/next/no-img-element
                  <img alt={`Xem trước ảnh danh mục ${editor.name}`} src={editor.imageUrl} />
                : <span className="admin-image-preview-fallback">Chưa có ảnh — dán đường dẫn để xem trước tại đây.</span>}
            </span>
          </AdminField>
          <AdminField error={fieldErrors.sortOrder} hint="Số nhỏ hiển thị trước." id="category-sort" label="Thứ tự sắp xếp">
            <input
              className="admin-input admin-mono"
              data-testid="input-category-sort"
              id="category-sort"
              inputMode="numeric"
              min="0"
              onChange={(event) => setEditor({ ...editor, sortOrder: event.target.value })}
              type="number"
              value={editor.sortOrder}
            />
          </AdminField>
          <label className="admin-check">
            <input
              checked={editor.isActive}
              data-testid="checkbox-category-active"
              onChange={(event) => setEditor({ ...editor, isActive: event.target.checked })}
              type="checkbox"
            />
            <span><strong>Hiển thị trên storefront</strong><small>Danh mục ẩn vẫn quản lý được sản phẩm nhưng không xuất hiện công khai.</small></span>
          </label>
          <div className="admin-modal-footer">
            <button className="admin-button admin-button-quiet" onClick={() => setEditor(null)} type="button">Hủy</button>
            <button className="admin-button admin-button-primary" data-testid="button-category-save" disabled={saving} type="submit">
              {saving ? "Đang lưu..." : editor.id ? "Lưu thay đổi" : "Tạo danh mục"}
            </button>
          </div>
        </form>
      ) : null}

      {pendingArchive ? (
        <AdminConfirmDialog
          confirmLabel="Ẩn danh mục"
          message={`Ẩn danh mục “${pendingArchive.name}” khỏi storefront? Sản phẩm và dữ liệu lịch sử vẫn được giữ nguyên; bạn có thể bật lại trong form chỉnh sửa.`}
          onConfirm={() => void confirmArchive()}
          onDismiss={() => setPendingArchive(null)}
          title="Ẩn danh mục?"
        />
      ) : null}
      {confirmBatchArchive && pendingBatch ? (
        <AdminConfirmDialog
          confirmLabel="Ẩn danh mục đã chọn"
          message={`Ẩn ${pendingBatch.items.length} danh mục đã chọn khỏi storefront? Dữ liệu sản phẩm và lịch sử vẫn được giữ nguyên.`}
          onConfirm={() => void archiveSelectedCategories()}
          onDismiss={() => { setConfirmBatchArchive(false); setPendingBatch(null); }}
          title="Ẩn danh mục đã chọn?"
        />
      ) : null}
          {pickerOpen ? (
        <AdminMediaPickerModal
          onClose={() => setPickerOpen(false)}
          onSelect={(publicUrl) => {
            setEditor((current) => (current ? { ...current, imageUrl: publicUrl } : current));
            setPickerOpen(false);
          }}
        />
      ) : null}
</div>
  );
}
