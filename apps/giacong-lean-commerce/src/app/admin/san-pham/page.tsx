"use client";

import { ImageOff, RefreshCw, Search } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { AdminCategoryPanel } from "@/components/admin/AdminCategoryPanel";
import { AdminConfirmDialog } from "@/components/admin/AdminDialog";
import { AdminMediaPickerModal } from "@/components/admin/AdminMediaPickerModal";
import { AdminEmptyState, AdminErrorState, AdminLoadingTable, AdminPageHeading, AdminPagination, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { AdminMediaPanel } from "@/components/admin/AdminMediaPanel";
import { AdminModal } from "@/components/admin/AdminDialog";
import { AdminProductImportPanel } from "@/components/admin/AdminProductImportPanel";
import { AdminVariantPanel } from "@/components/admin/AdminVariantPanel";
import { useAdminSession } from "@/components/admin/AdminShell";
import { useAdminToast } from "@/components/admin/AdminToast";
import { AdminClientError, fetchAdmin, formatAdminDate, getInitials, mutateAdmin, type AdminCategory, type AdminProduct } from "@/lib/admin-client";
import { canManageCatalog } from "@/lib/admin-permissions";

interface ProductResponse {
  categories?: AdminCategory[];
  products: AdminProduct[];
  total: number;
  pagination?: { currentPage: number; lastPage: number; pageSize: number; total: number };
}

interface ProductBatchSnapshotResponse {
  products: Array<{ id: number; isActive: boolean; revision: number }>;
}

type ProductBatchItem = { id: number; expectedRevision: number };
type ProductBatchSkipReason = "already_archived" | "not_found" | "stale";
type ProductBatchResult = {
  changedCount: number;
  replayed?: boolean;
  selectedCount: number;
  skipped: Array<{ id: number; reason: ProductBatchSkipReason }>;
};

const productBatchSkipLabels: Record<ProductBatchSkipReason, string> = {
  stale: "xung đột phiên",
  already_archived: "đã ẩn trước đó",
  not_found: "không còn tồn tại",
};

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
  slug: "",
  status: "draft",
};

const statusLabelsVN: Record<ProductFormState["status"], string> = {
  archived: "Lưu trữ",
  draft: "Bản nháp",
  published: "Đã xuất bản",
  review: "Chờ duyệt",
};

