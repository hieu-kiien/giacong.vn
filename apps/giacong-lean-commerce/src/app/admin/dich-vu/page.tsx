"use client";

import { Search } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { AdminMediaPanel } from "@/components/admin/AdminMediaPanel";
import { AdminEmptyState, AdminErrorState, AdminLoadingTable, AdminPageHeading, AdminPagination, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { useAdminSession } from "@/components/admin/AdminShell";
import { AdminClientError, fetchAdmin, formatAdminDate, mutateAdmin, type AdminService } from "@/lib/admin-client";

interface ServiceResponse {
  services: AdminService[];
  total: number;
  pagination?: { currentPage: number; lastPage: number; pageSize: number; total: number };
}

type ServiceFormState = {
  description: string;
  id?: number;
  isActive: boolean;
  leadTimeDays: string;
  moqSummary: string;
  name: string;
  slug: string;
  status: "archived" | "draft" | "published" | "review";
  summary: string;
};

const emptyServiceForm: ServiceFormState = {
  description: "",
  isActive: false,
  leadTimeDays: "",
  moqSummary: "",
  name: "",
  slug: "",
  status: "draft",
  summary: "",
};

export default function AdminServicesPage() {
  const session = useAdminSession();
  const [services, setServices] = useState<AdminService[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AdminClientError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [editor, setEditor] = useState<ServiceFormState | null>(null);
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
    setEditor({ ...emptyServiceForm });
  }

  function openEdit(service: AdminService) {
    setSaveError(null);
    setEditor({
      description: service.description,
      id: service.id,
      isActive: service.isActive,
      leadTimeDays: service.leadTimeDays === null ? "" : String(service.leadTimeDays),
      moqSummary: service.moqSummary ?? "",
      name: service.name,
      slug: service.slug,
      status: service.status as ServiceFormState["status"],
      summary: service.summary,
    });
  }

  async function submitService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    setSaving(true);
    setSaveError(null);
    const payload = {
      description: editor.description,
      isActive: editor.isActive,
      leadTimeDays: editor.leadTimeDays === "" ? null : Number(editor.leadTimeDays),
      moqSummary: editor.moqSummary || null,
      name: editor.name,
      slug: editor.slug,
      status: editor.status,
      summary: editor.summary,
    };
    try {
      await mutateAdmin<{ service: AdminService }>(
        editor.id ? `/api/admin/services/${editor.id}` : "/api/admin/services",
        { body: payload, method: editor.id ? "PATCH" : "POST" },
      );
      setEditor(null);
      setAttempt((value) => value + 1);
    } catch (reason: unknown) {
      setSaveError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể lưu dịch vụ.", 0));
    } finally {
      setSaving(false);
    }
  }

  async function archiveService(service: AdminService) {
    if (!window.confirm(`Ẩn dịch vụ “${service.name}” khỏi storefront?`)) return;
    setArchivingId(service.id);
    setSaveError(null);
    try {
      await mutateAdmin<{ service: AdminService }>(`/api/admin/services/${service.id}`, { method: "DELETE" });
      if (editor?.id === service.id) setEditor(null);
      setAttempt((value) => value + 1);
    } catch (reason: unknown) {
      setSaveError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể ẩn dịch vụ.", 0));
    } finally {
      setArchivingId(null);
    }
  }

  return (
    <div className="admin-content">
      <AdminPageHeading kicker="Năng lực sản xuất" title="Dịch vụ gia công" subtitle="Quản lý danh mục năng lực sản xuất, MOQ và thời gian lead time đang công bố." stamp="SERVICE DIRECTORY" />
      {editor ? <ServiceEditor error={saveError} form={editor} onChange={setEditor} onCancel={() => { setEditor(null); setSaveError(null); }} onSubmit={submitService} saving={saving} /> : null}
      {editor?.id ? <AdminMediaPanel serviceId={editor.id} title="Ảnh dịch vụ và hồ sơ năng lực" /> : null}
      <form className="admin-toolbar" onSubmit={submitSearch}>
        <div className="admin-search-wrap">
          <label className="admin-label" htmlFor="service-search">Tìm theo tên, slug hoặc nội dung</label>
          <Search aria-hidden="true" />
          <input className="admin-input has-icon" data-testid="input-service-search" id="service-search" onChange={(event) => setInputQuery(event.target.value)} placeholder="Ví dụ: đóng gói, trà, viên nang..." value={inputQuery} />
        </div>
        <button className="admin-button admin-button-primary" data-testid="button-service-search" type="submit"><Search size={15} /> Tìm dịch vụ</button>
        {query ? <button className="admin-button admin-button-quiet" data-testid="button-service-clear-search" onClick={clearSearch} type="button">Xóa tìm kiếm</button> : null}
        <button className="admin-button admin-button-primary" data-testid="button-service-create" onClick={openCreate} type="button">Thêm dịch vụ</button>
      </form>
      {error ? <AdminErrorState error={error} onRetry={() => setAttempt((value) => value + 1)} /> : loading ? <AdminLoadingTable /> : (
        <section className="admin-panel admin-table-panel" aria-labelledby="service-table-heading">
          <div className="admin-panel-heading" style={{ padding: "21px 21px 0" }}><div><h2 className="admin-panel-title" id="service-table-heading">Danh mục dịch vụ</h2><p className="admin-panel-caption">{query ? `Kết quả cho “${query}”` : "Sắp xếp theo ID tăng dần"}</p></div><span className="admin-count">{total} bản ghi</span></div>
          {services.length === 0 ? <AdminEmptyState title={query ? "Không tìm thấy dịch vụ phù hợp" : "Chưa có dịch vụ trong catalog"} description={query ? "Thử một từ khóa khác. Không có dữ liệu mẫu được đưa vào danh sách." : "Bạn có thể tạo dịch vụ mới từ nút Thêm dịch vụ."} /> : (
            <>
              <div className="admin-table-scroll">
                <table className="admin-table">
                  <thead><tr><th scope="col">Dịch vụ</th><th scope="col">Tóm tắt</th><th scope="col">Trạng thái</th><th scope="col">MOQ</th><th scope="col">Lead time</th><th scope="col">Cập nhật</th><th scope="col">Thao tác</th></tr></thead>
                  <tbody>
                    {services.map((service) => (
                      <tr data-testid={`row-service-${service.id}`} key={service.id}>
                        <td><div className="admin-item-name">{service.name}<div className="admin-item-meta">{service.slug}</div></div></td>
                        <td><div className="admin-description">{service.summary || service.description || "Chưa có tóm tắt"}</div></td>
                        <td><AdminStatusBadge kind={service.isActive && service.status === "published" ? "green" : service.status === "draft" || service.status === "review" ? "amber" : "neutral"} value={service.isActive ? service.status : "Tạm ẩn"} /></td>
                        <td className="admin-description">{service.moqSummary || "Chưa có"}</td>
                        <td className="admin-mono">{service.leadTimeDays !== null ? `${service.leadTimeDays} ngày` : "Chưa có"}</td>
                        <td className="admin-mono">{formatAdminDate(service.updatedAt)}</td>
                        <td><div className="admin-table-actions"><button className="admin-button admin-button-quiet" data-testid={`button-service-edit-${service.id}`} onClick={() => openEdit(service)} type="button">Sửa</button>{service.isActive ? <button className="admin-button admin-button-danger" data-testid={`button-service-archive-${service.id}`} disabled={archivingId === service.id} onClick={() => void archiveService(service)} type="button">{archivingId === service.id ? "Đang ẩn" : "Ẩn"}</button> : null}</div></td>
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
          <p className="admin-panel-caption">Lưu dưới dạng draft trước; chỉ dịch vụ published và bật hiển thị mới được public read phục vụ storefront.</p>
        </div>
        <span className="admin-stamp">{form.id ? `ID ${form.id}` : "NEW RECORD"}</span>
      </div>
      {error ? <p className="admin-editor-error" role="alert">{error.code ? `${error.code} · ` : ""}{error.message}</p> : null}
      <form onSubmit={onSubmit}>
        <div className="admin-editor-grid">
          <label className="admin-field"><span>Tên dịch vụ <b aria-hidden="true">*</b></span><input className="admin-input" data-testid="input-service-name" onChange={(event) => update("name", event.target.value)} required value={form.name} /></label>
          <label className="admin-field"><span>Slug <b aria-hidden="true">*</b></span><input className="admin-input admin-mono" data-testid="input-service-slug" onChange={(event) => update("slug", event.target.value)} required value={form.slug} /></label>
          <label className="admin-field"><span>Trạng thái phát hành</span><select className="admin-select" data-testid="select-service-status" onChange={(event) => { const status = event.target.value as ServiceFormState["status"]; onChange({ ...form, isActive: status === "published" ? form.isActive : false, status }); }} value={form.status}><option value="draft">Draft</option><option value="review">Chờ duyệt</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
          <label className="admin-field"><span>Lead time (ngày)</span><input className="admin-input admin-mono" data-testid="input-service-lead-time" inputMode="numeric" min="0" onChange={(event) => update("leadTimeDays", event.target.value)} type="number" value={form.leadTimeDays} /></label>
          <label className="admin-field admin-field-wide"><span>MOQ / quy mô tối thiểu</span><input className="admin-input" data-testid="input-service-moq" onChange={(event) => update("moqSummary", event.target.value)} placeholder="Ví dụ: từ 500 kg / mẻ" value={form.moqSummary} /></label>
          <label className="admin-field admin-field-wide"><span>Tóm tắt</span><textarea className="admin-textarea" data-testid="input-service-summary" onChange={(event) => update("summary", event.target.value)} rows={2} value={form.summary} /></label>
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