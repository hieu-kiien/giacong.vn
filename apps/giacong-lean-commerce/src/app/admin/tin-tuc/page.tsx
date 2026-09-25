"use client";

import { ArrowLeft, ExternalLink, Eye, EyeOff, Newspaper, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { AdminConfirmDialog } from "@/components/admin/AdminDialog";
import { AdminField } from "@/components/admin/AdminField";
import { AdminMediaPickerModal } from "@/components/admin/AdminMediaPickerModal";
import { AdminEmptyState, AdminErrorState, AdminLoadingTable, AdminPageHeading, AdminPagination, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { useAdminSession } from "@/components/admin/AdminShell";
import { useAdminToast } from "@/components/admin/AdminToast";
import { useRegisterAdminUnsaved } from "@/components/admin/AdminUnsavedGuard";
import { AdminClientError, fetchAdmin, formatAdminDate, mutateAdmin } from "@/lib/admin-client";
import { parseAdminNewsPayload } from "@/lib/admin-news-input";
import { canManageNews } from "@/lib/admin-permissions.ts";

interface AdminNewsListItem {
  excerpt: string;
  hasUnpublishedChanges: boolean;
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

interface NewsBatchResponse {
  changedCount: number;
  selectedCount: number;
  skipped: Array<{ id: number; reason: string }>;
}

interface PendingNewsBatch {
  items: Array<{ expectedRevision: number; id: number }>;
  key: string;
  requestId: string;
}

interface NewsFormState {
  content: string;
  coverImageUrl: string;
  excerpt: string;
  id?: number;
  revision?: number;
  slug: string;
  title: string;
}

const emptyForm: NewsFormState = {
  content: "",
  coverImageUrl: "",
  excerpt: "",
  slug: "",
  title: "",
};

export default function AdminNewsPage() {
  const session = useAdminSession();
  const { showToast } = useAdminToast();
  const searchParams = useSearchParams();
  const canManage = canManageNews(session.role);

  const [posts, setPosts] = useState<AdminNewsListItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AdminClientError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [editor, setEditor] = useState<NewsFormState | null>(null);
  const [editorSnapshot, setEditorSnapshot] = useState<NewsFormState | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AdminNewsListItem | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchAction, setBatchAction] = useState<"publish" | "unpublish" | null>(null);
  const [publicationId, setPublicationId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const filteredPosts = useMemo(() => {
    if (statusFilter === "published") return posts.filter((p) => p.isPublished);
    if (statusFilter === "draft") return posts.filter((p) => !p.isPublished);
    return posts;
  }, [posts, statusFilter]);
  const newsBatchRequest = useRef<PendingNewsBatch | null>(null);
  const newsBatchInFlight = useRef(false);
  const publicationInFlight = useRef(false);
  const isDirty = useCallback(() => editor !== null && JSON.stringify(editor) !== JSON.stringify(editorSnapshot), [editor, editorSnapshot]);
  useRegisterAdminUnsaved(isDirty, saving);
  const applyNewsEditor = useCallback((form: NewsFormState) => {
    setEditor(form);
    setEditorSnapshot(form);
  }, []);

  const openEditById = useCallback(async (id: number) => {
    if (!canManage) {
      showToast("error", "Vai trò hiện tại chỉ được xem bài viết.");
      return;
    }
    setFieldErrors({});
    setFormError(null);
    try {
      const result = await fetchAdmin<{ post: NewsFormState & { coverImageUrl: string | null } }>(`/api/admin/news/${id}`);
      applyNewsEditor({
        content: result.post.content,
        coverImageUrl: result.post.coverImageUrl ?? "",
        excerpt: result.post.excerpt,
        id: result.post.id,
        revision: result.post.revision,
        slug: result.post.slug,
        title: result.post.title,
      });
    } catch (reason: unknown) {
      showToast("error", reason instanceof AdminClientError ? reason.message : "Không thể tải bài viết được yêu cầu.");
    }
  }, [applyNewsEditor, canManage, showToast]);

  const editQuery = searchParams.get("edit");
  const createQuery = searchParams.get("create");
  useEffect(() => {
    if (!editQuery || !canManage) return;
    const id = Number(editQuery);
    if (!Number.isSafeInteger(id) || id <= 0) {
      showToast("error", "Không thể tải bài viết được yêu cầu.");
      return;
    }
    void openEditById(id);
  }, [canManage, editQuery, openEditById, showToast]);

  useEffect(() => {
    if (editQuery || createQuery !== "1" || !canManage) return;
    setFieldErrors({});
    setFormError(null);
    applyNewsEditor({ ...emptyForm });
  }, [applyNewsEditor, canManage, createQuery, editQuery]);

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
    if (!editor || !canManage) return;
    const body: Record<string, unknown> = {
      content: editor.content,
      coverImageUrl: editor.coverImageUrl || null,
      excerpt: editor.excerpt,
      requestId: crypto.randomUUID(),
      slug: editor.slug,
      title: editor.title,
    };
    const parsed = parseAdminNewsPayload(body);
    setFieldErrors({});
    setFormError(null);
    if (!parsed.input) {
      setFieldErrors(parsed.fieldErrors);
      showToast("error", "Dữ liệu bài viết chưa hợp lệ.");
      return;
    }
    setSaving(true);
    try {
      if (editor.id && editor.revision) body.revision = editor.revision;
      await mutateAdmin(
        editor.id ? `/api/admin/news/${editor.id}` : "/api/admin/news",
        {
          body,
          method: editor.id ? "PATCH" : "POST",
        },
      );
      showToast("success", "Đã lưu bản nháp. Bài đang hiển thị công khai không đổi cho tới khi bạn bấm Phát hành.");
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
      await mutateAdmin(`/api/admin/news/${pendingDelete.id}`, {
        body: { requestId: crypto.randomUUID(), revision: pendingDelete.revision },
        method: "DELETE",
      });
      showToast("success", `Đã xóa bài “${pendingDelete.title}”.`);
      setPendingDelete(null);
      setAttempt((value) => value + 1);
    } catch (reason: unknown) {
      setPendingDelete(null);
      showToast("error", reason instanceof AdminClientError ? reason.message : "Không thể xóa bài viết.");
    }
  }

  async function togglePublication(post: AdminNewsListItem, publishOverride?: boolean) {
    if (publicationInFlight.current || newsBatchInFlight.current) return;
    const publish = publishOverride ?? !post.isPublished;
    publicationInFlight.current = true;
    setPublicationId(post.id);
    try {
      await mutateAdmin(`/api/admin/news/${post.id}/publish`, {
        body: { expectedRevision: post.revision, publish, requestId: crypto.randomUUID() },
        method: "POST",
      });
      showToast("success", publish ? (post.isPublished ? "Đã phát hành bản cập nhật lên website." : "Đã phát hành bài viết lên website.") : "Đã ẩn bài viết khỏi website.");
      setAttempt((value) => value + 1);
    } catch (reason: unknown) {
      showToast("error", reason instanceof AdminClientError ? reason.message : "Không thể thay đổi trạng thái bài viết.");
    } finally {
      publicationInFlight.current = false;
      setPublicationId(null);
    }
  }

  async function runBatch(publish: boolean) {
    const selectedPosts = posts.filter((post) => selectedIds.has(post.id));
    if (selectedPosts.length === 0 || publicationInFlight.current || newsBatchInFlight.current) return;

    const batchKey = `${publish ? "publish" : "unpublish"}:${selectedPosts.map((post) => post.id).sort((a, b) => a - b).join(",")}`;
    const pendingBatch = newsBatchRequest.current?.key === batchKey ? newsBatchRequest.current : null;
    const items = pendingBatch?.items ?? selectedPosts.map((post) => ({ expectedRevision: post.revision, id: post.id }));
    const requestId = pendingBatch?.requestId ?? crypto.randomUUID();
    newsBatchRequest.current = { items, key: batchKey, requestId };
    newsBatchInFlight.current = true;
    setBatchAction(publish ? "publish" : "unpublish");
    try {
      const result = await mutateAdmin<NewsBatchResponse>("/api/admin/news/batch", {
        body: {
          items,
          publish,
          requestId: pendingBatch?.requestId ?? requestId,
        },
        method: "POST",
      });
      const skipped = result.skipped?.length ?? 0;
      showToast(
        skipped > 0 ? "error" : "success",
        `${publish ? "Đã phát hành" : "Đã ẩn"} ${result.changedCount} / ${result.selectedCount} bài viết.${skipped > 0 ? ` ${skipped} bài chưa xử lý, hãy tải lại để xem lý do.` : ""}`,
      );
      if (newsBatchRequest.current?.key === batchKey) newsBatchRequest.current = null;
      setSelectedIds(new Set());
      setAttempt((value) => value + 1);
    } catch (reason: unknown) {
      const clientError = reason instanceof AdminClientError
        ? reason
        : new AdminClientError("Không thể xử lý hàng loạt bài viết.", 0);
      if (clientError.status >= 400 && clientError.status < 500 && newsBatchRequest.current?.key === batchKey) {
        newsBatchRequest.current = null;
      }
      showToast("error", clientError.message);
    } finally {
      newsBatchInFlight.current = false;
      setBatchAction(null);
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
      const allSelected = filteredPosts.length > 0 && filteredPosts.every((post) => current.has(post.id));
      if (allSelected) return new Set();
      return new Set(filteredPosts.map((post) => post.id));
    });
  }

  function changePage(nextPage: number) {
    setSelectedIds(new Set());
    setPage(nextPage);
  }

  async function openEdit(post: AdminNewsListItem) {
    await openEditById(post.id);
  }

  return (
    <div className="admin-content">
      <AdminPageHeading kicker="Nội dung / tin tức" title="Viết và xuất bản tin tức" subtitle="Bài viết xuất bản hiển thị tại /tin-tuc trên trang web. Bản nháp chỉ nhìn thấy trong admin." stamp="TIN TỨC" />
      {editor ? (
        <section className="admin-editor admin-haravan-editor" aria-labelledby="news-editor-heading">
          <form noValidate onSubmit={submitPost}>
            <div className="admin-haravan-topbar">
              <div className="admin-haravan-topbar-left">
                <button
                  className="admin-button admin-button-quiet"
                  disabled={saving}
                  onClick={() => {
                    if (isDirty()) { setConfirmDiscard(true); return; }
                    setEditor(null);
                    setFormError(null);
                    setFieldErrors({});
                  }}
                  style={{ alignItems: "center", display: "inline-flex", gap: 6, fontWeight: 600 }}
                  type="button"
                >
                  <ArrowLeft size={16} /> Danh sách bài viết
                </button>
                <div className="admin-haravan-title-wrap">
                  <h2 className="admin-panel-title" id="news-editor-heading" style={{ fontSize: 18, margin: 0 }}>
                    {editor.id ? editor.title || `Bài viết #${editor.id}` : "Thêm bài viết mới"}
                  </h2>
                  {editor.id ? (
                    <span className="admin-stamp">Mã {editor.id}</span>
                  ) : (
                    <span className="admin-stamp">BẢN GHI MỚI</span>
                  )}
                </div>
              </div>
              <div className="admin-haravan-topbar-right">
                {editor.slug ? (
                  <a
                    className="admin-button admin-button-quiet"
                    href={`/tin-tuc/${editor.slug}/`}
                    rel="noreferrer"
                    style={{ alignItems: "center", display: "inline-flex", gap: 6 }}
                    target="_blank"
                  >
                    <span>Xem trên website</span>
                    <ExternalLink size={14} />
                  </a>
                ) : null}
                <button
                  className="admin-button admin-button-quiet"
                  disabled={saving}
                  onClick={() => {
                    if (isDirty()) { setConfirmDiscard(true); return; }
                    setEditor(null);
                    setFormError(null);
                    setFieldErrors({});
                  }}
                  type="button"
                >
                  Hủy
                </button>
                <button
                  className="admin-button admin-button-primary"
                  disabled={saving}
                  type="submit"
                >
                  {saving ? "Đang lưu..." : "Lưu bài viết"}
                </button>
              </div>
            </div>
            {formError ? <p className="admin-editor-error" role="alert">{formError}</p> : null}
            <fieldset className="admin-fieldset" disabled={saving}>
            <div className="admin-editor-grid">
              <AdminField error={fieldErrors.title} id="news-title" label="Tiêu đề">
                <input className="admin-input" data-testid="input-news-title" id="news-title" onChange={(event) => setEditor({ ...editor, title: event.target.value })} value={editor.title} />
              </AdminField>
              <AdminField error={fieldErrors.slug} hint="Viết liền không dấu — dùng trong đường dẫn bài viết." id="news-slug" label="Đường dẫn (slug)">
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
              <span className="admin-item-meta" data-testid="news-draft-hint">
                Lưu lần này chỉ cập nhật bản nháp. Muốn đưa nội dung lên website, hãy bấm “Phát hành” sau khi kiểm tra.
              </span>
              <div className="admin-editor-actions">
                <button className="admin-button admin-button-quiet" data-testid="button-news-cancel" onClick={() => { if (isDirty()) { setConfirmDiscard(true); return; } setEditor(null); setFormError(null); setFieldErrors({}); }} type="button">Hủy</button>
                <button className="admin-button admin-button-primary" data-testid="button-news-save" disabled={saving} type="submit">{saving ? "Đang lưu..." : "Lưu bài viết"}</button>
              </div>
            </div>
            </fieldset>
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
            <div className="admin-content-toolbar-actions">
              {canManage && selectedIds.size > 0 ? (
                <>
                  <span className="admin-item-meta" data-testid="news-selection-count">Đã chọn {selectedIds.size}</span>
                  <button className="admin-button admin-button-quiet" data-testid="button-news-batch-publish" disabled={publicationId !== null || batchAction !== null} onClick={() => void runBatch(true)} type="button"><Eye size={13} /> {batchAction === "publish" ? "Đang phát hành..." : "Phát hành đã chọn"}</button>
                  <button className="admin-button admin-button-quiet" data-testid="button-news-batch-unpublish" disabled={publicationId !== null || batchAction !== null} onClick={() => void runBatch(false)} type="button"><EyeOff size={13} /> {batchAction === "unpublish" ? "Đang ẩn..." : "Ẩn đã chọn"}</button>
                  <button className="admin-button admin-button-quiet" onClick={() => setSelectedIds(new Set())} style={{ fontSize: 12, minHeight: 30, padding: "0 8px" }} type="button">Bỏ chọn</button>
                </>
              ) : null}
              {canManage ? (
                <button
                  className="admin-button admin-button-primary"
                  data-testid="button-news-create"
                  onClick={() => {
                    setFieldErrors({});
                    setFormError(null);
                    applyNewsEditor({ ...emptyForm });
                  }}
                  type="button"
                >
                  <Plus size={15} /> Thêm bài viết
                </button>
              ) : null}
            </div>
          </div>
          {error ? <AdminErrorState error={error} onRetry={() => setAttempt((value) => value + 1)} /> : loading ? <AdminLoadingTable /> : (
            <section className="admin-panel admin-table-panel" aria-labelledby="news-table-heading">
              <div className="admin-panel-heading" style={{ padding: "21px 21px 12px" }}><div><h2 className="admin-panel-title" id="news-table-heading">Danh sách bài viết</h2><p className="admin-panel-caption">Mới nhất hiển thị trước</p></div><Newspaper aria-hidden="true" color="#6e8c42" size={19} /></div>
              <div style={{ padding: "0 21px" }}>
                <div className="admin-filter-tabs">
                  <button
                    className={`admin-filter-tab${statusFilter === "all" ? " is-active" : ""}`}
                    onClick={() => setStatusFilter("all")}
                    type="button"
                  >
                    Tất cả <span className="admin-filter-tab-count">{posts.length}</span>
                  </button>
                  <button
                    className={`admin-filter-tab${statusFilter === "published" ? " is-active" : ""}`}
                    onClick={() => setStatusFilter("published")}
                    type="button"
                  >
                    Đã phát hành <span className="admin-filter-tab-count">{posts.filter((p) => p.isPublished).length}</span>
                  </button>
                  <button
                    className={`admin-filter-tab${statusFilter === "draft" ? " is-active" : ""}`}
                    onClick={() => setStatusFilter("draft")}
                    type="button"
                  >
                    Bản nháp <span className="admin-filter-tab-count">{posts.filter((p) => !p.isPublished).length}</span>
                  </button>
                </div>
              </div>
              {posts.length === 0 ? <AdminEmptyState title="Chưa có bài viết nào" description="Bấm “Thêm bài viết” để tạo bài đầu tiên cho /tin-tuc." /> : (
                <>
                  <div className="admin-table-scroll">
                    <table className="admin-table">
                      <thead><tr>{canManage ? <th scope="col"><input aria-label="Chọn tất cả bài viết trong trang" checked={filteredPosts.length > 0 && filteredPosts.every((post) => selectedIds.has(post.id))} disabled={batchAction !== null} onChange={toggleAllVisible} type="checkbox" /></th> : null}<th scope="col">Bài viết</th><th scope="col">Trạng thái</th><th scope="col">Ngày đăng</th><th scope="col">Cập nhật</th>{canManage ? <th scope="col">Thao tác</th> : null}</tr></thead>
                      <tbody>
                        {filteredPosts.map((post) => (
                          <tr data-testid={`row-news-${post.id}`} key={post.id}>
                            {canManage ? <td><input aria-label={`Chọn bài ${post.title}`} checked={selectedIds.has(post.id)} disabled={batchAction !== null} onChange={() => toggleSelected(post.id)} type="checkbox" /></td> : null}
                            <td>
                              <div className="admin-item-name">
                                <button
                                  className="admin-product-name-btn"
                                  data-testid={`link-news-edit-${post.id}`}
                                  disabled={saving}
                                  onClick={() => void openEdit(post)}
                                  title={`Sửa bài viết ${post.title}`}
                                  type="button"
                                >
                                  {post.title}
                                </button>
                                <div className="admin-item-meta" style={{ alignItems: "center", display: "inline-flex", gap: 5 }}>
                                  <span>{post.slug}</span>
                                  {post.slug && post.isPublished ? (
                                    <a
                                      className="admin-external-link-btn"
                                      href={`/tin-tuc/${post.slug}/`}
                                      onClick={(event) => event.stopPropagation()}
                                      rel="noreferrer"
                                      target="_blank"
                                      title="Xem bài viết trên website"
                                    >
                                      <ExternalLink size={12} />
                                    </a>
                                  ) : null}
                                </div>
                                <div className="admin-item-desc">{post.excerpt || "Chưa có tóm tắt"}</div>
                              </div>
                            </td>
                            <td><AdminStatusBadge kind={post.isPublished ? "green" : "amber"} value={post.isPublished ? "Đã đăng" : "Bản nháp"} /></td>
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
                                  {post.isPublished && post.hasUnpublishedChanges ? (
                                    <button className="admin-button admin-button-quiet" data-testid={`button-news-publish-update-${post.id}`} disabled={publicationId !== null || batchAction !== null} onClick={() => void togglePublication(post, true)} type="button">
                                      {publicationId === post.id ? "Đang xử lý..." : <><Eye size={13} /> Phát hành cập nhật</>}
                                    </button>
                                  ) : null}
                                  <button className="admin-button admin-button-quiet" data-testid={`button-news-publish-${post.id}`} disabled={publicationId !== null || batchAction !== null} onClick={() => void togglePublication(post)} type="button">
                                    {publicationId === post.id ? "Đang xử lý..." : <>{post.isPublished ? <EyeOff size={13} /> : <Eye size={13} />} {post.isPublished ? "Ẩn khỏi web" : "Phát hành"}</>}
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
                  <AdminPagination lastPage={lastPage} onPage={changePage} page={page} pageSize={20} total={total} />
                </>
              )}
            </section>
          )}
        </>
      )}
      {confirmDiscard ? <AdminConfirmDialog cancelLabel="Ở lại" confirmLabel="Bỏ thay đổi" message="Bài viết có thay đổi chưa lưu. Bỏ các thay đổi này?" onConfirm={() => { setEditor(null); setFormError(null); setFieldErrors({}); }} onDismiss={() => setConfirmDiscard(false)} title="Bỏ thay đổi chưa lưu?" /> : null}
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
