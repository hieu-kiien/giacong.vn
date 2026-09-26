"use client";

import { ArrowLeft, ExternalLink, Eye, EyeOff, FileText, FolderTree, ImageIcon, Search, Settings2, ShoppingCart, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useSearchParams } from "next/navigation";

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

function handleEditorTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
  const tabs = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? []);
  const currentIndex = tabs.indexOf(event.currentTarget);
  if (currentIndex < 0) return;

  let nextIndex = currentIndex;
  if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
  else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
  else if (event.key === "Home") nextIndex = 0;
  else if (event.key === "End") nextIndex = tabs.length - 1;
  else return;

  event.preventDefault();
  tabs[nextIndex]?.focus();
  tabs[nextIndex]?.click();
}
import { AdminCategoryPanel } from "@/components/admin/AdminCategoryPanel";
import { AdminConfirmDialog } from "@/components/admin/AdminDialog";
import { useAdminUnsaved, useRegisterAdminUnsaved } from "@/components/admin/AdminUnsavedGuard";
import { AdminMediaPickerModal } from "@/components/admin/AdminMediaPickerModal";
import { AdminEmptyState, AdminErrorState, AdminLoadingTable, AdminPageHeading, AdminPagination, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { AdminModal } from "@/components/admin/AdminDialog";
import { AdminProductImportPanel } from "@/components/admin/AdminProductImportPanel";
import { AdminVariantPanel } from "@/components/admin/AdminVariantPanel";
import { AdminProductGalleryManager } from "@/components/admin/AdminProductGalleryManager";
import { AdminProductTechSpecs } from "@/components/admin/AdminProductTechSpecs";
import { AdminProductSeoPreview } from "@/components/admin/AdminProductSeoPreview";
import { useAdminSession } from "@/components/admin/AdminShell";
import { useAdminToast } from "@/components/admin/AdminToast";
import { AdminClientError, fetchAdmin, formatAdminDate, getInitials, mutateAdmin, type AdminCategory, type AdminProduct } from "@/lib/admin-client";
import { canManageCatalog } from "@/lib/admin-permissions";
import { buildAdminProductPayload } from "@/lib/admin-product-form";
import { parseAdminProductPayload } from "@/lib/admin-product-input";

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
  revision?: number;
  shortDescription: string;
  sku: string;
  slug: string;
  slugFollowsName?: boolean;
  soldCount?: number;
  status: "archived" | "draft" | "published" | "review";
};

