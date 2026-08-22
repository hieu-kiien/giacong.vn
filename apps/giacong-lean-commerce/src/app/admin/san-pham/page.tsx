"use client";

import { ImageOff, RefreshCw, Search } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { AdminEmptyState, AdminErrorState, AdminLoadingTable, AdminPageHeading, AdminPagination, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { AdminMediaPanel } from "@/components/admin/AdminMediaPanel";
import { AdminProductBulkImport } from "@/components/admin/AdminProductBulkImport";
import { useAdminSession } from "@/components/admin/AdminShell";
import { AdminVariantPanel } from "@/components/admin/AdminVariantPanel";
import { AdminClientError, fetchAdmin, formatAdminDate, getInitials, mutateAdmin, type AdminCategory, type AdminProduct } from "@/lib/admin-client";
import { slugifyProductName } from "@/lib/slugify-product";

interface ProductResponse {
  categories?: AdminCategory[];
  products: AdminProduct[];
  total: number;
  pagination?: { currentPage: number; lastPage: number; pageSize: number; total: number };
}

type ProductFormState = {
  categoryId: string;
  description: string;
  id?: number;
  imageUrl: string;
  isActive: boolean;
  leadTimeDays: string;
  name: string;
  shortDescription: string;
  sku: string;
  slugTouched: boolean;
  slug: string;
  status: "archived" | "draft" | "published" | "review";
};

const emptyProductForm: ProductFormState = {
  categoryId: "",
  description: "",
  imageUrl: "",
  isActive: false,
  leadTimeDays: "",
  name: "",
  shortDescription: "",
  sku: "",
  slugTouched: false,
  slug: "",
  status: "draft",
};

export default function AdminProductsPage() {
  const session = useAdminSession();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [query, setQuery] = useState("");
  const [inputQuery, setInputQuery] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AdminClientError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [editor, setEditor] = useState<ProductFormState | null>(null);
  const [saveError, setSaveError] = useState<AdminClientError | null>(null);
  const [saving, setSaving] = useState(false);
  const [archivingId, setArchivingId] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (query) params.set("query", query);
    void (async () => {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setLoading(true);
      setError(null);
      try {
        const result = await fetchAdmin<ProductResponse>(`/api/admin/products?${params.toString()}`, controller.signal);
        setProducts(result.products ?? []);
        setCategories(result.categories ?? []);
        setTotal(result.total ?? 0);
        setLastPage(result.pagination?.lastPage ?? Math.max(1, Math.ceil((result.total ?? 0) / 20)));
      } catch (reason: unknown) {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể tải danh sách sản phẩm.", 0));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [session.subject, page, query, attempt]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setQuery(inputQuery.trim());
  }

  function clearSearch() {
    setInputQuery("");
    setQuery("");
    setPage(1);
  }

  function openCreate() {
    setSaveError(null);
    setEditor({ ...emptyProductForm });
  }

  function openEdit(product: AdminProduct) {
    setSaveError(null);
    setEditor({
      categoryId: product.categoryId ? String(product.categoryId) : "",
      description: product.description,
      id: product.id,
      imageUrl: product.imageUrl ?? "",
      isActive: product.isActive,
      leadTimeDays: product.leadTimeDays === null ? "" : String(product.leadTimeDays),
      name: product.name,
      shortDescription: product.shortDescription,
      sku: product.sku,
      slugTouched: true,
      slug: product.slug,
      status: product.status as ProductFormState["status"],
    });
  }

  async function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    setSaving(true);
    setSaveError(null);
    const payload = {
      categoryId: editor.categoryId || null,
      description: editor.description,
      imageUrl: editor.imageUrl || null,
      isActive: editor.isActive,
      leadTimeDays: editor.leadTimeDays === "" ? null : Number(editor.leadTimeDays),
      name: editor.name,
      shortDescription: editor.shortDescription,
      sku: editor.sku,
      slug: editor.slug,
      status: editor.status,
    };
    try {
      await mutateAdmin<{ product: AdminProduct }>(
        editor.id ? `/api/admin/products/${editor.id}` : "/api/admin/products",
        { body: payload, method: editor.id ? "PATCH" : "POST" },
      );
      setEditor(null);
      setAttempt((value) => value + 1);
    } catch (reason: unknown) {
      setSaveError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể lưu sản phẩm.", 0));
    } finally {
      setSaving(false);
    }
  }

  async function archiveProduct(product: AdminProduct) {
    if (!window.confirm(`Ẩn sản phẩm “${product.name}” khỏi storefront?`)) return;
    setArchivingId(product.id);
    setSaveError(null);
    try {
      await mutateAdmin<{ product: AdminProduct }>(`/api/admin/products/${product.id}`, { method: "DELETE" });
      if (editor?.id === product.id) setEditor(null);
      setAttempt((value) => value + 1);
    } catch (reason: unknown) {
      setSaveError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể ẩn sản phẩm.", 0));
    } finally {
      setArchivingId(null);
    }
  }

  return (
    <div className="admin-content">
      <AdminPageHeading kicker="Catalog / sản phẩm" title="Quản lý sản phẩm" subtitle="Tìm và kiểm tra trạng thái các sản phẩm private-label đang được quản lý trong catalog." stamp="PRODUCT CATALOG" />
      {editor ? <ProductEditor categories={categories} error={saveError} form={editor} onChange={setEditor} onCancel={() => { setEditor(null); setSaveError(null); }} onSubmit={submitProduct} saving={saving} /> : null}
      <AdminProductBulkImport onImported={() => setAttempt((value) => value + 1)} />
      <form className="admin-toolbar" onSubmit={submitSearch}>
        <div className="admin-search-wrap">
          <label className="admin-label" htmlFor="product-search">Tìm theo tên, SKU hoặc slug</label>
          <Search aria-hidden="true" />
          <input className="admin-input has-icon" data-testid="input-product-search" id="product-search" onChange={(event) => setInputQuery(event.target.value)} placeholder="Ví dụ: bột ngũ cốc, SKU, slug..." value={inputQuery} />
        </div>
        <button className="admin-button admin-button-primary" data-testid="button-product-search" type="submit"><Search size={15} /> Tìm sản phẩm</button>
        {query ? <button className="admin-button admin-button-quiet" data-testid="button-product-clear-search" onClick={clearSearch} type="button">Xóa tìm kiếm</button> : null}
        <button className="admin-button admin-button-primary" data-testid="button-product-create" onClick={openCreate} type="button">Thêm sản phẩm</button>
      </form>
      {error ? <AdminErrorState error={error} onRetry={() => setAttempt((value) => value + 1)} /> : loading ? <AdminLoadingTable /> : (
        <section className="admin-panel admin-table-panel" aria-labelledby="product-table-heading">
          <div className="admin-panel-heading" style={{ padding: "21px 21px 0" }}><div><h2 className="admin-panel-title" id="product-table-heading">Danh mục sản phẩm</h2><p className="admin-panel-caption">{query ? `Kết quả cho “${query}”` : "Sắp xếp theo cập nhật gần nhất"}</p></div><span className="admin-count">{total} bản ghi</span></div>
          {products.length === 0 ? <AdminEmptyState title={query ? "Không tìm thấy sản phẩm phù hợp" : "Chưa có sản phẩm trong catalog"} description={query ? "Thử một tên, SKU hoặc slug khác. Không có dữ liệu thay thế được hiển thị." : "API chưa trả về sản phẩm nào từ D1 catalog."} /> : (
            <>
              <div className="admin-table-scroll">
                <table className="admin-table">
                   <thead><tr><th scope="col">Sản phẩm</th><th scope="col">Danh mục / SKU</th><th scope="col">Trạng thái</th><th scope="col">Lead time</th><th scope="col">Cập nhật</th><th scope="col">Thao tác</th></tr></thead>
                  <tbody>
                    {products.map((product) => (
                      <tr data-testid={`row-product-${product.id}`} key={product.id}>
                        <td>
                          <div className="admin-product-cell">
                            <span className="admin-thumb">
                              {product.imageUrl ? (
                                // R2 hostnames are runtime-configured and cannot be statically allow-listed.
                                // eslint-disable-next-line @next/next/no-img-element
                                <img alt="" src={product.imageUrl} />
                              ) : <span>{getInitials(product.name)}</span>}
                            </span>
                            <div className="admin-item-name">{product.name}<div className="admin-item-meta">{product.slug}</div></div>
                          </div>
                        </td>
                        <td><div>{product.categoryName || "Chưa phân loại"}</div><div className="admin-item-meta">{product.sku || "Chưa có SKU"}</div></td>
                        <td><AdminStatusBadge kind={product.isActive && product.status === "published" ? "green" : product.status === "draft" || product.status === "review" ? "amber" : "neutral"} value={product.isActive ? product.status : "Tạm ẩn"} /></td>
                        <td className="admin-mono">{product.leadTimeDays ? `${product.leadTimeDays} ngày` : "Chưa có"}</td>
                         <td className="admin-mono">{formatAdminDate(product.updatedAt)}</td>
                         <td>
                           <div className="admin-table-actions">
                             <button className="admin-button admin-button-quiet" data-testid={`button-product-edit-${product.id}`} onClick={() => openEdit(product)} type="button">Sửa</button>
                             {product.isActive ? <button className="admin-button admin-button-danger" data-testid={`button-product-archive-${product.id}`} disabled={archivingId === product.id} onClick={() => void archiveProduct(product)} type="button">{archivingId === product.id ? "Đang ẩn" : "Ẩn"}</button> : null}
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
      {!loading && !error && products.length > 0 ? <p className="admin-stamp" style={{ marginTop: 15 }}><ImageOff size={12} style={{ verticalAlign: "middle" }} /> Ảnh không có sẽ được giữ dưới dạng chữ viết tắt · <RefreshCw size={11} style={{ verticalAlign: "middle" }} /> đọc mới từ API mỗi lần lọc</p> : null}
    </div>
  );
}

interface ProductEditorProps {
  categories: AdminCategory[];
  error: AdminClientError | null;
  form: ProductFormState;
  onCancel: () => void;
  onChange: (value: ProductFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
}

function ProductEditor({
  categories,
  error,
  form,
  onCancel,
  onChange,
  onSubmit,
  saving,
}: ProductEditorProps) {
  function update<K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) {
    onChange({ ...form, [key]: value });
  }

  function updateName(value: string) {
    onChange({
      ...form,
      name: value,
      slug: !form.id && !form.slugTouched ? slugifyProductName(value) : form.slug,
    });
  }

  return (
    <section className="admin-editor" aria-labelledby="product-editor-heading">
      <div className="admin-editor-heading">
        <div>
          <div className="admin-kicker">Catalog / chỉnh sửa</div>
          <h2 className="admin-panel-title" id="product-editor-heading">{form.id ? "Cập nhật sản phẩm" : "Tạo sản phẩm mới"}</h2>
          <p className="admin-panel-caption">{form.id ? "Cập nhật nội dung, rồi kiểm tra lại biến thể và bậc giá trước khi publish." : "Bước 1/3 · lưu Draft trước, sau đó thêm biến thể, giá và ảnh rồi mới publish."}</p>
        </div>
        <span className="admin-stamp">{form.id ? `ID ${form.id}` : "NEW RECORD"}</span>
      </div>
      {error ? <p className="admin-editor-error" role="alert">{error.code ? `${error.code} · ` : ""}{error.message}</p> : null}
      <form onSubmit={onSubmit}>
        <div className="admin-editor-grid">
          <label className="admin-field">
            <span>Tên sản phẩm <b aria-hidden="true">*</b></span>
            <input aria-describedby="product-name-help" className="admin-input" data-testid="input-product-name" onChange={(event) => updateName(event.target.value)} required value={form.name} />
            <small className="admin-field-help" id="product-name-help">Tên hiển thị cho khách và đội sales.</small>
          </label>
          <label className="admin-field">
            <span>Slug <b aria-hidden="true">*</b></span>
            <input aria-describedby="product-slug-help" className="admin-input admin-mono" data-testid="input-product-slug" onChange={(event) => onChange({ ...form, slug: event.target.value, slugTouched: true })} required value={form.slug} />
            <small className="admin-field-help" id="product-slug-help">Tự tạo từ tên; chỉ sửa khi cần giữ URL đã thống nhất.</small>
          </label>
          <label className="admin-field">
            <span>SKU <b aria-hidden="true">*</b></span>
            <input className="admin-input admin-mono" data-testid="input-product-sku" onChange={(event) => update("sku", event.target.value)} required value={form.sku} />
          </label>
          <label className="admin-field">
            <span>Danh mục</span>
            <select className="admin-select" data-testid="select-product-category" onChange={(event) => update("categoryId", event.target.value)} value={form.categoryId}>
              <option value="">Chưa phân loại</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label className="admin-field">
            <span>Trạng thái phát hành</span>
            <select className="admin-select" data-testid="select-product-status" onChange={(event) => {
              const status = event.target.value as ProductFormState["status"];
              onChange({ ...form, isActive: status === "published" ? form.isActive : false, status });
            }} value={form.status} disabled={!form.id}>
              <option value="draft">Draft{!form.id ? " · bắt buộc lúc tạo" : ""}</option>
              {form.id ? <><option value="review">Chờ duyệt</option><option value="published">Published</option><option value="archived">Archived</option></> : null}
            </select>
          </label>
          <label className="admin-field">
            <span>Lead time (ngày)</span>
            <input className="admin-input admin-mono" data-testid="input-product-lead-time" inputMode="numeric" min="0" onChange={(event) => update("leadTimeDays", event.target.value)} type="number" value={form.leadTimeDays} />
          </label>
          <label className="admin-field admin-field-wide">
            <span>Ảnh sản phẩm</span>
            <input aria-describedby="product-image-help" className="admin-input" data-testid="input-product-image" onChange={(event) => update("imageUrl", event.target.value)} placeholder="/media/products/... hoặc https://..." value={form.imageUrl} />
            <small className="admin-field-help" id="product-image-help">Sau khi lưu, bạn có thể upload ảnh vào R2 ở phần Media bên dưới.</small>
          </label>
          <label className="admin-field admin-field-wide">
            <span>Mô tả ngắn</span>
            <textarea className="admin-textarea" data-testid="input-product-short-description" onChange={(event) => update("shortDescription", event.target.value)} rows={2} value={form.shortDescription} />
          </label>
          <label className="admin-field admin-field-wide">
            <span>Mô tả chi tiết</span>
            <textarea className="admin-textarea" data-testid="input-product-description" onChange={(event) => update("description", event.target.value)} rows={5} value={form.description} />
          </label>
        </div>
        <div className="admin-editor-footer">
          <label className={`admin-check${form.status !== "published" ? " is-disabled" : ""}`}>
            <input checked={form.isActive} data-testid="checkbox-product-active" disabled={form.status !== "published"} onChange={(event) => update("isActive", event.target.checked)} type="checkbox" />
            <span><strong>Hiển thị trên storefront</strong><small>{form.status === "published" ? "Public product read sẽ thấy sản phẩm này." : "Chỉ published mới có thể hiển thị."}</small></span>
          </label>
          <div className="admin-editor-actions">
            <button className="admin-button admin-button-quiet" data-testid="button-product-cancel" onClick={onCancel} type="button">Hủy</button>
            <button className="admin-button admin-button-primary" data-testid="button-product-save" disabled={saving} type="submit">{saving ? "Đang lưu..." : form.id ? "Lưu thay đổi" : "Lưu Draft và tiếp tục"}</button>
          </div>
        </div>
      </form>
      {form.id ? <AdminVariantPanel productId={form.id} /> : null}
      {form.id ? <AdminMediaPanel productId={form.id} /> : null}
    </section>
  );
}
