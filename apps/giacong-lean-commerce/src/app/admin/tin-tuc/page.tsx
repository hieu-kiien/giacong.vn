"use client";

import { ExternalLink, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoadingTable,
  AdminPageHeading,
  AdminPagination,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";
import { useAdminSession } from "@/components/admin/AdminShell";
import { AdminClientError, fetchAdmin, formatAdminDate, mutateAdmin } from "@/lib/admin-client";

interface AdminNewsCategory {
  id: number;
  name: string;
  slug: string;
  active: boolean;
}

interface AdminNewsArticle {
  id: number;
  categoryId: number | null;
  categoryName: string | null;
  categorySlug: string | null;
  title: string;
  slug: string;
  excerpt: string;
  contentText: string;
  thumbnailUrl: string | null;
  status: "draft" | "published";
  featured: boolean;
  seoTitle: string;
  seoDescription: string;
  publishedAt: string | null;
  revision: number;
  archivedAt: string | null;
  updatedAt: string;
}

interface NewsListResponse {
  articles: AdminNewsArticle[];
  categories: AdminNewsCategory[];
  pagination: {
    currentPage: number;
    lastPage: number;
    pageSize: number;
    total: number;
  };
}

interface NewsFormState {
  categoryId: string;
  contentText: string;
  excerpt: string;
  featured: boolean;
  id?: number;
  publishedAt: string;
  revision?: number;
  seoDescription: string;
  seoTitle: string;
  slug: string;
  status: "draft" | "published";
  thumbnailUrl: string;
  title: string;
}

const emptyForm: NewsFormState = {
  categoryId: "",
  contentText: "",
  excerpt: "",
  featured: false,
  publishedAt: "",
  seoDescription: "",
  seoTitle: "",
  slug: "",
  status: "draft",
  thumbnailUrl: "",
  title: "",
};

export default function AdminNewsPage() {
  const session = useAdminSession();
  const canManage = session.role === "owner" || session.role === "content_manager";
  const [articles, setArticles] = useState<AdminNewsArticle[]>([]);
  const [categories, setCategories] = useState<AdminNewsCategory[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AdminClientError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [editor, setEditor] = useState<NewsFormState | null>(null);
  const [baseline, setBaseline] = useState("");
  const [saveError, setSaveError] = useState<AdminClientError | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [archivingId, setArchivingId] = useState<number | null>(null);

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
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (query) params.set("query", query);
    if (status) params.set("status", status);

    void (async () => {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setLoading(true);
      setError(null);
      try {
        const result = await fetchAdmin<NewsListResponse>(`/api/admin/news?${params.toString()}`, controller.signal);
        setArticles(result.articles ?? []);
        setCategories(result.categories ?? []);
        setTotal(result.pagination?.total ?? 0);
        setLastPage(result.pagination?.lastPage ?? 1);
      } catch (reason: unknown) {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể tải danh sách tin tức.", 0));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [session.subject, page, query, status, attempt]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setQuery(inputQuery.trim());
  }

  function openCreate() {
    if (!canManage) return;
    if (!confirmDiscard()) return;
    const form = { ...emptyForm, categoryId: defaultCategoryId(categories) };
    setEditor(form);
    setBaseline(JSON.stringify(form));
    setSaveError(null);
    setSaveMessage("");
  }

  function openEdit(article: AdminNewsArticle) {
    if (!canManage) return;
    if (!confirmDiscard()) return;
    applyArticleToEditor(article);
  }

  function applyArticleToEditor(article: AdminNewsArticle) {
    const form = articleToForm(article);
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

  function confirmDiscard() {
    return !dirty || window.confirm("Bạn có thay đổi chưa lưu. Bỏ các thay đổi này?");
  }

  async function submitArticle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || !canManage) return;
    setSaving(true);
    setSaveError(null);
    setSaveMessage("");

    const payload = {
      categoryId: editor.categoryId ? Number(editor.categoryId) : null,
      contentText: editor.contentText,
      excerpt: editor.excerpt,
      featured: editor.featured,
      publishedAt: editor.status === "published" && editor.publishedAt
        ? new Date(editor.publishedAt).toISOString()
        : null,
      seoDescription: editor.seoDescription,
      seoTitle: editor.seoTitle,
      slug: editor.slug,
      status: editor.id ? editor.status : "draft",
      thumbnailUrl: editor.thumbnailUrl || null,
      title: editor.title,
      ...(editor.id ? { revision: editor.revision } : {}),
    };

    try {
      const result = await mutateAdmin<{ article: AdminNewsArticle }>(
        editor.id ? `/api/admin/news/${editor.id}` : "/api/admin/news",
        { body: payload, method: editor.id ? "PATCH" : "POST" },
      );
      applyArticleToEditor(result.article);
      setSaveMessage(editor.id ? "Đã lưu thay đổi." : "Đã tạo bản nháp. Bạn có thể kiểm tra rồi phát hành.");
      setAttempt((value) => value + 1);
    } catch (reason: unknown) {
      setSaveError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể lưu bài viết.", 0));
    } finally {
      setSaving(false);
    }
  }

  async function reloadStaleArticle() {
    if (!editor?.id) return;
    try {
      const result = await fetchAdmin<{ article: AdminNewsArticle }>(`/api/admin/news/${editor.id}`);
      applyArticleToEditor(result.article);
      setSaveMessage("Đã tải bản mới nhất từ D1.");
    } catch (reason: unknown) {
      setSaveError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể tải bản mới nhất.", 0));
    }
  }

  async function archiveArticle(article: AdminNewsArticle) {
    if (!canManage) return;
    if (!window.confirm(`Lưu trữ bài viết “${article.title}”? Bài sẽ biến mất khỏi trang Tin tức.`)) return;
    setArchivingId(article.id);
    setSaveError(null);
    try {
      await mutateAdmin<{ article: AdminNewsArticle }>(`/api/admin/news/${article.id}`, {
        body: { revision: article.revision },
        method: "DELETE",
      });
      if (editor?.id === article.id) {
        setEditor(null);
        setBaseline("");
      }
      setAttempt((value) => value + 1);
    } catch (reason: unknown) {
      const clientError = reason instanceof AdminClientError ? reason : new AdminClientError("Không thể lưu trữ bài viết.", 0);
      setSaveError(clientError);
      if (clientError.code === "STALE_WRITE") setAttempt((value) => value + 1);
    } finally {
      setArchivingId(null);
    }
  }

  return (
    <div className="admin-content">
      <AdminPageHeading
        kicker="CMS / xuất bản"
        stamp="NEWS DESK"
        subtitle="Soạn bài, kiểm soát trạng thái phát hành, SEO và lịch xuất bản từ dữ liệu D1 canonical."
        title="Tin tức"
      />

      {!canManage ? (
        <div className="admin-readiness-note" role="note">
          Vai trò {session.role ?? "viewer"} có quyền xem dữ liệu nhưng không được tạo, sửa, phát hành hoặc lưu trữ bài viết.
        </div>
      ) : null}

      {editor ? (
        <NewsEditor
          categories={categories}
          dirty={dirty}
          error={saveError}
          form={editor}
          onCancel={closeEditor}
          onChange={setEditor}
          onReloadStale={() => void reloadStaleArticle()}
          onSubmit={submitArticle}
          saving={saving}
          successMessage={saveMessage}
        />
      ) : null}

      <form className="admin-toolbar" onSubmit={submitSearch}>
        <div className="admin-search-wrap">
          <label className="admin-label" htmlFor="news-search">Tìm theo tiêu đề hoặc slug</label>
          <Search aria-hidden="true" />
          <input
            className="admin-input has-icon"
            data-testid="input-news-search"
            id="news-search"
            onChange={(event) => setInputQuery(event.target.value)}
            placeholder="Ví dụ: gia công bột, đóng gói..."
            value={inputQuery}
          />
        </div>
        <label className="admin-field" style={{ minWidth: 170 }}>
          <span>Trạng thái</span>
          <select
            className="admin-select"
            data-testid="select-news-filter-status"
            onChange={(event) => { setStatus(event.target.value); setPage(1); }}
            value={status}
          >
            <option value="">Tất cả</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>
        <button className="admin-button admin-button-primary" data-testid="button-news-search" type="submit"><Search size={15} /> Tìm</button>
        {(query || status) ? (
          <button className="admin-button admin-button-quiet" onClick={() => { setInputQuery(""); setQuery(""); setStatus(""); setPage(1); }} type="button">
            Xóa bộ lọc
          </button>
        ) : null}
        {canManage ? <button className="admin-button admin-button-primary" data-testid="button-news-create" onClick={openCreate} type="button">Thêm bài viết</button> : null}
      </form>

      {saveError && !editor ? <p className="admin-editor-error" role="alert">{saveError.code ? `${saveError.code} · ` : ""}{saveError.message}</p> : null}

      {error ? <AdminErrorState error={error} onRetry={() => setAttempt((value) => value + 1)} /> : loading ? <AdminLoadingTable /> : (
        <section className="admin-panel admin-table-panel" aria-labelledby="news-table-heading">
          <div className="admin-panel-heading" style={{ padding: "21px 21px 0" }}>
            <div>
              <h2 className="admin-panel-title" id="news-table-heading">Kho bài viết</h2>
              <p className="admin-panel-caption">Chỉ dữ liệu thật từ bảng articles, không có bài mẫu trong UI.</p>
            </div>
            <span className="admin-count">{total} bản ghi</span>
          </div>

          {articles.length === 0 ? (
            <AdminEmptyState
              description={query || status ? "Thử thay đổi bộ lọc hoặc từ khóa." : "Tạo bản nháp đầu tiên để bắt đầu quản lý nội dung."}
              title={query || status ? "Không tìm thấy bài viết phù hợp" : "Chưa có bài viết"}
            />
          ) : (
            <>
              <div className="admin-table-scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col">Bài viết</th>
                      <th scope="col">Chuyên mục</th>
                      <th scope="col">Trạng thái</th>
                      <th scope="col">Lịch xuất bản</th>
                      <th scope="col">Cập nhật</th>
                      <th scope="col">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {articles.map((article) => (
                      <tr data-testid={`row-news-${article.id}`} key={article.id}>
                        <td>
                          <div className="admin-item-name">
                            {article.title}
                            <div className="admin-item-meta">/{article.slug} · rev {article.revision}{article.featured ? " · nổi bật" : ""}</div>
                          </div>
                        </td>
                        <td className="admin-description">{article.categoryName ?? "Không phân loại"}</td>
                        <td><AdminStatusBadge kind={article.status === "published" ? "green" : "amber"} value={article.status} /></td>
                        <td className="admin-mono">{formatUtcDate(article.publishedAt)}</td>
                        <td className="admin-mono">{formatAdminDate(article.updatedAt)}</td>
                        <td>
                          <div className="admin-table-actions">
                            {isPubliclyVisible(article) ? (
                              <Link className="admin-button admin-button-quiet" href={`/tin-tuc/${article.slug}`} target="_blank">
                                <ExternalLink size={14} /> Xem
                              </Link>
                            ) : null}
                            {canManage ? <button className="admin-button admin-button-quiet" data-testid={`button-news-edit-${article.id}`} onClick={() => openEdit(article)} type="button">Sửa</button> : null}
                            {canManage ? (
                              <button
                                className="admin-button admin-button-danger"
                                data-testid={`button-news-archive-${article.id}`}
                                disabled={archivingId === article.id}
                                onClick={() => void archiveArticle(article)}
                                type="button"
                              >
                                {archivingId === article.id ? "Đang lưu trữ" : "Lưu trữ"}
                              </button>
                            ) : null}
                          </div>
                        </td>
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
    </div>
  );
}

function NewsEditor({
  categories,
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
  categories: AdminNewsCategory[];
  dirty: boolean;
  error: AdminClientError | null;
  form: NewsFormState;
  onCancel: () => void;
  onChange: (value: NewsFormState) => void;
  onReloadStale: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
  successMessage: string;
}) {
  function update<K extends keyof NewsFormState>(key: K, value: NewsFormState[K]) {
    onChange({ ...form, [key]: value });
  }

  return (
    <section className="admin-editor" aria-labelledby="news-editor-heading">
      <div className="admin-editor-heading">
        <div>
          <div className="admin-kicker">News / chỉnh sửa</div>
          <h2 className="admin-panel-title" id="news-editor-heading">{form.id ? "Cập nhật bài viết" : "Tạo bản nháp mới"}</h2>
          <p className="admin-panel-caption">Bài mới luôn được tạo ở draft. Sau lần lưu đầu tiên, bạn có thể phát hành hoặc đặt lịch.</p>
        </div>
        <span className="admin-stamp">{form.id ? `ID ${form.id} · REV ${form.revision}` : "NEW DRAFT"}</span>
      </div>

      {error ? (
        <div className="admin-editor-error" role="alert">
          <div>{error.code ? `${error.code} · ` : ""}{error.message}</div>
          {error.code === "STALE_WRITE" ? (
            <button className="admin-button admin-button-quiet" onClick={onReloadStale} type="button"><RefreshCw size={14} /> Tải bản mới nhất</button>
          ) : null}
        </div>
      ) : null}
      {successMessage ? <div className="admin-readiness-note" role="status">{successMessage}</div> : null}

      <form onSubmit={onSubmit}>
        <div className="admin-editor-grid">
          <label className="admin-field admin-field-wide">
            <span>Tiêu đề <b aria-hidden="true">*</b></span>
            <input className="admin-input" data-testid="input-news-title" maxLength={180} onChange={(event) => update("title", event.target.value)} required value={form.title} />
          </label>
          <label className="admin-field">
            <span>Slug <b aria-hidden="true">*</b></span>
            <input className="admin-input admin-mono" data-testid="input-news-slug" maxLength={160} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" onChange={(event) => update("slug", event.target.value.toLowerCase())} required value={form.slug} />
          </label>
          <label className="admin-field">
            <span>Chuyên mục</span>
            <select className="admin-select" data-testid="select-news-category" onChange={(event) => update("categoryId", event.target.value)} value={form.categoryId}>
              <option value="">Không phân loại</option>
              {categories.map((category) => <option disabled={!category.active} key={category.id} value={category.id}>{category.name}{category.active ? "" : " (đã ẩn)"}</option>)}
            </select>
          </label>
          <label className="admin-field">
            <span>Trạng thái</span>
            {form.id ? (
              <select className="admin-select" data-testid="select-news-status" onChange={(event) => update("status", event.target.value as NewsFormState["status"])} value={form.status}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            ) : <input className="admin-input" disabled value="draft" />}
          </label>
          <label className="admin-field">
            <span>Thời điểm xuất bản</span>
            <input
              className="admin-input admin-mono"
              data-testid="input-news-published-at"
              disabled={!form.id || form.status !== "published"}
              onChange={(event) => update("publishedAt", event.target.value)}
              type="datetime-local"
              value={form.publishedAt}
            />
            <small>{form.status === "published" ? "Để trống để phát hành ngay khi lưu." : "Chỉ dùng khi trạng thái Published."}</small>
          </label>
          <label className="admin-field admin-field-wide">
            <span>Tóm tắt</span>
            <textarea className="admin-textarea" data-testid="input-news-excerpt" maxLength={600} onChange={(event) => update("excerpt", event.target.value)} rows={3} value={form.excerpt} />
          </label>
          <label className="admin-field admin-field-wide">
            <span>Nội dung bài viết {form.status === "published" ? <b aria-hidden="true">*</b> : null}</span>
            <textarea className="admin-textarea" data-testid="input-news-content" onChange={(event) => update("contentText", event.target.value)} required={form.status === "published"} rows={16} value={form.contentText} />
            <small>V1 lưu plain text an toàn. Tách đoạn bằng một dòng trống.</small>
          </label>
          <label className="admin-field admin-field-wide">
            <span>URL ảnh đại diện</span>
            <input className="admin-input" data-testid="input-news-thumbnail" maxLength={2048} onChange={(event) => update("thumbnailUrl", event.target.value)} placeholder="/media/... hoặc https://..." value={form.thumbnailUrl} />
          </label>
          <label className="admin-field admin-field-wide">
            <span>SEO title</span>
            <input className="admin-input" data-testid="input-news-seo-title" maxLength={180} onChange={(event) => update("seoTitle", event.target.value)} value={form.seoTitle} />
          </label>
          <label className="admin-field admin-field-wide">
            <span>SEO description</span>
            <textarea className="admin-textarea" data-testid="input-news-seo-description" maxLength={320} onChange={(event) => update("seoDescription", event.target.value)} rows={3} value={form.seoDescription} />
          </label>
        </div>

        <div className="admin-editor-footer">
          <label className="admin-check">
            <input checked={form.featured} data-testid="checkbox-news-featured" onChange={(event) => update("featured", event.target.checked)} type="checkbox" />
            <span><strong>Bài nổi bật</strong><small>Ưu tiên bài này ở đầu danh sách public khi đã published.</small></span>
          </label>
          <div className="admin-editor-actions">
            <span className="admin-panel-caption" aria-live="polite">{dirty ? "Có thay đổi chưa lưu" : "Đã đồng bộ với D1"}</span>
            <button className="admin-button admin-button-quiet" data-testid="button-news-cancel" onClick={onCancel} type="button">Đóng</button>
            <button className="admin-button admin-button-primary" data-testid="button-news-save" disabled={saving || !dirty} type="submit">{saving ? "Đang lưu..." : form.id ? "Lưu bài viết" : "Tạo bản nháp"}</button>
          </div>
        </div>
      </form>
    </section>
  );
}

function articleToForm(article: AdminNewsArticle): NewsFormState {
  return {
    categoryId: article.categoryId === null ? "" : String(article.categoryId),
    contentText: article.contentText,
    excerpt: article.excerpt,
    featured: article.featured,
    id: article.id,
    publishedAt: toLocalDateTime(article.publishedAt),
    revision: article.revision,
    seoDescription: article.seoDescription,
    seoTitle: article.seoTitle,
    slug: article.slug,
    status: article.status,
    thumbnailUrl: article.thumbnailUrl ?? "",
    title: article.title,
  };
}

function defaultCategoryId(categories: AdminNewsCategory[]): string {
  const category = categories.find((item) => item.active && item.slug === "tin-tuc") ?? categories.find((item) => item.active);
  return category ? String(category.id) : "";
}

function isPubliclyVisible(article: AdminNewsArticle): boolean {
  if (article.status !== "published" || !article.publishedAt) return false;
  const publishedAt = new Date(`${article.publishedAt.replace(" ", "T")}Z`);
  return !Number.isNaN(publishedAt.valueOf()) && publishedAt.valueOf() <= Date.now();
}

function toLocalDateTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(`${value.replace(" ", "T")}Z`);
  if (Number.isNaN(date.valueOf())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatUtcDate(value: string | null): string {
  if (!value) return "Chưa phát hành";
  const date = new Date(`${value.replace(" ", "T")}Z`);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}
