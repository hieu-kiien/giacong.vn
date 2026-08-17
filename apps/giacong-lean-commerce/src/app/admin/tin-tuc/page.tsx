"use client";

import { Newspaper, Search } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
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

interface NewsCategory {
  id: number;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface NewsArticle {
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
  isFeatured: boolean;
  seoTitle: string;
  seoDescription: string;
  publishedAt: string | null;
  revision: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface NewsResponse {
  articles: NewsArticle[];
  categories: NewsCategory[];
  total: number;
  pagination?: { currentPage: number; lastPage: number; pageSize: number; total: number };
}

type ArticleForm = {
  id?: number;
  revision?: number;
  categoryId: string;
  title: string;
  slug: string;
  excerpt: string;
  contentText: string;
  thumbnailUrl: string;
  status: "draft" | "published";
  isFeatured: boolean;
  seoTitle: string;
  seoDescription: string;
  publishedAt: string;
};

type CategoryForm = {
  id?: number;
  name: string;
  slug: string;
  description: string;
  sortOrder: string;
  isActive: boolean;
};

const emptyArticle: ArticleForm = {
  categoryId: "",
  title: "",
  slug: "",
  excerpt: "",
  contentText: "",
  thumbnailUrl: "",
  status: "draft",
  isFeatured: false,
  seoTitle: "",
  seoDescription: "",
  publishedAt: "",
};

const emptyCategory: CategoryForm = {
  name: "",
  slug: "",
  description: "",
  sortOrder: "0",
  isActive: true,
};

export default function AdminNewsPage() {
  const session = useAdminSession();
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [categories, setCategories] = useState<NewsCategory[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AdminClientError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [articleEditor, setArticleEditor] = useState<ArticleForm | null>(null);
  const [categoryEditor, setCategoryEditor] = useState<CategoryForm | null>(null);
  const [saveError, setSaveError] = useState<AdminClientError | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (query) params.set("query", query);
    if (status) params.set("status", status);
    if (categoryFilter) params.set("categoryId", categoryFilter);
    void (async () => {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setLoading(true);
      setError(null);
      try {
        const result = await fetchAdmin<NewsResponse>(`/api/admin/news/articles?${params.toString()}`, controller.signal);
        setArticles(result.articles ?? []);
        setCategories(result.categories ?? []);
        setTotal(result.total ?? 0);
        setLastPage(result.pagination?.lastPage ?? Math.max(1, Math.ceil((result.total ?? 0) / 20)));
      } catch (reason: unknown) {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể tải News CMS.", 0));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [session.subject, page, query, status, categoryFilter, attempt]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setQuery(inputQuery.trim());
  }

  function openArticle(article?: NewsArticle) {
    setSaveError(null);
    setCategoryEditor(null);
    setArticleEditor(article ? {
      id: article.id,
      revision: article.revision,
      categoryId: article.categoryId === null ? "" : String(article.categoryId),
      title: article.title,
      slug: article.slug,
      excerpt: article.excerpt,
      contentText: article.contentText,
      thumbnailUrl: article.thumbnailUrl ?? "",
      status: article.status,
      isFeatured: article.isFeatured,
      seoTitle: article.seoTitle,
      seoDescription: article.seoDescription,
      publishedAt: toDateTimeLocal(article.publishedAt),
    } : { ...emptyArticle });
  }

  async function submitArticle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!articleEditor) return;
    setSaving(true);
    setSaveError(null);
    const payload = {
      categoryId: articleEditor.categoryId ? Number(articleEditor.categoryId) : null,
      title: articleEditor.title,
      slug: articleEditor.slug,
      excerpt: articleEditor.excerpt,
      contentText: articleEditor.contentText,
      thumbnailUrl: articleEditor.thumbnailUrl || null,
      status: articleEditor.status,
      isFeatured: articleEditor.isFeatured,
      seoTitle: articleEditor.seoTitle,
      seoDescription: articleEditor.seoDescription,
      publishedAt: articleEditor.publishedAt ? new Date(articleEditor.publishedAt).toISOString() : null,
      ...(articleEditor.revision ? { revision: articleEditor.revision } : {}),
    };
    try {
      await mutateAdmin<{ article: NewsArticle }>(
        articleEditor.id ? `/api/admin/news/articles/${articleEditor.id}` : "/api/admin/news/articles",
        { body: payload, method: articleEditor.id ? "PATCH" : "POST" },
      );
      setArticleEditor(null);
      setAttempt((value) => value + 1);
    } catch (reason: unknown) {
      setSaveError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể lưu bài viết.", 0));
    } finally {
      setSaving(false);
    }
  }

  async function deleteArticle(article: NewsArticle) {
    if (!window.confirm(`Xóa vĩnh viễn bài viết “${article.title}”? Thao tác này không thể hoàn tác.`)) return;
    setDeletingId(article.id);
    setSaveError(null);
    try {
      await mutateAdmin<{ deleted: boolean }>(`/api/admin/news/articles/${article.id}`, {
        body: { revision: article.revision },
        method: "DELETE",
      });
      if (articleEditor?.id === article.id) setArticleEditor(null);
      setAttempt((value) => value + 1);
    } catch (reason: unknown) {
      setSaveError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể xóa bài viết.", 0));
    } finally {
      setDeletingId(null);
    }
  }

  function openCategory(category?: NewsCategory) {
    setSaveError(null);
    setArticleEditor(null);
    setCategoryEditor(category ? {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      sortOrder: String(category.sortOrder),
      isActive: category.isActive,
    } : { ...emptyCategory });
  }

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!categoryEditor) return;
    setSaving(true);
    setSaveError(null);
    const payload = {
      name: categoryEditor.name,
      slug: categoryEditor.slug,
      description: categoryEditor.description,
      sortOrder: Number(categoryEditor.sortOrder),
      isActive: categoryEditor.isActive,
    };
    try {
      await mutateAdmin<{ category: NewsCategory }>(
        categoryEditor.id ? `/api/admin/news/categories/${categoryEditor.id}` : "/api/admin/news/categories",
        { body: payload, method: categoryEditor.id ? "PATCH" : "POST" },
      );
      setCategoryEditor(null);
      setAttempt((value) => value + 1);
    } catch (reason: unknown) {
      setSaveError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể lưu danh mục.", 0));
    } finally {
      setSaving(false);
    }
  }

  async function deleteCategory(category: NewsCategory) {
    if (!window.confirm(`Xóa danh mục “${category.name}”? Chỉ danh mục chưa có bài viết mới có thể xóa.`)) return;
    setDeletingId(-category.id);
    setSaveError(null);
    try {
      await mutateAdmin<{ deleted: boolean }>(`/api/admin/news/categories/${category.id}`, { method: "DELETE" });
      if (categoryEditor?.id === category.id) setCategoryEditor(null);
      if (categoryFilter === String(category.id)) setCategoryFilter("");
      setAttempt((value) => value + 1);
    } catch (reason: unknown) {
      setSaveError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể xóa danh mục.", 0));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="admin-content">
      <AdminPageHeading
        kicker="CMS / biên tập"
        title="Tin tức"
        subtitle="Quản lý bài viết, lịch phát hành, SEO và danh mục hiển thị trên storefront. Nội dung V1 được lưu dạng văn bản thuần."
        stamp="NEWS CMS"
      />

      {saveError && !articleEditor && !categoryEditor ? <p className="admin-editor-error" role="alert">{saveError.code ? `${saveError.code} · ` : ""}{saveError.message}</p> : null}
      {articleEditor ? <ArticleEditor categories={categories} error={saveError} form={articleEditor} onCancel={() => { setArticleEditor(null); setSaveError(null); }} onChange={setArticleEditor} onSubmit={submitArticle} saving={saving} /> : null}
      {categoryEditor ? <CategoryEditor error={saveError} form={categoryEditor} onCancel={() => { setCategoryEditor(null); setSaveError(null); }} onChange={setCategoryEditor} onSubmit={submitCategory} saving={saving} /> : null}

      <form className="admin-toolbar" onSubmit={submitSearch}>
        <div className="admin-search-wrap">
          <label className="admin-label" htmlFor="news-search">Tìm bài viết</label>
          <Search aria-hidden="true" />
          <input className="admin-input has-icon" id="news-search" onChange={(event) => setInputQuery(event.target.value)} placeholder="Tiêu đề, slug hoặc tóm tắt..." value={inputQuery} />
        </div>
        <select className="admin-select" aria-label="Lọc trạng thái" onChange={(event) => { setStatus(event.target.value); setPage(1); }} value={status}>
          <option value="">Mọi trạng thái</option><option value="draft">Draft</option><option value="published">Published</option>
        </select>
        <select className="admin-select" aria-label="Lọc danh mục" onChange={(event) => { setCategoryFilter(event.target.value); setPage(1); }} value={categoryFilter}>
          <option value="">Mọi danh mục</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <button className="admin-button admin-button-primary" type="submit"><Search size={15} /> Tìm</button>
        <button className="admin-button admin-button-primary" onClick={() => openArticle()} type="button"><Newspaper size={15} /> Thêm bài viết</button>
      </form>

      {error ? <AdminErrorState error={error} onRetry={() => setAttempt((value) => value + 1)} /> : loading ? <AdminLoadingTable /> : (
        <section className="admin-panel admin-table-panel" aria-labelledby="news-table-heading">
          <div className="admin-panel-heading" style={{ padding: "21px 21px 0" }}>
            <div><h2 className="admin-panel-title" id="news-table-heading">Bài viết</h2><p className="admin-panel-caption">Draft không xuất hiện trên storefront. Published có thể đặt thời điểm trong tương lai để lên lịch.</p></div>
            <span className="admin-count">{total} bản ghi</span>
          </div>
          {articles.length === 0 ? <AdminEmptyState title="Chưa có bài viết phù hợp" description="Tạo bài draft mới hoặc thay đổi bộ lọc tìm kiếm." /> : <>
            <div className="admin-table-scroll"><table className="admin-table">
              <thead><tr><th>Bài viết</th><th>Danh mục</th><th>Trạng thái</th><th>Phát hành</th><th>Cập nhật</th><th>Thao tác</th></tr></thead>
              <tbody>{articles.map((article) => <tr key={article.id}>
                <td><div className="admin-item-name">{article.title}<div className="admin-item-meta">/{article.slug}/ · rev {article.revision}{article.isFeatured ? " · nổi bật" : ""}</div></div></td>
                <td className="admin-description">{article.categoryName ?? "Chưa phân loại"}</td>
                <td><AdminStatusBadge kind={article.status === "published" ? "green" : "amber"} value={article.status} /></td>
                <td className="admin-mono">{article.publishedAt ? formatAdminDate(article.publishedAt) : "Chưa đặt"}</td>
                <td className="admin-mono">{formatAdminDate(article.updatedAt)}</td>
                <td><div className="admin-table-actions"><button className="admin-button admin-button-quiet" onClick={() => openArticle(article)} type="button">Sửa</button><button className="admin-button admin-button-danger" disabled={deletingId === article.id} onClick={() => void deleteArticle(article)} type="button">{deletingId === article.id ? "Đang xóa" : "Xóa"}</button></div></td>
              </tr>)}</tbody>
            </table></div>
            <AdminPagination lastPage={lastPage} onPage={setPage} page={page} pageSize={20} total={total} />
          </>}
        </section>
      )}

      <section className="admin-panel admin-table-panel" aria-labelledby="news-category-heading" style={{ marginTop: 24 }}>
        <div className="admin-panel-heading" style={{ padding: "21px 21px 0" }}><div><h2 className="admin-panel-title" id="news-category-heading">Danh mục tin tức</h2><p className="admin-panel-caption">Tắt hiển thị để ẩn khỏi bộ lọc storefront. Chỉ danh mục chưa được bài viết sử dụng mới có thể xóa.</p></div><button className="admin-button admin-button-primary" onClick={() => openCategory()} type="button">Thêm danh mục</button></div>
        {categories.length === 0 ? <AdminEmptyState title="Chưa có danh mục" description="Tạo danh mục đầu tiên để phân loại bài viết." /> : <div className="admin-table-scroll"><table className="admin-table">
          <thead><tr><th>Danh mục</th><th>Mô tả</th><th>Thứ tự</th><th>Hiển thị</th><th>Thao tác</th></tr></thead>
          <tbody>{categories.map((category) => <tr key={category.id}><td><div className="admin-item-name">{category.name}<div className="admin-item-meta">{category.slug}</div></div></td><td className="admin-description">{category.description || "Chưa có mô tả"}</td><td className="admin-mono">{category.sortOrder}</td><td><AdminStatusBadge kind={category.isActive ? "green" : "neutral"} value={category.isActive ? "Đang hiện" : "Tạm ẩn"} /></td><td><div className="admin-table-actions"><button className="admin-button admin-button-quiet" onClick={() => openCategory(category)} type="button">Sửa</button><button className="admin-button admin-button-danger" disabled={deletingId === -category.id} onClick={() => void deleteCategory(category)} type="button">{deletingId === -category.id ? "Đang xóa" : "Xóa"}</button></div></td></tr>)}</tbody>
        </table></div>}
      </section>
    </div>
  );
}

function ArticleEditor({ categories, error, form, onCancel, onChange, onSubmit, saving }: { categories: NewsCategory[]; error: AdminClientError | null; form: ArticleForm; onCancel: () => void; onChange: (value: ArticleForm) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; saving: boolean }) {
  function update<K extends keyof ArticleForm>(key: K, value: ArticleForm[K]) { onChange({ ...form, [key]: value }); }
  return <section className="admin-editor" aria-labelledby="news-editor-heading"><div className="admin-editor-heading"><div><div className="admin-kicker">News / chỉnh sửa</div><h2 className="admin-panel-title" id="news-editor-heading">{form.id ? "Cập nhật bài viết" : "Tạo bài viết mới"}</h2><p className="admin-panel-caption">Bài mới luôn lưu draft trước. Khi publish, thời điểm phát hành quyết định lúc public read nhìn thấy bài.</p></div><span className="admin-stamp">{form.id ? `ID ${form.id} · REV ${form.revision}` : "NEW DRAFT"}</span></div>
    {error ? <p className="admin-editor-error" role="alert">{error.code ? `${error.code} · ` : ""}{error.message}</p> : null}
    <form onSubmit={onSubmit}><div className="admin-editor-grid">
      <label className="admin-field admin-field-wide"><span>Tiêu đề <b>*</b></span><input className="admin-input" onChange={(e) => update("title", e.target.value)} required value={form.title} /></label>
      <label className="admin-field"><span>Slug <b>*</b></span><input className="admin-input admin-mono" onChange={(e) => update("slug", e.target.value)} required value={form.slug} /></label>
      <label className="admin-field"><span>Danh mục</span><select className="admin-select" onChange={(e) => update("categoryId", e.target.value)} value={form.categoryId}><option value="">Chưa phân loại</option>{categories.filter((item) => item.isActive || String(item.id) === form.categoryId).map((item) => <option key={item.id} value={item.id}>{item.name}{item.isActive ? "" : " (tạm ẩn)"}</option>)}</select></label>
      <label className="admin-field"><span>Trạng thái</span><select className="admin-select" disabled={!form.id} onChange={(e) => { const next = e.target.value as ArticleForm["status"]; onChange({ ...form, status: next, publishedAt: next === "published" && !form.publishedAt ? currentDateTimeLocal() : form.publishedAt }); }} value={form.status}><option value="draft">Draft</option><option value="published">Published</option></select></label>
      <label className="admin-field"><span>Thời điểm phát hành</span><input className="admin-input admin-mono" disabled={form.status !== "published"} onChange={(e) => update("publishedAt", e.target.value)} required={form.status === "published"} type="datetime-local" value={form.publishedAt} /></label>
      <label className="admin-field admin-field-wide"><span>Tóm tắt</span><textarea className="admin-textarea" onChange={(e) => update("excerpt", e.target.value)} rows={3} value={form.excerpt} /></label>
      <label className="admin-field admin-field-wide"><span>Nội dung bài viết</span><textarea className="admin-textarea admin-mono" onChange={(e) => update("contentText", e.target.value)} rows={14} value={form.contentText} /></label>
      <label className="admin-field admin-field-wide"><span>URL ảnh đại diện</span><input className="admin-input" onChange={(e) => update("thumbnailUrl", e.target.value)} placeholder="/media/... hoặc https://..." value={form.thumbnailUrl} /></label>
      <label className="admin-field"><span>SEO title</span><input className="admin-input" onChange={(e) => update("seoTitle", e.target.value)} value={form.seoTitle} /></label>
      <label className="admin-field"><span>SEO description</span><textarea className="admin-textarea" onChange={(e) => update("seoDescription", e.target.value)} rows={2} value={form.seoDescription} /></label>
    </div><div className="admin-editor-footer"><label className="admin-check"><input checked={form.isFeatured} onChange={(e) => update("isFeatured", e.target.checked)} type="checkbox" /><span><strong>Bài nổi bật</strong><small>Ưu tiên bài trong danh sách public theo read model.</small></span></label><div className="admin-editor-actions"><button className="admin-button admin-button-quiet" onClick={onCancel} type="button">Hủy</button><button className="admin-button admin-button-primary" disabled={saving} type="submit">{saving ? "Đang lưu..." : "Lưu bài viết"}</button></div></div></form>
  </section>;
}

function CategoryEditor({ error, form, onCancel, onChange, onSubmit, saving }: { error: AdminClientError | null; form: CategoryForm; onCancel: () => void; onChange: (value: CategoryForm) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; saving: boolean }) {
  function update<K extends keyof CategoryForm>(key: K, value: CategoryForm[K]) { onChange({ ...form, [key]: value }); }
  return <section className="admin-editor" aria-labelledby="news-category-editor-heading"><div className="admin-editor-heading"><div><div className="admin-kicker">News / taxonomy</div><h2 className="admin-panel-title" id="news-category-editor-heading">{form.id ? "Cập nhật danh mục" : "Tạo danh mục mới"}</h2></div><span className="admin-stamp">{form.id ? `ID ${form.id}` : "NEW CATEGORY"}</span></div>
    {error ? <p className="admin-editor-error" role="alert">{error.code ? `${error.code} · ` : ""}{error.message}</p> : null}
    <form onSubmit={onSubmit}><div className="admin-editor-grid"><label className="admin-field"><span>Tên danh mục <b>*</b></span><input className="admin-input" onChange={(e) => update("name", e.target.value)} required value={form.name} /></label><label className="admin-field"><span>Slug <b>*</b></span><input className="admin-input admin-mono" onChange={(e) => update("slug", e.target.value)} required value={form.slug} /></label><label className="admin-field"><span>Thứ tự</span><input className="admin-input admin-mono" min="0" onChange={(e) => update("sortOrder", e.target.value)} type="number" value={form.sortOrder} /></label><label className="admin-field admin-field-wide"><span>Mô tả</span><textarea className="admin-textarea" onChange={(e) => update("description", e.target.value)} rows={3} value={form.description} /></label></div><div className="admin-editor-footer"><label className="admin-check"><input checked={form.isActive} onChange={(e) => update("isActive", e.target.checked)} type="checkbox" /><span><strong>Hiển thị trên storefront</strong><small>Danh mục tạm ẩn vẫn giữ liên kết với bài viết hiện có.</small></span></label><div className="admin-editor-actions"><button className="admin-button admin-button-quiet" onClick={onCancel} type="button">Hủy</button><button className="admin-button admin-button-primary" disabled={saving} type="submit">{saving ? "Đang lưu..." : "Lưu danh mục"}</button></div></div></form>
  </section>;
}

function toDateTimeLocal(value: string | null): string {
  if (!value) return "";
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function currentDateTimeLocal(): string {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
