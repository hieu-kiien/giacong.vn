"use client";

import { ArrowLeft, ExternalLink, Eye, EyeOff, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

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
import { useAdminUnsaved, useRegisterAdminUnsaved } from "@/components/admin/AdminUnsavedGuard";
import { AdminMediaPanel } from "@/components/admin/AdminMediaPanel";
import { AdminEmptyState, AdminErrorState, AdminLoadingTable, AdminPageHeading, AdminPagination, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { useAdminSession } from "@/components/admin/AdminShell";
import { AdminConfirmDialog } from "@/components/admin/AdminDialog";
import { useAdminToast } from "@/components/admin/AdminToast";
import { AdminClientError, fetchAdmin, formatAdminDate, getInitials, mutateAdmin, type AdminService } from "@/lib/admin-client";
import { canManageServices } from "@/lib/admin-permissions";

interface AdminServiceWithRevision extends AdminService {
  revision: number;
}

interface ServiceResponse {
  services: AdminServiceWithRevision[];
  total: number;
  pagination?: { currentPage: number; lastPage: number; pageSize: number; total: number };
}

interface ServiceBatchSnapshotResponse {
  services: Array<{ id: number; isActive: boolean; revision: number }>;
}

interface ServiceBatchResponse {
  changedCount: number;
  selectedCount: number;
  skipped: Array<{ id: number; reason: string }>;
}

interface PendingServiceBatch {
  items: Array<{ expectedRevision: number; id: number }>;
  key: string;
  requestId: string;
}

type ServiceFormState = {
  ctaHref: string;
  ctaLabel: string;
  description: string;
  id?: number;
  imageUrl: string;
  isActive: boolean;
  leadTimeDays: string;
  moqSummary: string;
  name: string;
  offeringsText: string;
  slug: string;
  sortOrder: string;
  status: "archived" | "draft" | "published" | "review";
  summary: string;
  revision: number;
};

const serviceStatusLabels: Record<string, string> = {
  published: "Đang hiển thị",
  draft: "Bản nháp",
  review: "Chờ duyệt",
  archived: "Đã lưu trữ",
};

const emptyServiceForm: ServiceFormState = {
  ctaHref: "/lien-he/",
  ctaLabel: "Liên hệ tư vấn",
  description: "",
  imageUrl: "",
  isActive: false,
  leadTimeDays: "",
  moqSummary: "",
  name: "",
  offeringsText: "",
  slug: "",
  sortOrder: "",
  status: "draft",
  summary: "",
  revision: 0,
};

function formatOfferings(offerings: AdminServiceWithRevision["offerings"]): string {
  return (offerings ?? []).map((offering) => `${offering.label} | ${offering.href}`).join("\n");
}

function parseOfferingLines(value: string): Array<{ href: string; label: string }> {
  return value.split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf("|");
      if (separator < 0) return { href: "", label: line };
      return { href: line.slice(separator + 1).trim(), label: line.slice(0, separator).trim() };
    });
}

