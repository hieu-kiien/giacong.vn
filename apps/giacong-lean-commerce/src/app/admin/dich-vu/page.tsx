"use client";

import { Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useAdminUnsaved, useRegisterAdminUnsaved } from "@/components/admin/AdminUnsavedGuard";
import { AdminMediaPanel } from "@/components/admin/AdminMediaPanel";
import { AdminEmptyState, AdminErrorState, AdminLoadingTable, AdminPageHeading, AdminPagination, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { useAdminSession } from "@/components/admin/AdminShell";
import { AdminConfirmDialog } from "@/components/admin/AdminDialog";
import { useAdminToast } from "@/components/admin/AdminToast";
import { AdminClientError, fetchAdmin, formatAdminDate, mutateAdmin, type AdminService } from "@/lib/admin-client";
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
  const serviceBatchRequest = useRef<PendingServiceBatch | null>(null);
  const serviceBatchInFlight = useRef(false);
  const { isDirty: hasUnsavedChanges, saving: nestedSaving } = useAdminUnsaved();
  const isDirty = useCallback(() => editor !== null && JSON.stringify(editor) !== JSON.stringify(editorSnapshot), [editor, editorSnapshot]);
  useRegisterAdminUnsaved(isDirty, saving);

  const applyServiceEditor = useCallback((form: ServiceFormState | null) => {
    setEditor(form);
    setEditorSnapshot(form);
    setSaveError(null);
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
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (query) params.set("query", query);
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
  }, [session.subject, page, query, attempt]);

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
      await mutateAdmin<{ service: AdminServiceWithRevision }>(
        editor.id ? `/api/admin/services/${editor.id}` : "/api/admin/services",
        { body: payload, method: editor.id ? "PATCH" : "POST" },
      );
      setEditor(null);
      setAttempt((value) => value + 1);
      showToast("success", "Đã lưu dịch vụ.");
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

  function toggleSelected(id: number) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    const activeServices = services.filter((service) => service.isActive);
    setSelectedIds((current) => {
      const next = new Set(current);
      const allSelected = activeServices.length > 0 && activeServices.every((service) => next.has(service.id));
      for (const service of activeServices) {
        if (allSelected) next.delete(service.id);
        else next.add(service.id);
      }
      return next;
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
      <AdminPageHeading kicker="Năng lực sản xuất" title="Dịch vụ gia công" subtitle="Quản lý danh mục năng lực sản xuất, số lượng tối thiểu và thời gian làm hàng đang công bố." stamp="DANH MỤC DỊCH VỤ" />
      {editor ? <ServiceEditor error={saveError} form={editor} onChange={setEditor} onCancel={() => requestServiceEditor(null)} onSubmit={submitService} saving={saving} /> : null}
      {pendingEditor ? <AdminConfirmDialog cancelLabel="Ở lại" confirmLabel="Bỏ thay đổi" message="Dịch vụ có thay đổi chưa lưu. Bỏ các thay đổi này?" onConfirm={() => applyServiceEditor(pendingEditor.form)} onDismiss={() => setPendingEditor(null)} title="Bỏ thay đổi chưa lưu?" /> : null}
      {editor?.id ? <AdminMediaPanel serviceId={editor.id} title="Ảnh dịch vụ và hồ sơ năng lực" /> : null}
      <form className="admin-toolbar" onSubmit={submitSearch}>
        <div className="admin-search-wrap">
          <label className="admin-label" htmlFor="service-search">Tìm theo tên, đường dẫn hoặc nội dung</label>
          <Search aria-hidden="true" />
          <input className="admin-input has-icon" data-testid="input-service-search" id="service-search" onChange={(event) => setInputQuery(event.target.value)} placeholder="Ví dụ: đóng gói, trà, viên nang..." value={inputQuery} />
        </div>
        <button className="admin-button admin-button-primary" data-testid="button-service-search" type="submit"><Search size={15} /> Tìm dịch vụ</button>
        {query ? <button className="admin-button admin-button-quiet" data-testid="button-service-clear-search" onClick={clearSearch} type="button">Xóa tìm kiếm</button> : null}
        {canManage && selectedIds.size > 0 ? (
          <>
            <span aria-live="polite" className="admin-item-meta" data-testid="service-selection-count">Đã chọn {selectedIds.size}</span>
            <button className="admin-button admin-button-danger" data-testid="button-service-batch-archive" disabled={batchArchiving} onClick={() => setConfirmBatchArchive(services.filter((service) => selectedIds.has(service.id) && service.isActive))} type="button">{batchArchiving ? "Đang ẩn..." : "Ẩn đã chọn"}</button>
          </>
        ) : null}
        {canManage ? <button className="admin-button admin-button-primary" data-testid="button-service-create" onClick={openCreate} type="button">Thêm dịch vụ</button> : null}
      </form>
      {error ? <AdminErrorState error={error} onRetry={() => setAttempt((value) => value + 1)} /> : loading ? <AdminLoadingTable /> : (
        <section className="admin-panel admin-table-panel" aria-labelledby="service-table-heading">
          <div className="admin-panel-heading" style={{ padding: "21px 21px 0" }}><div><h2 className="admin-panel-title" id="service-table-heading">Danh mục dịch vụ</h2><p className="admin-panel-caption">{query ? `Kết quả cho “${query}”` : "Sắp xếp theo ID tăng dần"}</p></div><span className="admin-count">{total} bản ghi</span></div>
          {services.length === 0 ? <AdminEmptyState title={query ? "Không tìm thấy dịch vụ phù hợp" : "Chưa có dịch vụ"} description={query ? "Thử một từ khóa khác. Không có dữ liệu mẫu được đưa vào danh sách." : "Bạn có thể tạo dịch vụ mới từ nút Thêm dịch vụ."} /> : (
            <>
              <div className="admin-table-scroll">
                <table className="admin-table">
                  <thead><tr>{canManage ? <th scope="col"><input aria-label="Chọn tất cả dịch vụ trong trang" checked={services.some((service) => service.isActive) && services.filter((service) => service.isActive).every((service) => selectedIds.has(service.id))} disabled={batchArchiving} onChange={toggleAllVisible} type="checkbox" /></th> : null}<th scope="col">Dịch vụ</th><th scope="col">Tóm tắt</th><th scope="col">Trạng thái</th><th scope="col">Tối thiểu</th><th scope="col">Thời gian làm hàng</th><th scope="col">Cập nhật</th>{canManage ? <th scope="col">Thao tác</th> : null}</tr></thead>
                  <tbody>
                    {services.map((service) => (
                      <tr data-testid={`row-service-${service.id}`} key={service.id}>
                        {canManage ? <td><input aria-label={`Chọn dịch vụ ${service.name}`} checked={selectedIds.has(service.id)} disabled={!service.isActive || batchArchiving} onChange={() => toggleSelected(service.id)} type="checkbox" /></td> : null}
                        <td><div className="admin-item-name">{service.name}<div className="admin-item-meta">{service.slug}</div></div></td>
                        <td><div className="admin-description">{service.summary || service.description || "Chưa có tóm tắt"}</div></td>
                        <td><AdminStatusBadge kind={service.isActive && service.status === "published" ? "green" : service.status === "draft" || service.status === "review" ? "amber" : "neutral"} value={service.isActive ? serviceStatusLabels[service.status] ?? service.status : "Tạm ẩn"} /></td>
                        <td className="admin-description">{service.moqSummary || "Chưa có"}</td>
                        <td className="admin-mono">{service.leadTimeDays !== null ? `${service.leadTimeDays} ngày` : "Chưa có"}</td>
                        <td className="admin-mono">{formatAdminDate(service.updatedAt)}</td>
                        {canManage ? <td><div className="admin-table-actions"><button className="admin-button admin-button-quiet" data-testid={`button-service-edit-${service.id}`} onClick={() => openEdit(service)} type="button">Sửa</button>{service.isActive ? <button className="admin-button admin-button-danger" data-testid={`button-service-archive-${service.id}`} disabled={archivingId === service.id || batchArchiving} onClick={() => setConfirmArchive(service)} type="button">{archivingId === service.id ? "Đang ẩn" : "Ẩn"}</button> : null}</div></td> : null}
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
  function update<K extends keyof ServiceFormState>(key: K, value: ServiceFormState[K]) {
    onChange({ ...form, [key]: value });
  }

  return (
    <section className="admin-editor" aria-labelledby="service-editor-heading">
      <div className="admin-editor-heading">
        <div>
          <div className="admin-kicker">Năng lực / chỉnh sửa</div>
          <h2 className="admin-panel-title" id="service-editor-heading">{form.id ? "Cập nhật dịch vụ" : "Tạo dịch vụ mới"}</h2>
          <p className="admin-panel-caption">Lưu dưới dạng bản nháp trước; chỉ dịch vụ đã đăng và bật hiển thị mới hiện ra trang web.</p>
        </div>
        <span className="admin-stamp">{form.id ? `ID ${form.id}` : "BẢN GHI MỚI"}</span>
      </div>
      {error ? <p className="admin-editor-error" role="alert">{error.code ? `${error.code} · ` : ""}{error.message}</p> : null}
      {error?.fieldErrors && Object.keys(error.fieldErrors).length > 0 ? (
        <ul className="admin-editor-error-list" data-testid="service-form-field-errors">
          {Object.entries(error.fieldErrors).map(([field, message]) => (
            <li key={field}>{field}: {message}</li>
          ))}
        </ul>
      ) : null}
      <form onSubmit={onSubmit}>
        <div className="admin-editor-grid">
          <label className="admin-field"><span>Tên dịch vụ <b aria-hidden="true">*</b></span><input className="admin-input" data-testid="input-service-name" onChange={(event) => update("name", event.target.value)} required value={form.name} /></label>
          <label className="admin-field"><span>Đường dẫn (slug) <b aria-hidden="true">*</b></span><input className="admin-input admin-mono" data-testid="input-service-slug" onChange={(event) => update("slug", event.target.value)} required value={form.slug} /></label>
          <label className="admin-field"><span>Trạng thái phát hành</span><select className="admin-select" data-testid="select-service-status" onChange={(event) => { const status = event.target.value as ServiceFormState["status"]; onChange({ ...form, isActive: status === "published" ? form.isActive : false, status }); }} value={form.status}><option value="draft">Bản nháp</option><option value="review">Chờ duyệt</option><option value="published">Đã xuất bản</option><option value="archived">Lưu trữ</option></select></label>
          <label className="admin-field"><span>Thời gian làm hàng (ngày)</span><input className="admin-input admin-mono" data-testid="input-service-lead-time" inputMode="numeric" min="0" onChange={(event) => update("leadTimeDays", event.target.value)} type="number" value={form.leadTimeDays} /></label>
          <label className="admin-field admin-field-wide"><span>Số lượng tối thiểu</span><input className="admin-input" data-testid="input-service-moq" onChange={(event) => update("moqSummary", event.target.value)} placeholder="Ví dụ: từ 500 kg / mẻ" value={form.moqSummary} /></label>
          <label className="admin-field admin-field-wide"><span>Tóm tắt</span><textarea className="admin-textarea" data-testid="input-service-summary" onChange={(event) => update("summary", event.target.value)} rows={2} value={form.summary} /></label>
          <label className="admin-field admin-field-wide"><span>Dịch vụ trong nhóm</span><textarea className="admin-textarea admin-mono" data-testid="input-service-offerings" onChange={(event) => update("offeringsText", event.target.value)} placeholder="Tên hiển thị | /đường-dẫn/" rows={7} value={form.offeringsText} /><small className="admin-item-meta">Mỗi dòng một mục. Thứ tự từ trên xuống là thứ tự hiển thị ngoài website.</small></label>
          <label className="admin-field"><span>Nhãn nút liên hệ</span><input className="admin-input" data-testid="input-service-cta-label" onChange={(event) => update("ctaLabel", event.target.value)} value={form.ctaLabel} /></label>
          <label className="admin-field"><span>Đường dẫn nút liên hệ</span><input className="admin-input admin-mono" data-testid="input-service-cta-href" onChange={(event) => update("ctaHref", event.target.value)} placeholder="/lien-he/?service=..." value={form.ctaHref} /></label>
          <label className="admin-field"><span>Thứ tự nhóm</span><input className="admin-input admin-mono" data-testid="input-service-sort-order" inputMode="numeric" min="0" onChange={(event) => update("sortOrder", event.target.value)} type="number" value={form.sortOrder} /></label>
          <div className="admin-field admin-field-wide">
            <span>Ảnh chính</span>
            <div className="admin-item-meta" data-testid="service-main-image">
              {form.imageUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="Ảnh chính dịch vụ" src={form.imageUrl} style={{ borderRadius: 8, height: 52, marginRight: 8, objectFit: "cover", verticalAlign: "middle", width: 72 }} />
                  <button className="admin-button admin-button-quiet" data-testid="button-service-clear-image" onClick={() => update("imageUrl", "")} type="button">Gỡ ảnh chính</button>
                </>
              ) : (
                <>Chưa có. Lưu bản nháp trước; sau đó panel ảnh sẽ xuất hiện bên dưới để tải lên và chọn “Dùng làm ảnh chính”.</>
              )}
            </div>
          </div>
          <label className="admin-field admin-field-wide"><span>Mô tả chi tiết</span><textarea className="admin-textarea" data-testid="input-service-description" onChange={(event) => update("description", event.target.value)} rows={5} value={form.description} /></label>
        </div>
        <div className="admin-editor-footer">
          <label className={`admin-check${form.status !== "published" ? " is-disabled" : ""}`}><input checked={form.isActive} data-testid="checkbox-service-active" disabled={form.status !== "published"} onChange={(event) => update("isActive", event.target.checked)} type="checkbox" /><span><strong>Hiển thị trên storefront</strong><small>{form.status === "published" ? "Public service read sẽ thấy dịch vụ này." : "Chỉ published mới có thể hiển thị."}</small></span></label>
          <div className="admin-editor-actions"><button className="admin-button admin-button-quiet" data-testid="button-service-cancel" onClick={onCancel} type="button">Hủy</button><button className="admin-button admin-button-primary" data-testid="button-service-save" disabled={saving} type="submit">{saving ? "Đang lưu..." : "Lưu dịch vụ"}</button></div>
        </div>
      </form>
    </section>
  );
}