const productFieldLabels: Record<string, { label: string; tab: "general" | "media"; testId: string }> = {
  name: { label: "Tên sản phẩm", tab: "general", testId: "input-product-name" },
  slug: { label: "Đường dẫn", tab: "general", testId: "input-product-slug" },
  shortDescription: { label: "Mô tả ngắn", tab: "general", testId: "input-product-short-description" },
  description: { label: "Mô tả chi tiết", tab: "general", testId: "input-product-description" },
  status: { label: "Trạng thái", tab: "general", testId: "select-product-status" },
  isActive: { label: "Hiển thị sản phẩm", tab: "general", testId: "checkbox-product-active" },
  categoryId: { label: "Danh mục", tab: "general", testId: "select-product-category" },
  sku: { label: "Mã hàng", tab: "general", testId: "input-product-sku" },
  leadTimeDays: { label: "Thời gian sản xuất", tab: "general", testId: "input-product-lead-time" },
  imageUrl: { label: "Ảnh chính", tab: "media", testId: "input-product-image" },
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

function isProductEditorDirty(editor: ProductFormState | null, snapshot: ProductFormState | null): boolean {
  if (!editor) return false;
  if (!snapshot) return true;
  return (
    editor.categoryId !== snapshot.categoryId ||
    editor.description !== snapshot.description ||
    editor.id !== snapshot.id ||
    editor.imageUrl !== snapshot.imageUrl ||
    editor.isActive !== snapshot.isActive ||
    editor.leadTimeDays !== snapshot.leadTimeDays ||
    editor.name !== snapshot.name ||
    editor.shortDescription !== snapshot.shortDescription ||
    editor.sku !== snapshot.sku ||
    editor.slug !== snapshot.slug ||
    editor.status !== snapshot.status
  );
}

function toProductForm(product: AdminProduct): ProductFormState {
  return {
    categoryId: product.categoryId ? String(product.categoryId) : "",
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
    soldCount: product.soldCount ?? 0,
    status: product.status as ProductFormState["status"],
  };
}

export default function AdminProductsPage() {
  const session = useAdminSession();
  const { showToast } = useAdminToast();
  const searchParams = useSearchParams();
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
  const [editorSnapshot, setEditorSnapshot] = useState<ProductFormState | null>(null);
  const [pendingRequest, setPendingRequest] = useState<{ form: ProductFormState | null } | null>(null);
  const saveInFlightRef = useRef(false);
  const productRequestRef = useRef<{ key: string; requestId: string } | null>(null);
  const editorGenerationRef = useRef(0);
  const [saveError, setSaveError] = useState<AdminClientError | null>(null);
  const [saving, setSaving] = useState(false);
  const [archivingId, setArchivingId] = useState<number | null>(null);
  const [activatingId, setActivatingId] = useState<number | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<AdminProduct | null>(null);
  const [categoryPanelOpen, setCategoryPanelOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchArchiving, setBatchArchiving] = useState(false);
  const [batchActivating, setBatchActivating] = useState(false);
  const [batchCategoryModal, setBatchCategoryModal] = useState(false);
  const [batchTargetCategory, setBatchTargetCategory] = useState<number | null>(null);
  const [batchCategoryLoading, setBatchCategoryLoading] = useState(false);
  const [confirmBatchArchive, setConfirmBatchArchive] = useState(false);
  const [pendingBatch, setPendingBatch] = useState<{ requestId: string; items: ProductBatchItem[] } | null>(null);
  const [batchEditModal, setBatchEditModal] = useState(false);
  const [batchEditLoading, setBatchEditLoading] = useState(false);
  const [batchEditStatus, setBatchEditStatus] = useState<"archived" | "draft" | "keep" | "published" | "review">("keep");
  const [batchEditVisibility, setBatchEditVisibility] = useState<"active" | "inactive" | "keep">("keep");
  const [batchEditCategory, setBatchEditCategory] = useState<number | "keep" | "none">("keep");
  const [batchEditLeadTimeAction, setBatchEditLeadTimeAction] = useState<"clear" | "keep" | "set">("keep");
  const [batchEditLeadTimeValue, setBatchEditLeadTimeValue] = useState("");
  const editQuery = searchParams.get("edit");
  const createQuery = searchParams.get("create");
  const deepLinkKey = editQuery ? `edit:${editQuery}` : createQuery === "1" ? "create" : null;
  const handledDeepLinkRef = useRef<string | null>(null);
  const canManage = canManageCatalog(session.role);
  const statusParam = searchParams.get("status");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "draft" | "hidden">(() => {
    if (statusParam === "draft") return "draft";
    if (statusParam === "active") return "active";
    if (statusParam === "hidden") return "hidden";
    return "all";
  });

  useEffect(() => {
    const sp = searchParams.get("status");
    if (sp === "draft" || sp === "active" || sp === "hidden") {
      setStatusFilter(sp);
    } else {
      setStatusFilter("all");
    }
  }, [searchParams]);

  function updateStatusFilter(nextStatus: "all" | "active" | "draft" | "hidden") {
    if (nextStatus === statusFilter) return;

    const url = new URL(window.location.href);
    if (nextStatus === "all") url.searchParams.delete("status");
    else url.searchParams.set("status", nextStatus);
    url.searchParams.delete("page");
    window.history.pushState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    setStatusFilter(nextStatus);
    setPage(1);
  }

  const filteredProducts = useMemo(() => {
    if (statusFilter === "active") return products.filter((p) => p.isActive && p.status === "published");
    if (statusFilter === "draft") return products.filter((p) => p.status === "draft" || p.status === "review");
    if (statusFilter === "hidden") return products.filter((p) => !p.isActive || p.status === "archived");
    return products;
  }, [products, statusFilter]);
  const selectedStatusLabel = statusFilter === "active" ? "Đang hiển thị" : statusFilter === "draft" ? "Bản nháp / Chờ duyệt" : statusFilter === "hidden" ? "Tạm ẩn" : "";
  const activeProducts = filteredProducts.filter((product) => product.isActive);
  const allVisibleSelected = canManage && filteredProducts.length > 0 && filteredProducts.every((product) => selectedIds.has(product.id));
  const { isDirty: aggregateIsDirty, revision: unsavedRevision } = useAdminUnsaved();
  const isUnsavedDirty = useCallback(() => isProductEditorDirty(editor, editorSnapshot), [editor, editorSnapshot]);
  const hasUnsavedChanges = useCallback(() => {
    if (isProductEditorDirty(editor, editorSnapshot)) return true;
    try {
      return aggregateIsDirty();
    } catch {
      return false;
    }
  }, [aggregateIsDirty, editor, editorSnapshot]);
  useRegisterAdminUnsaved(isUnsavedDirty, saving);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (query) params.set("query", query);
    if (statusFilter !== "all") params.set("status", statusFilter);
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
  }, [session.subject, page, query, statusFilter, attempt]);

  useEffect(() => {
    if (!hasUnsavedChanges()) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedChanges, unsavedRevision]);

  const applyEditorForm = useCallback((form: ProductFormState | null, updateHistory = true) => {
    editorGenerationRef.current += 1;
    productRequestRef.current = null;
    handledDeepLinkRef.current = form ? (form.id ? `edit:${form.id}` : "create") : null;
    setEditor(form ? { ...form } : null);
    setEditorSnapshot(form ? { ...form } : null);
    setSaveError(null);
    setPendingRequest(null);
    if (updateHistory && typeof window !== "undefined") {
      const nextHref = form ? (form.id ? `/admin/san-pham?edit=${form.id}` : "/admin/san-pham?create=1") : "/admin/san-pham";
      const currentHref = `${window.location.pathname}${window.location.search}`;
      if (currentHref !== nextHref) {
        const state = form ? (form.id ? { edit: form.id } : { create: "1" }) : null;
        window.history.pushState(state, "", nextHref);
      }
    }
  }, []);

  function handleEditorChange(form: ProductFormState) {
    productRequestRef.current = null;
    setEditor(form);
  }

  const requestOpenEditor = useCallback((form: ProductFormState) => {
    if (saving || saveInFlightRef.current) return;
    if (hasUnsavedChanges()) {
      setPendingRequest({ form: { ...form } });
      return;
    }
    applyEditorForm(form);
  }, [applyEditorForm, hasUnsavedChanges, saving]);

  function requestCloseEditor() {
    if (saving || saveInFlightRef.current) return;
    if (hasUnsavedChanges()) {
      setPendingRequest({ form: null });
      return;
    }
    applyEditorForm(null);
  }

  function confirmPendingEditor() {
    const pending = pendingRequest;
    if (!pending) return;
    applyEditorForm(pending.form);
  }

  function cancelPendingEditor() {
    setPendingRequest(null);
  }

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

  const openCreate = useCallback(() => {
    requestOpenEditor({ ...emptyProductForm });
  }, [requestOpenEditor]);

  function openEdit(product: AdminProduct) {
    requestOpenEditor(toProductForm(product));
  }

  useEffect(() => {
    if (!canManage || loading || !deepLinkKey || handledDeepLinkRef.current === deepLinkKey) return;
    handledDeepLinkRef.current = deepLinkKey;
    if (deepLinkKey === "create") {
      openCreate();
      return;
    }

    const id = Number(editQuery);
    if (!Number.isSafeInteger(id) || id <= 0) {
      showToast("error", "Không thể tải sản phẩm được yêu cầu.");
      return;
    }

    void fetchAdmin<{ product: AdminProduct }>(`/api/admin/products/${id}`)
      .then((result) => requestOpenEditor(toProductForm(result.product)))
      .catch((reason: unknown) => {
        showToast("error", reason instanceof AdminClientError ? reason.message : "Không thể tải sản phẩm được yêu cầu.");
      });
  }, [canManage, deepLinkKey, editQuery, loading, openCreate, requestOpenEditor, showToast]);

  useEffect(() => {
    function onPopState() {
      const url = new URL(window.location.href);
      const edit = url.searchParams.get("edit");
      const create = url.searchParams.get("create");
      handledDeepLinkRef.current = edit ? `edit:${edit}` : create === "1" ? "create" : null;
      if (edit) {
        const id = Number(edit);
        if (Number.isSafeInteger(id) && id > 0) {
          void fetchAdmin<{ product: AdminProduct }>(`/api/admin/products/${id}`)
            .then((result) => applyEditorForm(toProductForm(result.product), false))
            .catch(() => {});
        }
      } else if (create === "1") {
        applyEditorForm({ ...emptyProductForm }, false);
      } else {
        applyEditorForm(null, false);
      }
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [applyEditorForm]);

  async function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || saving || saveInFlightRef.current) return;
    const generationAtSubmit = editorGenerationRef.current;
    const requestId = crypto.randomUUID();
    const payload = {
      ...(editor.id ? { revision: editor.revision } : {}),
      ...buildAdminProductPayload(editor, requestId),
    };
    const parsed = parseAdminProductPayload(payload);
    if (!parsed.input) {
      const validationError = new AdminClientError("Dữ liệu sản phẩm chưa hợp lệ.", 422, "VALIDATION_ERROR", parsed.fieldErrors);
      setSaveError(validationError);
      showToast("error", validationError.message);
      return;
    }
    saveInFlightRef.current = true;
    setSaving(true);
    setSaveError(null);
    const requestKey = JSON.stringify({ editor, method: editor.id ? "PATCH" : "POST" });
    const effectiveRequestId = productRequestRef.current?.key === requestKey
      ? productRequestRef.current.requestId
      : requestId;
    productRequestRef.current = { key: requestKey, requestId: effectiveRequestId };
    const mutationPayload = { ...payload, requestId: effectiveRequestId };
    try {
      const result = await mutateAdmin<{ product: AdminProduct }>(
        editor.id ? `/api/admin/products/${editor.id}` : "/api/admin/products",
        { body: mutationPayload, method: editor.id ? "PATCH" : "POST" },
      );
      if (editorGenerationRef.current !== generationAtSubmit) return;
      productRequestRef.current = null;
      const updatedForm = { ...toProductForm(result.product), slugFollowsName: editor.slugFollowsName };
      setEditor(updatedForm);
      setEditorSnapshot(updatedForm);
      setPendingRequest(null);
      setAttempt((value) => value + 1);
      showToast("success", editor.id ? "Đã lưu thay đổi sản phẩm thành công." : "Đã tạo sản phẩm mới thành công.");
    } catch (reason: unknown) {
      if (editorGenerationRef.current !== generationAtSubmit) return;
      setSaveError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể lưu sản phẩm.", 0));
      showToast("error", reason instanceof AdminClientError ? reason.message : "Không thể lưu sản phẩm.");
    } finally {
      saveInFlightRef.current = false;
      if (editorGenerationRef.current === generationAtSubmit) setSaving(false);
      else setSaving(false);
    }
  }

  async function archiveProduct(product: AdminProduct) {
    if (!canManage) return;
    setArchivingId(product.id);
    setSaveError(null);
    try {
      await mutateAdmin<{ product: AdminProduct }>(`/api/admin/products/${product.id}`, {
        body: { requestId: crypto.randomUUID(), revision: product.revision },
        method: "DELETE",
      });
      if (editor?.id === product.id) {
        editorGenerationRef.current += 1;
        productRequestRef.current = null;
        setEditor(null);
        setEditorSnapshot(null);
        setPendingRequest(null);
      }
      setAttempt((value) => value + 1);
      showToast("success", `Đã ẩn sản phẩm “${product.name}”.`);
    } catch (reason: unknown) {
      setSaveError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể ẩn sản phẩm.", 0));
      showToast("error", reason instanceof AdminClientError ? reason.message : "Không thể ẩn sản phẩm.");
    } finally {
      setArchivingId(null);
    }
  }

  async function unhideProduct(product: AdminProduct) {
    if (!canManage) return;
    setActivatingId(product.id);
    setSaveError(null);
    try {
      const targetStatus: ProductFormState["status"] = product.status === "archived" ? "draft" : (product.status as ProductFormState["status"]);
      await mutateAdmin<{ product: AdminProduct }>(`/api/admin/products/${product.id}`, {
        body: {
          categoryId: product.categoryId ?? null,
          description: product.description,
          imageUrl: product.imageUrl,
          isActive: true,
          leadTimeDays: product.leadTimeDays,
          name: product.name,
          requestId: crypto.randomUUID(),
          revision: product.revision,
          shortDescription: product.shortDescription,
          sku: product.sku,
          slug: product.slug,
          status: targetStatus,
        },
        method: "PATCH",
      });
      if (editor?.id === product.id) {
        setEditor((current) => (current ? { ...current, isActive: true, status: targetStatus } : null));
        setEditorSnapshot((current) => (current ? { ...current, isActive: true, status: targetStatus } : null));
      }
      setAttempt((value) => value + 1);
      showToast("success", `Đã bật hiển thị cho sản phẩm “${product.name}”.`);
    } catch (reason: unknown) {
      setSaveError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể hiển thị lại sản phẩm.", 0));
      showToast("error", reason instanceof AdminClientError ? reason.message : "Không thể hiển thị lại sản phẩm.");
    } finally {
      setActivatingId(null);
    }
  }

  async function activateSelectedProducts() {
    if (!canManage || selectedIds.size === 0) return;
    setBatchActivating(true);
    let successCount = 0;
    let failCount = 0;
    const selectedProducts = products.filter((p) => selectedIds.has(p.id));
    for (const product of selectedProducts) {
      try {
        const targetStatus: ProductFormState["status"] = product.status === "archived" ? "draft" : (product.status as ProductFormState["status"]);
        await mutateAdmin<{ product: AdminProduct }>(`/api/admin/products/${product.id}`, {
          body: {
            categoryId: product.categoryId ?? null,
            description: product.description,
            imageUrl: product.imageUrl,
            isActive: true,
            leadTimeDays: product.leadTimeDays,
            name: product.name,
            requestId: crypto.randomUUID(),
            revision: product.revision,
            shortDescription: product.shortDescription,
            sku: product.sku,
            slug: product.slug,
            status: targetStatus,
          },
          method: "PATCH",
        });
        successCount += 1;
      } catch {
        failCount += 1;
      }
    }
    setSelectedIds(new Set());
    setAttempt((value) => value + 1);
    setBatchActivating(false);
    if (failCount > 0) {
      showToast("error", `Đã bật hiển thị ${successCount} sản phẩm (${failCount} sản phẩm lỗi).`);
    } else {
      showToast("success", `Đã bật hiển thị cho ${successCount} sản phẩm đã chọn.`);
    }
  }

  async function applyBatchCategory(targetCatId: number | null) {
    if (!canManage || selectedIds.size === 0) return;
    setBatchCategoryLoading(true);
    let successCount = 0;
    let failCount = 0;
    const selectedProducts = products.filter((p) => selectedIds.has(p.id));
    for (const product of selectedProducts) {
      try {
        await mutateAdmin<{ product: AdminProduct }>(`/api/admin/products/${product.id}`, {
          body: {
            categoryId: targetCatId,
            description: product.description,
            imageUrl: product.imageUrl,
            isActive: product.isActive,
            leadTimeDays: product.leadTimeDays,
            name: product.name,
            requestId: crypto.randomUUID(),
            revision: product.revision,
            shortDescription: product.shortDescription,
            sku: product.sku,
            slug: product.slug,
            status: product.status,
          },
          method: "PATCH",
        });
        successCount += 1;
      } catch {
        failCount += 1;
      }
    }
    setSelectedIds(new Set());
    setBatchCategoryModal(false);
    setAttempt((value) => value + 1);
    setBatchCategoryLoading(false);
    if (failCount > 0) {
      showToast("error", `Đã đổi danh mục cho ${successCount} sản phẩm (${failCount} lỗi).`);
    } else {
      showToast("success", `Đã đổi danh mục cho ${successCount} sản phẩm đã chọn.`);
    }
  }

  async function applyComprehensiveBatchEdit() {
    if (!canManage || selectedIds.size === 0) return;
    if (
      batchEditStatus === "keep" &&
      batchEditVisibility === "keep" &&
      batchEditCategory === "keep" &&
      batchEditLeadTimeAction === "keep"
    ) {
      showToast("info", "Chưa có thiết lập nào được chọn để thay đổi hàng loạt.");
      return;
    }
    setBatchEditLoading(true);
    let successCount = 0;
    let failCount = 0;
    const selectedProducts = products.filter((p) => selectedIds.has(p.id));
    for (const product of selectedProducts) {
      try {
        const nextStatus = batchEditStatus !== "keep" ? batchEditStatus : product.status;
        let nextIsActive = product.isActive;
        if (batchEditVisibility === "active") nextIsActive = true;
        else if (batchEditVisibility === "inactive") nextIsActive = false;
        else if (batchEditStatus === "published") nextIsActive = true;
        else if (batchEditStatus === "archived") nextIsActive = false;

        let nextCategoryId: number | null = product.categoryId;
        if (batchEditCategory === "none") nextCategoryId = null;
        else if (typeof batchEditCategory === "number") nextCategoryId = batchEditCategory;

        let nextLeadTimeDays: number | null = product.leadTimeDays;
        if (batchEditLeadTimeAction === "clear") nextLeadTimeDays = null;
        else if (batchEditLeadTimeAction === "set") {
          const val = Number(batchEditLeadTimeValue);
          nextLeadTimeDays = Number.isSafeInteger(val) && val >= 0 ? val : product.leadTimeDays;
        }

        await mutateAdmin<{ product: AdminProduct }>(`/api/admin/products/${product.id}`, {
          body: {
            categoryId: nextCategoryId,
            description: product.description,
            imageUrl: product.imageUrl,
            isActive: nextIsActive,
            leadTimeDays: nextLeadTimeDays,
            name: product.name,
            requestId: crypto.randomUUID(),
            revision: product.revision,
            shortDescription: product.shortDescription,
            sku: product.sku,
            slug: product.slug,
            status: nextStatus,
          },
          method: "PATCH",
        });
        successCount += 1;
      } catch {
        failCount += 1;
      }
    }
    setSelectedIds(new Set());
    setBatchEditModal(false);
    setAttempt((value) => value + 1);
    setBatchEditLoading(false);
    if (failCount > 0) {
      showToast("error", `Đã cập nhật ${successCount} sản phẩm (${failCount} lỗi).`);
    } else {
      showToast("success", `Đã cập nhật hàng loạt thành công cho ${successCount} sản phẩm.`);
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
    setSelectedIds(checked ? new Set(filteredProducts.map((product) => product.id)) : new Set());
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
      {editor ? (
        <ProductEditor
          categories={categories}
          error={saveError}
          form={editor}
          isDirty={hasUnsavedChanges()}
          onCancel={requestCloseEditor}
          onChange={handleEditorChange}
          onOpenCategoryPanel={() => setCategoryPanelOpen(true)}
          onSubmit={submitProduct}
          saving={saving}
        />
      ) : (
        <>
          <AdminPageHeading kicker="Hàng hóa / sản phẩm" title="Quản lý sản phẩm" subtitle="Quản lý thông tin, quy cách, giá và trạng thái hiển thị trên website." />
          <form className="admin-toolbar" onSubmit={submitSearch}>
            <div className="admin-search-wrap">
              <label className="admin-label" htmlFor="product-search">Tìm theo tên, mã hàng hoặc đường dẫn</label>
              <Search aria-hidden="true" />
              <input className="admin-input has-icon" data-testid="input-product-search" id="product-search" onChange={(event) => setInputQuery(event.target.value)} placeholder="Ví dụ: bột ngũ cốc, mã hàng, đường dẫn..." value={inputQuery} />
            </div>
            <button className="admin-button admin-button-primary" data-testid="button-product-search" type="submit"><Search size={15} /> Tìm sản phẩm</button>
            {query ? <button className="admin-button admin-button-quiet" data-testid="button-product-clear-search" onClick={clearSearch} type="button">Xóa tìm kiếm</button> : null}
            {canManage ? <button className="admin-button admin-button-primary" data-testid="button-product-create" disabled={saving} onClick={openCreate} type="button">Thêm sản phẩm</button> : null}
            <button
              className="admin-button admin-button-quiet"
              data-testid="button-open-category-panel"
              onClick={() => setCategoryPanelOpen(true)}
              type="button"
            >
              Quản lý danh mục
            </button>
            {canManage ? (
              <button
                className="admin-button admin-button-quiet"
                data-testid="button-open-csv-import"
                onClick={() => setImportModalOpen(true)}
                type="button"
              >
                Nhập CSV
              </button>
            ) : null}
            {canManage && selectedIds.size > 0 ? (
              <div className="admin-bulk-toolbar" style={{ alignItems: "center", background: "#f0f4ee", border: "1px solid #d5e2c6", borderRadius: 8, display: "flex", flexWrap: "wrap", gap: 8, padding: "6px 12px", width: "100%" }}>
                <span aria-live="polite" className="admin-badge admin-badge-green" data-testid="product-selection-count" style={{ fontWeight: 700 }}>
                  Đã chọn {selectedIds.size}
                </span>
                <button
                  className="admin-button admin-button-primary"
                  data-testid="button-product-batch-edit-open"
                  disabled={batchArchiving || batchActivating || batchCategoryLoading || batchEditLoading}
                  onClick={() => setBatchEditModal(true)}
                  style={{ alignItems: "center", display: "inline-flex", gap: 5, fontSize: 12, minHeight: 30, padding: "0 10px" }}
                  type="button"
                >
                  <Settings2 size={13} /> Chỉnh sửa hàng loạt
                </button>
                <button
                  className="admin-button admin-button-quiet"
                  data-testid="button-product-batch-activate"
                  disabled={batchArchiving || batchActivating}
                  onClick={() => void activateSelectedProducts()}
                  style={{ alignItems: "center", display: "inline-flex", gap: 5, fontSize: 12, minHeight: 30, padding: "0 10px" }}
                  type="button"
                >
                  <Eye size={13} /> {batchActivating ? "Đang hiện…" : "Hiện đã chọn"}
                </button>
                <button
                  className="admin-button admin-button-danger"
                  data-testid="button-product-batch-archive"
                  disabled={batchArchiving || batchActivating}
                  onClick={() => setConfirmBatchArchive(true)}
                  style={{ alignItems: "center", display: "inline-flex", gap: 5, fontSize: 12, minHeight: 30, padding: "0 10px" }}
                  type="button"
                >
                  <EyeOff size={13} /> {batchArchiving ? "Đang ẩn…" : "Ẩn đã chọn"}
                </button>
                <button
                  className="admin-button admin-button-quiet"
                  data-testid="button-product-batch-category-open"
                  disabled={batchArchiving || batchActivating}
                  onClick={() => setBatchCategoryModal(true)}
                  style={{ alignItems: "center", display: "inline-flex", gap: 5, fontSize: 12, minHeight: 30, padding: "0 10px" }}
                  type="button"
                >
                  <FolderTree size={13} /> Đổi danh mục
                </button>
                <button
                  className="admin-button admin-button-quiet"
                  onClick={() => setSelectedIds(new Set())}
                  style={{ fontSize: 12, minHeight: 30, padding: "0 8px" }}
                  type="button"
                >
                  Bỏ chọn
                </button>
              </div>
            ) : null}
          </form>
          {error ? <AdminErrorState error={error} onRetry={() => setAttempt((value) => value + 1)} /> : loading ? <AdminLoadingTable /> : (
            <section className="admin-panel admin-table-panel" aria-labelledby="product-table-heading">
              <div className="admin-panel-heading" style={{ padding: "21px 21px 12px" }}><div><h2 className="admin-panel-title" id="product-table-heading">Sản phẩm</h2><p className="admin-panel-caption">{query ? `Kết quả cho “${query}”${selectedStatusLabel ? ` · ${selectedStatusLabel}` : ""}` : selectedStatusLabel ? `Đang lọc: ${selectedStatusLabel}` : "Sắp xếp theo cập nhật gần nhất"}</p></div><span aria-live="polite" className="admin-count">{total} kết quả</span></div>
              <div style={{ padding: "0 21px" }}>
                <div className="admin-filter-tabs" role="group" aria-label="Lọc sản phẩm theo trạng thái">
                  <button
                    aria-pressed={statusFilter === "all"}
                    className={`admin-filter-tab${statusFilter === "all" ? " is-active" : ""}`}
                    onClick={() => updateStatusFilter("all")}
                    type="button"
                  >
                    Tất cả
                  </button>
                  <button
                    aria-pressed={statusFilter === "active"}
                    className={`admin-filter-tab${statusFilter === "active" ? " is-active" : ""}`}
                    onClick={() => updateStatusFilter("active")}
                    type="button"
                  >
                    Đang hiển thị
                  </button>
                  <button
                    aria-pressed={statusFilter === "draft"}
                    className={`admin-filter-tab${statusFilter === "draft" ? " is-active" : ""}`}
                    onClick={() => updateStatusFilter("draft")}
                    type="button"
                  >
                    Bản nháp / Chờ duyệt
                  </button>
                  <button
                    aria-pressed={statusFilter === "hidden"}
                    className={`admin-filter-tab${statusFilter === "hidden" ? " is-active" : ""}`}
                    onClick={() => updateStatusFilter("hidden")}
                    type="button"
                  >
                    Tạm ẩn
                  </button>
                </div>
              </div>
              {products.length === 0 ? <AdminEmptyState title={query ? "Không tìm thấy sản phẩm phù hợp" : statusFilter !== "all" ? "Không có sản phẩm ở trạng thái này" : "Chưa có sản phẩm"} description={query ? "Thử một tên, mã hàng hoặc đường dẫn khác." : statusFilter !== "all" ? "Thử chọn bộ lọc khác để xem thêm sản phẩm." : "Máy chủ chưa trả về sản phẩm nào."} /> : (
                <>
                  <p className="admin-table-scroll-hint">Kéo ngang bảng để xem đầy đủ thông tin và thao tác.</p>
                  <div className="admin-table-scroll">
                    <table className="admin-table admin-product-table">
                       <thead><tr>{canManage ? <th scope="col"><label className="admin-check"><input aria-label="Chọn tất cả sản phẩm trong trang" checked={allVisibleSelected} onChange={(event) => toggleAllVisible(event.target.checked)} type="checkbox" /><span>Chọn</span></label></th> : null}<th scope="col">Sản phẩm</th><th scope="col">Danh mục / Mã hàng</th><th scope="col">Quy cách</th><th scope="col">Tối thiểu / Giá từ</th><th scope="col">Đã bán</th><th scope="col">Trạng thái</th><th scope="col">Thời gian làm hàng</th><th scope="col">Cập nhật</th>{canManage ? <th scope="col">Thao tác</th> : null}</tr></thead>
                      <tbody>
                        {filteredProducts.map((product) => (
                          <tr data-testid={`row-product-${product.id}`} key={product.id}>
                            {canManage ? <td className="admin-product-select"><input aria-label={`Chọn sản phẩm ${product.name}`} checked={selectedIds.has(product.id)} disabled={batchArchiving || batchActivating} onChange={(event) => toggleProduct(product.id, event.target.checked)} type="checkbox" /></td> : null}
                            <td className="admin-product-summary">
                              <div className="admin-product-cell">
                                <button
                                  className="admin-thumb admin-thumb-clickable"
                                  disabled={saving}
                                  onClick={() => openEdit(product)}
                                  title={`Sửa sản phẩm ${product.name}`}
                                  type="button"
                                >
                                  {product.imageUrl ? (
                                    // R2 hostnames are runtime-configured and cannot be statically allow-listed.
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img alt={`Ảnh sản phẩm ${product.name}`} src={product.imageUrl} />
                                  ) : <span>{getInitials(product.name)}</span>}
                                </button>
                                <div className="admin-item-name">
                                  <button
                                    className="admin-product-name-btn"
                                    data-testid={`link-product-edit-${product.id}`}
                                    disabled={saving}
                                    onClick={() => openEdit(product)}
                                    title={`Sửa sản phẩm ${product.name}`}
                                    type="button"
                                  >
                                    {product.name}
                                  </button>
                                  <div className="admin-item-meta" style={{ alignItems: "center", display: "inline-flex", gap: 5 }}>
                                    <span>{product.slug}</span>
                                    {product.slug && product.isActive ? (
                                      <a
                                        className="admin-external-link-btn"
                                        href={`/san-pham/${product.slug}/`}
                                        onClick={(event) => event.stopPropagation()}
                                        rel="noreferrer"
                                        target="_blank"
                                        title="Xem trang sản phẩm trên website"
                                      >
                                        <ExternalLink size={12} />
                                      </a>
                                    ) : null}
                                  </div>
                                  <div className="admin-item-desc">{product.shortDescription || "Chưa có mô tả ngắn"}</div>
                                </div>
                              </div>
                            </td>
                            <td data-label="Danh mục / Mã hàng"><div>{product.categoryName || "Chưa phân loại"}</div><div className="admin-item-meta">SKU: {product.sku || "chưa có"}</div></td>
                            <td data-label="Quy cách" className="admin-mono">{product.variantCount ?? 0} quy cách</td>
                            <td data-label="Tối thiểu / Giá từ" className="admin-product-price">
                              <div>{product.minimumOrderQuantity ? `Tối thiểu ${product.minimumOrderQuantity}` : "—"}</div>
                              <div className="admin-item-meta">{product.startingPrice ? `từ ${new Intl.NumberFormat("vi-VN").format(product.startingPrice)}đ` : "Chưa có giá"}</div>
                            </td>
                            <td data-label="Đã bán" className="admin-mono" style={{ whiteSpace: "nowrap" }}>
                              <span title={`Đã có ${product.soldCount ?? 0} sản phẩm/lượt đặt`}>
                                <strong>{new Intl.NumberFormat("vi-VN").format(product.soldCount ?? 0)}</strong> đã bán
                              </span>
                            </td>
                            <td data-label="Trạng thái" className="admin-product-state"><AdminStatusBadge kind={product.isActive && product.status === "published" ? "green" : product.status === "draft" || product.status === "review" ? "amber" : "neutral"} value={product.status === "draft" || product.status === "review" || product.status === "archived" ? statusLabelsVN[product.status as ProductFormState["status"]] : product.isActive ? "Đang hiển thị" : "Đã đăng · Tạm ẩn"} /></td>
                            <td data-label="Thời gian làm hàng" className="admin-mono">{product.leadTimeDays ? `${product.leadTimeDays} ngày` : "Chưa có"}</td>
                            <td data-label="Cập nhật" className="admin-mono">{formatAdminDate(product.updatedAt)}</td>
                              {canManage ? <td className="admin-sticky-actions">
                                <div className="admin-table-actions">
                                  <button className="admin-button admin-button-quiet" data-testid={`button-product-edit-${product.id}`} disabled={saving} onClick={() => openEdit(product)} type="button">Sửa</button>
                                  {product.isActive ? (
                                    <button className="admin-button admin-button-danger" data-testid={`button-product-archive-${product.id}`} disabled={archivingId === product.id || activatingId === product.id} onClick={() => setConfirmArchive(product)} type="button">
                                      {archivingId === product.id ? "Đang ẩn" : "Ẩn"}
                                    </button>
                                  ) : (
                                    <button className="admin-button admin-button-primary" data-testid={`button-product-activate-${product.id}`} disabled={activatingId === product.id || archivingId === product.id} onClick={() => void unhideProduct(product)} style={{ fontSize: 12, minHeight: 28, padding: "0 8px" }} type="button">
                                      {activatingId === product.id ? "Đang hiện…" : "Hiện"}
                                    </button>
                                  )}
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
        </>
      )}
      {confirmArchive ? (
        <AdminConfirmDialog
          message={`Ẩn sản phẩm “${confirmArchive.name}” khỏi trang web? Sản phẩm vẫn giữ nguyên dữ liệu và có thể bật hiển thị lại sau.`}
          confirmLabel="Ẩn sản phẩm"
          onConfirm={() => void archiveProduct(confirmArchive)}
          onDismiss={() => setConfirmArchive(null)}
          title="Ẩn sản phẩm?"
        />
      ) : null}
      {confirmBatchArchive ? <AdminConfirmDialog message={`Ẩn ${selectedIds.size} sản phẩm đã chọn khỏi trang web? Dữ liệu vẫn được giữ lại.`} confirmLabel="Ẩn sản phẩm đã chọn" onConfirm={() => void archiveSelectedProducts()} onDismiss={() => setConfirmBatchArchive(false)} title="Ẩn sản phẩm đã chọn?" /> : null}
      {pendingRequest ? (
        <AdminConfirmDialog
          cancelLabel="Ở lại"
          confirmLabel="Bỏ thay đổi"
          message="Bạn có thay đổi chưa lưu. Chuyển bản ghi sẽ mất thay đổi? Vẫn chuyển?"
          onConfirm={confirmPendingEditor}
          onDismiss={cancelPendingEditor}
          title="Bỏ thay đổi chưa lưu?"
        />
      ) : null}
      {canManage && importModalOpen ? (
        <AdminModal labelledBy="admin-import-panel-title" onClose={() => setImportModalOpen(false)} title="Nhập danh sách sản phẩm từ CSV" width="wide">
          <h2 hidden id="admin-import-panel-title">Nhập danh sách sản phẩm từ CSV</h2>
          <AdminProductImportPanel categories={categories} onImported={() => { setImportModalOpen(false); setAttempt((value) => value + 1); }} role={session.role} />
        </AdminModal>
      ) : null}
      {categoryPanelOpen ? (
        <AdminModal labelledBy="admin-category-panel-title" onClose={() => setCategoryPanelOpen(false)} title="Quản lý danh mục" width="wide">
          <h2 hidden id="admin-category-panel-title">Quản lý danh mục</h2>
          <AdminCategoryPanel onChanged={() => setAttempt((value) => value + 1)} />
        </AdminModal>
      ) : null}
      {batchCategoryModal ? (
        <AdminModal
          labelledBy="admin-batch-category-title"
          onClose={() => setBatchCategoryModal(false)}
          title="Đổi danh mục hàng loạt"
        >
          <div className="admin-form-group" style={{ padding: "16px 0" }}>
            <p style={{ fontSize: 13, marginBottom: 12, color: "var(--admin-text-subtle)" }}>
              Chọn danh mục mới cho <strong>{selectedIds.size}</strong> sản phẩm đã chọn:
            </p>
            <label className="admin-label" htmlFor="batch-category-select">
              Danh mục đích
            </label>
            <select
              className="admin-select"
              id="batch-category-select"
              onChange={(e) => setBatchTargetCategory(e.target.value ? Number(e.target.value) : null)}
              value={batchTargetCategory ?? ""}
            >
              <option value="">-- Chưa phân loại --</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button
                className="admin-button admin-button-quiet"
                disabled={batchCategoryLoading}
                onClick={() => setBatchCategoryModal(false)}
                type="button"
              >
                Hủy
              </button>
              <button
                className="admin-button admin-button-primary"
                disabled={batchCategoryLoading}
                onClick={() => void applyBatchCategory(batchTargetCategory)}
                type="button"
              >
                {batchCategoryLoading ? "Đang cập nhật…" : "Áp dụng danh mục"}
              </button>
            </div>
          </div>
        </AdminModal>
      ) : null}
      {batchEditModal ? (
        <AdminModal
          labelledBy="admin-batch-edit-title"
          onClose={() => { if (!batchEditLoading) setBatchEditModal(false); }}
          title={`Chỉnh sửa hàng loạt (${selectedIds.size} sản phẩm đã chọn)`}
          width="wide"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "10px 0" }}>
            <p style={{ color: "#475569", fontSize: 13, margin: 0 }}>
              Chỉ các trường bạn chọn cập nhật mới được áp dụng cho <strong>{selectedIds.size}</strong> sản phẩm đã chọn. Các trường &ldquo;Giữ nguyên&rdquo; sẽ giữ nguyên giá trị ban đầu.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label className="admin-label" style={{ fontWeight: 600 }}>Trạng thái phát hành</label>
                <select
                  className="admin-select"
                  disabled={batchEditLoading}
                  onChange={(e) => setBatchEditStatus(e.target.value as any)}
                  value={batchEditStatus}
                >
                  <option value="keep">— Giữ nguyên hiện tại —</option>
                  <option value="published">Đã xuất bản (Published)</option>
                  <option value="draft">Bản nháp (Draft)</option>
                  <option value="review">Chờ duyệt (Review)</option>
                  <option value="archived">Lưu trữ (Archived)</option>
                </select>
              </div>

              <div>
                <label className="admin-label" style={{ fontWeight: 600 }}>Hiển thị trên website</label>
                <select
                  className="admin-select"
                  disabled={batchEditLoading}
                  onChange={(e) => setBatchEditVisibility(e.target.value as any)}
                  value={batchEditVisibility}
                >
                  <option value="keep">— Giữ nguyên hiện tại —</option>
                  <option value="active">Bật hiển thị (Hiện)</option>
                  <option value="inactive">Tắt hiển thị (Ẩn)</option>
                </select>
              </div>

              <div>
                <label className="admin-label" style={{ fontWeight: 600 }}>Danh mục sản phẩm</label>
                <select
                  className="admin-select"
                  disabled={batchEditLoading}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "keep") setBatchEditCategory("keep");
                    else if (val === "none") setBatchEditCategory("none");
                    else setBatchEditCategory(Number(val));
                  }}
                  value={String(batchEditCategory)}
                >
                  <option value="keep">— Giữ nguyên hiện tại —</option>
                  <option value="none">Xóa phân loại (Không có danh mục)</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="admin-label" style={{ fontWeight: 600 }}>Thời gian làm hàng (ngày)</label>
                <select
                  className="admin-select"
                  disabled={batchEditLoading}
                  onChange={(e) => setBatchEditLeadTimeAction(e.target.value as any)}
                  style={{ marginBottom: batchEditLeadTimeAction === "set" ? 8 : 0 }}
                  value={batchEditLeadTimeAction}
                >
                  <option value="keep">— Giữ nguyên hiện tại —</option>
                  <option value="set">Thiết lập số ngày cụ thể</option>
                  <option value="clear">Xóa thời gian làm hàng</option>
                </select>
                {batchEditLeadTimeAction === "set" ? (
                  <input
                    className="admin-input"
                    disabled={batchEditLoading}
                    min="0"
                    onChange={(e) => setBatchEditLeadTimeValue(e.target.value)}
                    placeholder="Nhập số ngày (ví dụ: 7)"
                    type="number"
                    value={batchEditLeadTimeValue}
                  />
                ) : null}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 12, paddingTop: 14, borderTop: "1px solid #e2e8f0" }}>
              <button
                className="admin-button admin-button-quiet"
                disabled={batchEditLoading}
                onClick={() => setBatchEditModal(false)}
                type="button"
              >
                Hủy
              </button>
              <button
                className="admin-button admin-button-primary"
                disabled={batchEditLoading}
                onClick={() => void applyComprehensiveBatchEdit()}
                type="button"
              >
                {batchEditLoading ? "Đang cập nhật..." : `Cập nhật ${selectedIds.size} sản phẩm`}
              </button>
            </div>
          </div>
        </AdminModal>
      ) : null}
    </div>
  );
}

interface ProductEditorProps {
  categories: AdminCategory[];
  error: AdminClientError | null;
  form: ProductFormState;
  isDirty?: boolean;
  onCancel: () => void;
  onChange: (value: ProductFormState) => void;
  onOpenCategoryPanel?: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
}

function ProductEditor({
  categories,
  error,
  form,
  isDirty = false,
  onCancel,
  onChange,
  onOpenCategoryPanel,
  onSubmit,
  saving,
}: ProductEditorProps) {
  const [activeTab, setActiveTab] = useState<"general" | "media" | "variants_seo">("general");
  const [mediaTabOpened, setMediaTabOpened] = useState(false);
  const [variantsTabOpened, setVariantsTabOpened] = useState(false);
  const [techSpecsOpened, setTechSpecsOpened] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useAdminToast();

  function focusProductFieldError(field: string) {
    const target = productFieldLabels[field];
    if (!target) return;
    setActiveTab(target.tab);
    if (target.tab === "media") setMediaTabOpened(true);
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-testid="${target.testId}"]`)?.focus();
    });
  }

  async function uploadProductFile(file: File) {
    if (!form.id) {
      showToast("info", "Hãy lưu bản nháp trước khi tải ảnh từ máy tính, hoặc dán đường dẫn ảnh.");
      return;
    }
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.set("requestId", crypto.randomUUID());
      formData.set("productId", String(form.id));
      formData.set("file", file);
      const res = await fetch("/api/admin/media", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json() as { ok?: boolean; data?: { media: { publicUrl: string } }; message?: string };
      if (res.ok && data.data?.media?.publicUrl) {
        update("imageUrl", data.data.media.publicUrl);
        showToast("success", "Đã tải ảnh lên và đặt làm ảnh chính sản phẩm.");
      } else {
        showToast("error", data.message || "Không thể tải ảnh lên.");
      }
    } catch {
      showToast("error", "Lỗi kết nối khi tải ảnh lên.");
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleDirectImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      await uploadProductFile(file);
    }
    if (event.target) event.target.value = "";
  }

  function update<K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) {
    onChange({ ...form, [key]: value });
  }

  return (
    <section className="admin-editor admin-haravan-editor" aria-labelledby="product-editor-heading">
      <form id="product-editor-save-form" noValidate onSubmit={onSubmit}>
        <div className="admin-haravan-topbar">
        <div className="admin-haravan-topbar-left">
          <button
            className="admin-button admin-button-quiet"
            data-testid="button-product-cancel"
            disabled={saving}
            onClick={onCancel}
            style={{ alignItems: "center", display: "inline-flex", gap: 6, fontWeight: 600 }}
            type="button"
            >
              <ArrowLeft size={16} /> Quay lại danh sách
          </button>
          <div className="admin-haravan-title-wrap">
            <h2 className="admin-panel-title" id="product-editor-heading" style={{ fontSize: 18, margin: 0 }}>
              {form.id ? form.name || `Sản phẩm #${form.id}` : "Thêm sản phẩm mới"}
            </h2>
            {form.id ? (
              <span className={`admin-status-badge admin-status-${form.status}`}>
                {statusLabelsVN[form.status] || form.status}
              </span>
            ) : (
              <span className="admin-stamp">BẢN GHI MỚI</span>
            )}
            {form.id ? (
              <span
                style={{
                  alignItems: "center",
                  background: "#f1f5f9",
                  border: "1px solid #cbd5e1",
                  borderRadius: 6,
                  color: "#334155",
                  display: "inline-flex",
                  fontSize: 12,
                  fontWeight: 600,
                  gap: 5,
                  padding: "3px 8px",
                }}
                title="Tổng số lượng đã đặt/bán qua các phiếu yêu cầu gia công"
              >
                <ShoppingCart size={13} />
                <span>Đã bán: {new Intl.NumberFormat("vi-VN").format(form.soldCount ?? 0)}</span>
              </span>
            ) : null}
          </div>
        </div>
        <div className="admin-haravan-topbar-right">
          {form.slug ? (
            <a
              className="admin-button admin-button-quiet"
              href={`/san-pham/${form.slug}/`}
              rel="noreferrer"
              style={{ alignItems: "center", display: "inline-flex", gap: 6 }}
              target="_blank"
            >
              <span>Xem trên website</span>
              <ExternalLink size={14} />
            </a>
          ) : null}
        </div>
      </div>

      {error ? <p className="admin-editor-error" role="alert">{error.code ? `${error.code} · ` : ""}{error.message}</p> : null}
      {error?.fieldErrors && Object.keys(error.fieldErrors).length > 0 ? (
        <ul className="admin-editor-error-list" data-testid="product-form-field-errors">
          {Object.entries(error.fieldErrors).map(([field, message]) => (
            <li key={field}>
              <button data-testid={`button-product-error-${field}`} onClick={() => focusProductFieldError(field)} type="button">
                {productFieldLabels[field]?.label ?? "Thông tin sản phẩm"}: {message}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

        <div className="admin-form-tabs" role="tablist" aria-label="Phân nhóm thông tin sản phẩm">
          <button
            type="button"
            role="tab"
            id="tab-btn-general"
            aria-controls="tab-panel-general"
            aria-selected={activeTab === "general"}
            tabIndex={activeTab === "general" ? 0 : -1}
            className={`admin-form-tab ${activeTab === "general" ? "is-active" : ""}`}
            onClick={() => setActiveTab("general")}
            onKeyDown={handleEditorTabKeyDown}
          >
            <FileText size={15} />
            <span>Thông tin & Quy cách</span>
          </button>
          <button
            type="button"
            role="tab"
            id="tab-btn-media"
            aria-controls="tab-panel-media"
            aria-selected={activeTab === "media"}
            tabIndex={activeTab === "media" ? 0 : -1}
            className={`admin-form-tab ${activeTab === "media" ? "is-active" : ""}`}
            onClick={() => { setActiveTab("media"); setMediaTabOpened(true); }}
            onKeyDown={handleEditorTabKeyDown}
          >
            <ImageIcon size={15} />
            <span>Ảnh & Media</span>
          </button>
          <button
            type="button"
            role="tab"
            id="tab-btn-variants-seo"
            aria-controls="tab-panel-variants-seo"
            aria-selected={activeTab === "variants_seo"}
            tabIndex={activeTab === "variants_seo" ? 0 : -1}
            className={`admin-form-tab ${activeTab === "variants_seo" ? "is-active" : ""}`}
            onClick={() => { setActiveTab("variants_seo"); setVariantsTabOpened(true); }}
            onKeyDown={handleEditorTabKeyDown}
          >
            <SlidersHorizontal size={15} />
            <span>Biến thể, giá & SEO</span>
          </button>
        </div>

        {/* TAB 1: Thông tin chung & Quy cách */}
        <div
          role="tabpanel"
          id="tab-panel-general"
          aria-labelledby="tab-btn-general"
          className={`admin-form-tab-panel ${activeTab === "general" ? "is-active" : "is-hidden"}`}
          style={{ display: activeTab === "general" ? "block" : "none" }}
        >
          <div className="admin-haravan-grid">
            {/* Cột chính: Thông tin cơ bản & mô tả */}
            <div className="admin-haravan-main">
              <div className="admin-haravan-card">
                <h3 className="admin-haravan-card-title">Thông tin chung</h3>
                <label className="admin-field">
                  <span>Tên sản phẩm <b aria-hidden="true">*</b></span>
                  <input
                    className="admin-input"
                    data-testid="input-product-name"
                    disabled={saving}
                    onChange={(event) => {
                      const newName = event.target.value;
                      onChange({
                        ...form,
                        name: newName,
                        slug: form.slugFollowsName === false ? form.slug : toSlug(newName),
                      });
                    }}
                    placeholder="Ví dụ: Gia công cà phê hòa tan 3in1, Chai nhựa PET 500ml..."
                    required
                    style={{ fontSize: 15, fontWeight: 500 }}
                    value={form.name}
                  />
                </label>

                <label className="admin-field">
                  <span>Đường dẫn (slug) <b aria-hidden="true">*</b></span>
                  <input
                    className="admin-input admin-mono"
                    data-testid="input-product-slug"
                    disabled={saving}
                    onChange={(event) => onChange({
                      ...form,
                      slug: event.target.value,
                      slugFollowsName: event.target.value.trim() === "",
                    })}
                    placeholder="gia-cong-ca-phe-3in1"
                    required
                    value={form.slug}
                  />
                  <small className="admin-field-hint">
                    Tự tạo theo tên sản phẩm; nhập slug riêng để giữ đường dẫn tùy chỉnh. Đường dẫn: /san-pham/{form.slug || "..."}
                  </small>
                </label>

                <label className="admin-field">
                  <span>Mô tả ngắn</span>
                  <textarea
                    className="admin-textarea"
                    data-testid="input-product-short-description"
                    disabled={saving}
                    onChange={(event) => update("shortDescription", event.target.value)}
                    placeholder="Tóm tắt ngắn 1-2 câu về sản phẩm, điểm nổi bật hoặc quy cách..."
                    rows={2}
                    value={form.shortDescription}
                  />
                </label>

                <div className="admin-field">
                  <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span className="admin-field-label">Mô tả chi tiết sản phẩm</span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      <button
                        className="admin-button admin-button-quiet"
                        onClick={() => update("description", form.description + (form.description ? "\n" : "") + "**Nội dung in đậm**")}
                        style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px" }}
                        title="In đậm"
                        type="button"
                      >
                        B
                      </button>
                      <button
                        className="admin-button admin-button-quiet"
                        onClick={() => update("description", form.description + (form.description ? "\n" : "") + "*Nội dung in nghiêng*")}
                        style={{ fontSize: 11, fontStyle: "italic", padding: "2px 7px" }}
                        title="In nghiêng"
                        type="button"
                      >
                        I
                      </button>
                      <button
                        className="admin-button admin-button-quiet"
                        onClick={() => update("description", form.description + (form.description ? "\n" : "") + "## Tiêu đề mục kỹ thuật")}
                        style={{ fontSize: 11, padding: "2px 7px" }}
                        title="Tiêu đề mục (H2)"
                        type="button"
                      >
                        H2
                      </button>
                      <button
                        className="admin-button admin-button-quiet"
                        onClick={() => update("description", form.description + (form.description ? "\n" : "") + "- Tiêu chuẩn 1\n- Tiêu chuẩn 2")}
                        style={{ fontSize: 11, padding: "2px 7px" }}
                        title="Danh sách gạch đầu dòng"
                        type="button"
                      >
                        • Danh sách
                      </button>
                      <button
                        className="admin-button admin-button-quiet"
                        onClick={() => update("description", form.description + (form.description ? "\n" : "") + "| Thông số | Chi tiết tiêu chuẩn |\n| :--- | :--- |\n| Vật liệu | Inox 304 / Nhôm |\n| Dung sai | ± 0.01 mm |")}
                        style={{ fontSize: 11, padding: "2px 7px" }}
                        title="Chèn bảng thông số mẫu"
                        type="button"
                      >
                        + Bảng mẫu
                      </button>
                    </div>
                  </div>
                  <textarea
                    className="admin-textarea"
                    data-testid="input-product-description"
                    disabled={saving}
                    onChange={(event) => update("description", event.target.value)}
                    placeholder="Nhập thông tin sản phẩm, tiêu chuẩn kỹ thuật, năng lực gia công... (hỗ trợ Markdown & Bảng)"
                    rows={8}
                    value={form.description}
                  />
                </div>
              </div>
            </div>

            {/* Cột phụ: Trạng thái, Phân loại, SKU, Lead Time */}
            <div className="admin-haravan-sidebar">
              {/* Card Trạng thái & Kênh hiển thị */}
              <div className="admin-haravan-card">
                <h3 className="admin-haravan-card-title">Trạng thái & Hiển thị</h3>
                <label className="admin-field">
                  <span>Trạng thái phát hành</span>
                  <select
                    className="admin-select"
                    data-testid="select-product-status"
                    disabled={saving}
                    onChange={(event) => {
                      const status = event.target.value as ProductFormState["status"];
                      onChange({
                        ...form,
                        isActive: status === "published" ? form.isActive : false,
                        status,
                      });
                    }}
                    value={form.status}
                  >
                    <option value="draft">Bản nháp (Chưa bán)</option>
                    <option value="review">Chờ duyệt</option>
                    <option disabled={!form.id} value="published">Đã xuất bản</option>
                    <option value="archived">Lưu trữ (Ẩn)</option>
                  </select>
                  {!form.id ? <small className="admin-field-hint">Lưu bản nháp trước, sau đó thêm biến thể hợp lệ rồi mới xuất bản.</small> : null}
                </label>

                <label className="admin-check" style={{ marginTop: 12 }}>
                  <input
                    checked={form.isActive}
                    data-testid="checkbox-product-active"
                    disabled={saving || form.status !== "published"}
                    onChange={(event) => {
                      const active = event.target.checked;
                      onChange({ ...form, isActive: active });
                    }}
                    type="checkbox"
                  />
                  <span>
                    <strong>Hiển thị trên trang web</strong>
                    <small>{form.status !== "published" ? "Chỉ sản phẩm đã xuất bản mới có thể hiển thị." : form.isActive ? "Sản phẩm đang hiển thị công khai." : "Đã xuất bản nhưng đang ẩn khỏi website."}</small>
                  </span>
                </label>
              </div>

              {/* Card Phân loại sản phẩm */}
              <div className="admin-haravan-card">
                <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <h3 className="admin-haravan-card-title" style={{ margin: 0 }}>Phân loại</h3>
                  {onOpenCategoryPanel ? (
                    <button
                      className="admin-button admin-button-quiet"
                      onClick={onOpenCategoryPanel}
                      style={{ fontSize: 11, padding: "2px 6px" }}
                      type="button"
                    >
                      + Quản lý danh mục
                    </button>
                  ) : null}
                </div>
                <label className="admin-field">
                  <span>Danh mục</span>
                  <select
                    className="admin-select"
                    data-testid="select-product-category"
                    disabled={saving}
                    onChange={(event) => update("categoryId", event.target.value)}
                    value={form.categoryId}
                  >
                    <option value="">Chưa phân loại</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Card Mã hàng & Sản xuất */}
              <div className="admin-haravan-card">
                <h3 className="admin-haravan-card-title">Mã hàng & Sản xuất</h3>
                <label className="admin-field">
                  <span>Mã hàng (SKU) <b aria-hidden="true">*</b></span>
                  <input
                    className="admin-input admin-mono"
                    data-testid="input-product-sku"
                    disabled={saving}
                    onChange={(event) => update("sku", event.target.value)}
                    placeholder="VD: SP-001"
                    required
                    value={form.sku}
                  />
                </label>
                <label className="admin-field">
                  <span>Thời gian làm hàng (ngày)</span>
                  <input
                    className="admin-input admin-mono"
                    data-testid="input-product-lead-time"
                    disabled={saving}
                    inputMode="numeric"
                    min="0"
                    onChange={(event) => update("leadTimeDays", event.target.value)}
                    type="number"
                    value={form.leadTimeDays}
                  />
                  <small className="admin-field-hint">Số ngày sản xuất dự kiến</small>
                </label>
              </div>
            </div>
          </div>
        </div>

      </form>

        {/* TAB 2: Hình ảnh & Thư viện Media */}
        <div
          role="tabpanel"
          id="tab-panel-media"
          aria-labelledby="tab-btn-media"
          className={`admin-form-tab-panel ${activeTab === "media" ? "is-active" : "is-hidden"}`}
          style={{ display: activeTab === "media" ? "block" : "none" }}
        >
          <div className="admin-haravan-card">
            <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between", marginBottom: 16 }}>
              <h3 className="admin-haravan-card-title" style={{ margin: 0 }}>Hình ảnh sản phẩm</h3>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  accept="image/jpeg,image/png,image/webp"
                  disabled={saving || uploadingImage}
                  onChange={handleDirectImageUpload}
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  type="file"
                />
                <button
                  className="admin-button admin-button-quiet"
                  disabled={saving || uploadingImage}
                  onClick={() => {
                    if (!form.id) {
                      showToast("info", "Hãy lưu bản nháp sản phẩm trước khi tải ảnh từ máy tính.");
                      return;
                    }
                    fileInputRef.current?.click();
                  }}
                  style={{ fontSize: 12 }}
                  type="button"
                >
                  {uploadingImage ? "Đang tải ảnh..." : "Tải ảnh từ máy tính"}
                </button>
                <button
                  className="admin-button admin-button-quiet"
                  disabled={saving}
                  onClick={() => setPickerOpen(true)}
                  style={{ fontSize: 12 }}
                  type="button"
                >
                  Chọn từ thư viện ảnh
                </button>
              </div>
            </div>
            <label className="admin-field">
              <span>Ảnh sản phẩm chính</span>
              <div className="admin-input-actions">
                <input
                  className="admin-input"
                  data-testid="input-product-image"
                  disabled={saving}
                  onChange={(event) => update("imageUrl", event.target.value)}
                  placeholder="/media/products/... hoặc https://..."
                  value={form.imageUrl}
                />
              </div>
              <div
                className={`admin-image-preview ${isDragging ? "admin-image-preview-dragover" : ""}`}
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(false);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(false);
                  const droppedFile = e.dataTransfer.files?.[0];
                  if (droppedFile) {
                    void uploadProductFile(droppedFile);
                  }
                }}
                style={{
                  alignItems: "center",
                  background: isDragging ? "#ecfdf5" : "transparent",
                  border: isDragging ? "2px dashed #059669" : "1px dashed var(--admin-border, #cbd5e1)",
                  borderRadius: 8,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  marginTop: 10,
                  minHeight: 120,
                  padding: 12,
                  position: "relative",
                  transition: "background-color 0.2s ease, border-color 0.2s ease",
                }}
              >
                {form.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={`Xem trước ảnh ${form.name}`} src={form.imageUrl} style={{ maxHeight: 180, objectFit: "contain" }} />
                ) : (
                  <span className="admin-image-preview-fallback" style={{ textAlign: "center" }}>
                    {isDragging
                      ? "Thả file ảnh vào đây để tải lên ngay..."
                      : "Kéo thả ảnh vào đây, hoặc nhấn \"Tải ảnh từ máy tính\" / \"Chọn từ thư viện ảnh\" ở trên."}
                  </span>
                )}
                {uploadingImage ? (
                  <div
                    style={{
                      alignItems: "center",
                      background: "rgba(255, 255, 255, 0.88)",
                      borderRadius: 6,
                      display: "flex",
                      gap: 8,
                      inset: 0,
                      justifyContent: "center",
                      position: "absolute",
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Đang tải ảnh lên Cloudflare R2...</span>
                  </div>
                ) : null}
              </div>
            </label>

            {form.id && mediaTabOpened ? (
              <div style={{ borderTop: "1px dashed var(--admin-border, #dce3dc)", marginTop: 16, paddingTop: 16 }}>
                <span className="admin-field-label" style={{ display: "block", marginBottom: 8 }}>
                  Bộ sưu tập ảnh ({form.name})
                </span>
                <AdminProductGalleryManager
                  onRevisionChange={(revision) => onChange({ ...form, revision })}
                  productId={form.id}
                />
              </div>
            ) : null}

            {pickerOpen ? (
              <AdminMediaPickerModal
                onClose={() => setPickerOpen(false)}
                onSelect={(publicUrl) => {
                  update("imageUrl", publicUrl);
                  setPickerOpen(false);
                }}
              />
            ) : null}
          </div>
        </div>

        {/* TAB 3: Biến thể, Bảng giá & SEO */}
        <div
          role="tabpanel"
          id="tab-panel-variants-seo"
          aria-labelledby="tab-btn-variants-seo"
          className={`admin-form-tab-panel ${activeTab === "variants_seo" ? "is-active" : "is-hidden"}`}
          style={{ display: activeTab === "variants_seo" ? "block" : "none" }}
        >
          {form.id ? (
            <div className="admin-haravan-card">
              <h3 className="admin-haravan-card-title">Biến thể & Bảng giá MOQ</h3>
              {variantsTabOpened ? <AdminVariantPanel productId={form.id} /> : null}
            </div>
          ) : (
            <div className="admin-haravan-card" style={{ color: "var(--admin-ink-muted)", padding: "24px", textAlign: "center" }}>
              Vui lòng lưu bản nháp sản phẩm trước khi cấu hình biến thể và bảng giá MOQ.
            </div>
          )}

          {form.id ? (
            <details
              className="admin-haravan-card admin-tech-specs-disclosure"
              onToggle={(event) => { if (event.currentTarget.open) setTechSpecsOpened(true); }}
            >
              <summary>
                <span>
                  <strong>Thông số kỹ thuật gia công · Tùy chọn</strong>
                  <small>Dành cho sản phẩm cần khai báo vật liệu, dung sai hoặc quy trình chế tạo.</small>
                </span>
              </summary>
              {techSpecsOpened ? <AdminProductTechSpecs productId={form.id} /> : null}
            </details>
          ) : null}

          <div className="admin-haravan-card">
            <h3 className="admin-haravan-card-title">Tối ưu hóa tìm kiếm (SEO)</h3>
            <AdminProductSeoPreview
              initialData={{
                imageUrl: form.imageUrl,
                seoDescription: form.shortDescription || form.description.slice(0, 160),
                seoTitle: form.name,
                slug: form.slug,
              }}
              onChange={(seo) => {
                if (seo.slug === form.slug) return;
                onChange({
                  ...form,
                  slug: seo.slug,
                  slugFollowsName: seo.slug.trim() === "",
                });
              }}
            />
          </div>
        </div>

        {/* Floating Sticky Action Bar */}
        <div
          className={`admin-floating-action-bar ${isDirty ? "is-dirty" : ""}`}
          role="region"
          aria-label="Thao tác lưu biểu mẫu"
        >
          <div className="admin-floating-action-bar-inner">
            <div className="admin-floating-action-bar-info">
              {isDirty ? (
                <span className="admin-floating-dirty-indicator">
                  <span className="admin-floating-dirty-dot" aria-hidden="true" />
                  Có thay đổi chưa lưu
                </span>
              ) : (
                <span className="admin-floating-clean-indicator">
                  {form.id ? `Sản phẩm #${form.id}` : "Bản ghi sản phẩm mới"} · Đã đồng bộ
                </span>
              )}
            </div>
            <div className="admin-floating-action-bar-actions">
              <button
                className="admin-button admin-button-primary"
                data-testid="button-product-save"
                disabled={saving}
                form="product-editor-save-form"
                type="submit"
              >
                {saving ? "Đang lưu..." : "Lưu sản phẩm"}
              </button>
            </div>
          </div>
        </div>
    </section>
  );
}