export default function AdminServicesPage() {
  const session = useAdminSession();
  const { showToast } = useAdminToast();
  const searchParams = useSearchParams();
  const canManage = canManageServices(session.role);
  const [confirmArchive, setConfirmArchive] = useState<AdminServiceWithRevision | null>(null);
  const [confirmBatchArchive, setConfirmBatchArchive] = useState<AdminServiceWithRevision[]>([]);
  const [services, setServices] = useState<AdminServiceWithRevision[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AdminClientError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [editor, setEditor] = useState<ServiceFormState | null>(null);
  const [editorSnapshot, setEditorSnapshot] = useState<ServiceFormState | null>(null);
  const [pendingEditor, setPendingEditor] = useState<{ form: ServiceFormState | null } | null>(null);
  const [saveError, setSaveError] = useState<AdminClientError | null>(null);
  const [saving, setSaving] = useState(false);
  const [archivingId, setArchivingId] = useState<number | null>(null);
  const [batchArchiving, setBatchArchiving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [activatingId, setActivatingId] = useState<number | null>(null);
  const [batchActivating, setBatchActivating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "draft" | "hidden">("all");
  const filteredServices = useMemo(() => {
    if (statusFilter === "active") return services.filter((s) => s.isActive && s.status === "published");
    if (statusFilter === "draft") return services.filter((s) => s.status === "draft" || s.status === "review");
    if (statusFilter === "hidden") return services.filter((s) => !s.isActive || s.status === "archived");
    return services;
  }, [services, statusFilter]);
  const serviceBatchRequest = useRef<PendingServiceBatch | null>(null);
  const serviceBatchInFlight = useRef(false);
  const { isDirty: hasUnsavedChanges, saving: nestedSaving } = useAdminUnsaved();
  const isDirty = useCallback(() => editor !== null && JSON.stringify(editor) !== JSON.stringify(editorSnapshot), [editor, editorSnapshot]);
  useRegisterAdminUnsaved(isDirty, saving);

  const applyServiceEditor = useCallback((form: ServiceFormState | null) => {
    setEditor(form);
    setEditorSnapshot(form);
    setSaveError(null);
    if (typeof window !== "undefined") {
      if (form) {
        if (form.id) {
          window.history.pushState({ edit: form.id }, "", `?edit=${form.id}`);
        } else {
          window.history.pushState({ create: "1" }, "", "?create=1");
        }
      } else {
        window.history.pushState(null, "", "/admin/dich-vu");
      }
    }
  }, []);

  const requestServiceEditor = useCallback((form: ServiceFormState | null) => {
    if (saving || nestedSaving) return;
    if (isDirty() || hasUnsavedChanges()) { setPendingEditor({ form }); return; }
    applyServiceEditor(form);
  }, [applyServiceEditor, hasUnsavedChanges, isDirty, nestedSaving, saving]);

  const editQuery = searchParams.get("edit");
  const createQuery = searchParams.get("create");
  const deepLinkKey = editQuery ? `edit:${editQuery}` : createQuery === "1" ? "create" : null;
  const handledDeepLinkRef = useRef<string | null>(null);

  const openEditById = useCallback(async (id: number) => {
    if (!canManage) return;
    try {
      const result = await fetchAdmin<{ service: AdminServiceWithRevision }>(`/api/admin/services/${id}`);
      requestServiceEditor({
        ctaHref: result.service.ctaHref ?? `/lien-he/?service=${result.service.slug}`,
        ctaLabel: result.service.ctaLabel ?? "Liên hệ tư vấn",
        description: result.service.description,
        id: result.service.id,
        imageUrl: result.service.imageUrl ?? "",
        isActive: result.service.isActive,
        leadTimeDays: result.service.leadTimeDays === null ? "" : String(result.service.leadTimeDays),
        moqSummary: result.service.moqSummary ?? "",
        name: result.service.name,
        offeringsText: formatOfferings(result.service.offerings),
        slug: result.service.slug,
        sortOrder: String(result.service.sortOrder ?? 0),
        status: result.service.status as ServiceFormState["status"],
        summary: result.service.summary,
        revision: result.service.revision,
      });
    } catch (reason: unknown) {
      showToast("error", reason instanceof AdminClientError ? reason.message : "Không thể tải dịch vụ được yêu cầu.");
    }
  }, [canManage, requestServiceEditor, showToast]);

  useEffect(() => {
    if (!canManage || !deepLinkKey || handledDeepLinkRef.current === deepLinkKey) return;
    handledDeepLinkRef.current = deepLinkKey;
    if (createQuery === "1" && !editQuery) {
      requestServiceEditor({ ...emptyServiceForm });
      return;
    }
    const id = Number(editQuery);
    if (!Number.isSafeInteger(id) || id <= 0) {
      showToast("error", "Không thể tải dịch vụ được yêu cầu.");
      return;
    }
    void openEditById(id);
  }, [canManage, createQuery, deepLinkKey, editQuery, openEditById, requestServiceEditor, showToast]);

  useEffect(() => {
    function onPopState() {
      const url = new URL(window.location.href);
      const edit = url.searchParams.get("edit");
      const create = url.searchParams.get("create");
      if (edit) {
        const id = Number(edit);
        if (Number.isSafeInteger(id) && id > 0) {
          void openEditById(id);
        }
      } else if (create === "1") {
        requestServiceEditor({ ...emptyServiceForm });
      } else {
        applyServiceEditor(null);
      }
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [applyServiceEditor, openEditById, requestServiceEditor]);

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
        const result = await fetchAdmin<ServiceResponse>(`/api/admin/services?${params.toString()}`, controller.signal);
        setServices(result.services ?? []);
        setTotal(result.total ?? 0);
        setLastPage(result.pagination?.lastPage ?? Math.max(1, Math.ceil((result.total ?? 0) / 20)));
      } catch (reason: unknown) {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể tải danh sách dịch vụ.", 0));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [session.subject, page, query, statusFilter, attempt]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, query]);

  useEffect(() => {
    // The media panel promotes a main image without touching this form; keep the
    // open editor (and the table) in sync when it does.
    function syncMainImage() {
      setAttempt((value) => value + 1);
      setEditor((current) => {
        if (!current?.id) return current;
        void (async () => {
          try {
            const { service } = await fetchAdmin<{ service: AdminServiceWithRevision }>(`/api/admin/services/${current.id}`);
            setEditor((latest) => latest?.id === service.id ? { ...latest, imageUrl: service.imageUrl ?? "" } : latest);
          } catch {
            // The editor keeps its previous image value; the table reload above still reflects D1.
          }
        })();
        return current;
      });
    }
    window.addEventListener("admin:service-updated", syncMainImage);
    return () => window.removeEventListener("admin:service-updated", syncMainImage);
  }, []);

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
    requestServiceEditor({ ...emptyServiceForm });
  }, [requestServiceEditor]);

  const openEdit = useCallback((service: AdminServiceWithRevision) => {
    requestServiceEditor({
      ctaHref: service.ctaHref ?? `/lien-he/?service=${service.slug}`,
      ctaLabel: service.ctaLabel ?? "Liên hệ tư vấn",
      description: service.description,
      id: service.id,
      imageUrl: service.imageUrl ?? "",
      isActive: service.isActive,
      leadTimeDays: service.leadTimeDays === null ? "" : String(service.leadTimeDays),
      moqSummary: service.moqSummary ?? "",
      name: service.name,
      offeringsText: formatOfferings(service.offerings),
      slug: service.slug,
      sortOrder: String(service.sortOrder ?? 0),
      status: service.status as ServiceFormState["status"],
      summary: service.summary,
      revision: service.revision,
    });
  }, [requestServiceEditor]);

  async function submitService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    setSaving(true);
    setSaveError(null);
    const fields = {
      ctaHref: editor.ctaHref.trim() || null,
      ctaLabel: editor.ctaLabel.trim() || null,
      description: editor.description,
      imageUrl: editor.imageUrl.trim() || null,
      isActive: editor.isActive,
      leadTimeDays: editor.leadTimeDays === "" ? null : Number(editor.leadTimeDays),
      moqSummary: editor.moqSummary || null,
      name: editor.name,
      offerings: parseOfferingLines(editor.offeringsText),
      slug: editor.slug,
      sortOrder: editor.sortOrder === "" ? null : Number(editor.sortOrder),
      status: editor.status,
      summary: editor.summary,
    };
    const payload = editor.id === undefined
      ? { ...fields, requestId: crypto.randomUUID() }
      : { ...fields, requestId: crypto.randomUUID(), revision: editor.revision };
    try {
      const result = await mutateAdmin<{ service: AdminServiceWithRevision }>(
        editor.id ? `/api/admin/services/${editor.id}` : "/api/admin/services",
        { body: payload, method: editor.id ? "PATCH" : "POST" },
      );
      const saved = result.service;
      const nextForm: ServiceFormState = {
        ctaHref: saved.ctaHref ?? `/lien-he/?service=${saved.slug}`,
        ctaLabel: saved.ctaLabel ?? "Liên hệ tư vấn",
        description: saved.description,
        id: saved.id,
        imageUrl: saved.imageUrl ?? "",
        isActive: saved.isActive,
        leadTimeDays: saved.leadTimeDays === null ? "" : String(saved.leadTimeDays),
        moqSummary: saved.moqSummary ?? "",
        name: saved.name,
        offeringsText: formatOfferings(saved.offerings),
        slug: saved.slug,
        sortOrder: String(saved.sortOrder ?? 0),
        status: saved.status as ServiceFormState["status"],
        summary: saved.summary,
        revision: saved.revision,
      };
      setEditor(nextForm);
      setEditorSnapshot(nextForm);
      setAttempt((value) => value + 1);
      showToast("success", editor.id ? "Đã lưu thay đổi dịch vụ." : "Đã tạo dịch vụ mới.");
    } catch (reason: unknown) {
      setSaveError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể lưu dịch vụ.", 0));
    } finally {
      setSaving(false);
    }
  }

  async function archiveService(service: AdminServiceWithRevision) {
    setArchivingId(service.id);
    setSaveError(null);
    try {
      await mutateAdmin<{ service: AdminServiceWithRevision }>(`/api/admin/services/${service.id}`, {
        body: { requestId: crypto.randomUUID(), revision: service.revision },
        method: "DELETE",
      });
      if (editor?.id === service.id) setEditor(null);
      setAttempt((value) => value + 1);
      showToast("success", `Đã ẩn dịch vụ “${service.name}”.`);
    } catch (reason: unknown) {
      setSaveError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể ẩn dịch vụ.", 0));
    } finally {
      setArchivingId(null);
    }
  }

  async function archiveSelectedServices() {
    const selectedServices = confirmBatchArchive.filter((service) => service.isActive);
    if (selectedServices.length === 0 || serviceBatchInFlight.current) return;
    serviceBatchInFlight.current = true;
    setBatchArchiving(true);
    setSaveError(null);
    const batchKey = selectedServices.map((service) => service.id).sort((a, b) => a - b).join(",");
    const pendingBatch = serviceBatchRequest.current?.key === batchKey ? serviceBatchRequest.current : null;
    try {
      let items = pendingBatch?.items;
      if (!items) {
        const ids = selectedServices.map((service) => service.id).join(",");
        const snapshotResult = await fetchAdmin<ServiceBatchSnapshotResponse>(`/api/admin/services/batch?ids=${encodeURIComponent(ids)}`);
        const snapshots = new Map(snapshotResult.services.map((service) => [service.id, service]));
        items = selectedServices.map((service) => ({
          expectedRevision: snapshots.get(service.id)?.revision ?? 1,
          id: service.id,
        }));
      }
      const requestId = pendingBatch?.requestId ?? crypto.randomUUID();
      serviceBatchRequest.current = { items, key: batchKey, requestId };
      const result = await mutateAdmin<ServiceBatchResponse>("/api/admin/services/batch", {
        body: {
          items,
          requestId: pendingBatch?.requestId ?? requestId,
        },
        method: "POST",
      });
      const skipped = result.skipped?.length ?? 0;
      showToast(
        skipped > 0 ? "error" : "success",
        `Đã ẩn ${result.changedCount} / ${result.selectedCount} dịch vụ.${skipped > 0 ? ` ${skipped} dịch vụ chưa xử lý, hãy tải lại để kiểm tra.` : ""}`,
      );
      if (serviceBatchRequest.current?.key === batchKey) serviceBatchRequest.current = null;
      setSelectedIds(new Set());
      setAttempt((value) => value + 1);
    } catch (reason: unknown) {
      const clientError = reason instanceof AdminClientError
        ? reason
        : new AdminClientError("Không thể ẩn hàng loạt dịch vụ.", 0);
      if (clientError.status >= 400 && clientError.status < 500 && serviceBatchRequest.current?.key === batchKey) {
        serviceBatchRequest.current = null;
      }
      showToast("error", clientError.message);
    } finally {
      serviceBatchInFlight.current = false;
      setBatchArchiving(false);
      setConfirmBatchArchive([]);
    }
  }

  async function unhideService(service: AdminServiceWithRevision) {
    if (!canManage) return;
    setActivatingId(service.id);
    setSaveError(null);
    try {
      const targetStatus: ServiceFormState["status"] = service.status === "archived" ? "draft" : (service.status as ServiceFormState["status"]);
      await mutateAdmin<{ service: AdminServiceWithRevision }>(`/api/admin/services/${service.id}`, {
        body: {
          ctaHref: service.ctaHref ?? null,
          ctaLabel: service.ctaLabel ?? null,
          description: service.description,
          imageUrl: service.imageUrl ?? null,
          isActive: true,
          leadTimeDays: service.leadTimeDays ?? null,
          moqSummary: service.moqSummary ?? null,
          name: service.name,
          offerings: service.offerings ?? [],
          requestId: crypto.randomUUID(),
          revision: service.revision,
          slug: service.slug,
          sortOrder: service.sortOrder ?? null,
          status: targetStatus,
          summary: service.summary,
        },
        method: "PATCH",
      });
      if (editor?.id === service.id) {
        setEditor((current) => (current ? { ...current, isActive: true, status: targetStatus } : null));
        setEditorSnapshot((current) => (current ? { ...current, isActive: true, status: targetStatus } : null));
      }
      setAttempt((value) => value + 1);
      showToast("success", `Đã bật hiển thị cho dịch vụ “${service.name}”.`);
    } catch (reason: unknown) {
      setSaveError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể hiển thị lại dịch vụ.", 0));
      showToast("error", reason instanceof AdminClientError ? reason.message : "Không thể hiển thị lại dịch vụ.");
    } finally {
      setActivatingId(null);
    }
  }

  async function activateSelectedServices() {
    if (!canManage || selectedIds.size === 0) return;
    setBatchActivating(true);
    let successCount = 0;
    let failCount = 0;
    const selectedServices = services.filter((s) => selectedIds.has(s.id));
    for (const service of selectedServices) {
      try {
        const targetStatus: ServiceFormState["status"] = service.status === "archived" ? "draft" : (service.status as ServiceFormState["status"]);
        await mutateAdmin<{ service: AdminServiceWithRevision }>(`/api/admin/services/${service.id}`, {
          body: {
            ctaHref: service.ctaHref ?? null,
            ctaLabel: service.ctaLabel ?? null,
            description: service.description,
            imageUrl: service.imageUrl ?? null,
            isActive: true,
            leadTimeDays: service.leadTimeDays ?? null,
            moqSummary: service.moqSummary ?? null,
            name: service.name,
            offerings: service.offerings ?? [],
            requestId: crypto.randomUUID(),
            revision: service.revision,
            slug: service.slug,
            sortOrder: service.sortOrder ?? null,
            status: targetStatus,
            summary: service.summary,
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
      showToast("error", `Đã bật hiển thị ${successCount} dịch vụ (${failCount} lỗi).`);
    } else {
      showToast("success", `Đã bật hiển thị cho ${successCount} dịch vụ đã chọn.`);
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
      const allSelected = filteredServices.length > 0 && filteredServices.every((service) => current.has(service.id));
      if (allSelected) return new Set();
      return new Set(filteredServices.map((service) => service.id));
    });
  }

const serviceStatusLabels: Record<string, string> = {
  draft: "Bản nháp",
  review: "Chờ duyệt",
  published: "Đã đăng",
  archived: "Lưu trữ",
};

  return (
    <div className="admin-content">
      {editor ? (
        <>
          <AdminPageHeading kicker="Năng lực sản xuất" title={editor.id ? `Chỉnh sửa dịch vụ: ${editor.name}` : "Thêm dịch vụ mới"} subtitle="Quản lý danh mục năng lực sản xuất, số lượng tối thiểu và thời gian làm hàng đang công bố." stamp="DANH MỤC DỊCH VỤ" />
          <ServiceEditor error={saveError} form={editor} onChange={setEditor} onCancel={() => requestServiceEditor(null)} onSubmit={submitService} saving={saving} />
          {editor?.id ? <AdminMediaPanel serviceId={editor.id} title="Ảnh dịch vụ và hồ sơ năng lực" /> : null}
        </>
      ) : (
        <>
          <AdminPageHeading kicker="Năng lực sản xuất" title="Dịch vụ gia công" subtitle="Quản lý danh mục năng lực sản xuất, số lượng tối thiểu và thời gian làm hàng đang công bố." stamp="DANH MỤC DỊCH VỤ" />
          <form className="admin-toolbar" onSubmit={submitSearch}>
        <div className="admin-search-wrap">
          <label className="admin-label" htmlFor="service-search">Tìm theo tên, đường dẫn hoặc nội dung</label>
          <Search aria-hidden="true" />
          <input className="admin-input has-icon" data-testid="input-service-search" id="service-search" onChange={(event) => setInputQuery(event.target.value)} placeholder="Ví dụ: đóng gói, trà, viên nang..." value={inputQuery} />
        </div>
        <button className="admin-button admin-button-primary" data-testid="button-service-search" type="submit"><Search size={15} /> Tìm dịch vụ</button>
        {query ? <button className="admin-button admin-button-quiet" data-testid="button-service-clear-search" onClick={clearSearch} type="button">Xóa tìm kiếm</button> : null}
        {canManage && selectedIds.size > 0 ? (
          <div className="admin-bulk-toolbar" style={{ alignItems: "center", display: "inline-flex", flexWrap: "wrap", gap: 8 }}>
            <span aria-live="polite" className="admin-item-meta" data-testid="service-selection-count">
              Đã chọn <strong>{selectedIds.size}</strong>
            </span>
            <button
              className="admin-button admin-button-quiet"
              data-testid="button-service-batch-unhide"
              disabled={batchArchiving || batchActivating}
              onClick={() => void activateSelectedServices()}
              style={{ alignItems: "center", display: "inline-flex", gap: 5, fontSize: 12, minHeight: 30, padding: "0 10px" }}
              type="button"
            >
              <Eye size={13} /> {batchActivating ? "Đang hiện…" : "Hiện đã chọn"}
            </button>
            <button
              className="admin-button admin-button-danger"
              data-testid="button-service-batch-archive"
              disabled={batchArchiving || batchActivating}
              onClick={() => setConfirmBatchArchive(services.filter((service) => selectedIds.has(service.id) && service.isActive))}
              style={{ alignItems: "center", display: "inline-flex", gap: 5, fontSize: 12, minHeight: 30, padding: "0 10px" }}
              type="button"
            >
              <EyeOff size={13} /> {batchArchiving ? "Đang ẩn…" : "Ẩn đã chọn"}
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
        {canManage ? <button className="admin-button admin-button-primary" data-testid="button-service-create" onClick={openCreate} type="button">Thêm dịch vụ</button> : null}
      </form>
      {error ? <AdminErrorState error={error} onRetry={() => setAttempt((value) => value + 1)} /> : loading ? <AdminLoadingTable /> : (
        <section className="admin-panel admin-table-panel" aria-labelledby="service-table-heading">
          <div className="admin-panel-heading" style={{ padding: "21px 21px 12px" }}><div><h2 className="admin-panel-title" id="service-table-heading">Danh mục dịch vụ</h2><p className="admin-panel-caption">{query ? `Kết quả cho “${query}”` : "Sắp xếp theo ID tăng dần"}</p></div><span className="admin-count">{total} bản ghi</span></div>
          <div style={{ padding: "0 21px" }}>
            <div className="admin-filter-tabs">
              <button
                className={`admin-filter-tab${statusFilter === "all" ? " is-active" : ""}`}
                onClick={() => { setStatusFilter("all"); setPage(1); }}
                type="button"
              >
                Tất cả <span className="admin-filter-tab-count">{services.length}</span>
              </button>
              <button
                className={`admin-filter-tab${statusFilter === "active" ? " is-active" : ""}`}
                onClick={() => { setStatusFilter("active"); setPage(1); }}
                type="button"
              >
                Đang hiển thị <span className="admin-filter-tab-count">{services.filter((s) => s.isActive && s.status === "published").length}</span>
              </button>
              <button
                className={`admin-filter-tab${statusFilter === "draft" ? " is-active" : ""}`}
                onClick={() => { setStatusFilter("draft"); setPage(1); }}
                type="button"
              >
                Bản nháp / Chờ duyệt <span className="admin-filter-tab-count">{services.filter((s) => s.status === "draft" || s.status === "review").length}</span>
              </button>
              <button
                className={`admin-filter-tab${statusFilter === "hidden" ? " is-active" : ""}`}
                onClick={() => { setStatusFilter("hidden"); setPage(1); }}
                type="button"
              >
                Tạm ẩn <span className="admin-filter-tab-count">{services.filter((s) => !s.isActive || s.status === "archived").length}</span>
              </button>
            </div>
          </div>
          {services.length === 0 ? <AdminEmptyState title={query ? "Không tìm thấy dịch vụ phù hợp" : "Chưa có dịch vụ"} description={query ? "Thử một từ khóa khác. Không có dữ liệu mẫu được đưa vào danh sách." : "Bạn có thể tạo dịch vụ mới từ nút Thêm dịch vụ."} /> : (
            <>
              <div className="admin-table-scroll">
                <table className="admin-table admin-product-table">
                  <thead><tr>{canManage ? <th scope="col"><input aria-label="Chọn tất cả dịch vụ trong trang" checked={filteredServices.length > 0 && filteredServices.every((service) => selectedIds.has(service.id))} disabled={batchArchiving || batchActivating} onChange={toggleAllVisible} type="checkbox" /></th> : null}<th scope="col">Dịch vụ</th><th scope="col">Tóm tắt</th><th scope="col">Trạng thái</th><th scope="col">Tối thiểu</th><th scope="col">Thời gian làm hàng</th><th scope="col">Cập nhật</th>{canManage ? <th scope="col">Thao tác</th> : null}</tr></thead>
                  <tbody>
                    {filteredServices.map((service) => (
                      <tr data-testid={`row-service-${service.id}`} key={service.id}>
                        {canManage ? <td><input aria-label={`Chọn dịch vụ ${service.name}`} checked={selectedIds.has(service.id)} disabled={batchArchiving || batchActivating} onChange={() => toggleSelected(service.id)} type="checkbox" /></td> : null}
                        <td className="admin-product-summary">
                          <div className="admin-product-cell">
                            <button
                              className="admin-thumb admin-thumb-clickable"
                              disabled={saving}
                              onClick={() => openEdit(service)}
                              title={`Sửa dịch vụ ${service.name}`}
                              type="button"
                            >
                              {service.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img alt={`Ảnh dịch vụ ${service.name}`} src={service.imageUrl} />
                              ) : (
                                <span>{getInitials(service.name)}</span>
                              )}
                            </button>
                            <div className="admin-item-name">
                              <button
                                className="admin-product-name-btn"
                                data-testid={`link-service-edit-${service.id}`}
                                disabled={saving}
                                onClick={() => openEdit(service)}
                                title={`Sửa dịch vụ ${service.name}`}
                                type="button"
                              >
                                {service.name}
                              </button>
                              <div className="admin-item-meta" style={{ alignItems: "center", display: "inline-flex", gap: 5 }}>
                                <span>{service.slug}</span>
                                {service.slug && service.isActive ? (
                                  <a
                                    className="admin-external-link-btn"
                                    href={`/dich-vu/${service.slug}/`}
                                    onClick={(event) => event.stopPropagation()}
                                    rel="noreferrer"
                                    target="_blank"
                                    title="Xem trang dịch vụ trên website"
                                  >
                                    <ExternalLink size={12} />
                                  </a>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td><div className="admin-description">{service.summary || service.description || "Chưa có tóm tắt"}</div></td>
                        <td><AdminStatusBadge kind={service.isActive && service.status === "published" ? "green" : service.status === "draft" || service.status === "review" ? "amber" : "neutral"} value={service.isActive ? serviceStatusLabels[service.status] ?? service.status : "Tạm ẩn"} /></td>
                        <td className="admin-description">{service.moqSummary || "Chưa có"}</td>
                        <td className="admin-mono">{service.leadTimeDays !== null ? `${service.leadTimeDays} ngày` : "Chưa có"}</td>
                        <td className="admin-mono">{formatAdminDate(service.updatedAt)}</td>
                        {canManage ? (
                          <td>
                            <div className="admin-table-actions">
                              <button className="admin-button admin-button-quiet" data-testid={`button-service-edit-${service.id}`} onClick={() => openEdit(service)} type="button">Sửa</button>
                              {service.isActive ? (
                                <button className="admin-button admin-button-danger" data-testid={`button-service-archive-${service.id}`} disabled={archivingId === service.id || batchArchiving || batchActivating} onClick={() => setConfirmArchive(service)} type="button">
                                  {archivingId === service.id ? "Đang ẩn" : "Ẩn"}
                                </button>
                              ) : (
                                <button className="admin-button admin-button-primary" data-testid={`button-service-activate-${service.id}`} disabled={activatingId === service.id || batchArchiving || batchActivating} onClick={() => void unhideService(service)} style={{ fontSize: 12, minHeight: 28, padding: "0 8px" }} type="button">
                                  {activatingId === service.id ? "Đang hiện…" : "Hiện"}
                                </button>
                              )}
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
  {pendingEditor ? (
    <AdminConfirmDialog
      cancelLabel="Ở lại"
      confirmLabel="Bỏ thay đổi"
      message="Dịch vụ có thay đổi chưa lưu. Bỏ các thay đổi này?"
      onConfirm={() => applyServiceEditor(pendingEditor.form)}
      onDismiss={() => setPendingEditor(null)}
      title="Bỏ thay đổi chưa lưu?"
    />
  ) : null}
      {confirmArchive ? (
        <AdminConfirmDialog
          confirmLabel="Ẩn dịch vụ"
          message={`Ẩn dịch vụ “${confirmArchive.name}” khỏi trang web? Dữ liệu vẫn được giữ và có thể bật lại.`}
          onConfirm={() => void archiveService(confirmArchive)}
          onDismiss={() => setConfirmArchive(null)}
          title="Ẩn dịch vụ?"
        />
      ) : null}
      {confirmBatchArchive.length > 0 ? (
        <AdminConfirmDialog
          confirmLabel="Ẩn các dịch vụ"
          message={`Ẩn ${confirmBatchArchive.length} dịch vụ khỏi trang web? Dữ liệu vẫn được giữ và có thể bật lại.`}
          onConfirm={() => void archiveSelectedServices()}
          onDismiss={() => setConfirmBatchArchive([])}
          title="Ẩn các dịch vụ đã chọn?"
        />
      ) : null}
    </div>
  );
}

interface ServiceEditorProps {
  error: AdminClientError | null;
  form: ServiceFormState;
  onCancel: () => void;
  onChange: (value: ServiceFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
}

function ServiceEditor({ error, form, onCancel, onChange, onSubmit, saving }: ServiceEditorProps) {
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useAdminToast();

  async function uploadServiceFile(file: File) {
    if (!form.id) {
      showToast("info", "Hãy lưu bản nháp dịch vụ trước khi tải ảnh từ máy tính, hoặc dán đường dẫn ảnh.");
      return;
    }
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.set("requestId", crypto.randomUUID());
      formData.set("serviceId", String(form.id));
      formData.set("file", file);
      const res = await fetch("/api/admin/media", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json() as { ok?: boolean; data?: { media: { publicUrl: string } }; message?: string };
      if (res.ok && data.data?.media?.publicUrl) {
        update("imageUrl", data.data.media.publicUrl);
        showToast("success", "Đã tải ảnh lên và đặt làm ảnh chính dịch vụ.");
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
      await uploadServiceFile(file);
    }
    if (event.target) event.target.value = "";
  }

  function update<K extends keyof ServiceFormState>(key: K, value: ServiceFormState[K]) {
    onChange({ ...form, [key]: value });
  }

  const parsedOfferingRows = useMemo(() => {
    if (!form.offeringsText.trim()) return [];
    return form.offeringsText
      .split("\n")
      .map((line) => {
        const parts = line.split("|").map((p) => p.trim());
        return { name: parts[0] || "", path: parts[1] || "" };
      });
  }, [form.offeringsText]);

  function updateOfferingRow(index: number, field: "name" | "path", val: string) {
    const lines = form.offeringsText ? form.offeringsText.split("\n") : [];
    while (lines.length <= index) lines.push("");
    const parts = lines[index].split("|").map((p) => p.trim());
    const curName = parts[0] || "";
    const curPath = parts[1] || "";
    if (field === "name") {
      lines[index] = `${val} | ${curPath}`;
    } else {
      lines[index] = `${curName} | ${val}`;
    }
    update("offeringsText", lines.join("\n"));
  }

  function addOfferingRow() {
    const lines = form.offeringsText.trim() ? form.offeringsText.split("\n") : [];
    lines.push("Dịch vụ mới | /dich-vu/...");
    update("offeringsText", lines.join("\n"));
  }

  function removeOfferingRow(index: number) {
    const lines = form.offeringsText.split("\n");
    lines.splice(index, 1);
    update("offeringsText", lines.join("\n"));
  }

  return (
    <section className="admin-editor admin-haravan-editor" aria-labelledby="service-editor-heading">
      <form noValidate onSubmit={onSubmit}>
        <div className="admin-haravan-topbar">
          <div className="admin-haravan-topbar-left">
            <button
              className="admin-button admin-button-quiet"
              disabled={saving}
              onClick={onCancel}
              style={{ alignItems: "center", display: "inline-flex", gap: 6, fontWeight: 600 }}
              type="button"
            >
              <ArrowLeft size={16} /> Danh sách dịch vụ
            </button>
            <div className="admin-haravan-title-wrap">
              <h2 className="admin-panel-title" id="service-editor-heading" style={{ fontSize: 18, margin: 0 }}>
                {form.id ? form.name || `Dịch vụ #${form.id}` : "Thêm dịch vụ mới"}
              </h2>
              {form.id ? (
                <span className={`admin-status-badge admin-status-${form.status}`}>
                  {serviceStatusLabels[form.status] || form.status}
                </span>
              ) : (
                <span className="admin-stamp">BẢN GHI MỚI</span>
              )}
            </div>
          </div>
          <div className="admin-haravan-topbar-right">
            {form.slug && form.isActive ? (
              <a
                className="admin-button admin-button-quiet"
                href={`/dich-vu/${form.slug}/`}
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
              data-testid="button-service-cancel"
              disabled={saving}
              onClick={onCancel}
              type="button"
            >
              Hủy
            </button>
            <button
              className="admin-button admin-button-primary"
              data-testid="button-service-save"
              disabled={saving}
              type="submit"
            >
              {saving ? "Đang lưu..." : "Lưu dịch vụ"}
            </button>
          </div>
        </div>

        {error ? <p className="admin-editor-error" role="alert">{error.code ? `${error.code} · ` : ""}{error.message}</p> : null}
        {error?.fieldErrors && Object.keys(error.fieldErrors).length > 0 ? (
          <ul className="admin-editor-error-list" data-testid="service-form-field-errors">
            {Object.entries(error.fieldErrors).map(([field, message]) => (
              <li key={field}>{field}: {message}</li>
            ))}
          </ul>
        ) : null}

        <div className="admin-haravan-grid">
          {/* CỘT CHÍNH (Trái) */}
          <div className="admin-haravan-main">
            {/* Card 1: Thông tin chung */}
            <div className="admin-haravan-card">
              <h3 className="admin-haravan-card-title">Thông tin chung</h3>
              <label className="admin-field">
                <span>Tên dịch vụ <b aria-hidden="true">*</b></span>
                <input
                  className="admin-input"
                  data-testid="input-service-name"
                  disabled={saving}
                  onChange={(event) => {
                    const newName = event.target.value;
                    if (!form.id && (!form.slug || form.slug === toSlug(form.name))) {
                      onChange({ ...form, name: newName, slug: toSlug(newName) });
                    } else {
                      update("name", newName);
                    }
                  }}
                  placeholder="Ví dụ: Gia công chi tiết máy CNC, Ép nhựa kỹ thuật..."
                  required
                  style={{ fontSize: 15, fontWeight: 500 }}
                  value={form.name}
                />
              </label>

              <label className="admin-field">
                <span>Đường dẫn (slug) <b aria-hidden="true">*</b></span>
                <input
                  className="admin-input admin-mono"
                  data-testid="input-service-slug"
                  disabled={saving}
                  onChange={(event) => update("slug", event.target.value)}
                  placeholder="gia-cong-chi-tiet-may-cnc"
                  required
                  value={form.slug}
                />
              </label>

              <label className="admin-field">
                <span>Tóm tắt dịch vụ</span>
                <textarea
                  className="admin-textarea"
                  data-testid="input-service-summary"
                  disabled={saving}
                  onChange={(event) => update("summary", event.target.value)}
                  placeholder="Mô tả súc tích về năng lực sản xuất, quy mô máy móc và thế mạnh của dịch vụ này..."
                  rows={3}
                  value={form.summary}
                />
              </label>

              <label className="admin-field">
                <span>Mô tả chi tiết</span>
                <textarea
                  className="admin-textarea"
                  data-testid="input-service-description"
                  disabled={saving}
                  onChange={(event) => update("description", event.target.value)}
                  placeholder="Chi tiết công nghệ, quy trình sản xuất, tiêu chuẩn nghiệm thu và năng lực xuất khẩu..."
                  rows={6}
                  value={form.description}
                />
              </label>
            </div>

            {/* Card 2: Nhóm dịch vụ & Năng lực */}
            <div className="admin-haravan-card">
              <h3 className="admin-haravan-card-title">Dịch vụ con trong nhóm & Quy chuẩn</h3>
              <div className="admin-field">
                <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontWeight: 600 }}>Dịch vụ con trong nhóm ({parsedOfferingRows.length})</span>
                  <button
                    className="admin-button admin-button-quiet"
                    disabled={saving}
                    onClick={addOfferingRow}
                    style={{ fontSize: 12, padding: "2px 8px" }}
                    type="button"
                  >
                    + Thêm dòng dịch vụ con
                  </button>
                </div>
                {parsedOfferingRows.length === 0 ? (
                  <div style={{ background: "#f8faf8", border: "1px dashed var(--admin-border, #dce3dc)", borderRadius: 6, padding: "14px", textAlign: "center" }}>
                    <p style={{ color: "var(--admin-text-subtle)", fontSize: 13, margin: "0 0 8px" }}>Chưa có dịch vụ con nào trong nhóm năng lực này.</p>
                    <button className="admin-button admin-button-quiet" disabled={saving} onClick={addOfferingRow} style={{ fontSize: 12 }} type="button">+ Thêm dịch vụ con đầu tiên</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {parsedOfferingRows.map((row, idx) => (
                      <div key={idx} style={{ alignItems: "center", display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr auto" }}>
                        <input
                          className="admin-input"
                          disabled={saving}
                          onChange={(e) => updateOfferingRow(idx, "name", e.target.value)}
                          placeholder="Tên dịch vụ con (VD: Phay CNC 4 trục)"
                          value={row.name}
                        />
                        <input
                          className="admin-input admin-mono"
                          disabled={saving}
                          onChange={(e) => updateOfferingRow(idx, "path", e.target.value)}
                          placeholder="Đường dẫn (VD: /dich-vu/phay-cnc/)"
                          value={row.path}
                        />
                        <button
                          className="admin-button admin-button-quiet admin-button-danger"
                          disabled={saving}
                          onClick={() => removeOfferingRow(idx)}
                          style={{ minHeight: 34, padding: "0 8px" }}
                          title="Xóa dòng này"
                          type="button"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <details style={{ marginTop: 12 }}>
                  <summary style={{ color: "var(--admin-text-subtle)", cursor: "pointer", fontSize: 12 }}>
                    Chỉnh sửa nhanh dạng văn bản (Tên | /đường-dẫn/)
                  </summary>
                  <textarea
                    className="admin-textarea admin-mono"
                    data-testid="input-service-offerings"
                    disabled={saving}
                    onChange={(event) => update("offeringsText", event.target.value)}
                    placeholder={"Phay CNC 4-5 trục | /dich-vu/phay-cnc/\nTiện CNC chính xác | /dich-vu/tien-cnc/\nCắt dây EDM | /dich-vu/cat-day-edm/"}
                    rows={4}
                    style={{ marginTop: 6 }}
                    value={form.offeringsText}
                  />
                </details>
              </div>

              <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr", marginTop: 12 }}>
                <label className="admin-field">
                  <span>Số lượng tối thiểu (MOQ)</span>
                  <input
                    className="admin-input"
                    data-testid="input-service-moq"
                    disabled={saving}
                    onChange={(event) => update("moqSummary", event.target.value)}
                    placeholder="Ví dụ: từ 100 chiếc / mẻ"
                    value={form.moqSummary}
                  />
                </label>

                <label className="admin-field">
                  <span>Thời gian làm hàng (ngày)</span>
                  <input
                    className="admin-input admin-mono"
                    data-testid="input-service-lead-time"
                    disabled={saving}
                    inputMode="numeric"
                    min="0"
                    onChange={(event) => update("leadTimeDays", event.target.value)}
                    placeholder="7"
                    type="number"
                    value={form.leadTimeDays}
                  />
                </label>
              </div>
            </div>

            {/* Card 3: Ảnh chính */}
            <div className="admin-haravan-card">
              <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between", marginBottom: 12 }}>
                <h3 className="admin-haravan-card-title" style={{ margin: 0 }}>Ảnh chính dịch vụ</h3>
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
                        showToast("info", "Hãy lưu bản nháp dịch vụ trước khi tải ảnh từ máy tính.");
                        return;
                      }
                      fileInputRef.current?.click();
                    }}
                    style={{ fontSize: 12 }}
                    type="button"
                  >
                    {uploadingImage ? "Đang tải ảnh..." : "Tải ảnh từ máy tính"}
                  </button>
                </div>
              </div>
              <div className="admin-item-meta" data-testid="service-main-image">
                <label className="admin-field" style={{ marginBottom: 12 }}>
                  <span>Đường dẫn ảnh</span>
                  <div className="admin-input-actions">
                    <input
                      className="admin-input"
                      disabled={saving}
                      onChange={(event) => update("imageUrl", event.target.value)}
                      placeholder="/media/services/... hoặc https://..."
                      value={form.imageUrl}
                    />
                  </div>
                </label>
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
                      void uploadServiceFile(droppedFile);
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
                    minHeight: 100,
                    padding: 12,
                    position: "relative",
                    transition: "all 0.2s ease",
                  }}
                >
                  {form.imageUrl ? (
                    <div style={{ alignItems: "center", display: "flex", gap: 14 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt="Ảnh chính dịch vụ"
                        src={form.imageUrl}
                        style={{ borderRadius: 8, height: 72, objectFit: "cover", width: 100, border: "1px solid var(--admin-border)" }}
                      />
                      <div>
                        <button
                          className="admin-button admin-button-quiet admin-button-danger"
                          data-testid="button-service-clear-image"
                          onClick={() => update("imageUrl", "")}
                          type="button"
                        >
                          Gỡ ảnh chính
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p style={{ color: "var(--admin-text-subtle)", fontSize: 13, margin: 0, textAlign: "center" }}>
                      {isDragging
                        ? "Thả file ảnh vào đây để tải lên ngay..."
                        : "Kéo thả ảnh vào đây, hoặc nhấn \"Tải ảnh từ máy tính\" để làm đại diện cho dịch vụ."}
                    </p>
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
              </div>
            </div>
          </div>

          {/* CỘT PHỤ (Phải) */}
          <div className="admin-haravan-sidebar">
            {/* Card 1: Trạng thái & Hiển thị */}
            <div className="admin-haravan-card">
              <h3 className="admin-haravan-card-title">Trạng thái & Hiển thị</h3>
              <label className="admin-field">
                <span>Trạng thái phát hành</span>
                <select
                  className="admin-select"
                  data-testid="select-service-status"
                  disabled={saving}
                  onChange={(event) => {
                    const status = event.target.value as ServiceFormState["status"];
                    onChange({
                      ...form,
                      isActive: status === "published" ? true : false,
                      status,
                    });
                  }}
                  value={form.status}
                >
                  <option value="draft">Bản nháp</option>
                  <option value="review">Chờ duyệt</option>
                  <option value="published">Đã xuất bản</option>
                  <option value="archived">Lưu trữ</option>
                </select>
              </label>

              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--admin-border, #dce3dc)" }}>
                <label className="admin-check">
                  <input
                    checked={form.isActive}
                    data-testid="checkbox-service-active"
                    disabled={saving}
                    onChange={(event) => {
                      const active = event.target.checked;
                      onChange({
                        ...form,
                        isActive: active,
                        status: active ? "published" : form.status === "published" ? "draft" : form.status,
                      });
                    }}
                    type="checkbox"
                  />
                  <span>
                    <strong>Hiển thị trên website</strong>
                    <small>{form.isActive ? "Khách hàng ngoài website có thể xem dịch vụ này." : "Dịch vụ đang ẩn hoặc ở trạng thái nháp."}</small>
                  </span>
                </label>
              </div>
            </div>

            {/* Card 2: Nút kêu gọi hành động (CTA) */}
            <div className="admin-haravan-card">
              <h3 className="admin-haravan-card-title">Nút kêu gọi hành động (CTA)</h3>
              <label className="admin-field">
                <span>Nhãn nút liên hệ</span>
                <input
                  className="admin-input"
                  data-testid="input-service-cta-label"
                  disabled={saving}
                  onChange={(event) => update("ctaLabel", event.target.value)}
                  placeholder="Liên hệ tư vấn"
                  value={form.ctaLabel}
                />
              </label>

              <label className="admin-field">
                <span>Đường dẫn nút liên hệ</span>
                <input
                  className="admin-input admin-mono"
                  data-testid="input-service-cta-href"
                  disabled={saving}
                  onChange={(event) => update("ctaHref", event.target.value)}
                  placeholder="/lien-he/?service=..."
                  value={form.ctaHref}
                />
              </label>
            </div>

            {/* Card 3: Sắp xếp */}
            <div className="admin-haravan-card">
              <h3 className="admin-haravan-card-title">Thứ tự hiển thị</h3>
              <label className="admin-field">
                <span>Thứ tự nhóm</span>
                <input
                  className="admin-input admin-mono"
                  data-testid="input-service-sort-order"
                  disabled={saving}
                  inputMode="numeric"
                  min="0"
                  onChange={(event) => update("sortOrder", event.target.value)}
                  type="number"
                  value={form.sortOrder}
                />
                <small className="admin-item-meta">Số nhỏ hơn sẽ hiển thị trước ngoài danh mục dịch vụ.</small>
              </label>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="admin-editor-footer" style={{ marginTop: 24 }}>
          <span className="admin-item-meta">
            {form.id ? `Mã dịch vụ #${form.id} · Cập nhật theo thời gian thực` : "Bản ghi dịch vụ mới chưa lưu"}
          </span>
          <div className="admin-editor-actions">
            <button
              className="admin-button admin-button-quiet"
              data-testid="button-service-cancel"
              disabled={saving}
              onClick={onCancel}
              type="button"
            >
              Hủy
            </button>
            <button
              className="admin-button admin-button-primary"
              data-testid="button-service-save"
              disabled={saving}
              type="submit"
            >
              {saving ? "Đang lưu..." : "Lưu dịch vụ"}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