export default function AdminProductsPage() {
  const session = useAdminSession();
  const { showToast } = useAdminToast();
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
  const [confirmArchive, setConfirmArchive] = useState<AdminProduct | null>(null);
  const [categoryPanelOpen, setCategoryPanelOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchArchiving, setBatchArchiving] = useState(false);
  const [confirmBatchArchive, setConfirmBatchArchive] = useState(false);
  const [pendingBatch, setPendingBatch] = useState<{ requestId: string; items: ProductBatchItem[] } | null>(null);
  const canManage = canManageCatalog(session.role);
  const activeProducts = products.filter((product) => product.isActive);
  const allVisibleSelected = canManage && activeProducts.length > 0 && activeProducts.every((product) => selectedIds.has(product.id));

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
        setSelectedIds(new Set());
        setPendingBatch(null);
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
      showToast("success", editor.id ? "Đã lưu thay đổi sản phẩm." : "Đã tạo sản phẩm mới (draft).");
    } catch (reason: unknown) {
      setSaveError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể lưu sản phẩm.", 0));
      showToast("error", reason instanceof AdminClientError ? reason.message : "Không thể lưu sản phẩm.");
    } finally {
      setSaving(false);
    }
  }

  async function archiveProduct(product: AdminProduct) {
    if (!canManage) return;
    setArchivingId(product.id);
    setSaveError(null);
    try {
      await mutateAdmin<{ product: AdminProduct }>(`/api/admin/products/${product.id}`, { method: "DELETE" });
      if (editor?.id === product.id) setEditor(null);
      setAttempt((value) => value + 1);
      showToast("success", `Đã ẩn sản phẩm “${product.name}”.`);
    } catch (reason: unknown) {
      setSaveError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể ẩn sản phẩm.", 0));
      showToast("error", reason instanceof AdminClientError ? reason.message : "Không thể ẩn sản phẩm.");
    } finally {
      setArchivingId(null);
    }
  }

  function toggleProduct(productId: number, checked: boolean) {
    if (!canManage) return;
    setPendingBatch(null);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(productId); else next.delete(productId);
      return next;
    });
  }

  function toggleAllVisible(checked: boolean) {
    if (!canManage) return;
    setPendingBatch(null);
    setSelectedIds(checked ? new Set(activeProducts.map((product) => product.id)) : new Set());
  }

  async function archiveSelectedProducts() {
    if (!canManage || selectedIds.size === 0) return;
    setBatchArchiving(true);
    try {
      let batch = pendingBatch;
      if (!batch) {
        const ids = [...selectedIds].sort((left, right) => left - right);
        const snapshot = await fetchAdmin<ProductBatchSnapshotResponse>(`/api/admin/products/batch?ids=${ids.join(",")}`);
        const revisions = new Map(snapshot.products.map((product) => [product.id, product.revision]));
        batch = { requestId: crypto.randomUUID(), items: ids.map((id) => ({ id, expectedRevision: revisions.get(id) ?? 1 })) };
        setPendingBatch(batch);
      }
      const result = await mutateAdmin<ProductBatchResult>("/api/admin/products/batch", {
        body: { requestId: batch.requestId, items: batch.items },
        method: "POST",
      });
      setConfirmBatchArchive(false);
      setSelectedIds(new Set());
      setPendingBatch(null);
      setAttempt((value) => value + 1);
      const skipped = result.skipped?.length ?? 0;
      const skipCounts = new Map<string, number>();
      for (const item of result.skipped ?? []) skipCounts.set(item.reason, (skipCounts.get(item.reason) ?? 0) + 1);
      const skipSummary = (Object.keys(productBatchSkipLabels) as ProductBatchSkipReason[])
        .map((reason) => {
          const count = skipCounts.get(reason) ?? 0;
          return count > 0 ? `${count} ${productBatchSkipLabels[reason]}` : null;
        })
        .filter((value): value is string => Boolean(value))
        .join(", ");
      showToast(
        skipped > 0 ? "error" : "success",
        `Đã ẩn ${result.changedCount} / ${result.selectedCount} sản phẩm.${result.replayed ? " Gửi lại an toàn theo cùng requestId." : ""}${skipSummary ? ` Chưa xử lý: ${skipSummary}. Hãy tải lại để xem trạng thái mới.` : ""}`,
      );
    } catch (reason: unknown) {
      const canRetrySameBatch = !(reason instanceof AdminClientError) || reason.status === 0 || reason.status === 502 || reason.status === 504;
      if (!canRetrySameBatch) setPendingBatch(null);
      showToast(
        "error",
        `${reason instanceof AdminClientError ? reason.message : "Không thể ẩn các sản phẩm đã chọn."}${canRetrySameBatch ? " Có thể bấm lại để gửi lại an toàn cùng yêu cầu." : ""}`,
      );
    } finally {
      setBatchArchiving(false);
    }
  }

  return (
    <div className="admin-content">
      <AdminPageHeading kicker="Danh mục / sản phẩm" title="Quản lý sản phẩm" subtitle="Tìm và kiểm tra trạng thái các sản phẩm private-label đang được quản lý trong catalog." stamp="DANH MỤC SẢN PHẨM" />
      <AdminProductImportPanel categories={categories} onImported={() => setAttempt((value) => value + 1)} role={session.role} />
      {editor ? <ProductEditor categories={categories} error={saveError} form={editor} onChange={setEditor} onCancel={() => { setEditor(null); setSaveError(null); }} onSubmit={submitProduct} saving={saving} /> : null}
      <form className="admin-toolbar" onSubmit={submitSearch}>
        <div className="admin-search-wrap">
          <label className="admin-label" htmlFor="product-search">Tìm theo tên, SKU hoặc slug</label>
          <Search aria-hidden="true" />
          <input className="admin-input has-icon" data-testid="input-product-search" id="product-search" onChange={(event) => setInputQuery(event.target.value)} placeholder="Ví dụ: bột ngũ cốc, SKU, slug..." value={inputQuery} />
        </div>
        <button className="admin-button admin-button-primary" data-testid="button-product-search" type="submit"><Search size={15} /> Tìm sản phẩm</button>
        {query ? <button className="admin-button admin-button-quiet" data-testid="button-product-clear-search" onClick={clearSearch} type="button">Xóa tìm kiếm</button> : null}
        {canManage ? <button className="admin-button admin-button-primary" data-testid="button-product-create" onClick={openCreate} type="button">Thêm sản phẩm</button> : null}
        <button
          className="admin-button admin-button-quiet"
          data-testid="button-open-category-panel"
          onClick={() => setCategoryPanelOpen(true)}
          type="button"
        >
          Quản lý danh mục
        </button>
        {canManage && selectedIds.size > 0 ? <><span aria-live="polite" className="admin-item-meta" data-testid="product-selection-count">Đã chọn {selectedIds.size}</span><button className="admin-button admin-button-danger" data-testid="button-product-batch-archive" disabled={batchArchiving} onClick={() => setConfirmBatchArchive(true)} type="button">{batchArchiving ? "Đang ẩn…" : "Ẩn đã chọn"}</button></> : null}
      </form>
      {error ? <AdminErrorState error={error} onRetry={() => setAttempt((value) => value + 1)} /> : loading ? <AdminLoadingTable /> : (
        <section className="admin-panel admin-table-panel" aria-labelledby="product-table-heading">
          <div className="admin-panel-heading" style={{ padding: "21px 21px 0" }}><div><h2 className="admin-panel-title" id="product-table-heading">Danh mục sản phẩm</h2><p className="admin-panel-caption">{query ? `Kết quả cho “${query}”` : "Sắp xếp theo cập nhật gần nhất"}</p></div><span className="admin-count">{total} bản ghi</span></div>
          {products.length === 0 ? <AdminEmptyState title={query ? "Không tìm thấy sản phẩm phù hợp" : "Chưa có sản phẩm trong catalog"} description={query ? "Thử một tên, SKU hoặc slug khác. Không có dữ liệu thay thế được hiển thị." : "API chưa trả về sản phẩm nào từ D1 catalog."} /> : (
            <>
              <div className="admin-table-scroll">
                <table className="admin-table">
                   <thead><tr>{canManage ? <th scope="col"><label className="admin-check"><input aria-label="Chọn tất cả sản phẩm trong trang" checked={allVisibleSelected} onChange={(event) => toggleAllVisible(event.target.checked)} type="checkbox" /><span>Chọn</span></label></th> : null}<th scope="col">Sản phẩm</th><th scope="col">Danh mục / SKU</th><th scope="col">Quy cách</th><th scope="col">MOQ / Giá từ</th><th scope="col">Trạng thái</th><th scope="col">Lead time</th><th scope="col">Cập nhật</th>{canManage ? <th scope="col">Thao tác</th> : null}</tr></thead>
                  <tbody>
                    {products.map((product) => (
                      <tr data-testid={`row-product-${product.id}`} key={product.id}>
                        {canManage ? <td><input aria-label={`Chọn sản phẩm ${product.name}`} checked={selectedIds.has(product.id)} disabled={!product.isActive || batchArchiving} onChange={(event) => toggleProduct(product.id, event.target.checked)} type="checkbox" /></td> : null}
                        <td>
                          <div className="admin-product-cell">
                            <span className="admin-thumb">
                              {product.imageUrl ? (
                                // R2 hostnames are runtime-configured and cannot be statically allow-listed.
                                // eslint-disable-next-line @next/next/no-img-element
                                <img alt={`Ảnh sản phẩm ${product.name}`} src={product.imageUrl} />
                              ) : <span>{getInitials(product.name)}</span>}
                            </span>
                            <div className="admin-item-name">{product.name}<div className="admin-item-meta">{product.slug}</div><div className="admin-item-desc">{product.shortDescription || "Chưa có mô tả ngắn"}</div></div>
                          </div>
                        </td>
                        <td><div>{product.categoryName || "Chưa phân loại"}</div><div className="admin-item-meta">SKU: {product.sku || "chưa có"}</div></td>
                        <td className="admin-mono">{product.variantCount ?? 0} quy cách</td>
                        <td>
                          <div>{product.minimumOrderQuantity ? `MOQ ${product.minimumOrderQuantity}` : "—"}</div>
                          <div className="admin-item-meta">{product.startingPrice ? `từ ${new Intl.NumberFormat("vi-VN").format(product.startingPrice)}đ` : "Chưa có giá"}</div>
                        </td>
                        <td><AdminStatusBadge kind={product.isActive && product.status === "published" ? "green" : product.status === "draft" || product.status === "review" ? "amber" : "neutral"} value={product.isActive ? statusLabelsVN[product.status as ProductFormState["status"]] ?? product.status : "Tạm ẩn"} /></td>
                        <td className="admin-mono">{product.leadTimeDays ? `${product.leadTimeDays} ngày` : "Chưa có"}</td>
                         <td className="admin-mono">{formatAdminDate(product.updatedAt)}</td>
                         {canManage ? <td>
                           <div className="admin-table-actions">
                             <button className="admin-button admin-button-quiet" data-testid={`button-product-edit-${product.id}`} onClick={() => openEdit(product)} type="button">Sửa</button>
                             {product.isActive ? <button className="admin-button admin-button-danger" data-testid={`button-product-archive-${product.id}`} disabled={archivingId === product.id} onClick={() => setConfirmArchive(product)} type="button">{archivingId === product.id ? "Đang ẩn" : "Ẩn"}</button> : null}
                           </div>
                         </td> : null}
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
      {confirmArchive ? (
        <AdminConfirmDialog
          message={`Ẩn sản phẩm “${confirmArchive.name}” khỏi storefront? Sản phẩm vẫn giữ nguyên dữ liệu và có thể bật hiển thị lại sau.`}
          confirmLabel="Ẩn sản phẩm"
          onConfirm={() => void archiveProduct(confirmArchive)}
          onDismiss={() => setConfirmArchive(null)}
          title="Ẩn sản phẩm?"
        />
      ) : null}
      {confirmBatchArchive ? <AdminConfirmDialog message={`Ẩn ${selectedIds.size} sản phẩm đã chọn khỏi storefront? Dữ liệu vẫn được giữ lại.`} confirmLabel="Ẩn sản phẩm đã chọn" onConfirm={() => void archiveSelectedProducts()} onDismiss={() => setConfirmBatchArchive(false)} title="Ẩn sản phẩm đã chọn?" /> : null}
      {categoryPanelOpen ? (
        <AdminModal labelledBy="admin-category-panel-title" onClose={() => setCategoryPanelOpen(false)} title="Quản lý danh mục" width="wide">
          <h2 hidden id="admin-category-panel-title">Quản lý danh mục</h2>
          <AdminCategoryPanel onChanged={() => setAttempt((value) => value + 1)} />
        </AdminModal>
      ) : null}
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
  const [pickerOpen, setPickerOpen] = useState(false);

  function update<K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) {
    onChange({ ...form, [key]: value });
  }

  return (
    <section className="admin-editor" aria-labelledby="product-editor-heading">
      <div className="admin-editor-heading">
        <div>
          <div className="admin-kicker">Catalog / chỉnh sửa</div>
          <h2 className="admin-panel-title" id="product-editor-heading">{form.id ? "Cập nhật sản phẩm" : "Tạo sản phẩm mới"}</h2>
          <p className="admin-panel-caption">Lưu dưới dạng draft trước; chỉ sản phẩm published và bật hiển thị mới được public read phục vụ storefront.</p>
        </div>
        <span className="admin-stamp">{form.id ? `Mã ${form.id}` : "BẢN GHI MỚI"}</span>
      </div>
      {error ? <p className="admin-editor-error" role="alert">{error.code ? `${error.code} · ` : ""}{error.message}</p> : null}
      <form onSubmit={onSubmit}>
        <div className="admin-editor-grid">
          <label className="admin-field">
            <span>Tên sản phẩm <b aria-hidden="true">*</b></span>
            <input className="admin-input" data-testid="input-product-name" onChange={(event) => update("name", event.target.value)} required value={form.name} />
          </label>
          <label className="admin-field">
            <span>Slug <b aria-hidden="true">*</b></span>
            <input className="admin-input admin-mono" data-testid="input-product-slug" onChange={(event) => update("slug", event.target.value)} required value={form.slug} />
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
            }} value={form.status}>
              <option value="draft">Bản nháp</option>
              <option value="review">Chờ duyệt</option>
              <option value="published">Đã xuất bản</option>
              <option value="archived">Lưu trữ</option>
            </select>
          </label>
          <label className="admin-field">
            <span>Lead time (ngày)</span>
            <input className="admin-input admin-mono" data-testid="input-product-lead-time" inputMode="numeric" min="0" onChange={(event) => update("leadTimeDays", event.target.value)} type="number" value={form.leadTimeDays} />
          </label>
          <label className="admin-field admin-field-wide">
            <span>Ảnh sản phẩm</span>
            <div className="admin-input-actions">
              <input className="admin-input" data-testid="input-product-image" onChange={(event) => update("imageUrl", event.target.value)} placeholder="/media/products/... hoặc https://..." value={form.imageUrl} />
              <button className="admin-button admin-button-quiet" onClick={() => setPickerOpen(true)} type="button">Chọn từ thư viện</button>
            </div>
            <span className="admin-image-preview">
              {form.imageUrl
                ? // eslint-disable-next-line @next/next/no-img-element
                  <img alt={`Xem trước ảnh ${form.name}`} src={form.imageUrl} />
                : <span className="admin-image-preview-fallback">Chưa có ảnh — dán đường dẫn, chọn từ thư viện hoặc upload ở panel bên dưới để xem trước tại đây.</span>}
            </span>
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
            <button className="admin-button admin-button-primary" data-testid="button-product-save" disabled={saving} type="submit">{saving ? "Đang lưu..." : "Lưu sản phẩm"}</button>
          </div>
        </div>
      </form>
      {form.id ? <AdminVariantPanel productId={form.id} /> : null}
      {form.id ? <AdminMediaPanel productId={form.id} /> : null}
    </section>
  );
}
