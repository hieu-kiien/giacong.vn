"use client";

import { RefreshCw, Tags } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoadingTable,
  AdminPageHeading,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";
import { useAdminSession } from "@/components/admin/AdminShell";
import { AdminClientError, fetchAdmin, formatAdminDate, mutateAdmin } from "@/lib/admin-client";

interface NewsCategory {
  id: number;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  active: boolean;
  revision: number;
  updatedAt: string;
}

interface CategoryListResponse {
  categories: NewsCategory[];
}

interface CategoryFormState {
  active: boolean;
  description: string;
  id?: number;
  name: string;
  revision?: number;
  slug: string;
  sortOrder: string;
}

const emptyForm: CategoryFormState = {
  active: true,
  description: "",
  name: "",
  slug: "",
  sortOrder: "0",
};

export default function AdminNewsCategoryPage() {
  const session = useAdminSession();
  const canManage = session.role === "owner" || session.role === "content_manager";
  const [categories, setCategories] = useState<NewsCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AdminClientError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [editor, setEditor] = useState<CategoryFormState | null>(null);
  const [baseline, setBaseline] = useState("");
  const [saveError, setSaveError] = useState<AdminClientError | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const dirty = useMemo(
    () => editor !== null && JSON.stringify(editor) !== baseline,
    [editor, baseline],
  );

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setLoading(true);
      setError(null);
      try {
        const result = await fetchAdmin<CategoryListResponse>("/api/admin/news/categories", controller.signal);
        setCategories(result.categories ?? []);
      } catch (reason: unknown) {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể tải chuyên mục tin tức.", 0));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [session.subject, attempt]);

  function confirmDiscard(): boolean {
    return !dirty || window.confirm("Bạn có thay đổi chuyên mục chưa lưu. Bỏ các thay đổi này?");
  }

  function openCreate() {
    if (!canManage || !confirmDiscard()) return;
    const form = { ...emptyForm, sortOrder: nextSortOrder(categories) };
    setEditor(form);
    setBaseline(JSON.stringify(form));
    setSaveError(null);
    setSaveMessage("");
  }

  function openEdit(category: NewsCategory) {
    if (!canManage || !confirmDiscard()) return;
    applyCategoryToEditor(category);
  }

  function applyCategoryToEditor(category: NewsCategory) {
    const form: CategoryFormState = {
      active: category.active,
      description: category.description,
      id: category.id,
      name: category.name,
      revision: category.revision,
      slug: category.slug,
      sortOrder: String(category.sortOrder),
    };
    setEditor(form);
    setBaseline(JSON.stringify(form));
    setSaveError(null);
    setSaveMessage("");
  }

  function closeEditor() {
    if (!confirmDiscard()) return;
    setEditor(null);
    setBaseline("");
    setSaveError(null);
    setSaveMessage("");
  }

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || !canManage) return;
    setSaving(true);
    setSaveError(null);
    setSaveMessage("");

    const payload = {
      active: editor.active,
      description: editor.description,
      name: editor.name,
      slug: editor.slug,
      sortOrder: Number(editor.sortOrder),
      ...(editor.id ? { revision: editor.revision } : {}),
    };

    try {
      const result = await mutateAdmin<{ category: NewsCategory }>(
        editor.id ? `/api/admin/news/categories/${editor.id}` : "/api/admin/news/categories",
        { body: payload, method: editor.id ? "PATCH" : "POST" },
      );
      applyCategoryToEditor(result.category);
      setSaveMessage(editor.id ? "Đã lưu chuyên mục." : "Đã tạo chuyên mục mới.");
      setAttempt((value) => value + 1);
    } catch (reason: unknown) {
      setSaveError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể lưu chuyên mục.", 0));
    } finally {
      setSaving(false);
    }
  }

  async function reloadStaleCategory() {
    if (!editor?.id) return;
    try {
      const result = await fetchAdmin<{ category: NewsCategory }>(`/api/admin/news/categories/${editor.id}`);
      applyCategoryToEditor(result.category);
      setSaveMessage("Đã tải bản chuyên mục mới nhất từ D1.");
    } catch (reason: unknown) {
      setSaveError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể tải bản mới nhất.", 0));
    }
  }

  async function deleteCategory(category: NewsCategory) {
    if (!canManage) return;
    if (!window.confirm(`Xóa chuyên mục “${category.name}”? Chỉ chuyên mục không còn bài viết tham chiếu mới có thể xóa.`)) return;
    setDeletingId(category.id);
    setSaveError(null);
    setSaveMessage("");
    try {
      await mutateAdmin<{ deleted: boolean; id: number }>(`/api/admin/news/categories/${category.id}`, {
        body: { revision: category.revision },
        method: "DELETE",
      });
      if (editor?.id === category.id) {
        setEditor(null);
        setBaseline("");
      }
      setAttempt((value) => value + 1);
    } catch (reason: unknown) {
      const clientError = reason instanceof AdminClientError ? reason : new AdminClientError("Không thể xóa chuyên mục.", 0);
      setSaveError(clientError);
      if (clientError.code === "STALE_WRITE") setAttempt((value) => value + 1);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="admin-content">
      <AdminPageHeading
        kicker="News / taxonomy"
        stamp="CATEGORY DESK"
        subtitle="Tổ chức chuyên mục dùng chung cho bài viết và bộ lọc public. Tạm ẩn thay vì xóa khi chuyên mục vẫn còn lịch sử nội dung."
        title="Chuyên mục tin tức"
      />

      {!canManage ? (
        <div className="admin-readiness-note" role="note">
          Vai trò {session.role ?? "viewer"} có quyền xem chuyên mục nhưng không được tạo, sửa hoặc xóa.
        </div>
      ) : null}

      {editor ? (
        <CategoryEditor
          dirty={dirty}
          error={saveError}
          form={editor}
          onCancel={closeEditor}
          onChange={setEditor}
          onReloadStale={() => void reloadStaleCategory()}
          onSubmit={submitCategory}
          saving={saving}
          successMessage={saveMessage}
        />
      ) : null}

      <div className="admin-toolbar">
        <div>
          <div className="admin-label">Quản lý taxonomy</div>
          <p className="admin-panel-caption">Thứ tự thấp hơn xuất hiện trước trong bộ lọc Tin tức public.</p>
        </div>
        {canManage ? (
          <button className="admin-button admin-button-primary" data-testid="button-news-category-create" onClick={openCreate} type="button">
            <Tags size={15} /> Thêm chuyên mục
          </button>
        ) : null}
      </div>

      {saveError && !editor ? (
        <div className="admin-editor-error" role="alert">
          {saveError.code ? `${saveError.code} · ` : ""}{saveError.message}
        </div>
      ) : null}

      {error ? (
        <AdminErrorState error={error} onRetry={() => setAttempt((value) => value + 1)} />
      ) : loading ? (
        <AdminLoadingTable />
      ) : (
        <section className="admin-panel admin-table-panel" aria-labelledby="news-categories-table-heading">
          <div className="admin-panel-heading" style={{ padding: "21px 21px 0" }}>
            <div>
              <h2 className="admin-panel-title" id="news-categories-table-heading">Danh sách chuyên mục</h2>
              <p className="admin-panel-caption">Dữ liệu đọc trực tiếp từ `article_categories` trong D1 canonical.</p>
            </div>
            <span className="admin-count">{categories.length} bản ghi</span>
          </div>

          {categories.length === 0 ? (
            <AdminEmptyState title="Chưa có chuyên mục" description="Tạo chuyên mục đầu tiên để phân loại bài viết Tin tức." />
          ) : (
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Chuyên mục</th>
                    <th scope="col">Mô tả</th>
                    <th scope="col">Thứ tự</th>
                    <th scope="col">Hiển thị</th>
                    <th scope="col">Cập nhật</th>
                    <th scope="col">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category) => (
                    <tr data-testid={`row-news-category-${category.id}`} key={category.id}>
                      <td>
                        <div className="admin-item-name">
                          {category.name}
                          <div className="admin-item-meta">{category.slug} · rev {category.revision}</div>
                        </div>
                      </td>
                      <td className="admin-description">{category.description || "Chưa có mô tả"}</td>
                      <td className="admin-mono">{category.sortOrder}</td>
                      <td><AdminStatusBadge kind={category.active ? "green" : "neutral"} value={category.active ? "Đang hiện" : "Tạm ẩn"} /></td>
                      <td className="admin-mono">{formatAdminDate(category.updatedAt)}</td>
                      <td>
                        <div className="admin-table-actions">
                          {canManage ? (
                            <button className="admin-button admin-button-quiet" data-testid={`button-news-category-edit-${category.id}`} onClick={() => openEdit(category)} type="button">
                              Sửa
                            </button>
                          ) : null}
                          {canManage ? (
                            <button
                              className="admin-button admin-button-danger"
                              data-testid={`button-news-category-delete-${category.id}`}
                              disabled={deletingId === category.id}
                              onClick={() => void deleteCategory(category)}
                              type="button"
                            >
                              {deletingId === category.id ? "Đang xóa" : "Xóa"}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function CategoryEditor({
  dirty,
  error,
  form,
  onCancel,
  onChange,
  onReloadStale,
  onSubmit,
  saving,
  successMessage,
}: {
  dirty: boolean;
  error: AdminClientError | null;
  form: CategoryFormState;
  onCancel: () => void;
  onChange: (value: CategoryFormState) => void;
  onReloadStale: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
  successMessage: string;
}) {
  function update<K extends keyof CategoryFormState>(key: K, value: CategoryFormState[K]) {
    onChange({ ...form, [key]: value });
  }

  return (
    <section className="admin-editor" aria-labelledby="news-category-editor-heading">
      <div className="admin-editor-heading">
        <div>
          <div className="admin-kicker">News / taxonomy</div>
          <h2 className="admin-panel-title" id="news-category-editor-heading">{form.id ? "Cập nhật chuyên mục" : "Tạo chuyên mục mới"}</h2>
          <p className="admin-panel-caption">Slug là đường lọc public ổn định. Nếu chuyên mục đang dùng, ưu tiên tạm ẩn thay vì xóa.</p>
        </div>
        <span className="admin-stamp">{form.id ? `ID ${form.id} · REV ${form.revision}` : "NEW CATEGORY"}</span>
      </div>

      {error ? (
        <div className="admin-editor-error" role="alert">
          <div>{error.code ? `${error.code} · ` : ""}{error.message}</div>
          {error.code === "STALE_WRITE" && form.id ? (
            <button className="admin-button admin-button-quiet" onClick={onReloadStale} type="button">
              <RefreshCw size={14} /> Tải bản mới nhất
            </button>
          ) : null}
        </div>
      ) : null}
      {successMessage ? <div className="admin-readiness-note" role="status">{successMessage}</div> : null}

      <form onSubmit={onSubmit}>
        <div className="admin-editor-grid">
          <label className="admin-field admin-field-wide">
            <span>Tên chuyên mục <b aria-hidden="true">*</b></span>
            <input className="admin-input" data-testid="input-news-category-name" maxLength={160} onChange={(event) => update("name", event.target.value)} required value={form.name} />
          </label>
          <label className="admin-field">
            <span>Slug <b aria-hidden="true">*</b></span>
            <input
              className="admin-input admin-mono"
              data-testid="input-news-category-slug"
              maxLength={160}
              onChange={(event) => update("slug", event.target.value.toLowerCase())}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              required
              value={form.slug}
            />
          </label>
          <label className="admin-field">
            <span>Thứ tự</span>
            <input className="admin-input admin-mono" data-testid="input-news-category-sort" min="0" onChange={(event) => update("sortOrder", event.target.value)} required type="number" value={form.sortOrder} />
          </label>
          <label className="admin-field admin-field-wide">
            <span>Mô tả</span>
            <textarea className="admin-textarea" data-testid="input-news-category-description" maxLength={600} onChange={(event) => update("description", event.target.value)} rows={4} value={form.description} />
          </label>
        </div>

        <div className="admin-editor-footer">
          <label className="admin-check">
            <input checked={form.active} data-testid="checkbox-news-category-active" onChange={(event) => update("active", event.target.checked)} type="checkbox" />
            <span><strong>Hiển thị trên storefront</strong><small>Tắt để bỏ chuyên mục khỏi bộ lọc public mà không làm mất liên kết lịch sử của bài viết.</small></span>
          </label>
          <div className="admin-editor-actions">
            <span className="admin-panel-caption" aria-live="polite">{dirty ? "Có thay đổi chưa lưu" : "Đã đồng bộ với D1"}</span>
            <button className="admin-button admin-button-quiet" data-testid="button-news-category-cancel" onClick={onCancel} type="button">Đóng</button>
            <button className="admin-button admin-button-primary" data-testid="button-news-category-save" disabled={saving || !dirty} type="submit">
              {saving ? "Đang lưu..." : form.id ? "Lưu chuyên mục" : "Tạo chuyên mục"}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

function nextSortOrder(categories: NewsCategory[]): string {
  if (categories.length === 0) return "0";
  return String(Math.max(...categories.map((category) => category.sortOrder)) + 10);
}
