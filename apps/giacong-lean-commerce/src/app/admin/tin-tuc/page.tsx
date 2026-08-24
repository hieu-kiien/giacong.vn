"use client";

import { Newspaper, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AdminConfirmDialog } from "@/components/admin/AdminDialog";
import { AdminField } from "@/components/admin/AdminField";
import { AdminMediaPickerModal } from "@/components/admin/AdminMediaPickerModal";
import { AdminEmptyState, AdminErrorState, AdminLoadingTable, AdminPageHeading, AdminPagination, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { useAdminSession } from "@/components/admin/AdminShell";
import { useAdminToast } from "@/components/admin/AdminToast";
import { AdminClientError, fetchAdmin, formatAdminDate, mutateAdmin } from "@/lib/admin-client";

interface AdminNewsListItem {
  excerpt: string;
  id: number;
  isPublished: boolean;
  publishedAt: string | null;
  revision: number;
  slug: string;
  title: string;
  updatedAt: string;
}

interface NewsListResponse {
  posts: AdminNewsListItem[];
  total: number;
  pagination?: { currentPage: number; lastPage: number; pageSize: number; total: number };
}

interface NewsFormState {
  content: string;
  coverImageUrl: string;
  excerpt: string;
  id?: number;
  isPublished: boolean;
  revision?: number;
  slug: string;
  title: string;
}

const emptyForm: NewsFormState = {
  content: "",
  coverImageUrl: "",
  excerpt: "",
  isPublished: false,
  slug: "",
  title: "",
};

export default function AdminNewsPage() {
  const session = useAdminSession();
  const { showToast } = useAdminToast();
  const canManage = session.role === "owner" || session.role === "content_manager";

  const [posts, setPosts] = useState<AdminNewsListItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AdminClientError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [editor, setEditor] = useState<NewsFormState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AdminNewsListItem | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setLoading(true);
      setError(null);
      try {
        const result = await fetchAdmin<NewsListResponse>(`/api/admin/news?page=${page}&pageSize=20`, controller.signal);
        setPosts(result.posts ?? []);
        setTotal(result.total ?? 0);
        setLastPage(result.pagination?.lastPage ?? 1);
      } catch (reason: unknown) {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể tải danh sách bài viết.", 0));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [page, attempt]);

  async function submitPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    setSaving(true);
    setFieldErrors({});
    setFormError(null);
    try {
      await mutateAdmin(
        editor.id ? `/api/admin/news/${editor.id}` : "/api/admin/news",
        {
          body: {
            content: editor.content,
            coverImageUrl: editor.coverImageUrl || null,
            excerpt: editor.excerpt,
            isPublished: editor.isPublished,
            revision: editor.revision,
            slug: editor.slug,
            title: editor.title,
          },
          method: editor.id ? "PATCH" : "POST",
        },
      );
      showToast("success", editor.isPublished ? "Đã lưu và xuất bản bài viết." : "Đã lưu bài viết (nháp).");
      setEditor(null);
      setAttempt((value) => value + 1);
    } catch (reason: unknown) {
      if (reason instanceof AdminClientError && reason.status === 422 && reason.fieldErrors) {
        setFieldErrors(reason.fieldErrors);
        showToast("error", "Dữ liệu bài viết chưa hợp lệ.");
      } else {
        setFormError(reason instanceof AdminClientError ? reason.message : "Không thể lưu bài viết.");
        showToast("error", reason instanceof AdminClientError ? reason.message : "Không thể lưu bài viết.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await mutateAdmin(`/api/admin/news/${pendingDelete.id}`, { method: "DELETE" });
      showToast("success", `Đã xóa bài “${pendingDelete.title}”.`);
      setPendingDelete(null);
      setAttempt((value) => value + 1);
    } catch (reason: unknown) {
      setPendingDelete(null);
      showToast("error", reason instanceof AdminClientError ? reason.message : "Không thể xóa bài viết.");
    }
  }

  async function openEdit(post: AdminNewsListItem) {
    setFieldErrors({});
    setFormError(null);
    try {
      const result = await fetchAdmin<{ post: NewsFormState & { coverImageUrl: string | null } }>(`/api/admin/news/${post.id}`);
      setEditor({
        content: result.post.content,
        coverImageUrl: result.post.coverImageUrl ?? "",
        excerpt: result.post.excerpt,
        id: result.post.id,
        isPublished: result.post.isPublished,
        revision: result.post.revision,
        slug: result.post.slug,
        title: result.post.title,
      });
    } catch (reason: unknown) {
      showToast("error", reason instanceof AdminClientError ? reason.message : "Không thể tải bài viết.");
    }
  }

  return (
    <div className="admin-content">
      <AdminPageHeading kicker="Nội dung / tin tức" title="Viết và xuất bản tin tức" subtitle="Bài viết xuất bản hiển thị tại /tin-tuc trên storefront. Bản nháp chỉ nhìn thấy trong admin." stamp="TIN TỨC" />
      {editor ? (
        <section className="admin-editor" aria-labelledby="news-editor-heading">
          <div className="admin-editor-heading">
            <div>
              <div className="admin-kicker">Nội dung / chỉnh sửa</div>
              <h2 className="admin-panel-title" id="news-editor-heading">{editor.id ? "Cập nhật bài viết" : "Bài viết mới"}</h2>
              <p className="admin-panel-caption">Nội dung xuống dòng sẽ hiển thị thành đoạn văn trên storefront.</p>
            </div>
            <span className="admin-stamp">{editor.id ? `Mã ${editor.id}` : "BẢN GHI MỚI"}</span>
          </div>
          {formError ? <p className="admin-editor-error" role="alert">{formError}</p> : null}
          <form onSubmit={submitPost}>
            <div className="admin-editor-grid">
              <AdminField error={fieldErrors.title} id="news-title" label="Tiêu đề">
                <input className="admin-input" data-testid="input-news-title" id="news-title" onChange={(event) => setEditor({ ...editor, title: event.target.value })} value={editor.title} />
              </AdminField>
              <AdminField error={fieldErrors.slug} hint="Chữ thường, số và gạch ngang — dùng trong URL bài viết." id="news-slug" label="Slug">
                <input className="admin-input admin-mono" data-testid="input-news-slug" id="news-slug" onChange={(event) => setEditor({ ...editor, slug: event.target.value })} value={editor.slug} />
              </AdminField>
              <div className="admin-field admin-field-wide">
                <AdminField error={fieldErrors.coverImageUrl} id="news-cover" label="Ảnh bìa" optional>
                  <div className="admin-input-actions">
                    <input className="admin-input" data-testid="input-news-cover" id="news-cover" onChange={(event) => setEditor({ ...editor, coverImageUrl: event.target.value })} placeholder="https://..." value={editor.coverImageUrl} />
                    <button className="admin-button admin-button-quiet" onClick={() => setPickerOpen(true)} type="button">Chọn từ thư viện</button>
                  </div>
                  <span className="admin-image-preview">
                    {editor.coverImageUrl
                      ? // eslint-disable-next-line @next/next/no-img-element
                        <img alt="Xem trước ảnh bìa" src={editor.coverImageUrl} />
                      : <span className="admin-image-preview-fallback">Chưa có ảnh bìa.</span>}
                  </span>
                </AdminField>
              </div>
              <div className="admin-field admin-field-wide">
                <AdminField error={fieldErrors.excerpt} hint="Hiển thị trong danh sách tin." id="news-excerpt" label="Tóm tắt">
                  <textarea className="admin-textarea" data-testid="input-news-excerpt" id="news-excerpt" onChange={(event) => setEditor({ ...editor, excerpt: event.target.value })} rows={2} value={editor.excerpt} />
                </AdminField>
              </div>
              <div className="admin-field admin-field-wide">
                <AdminField error={fieldErrors.content} hint="Xuống dòng hai lần để tách đoạn văn." id="news-content" label="Nội dung bài viết">
                  <textarea className="admin-textarea" data-testid="input-news-content" id="news-content" onChange={(event) => setEditor({ ...editor, content: event.target.value })} rows={14} value={editor.content} />
                </AdminField>
              </div>
            </div>
            <div className="admin-editor-footer">
              <label className="admin-check">
                <input checked={editor.isPublished} data-testid="checkbox-news-published" onChange={(event) => setEditor({ ...editor, isPublished: event.target.checked })} type="checkbox" />
                <span><strong>Xuất bản bài viết</strong><small>Bài xuất bản hiển thị công khai tại /tin-tuc.</small></span>
              </label>
              <div className="admin-editor-actions">
                <button className="admin-button admin-button-quiet" data-testid="button-news-cancel" onClick={() => { setEditor(null); setFormError(null); setFieldErrors({}); }} type="button">Hủy</button>
                <button className="admin-button admin-button-primary" data-testid="button-news-save" disabled={saving} type="submit">{saving ? "Đang lưu..." : "Lưu bài viết"}</button>
              </div>
            </div>
          </form>
          {pickerOpen ? (
            <AdminMediaPickerModal
              onClose={() => setPickerOpen(false)}
              onSelect={(publicUrl) => {
                setEditor((current) => (current ? { ...current, coverImageUrl: publicUrl } : current));
                setPickerOpen(false);
              }}
            />
          ) : null}
        </section>
      ) : (
        <>
          <div className="admin-toolbar">
            <span className="admin-count"><Newspaper size={13} style={{ verticalAlign: "middle" }} /> {total} bài viết</span>
            {canManage ? (
              <button
                className="admin-button admin-button-primary"
                data-testid="button-news-create"
                onClick={() => {
                  setFieldErrors({});
                  setFormError(null);
                  setEditor({ ...emptyForm });
                }}
                type="button"
              >
                <Plus size={15} /> Viết bài mới
              </button>
            ) : null}
          </div>
          {error ? <AdminErrorState error={error} onRetry={() => setAttempt((value) => value + 1)} /> : loading ? <AdminLoadingTable /> : (
            <section className="admin-panel admin-table-panel" aria-labelledby="news-table-heading">
              <div className="admin-panel-heading" style={{ padding: "21px 21px 0" }}><div><h2 className="admin-panel-title" id="news-table-heading">Danh sách bài viết</h2><p className="admin-panel-caption">Mới nhất hiển thị trước</p></div><Newspaper aria-hidden="true" color="#6e8c42" size={19} /></div>
              {posts.length === 0 ? <AdminEmptyState title="Chưa có bài viết nào" description="Bấm “Viết bài mới” để tạo bài đầu tiên cho /tin-tuc." /> : (
                <>
                  <div className="admin-table-scroll">
                    <table className="admin-table">
                      <thead><tr><th scope="col">Bài viết</th><th scope="col">Trạng thái</th><th scope="col">Xuất bản</th><th scope="col">Cập nhật</th>{canManage ? <th scope="col">Thao tác</th> : null}</tr></thead>
                      <tbody>
                        {posts.map((post) => (
                          <tr data-testid={`row-news-${post.id}`} key={post.id}>
                            <td>
                              <div className="admin-item-name">{post.title}</div>
                              <div className="admin-item-meta">{post.slug}</div>
                              <div className="admin-item-desc">{post.excerpt || "Chưa có tóm tắt"}</div>
                            </td>
                            <td><AdminStatusBadge kind={post.isPublished ? "green" : "amber"} value={post.isPublished ? "Đã xuất bản" : "Bản nháp"} /></td>
                            <td className="admin-mono">{formatAdminDate(post.publishedAt)}</td>
                            <td className="admin-mono">{formatAdminDate(post.updatedAt)}</td>
                            {canManage ? (
                              <td>
                                <div className="admin-table-actions">
                                  <button
                                    className="admin-button admin-button-quiet"
                                    data-testid={`button-news-edit-${post.id}`}
                                    onClick={() => void openEdit(post)}
                                    type="button"
                                  >
                                    <Pencil size={13} /> Sửa
                                  </button>
                                  <button className="admin-button admin-button-danger" data-testid={`button-news-delete-${post.id}`} onClick={() => setPendingDelete(post)} type="button"><Trash2 size={13} /> Xóa</button>
                                </div>
                              </td>
                            ) : null}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <AdminPagination lastPage={lastPage} onPage={setPage} page={page} pageSize={20} total={total} />
                </>
              )}
            </section>
          )}
        </>
      )}
      {pendingDelete ? (
        <AdminConfirmDialog
          confirmLabel="Xóa bài viết"
          message={`Xóa vĩnh viễn bài “${pendingDelete.title}”? Không thể hoàn tác.`}
          onConfirm={() => void confirmDelete()}
          onDismiss={() => setPendingDelete(null)}
          title="Xóa bài viết?"
        />
      ) : null}
    </div>
  );
}
