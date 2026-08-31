"use client";

import { ClipboardList, Filter, Mail, Phone, Search } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { AdminEmptyState, AdminErrorState, AdminLoadingTable, AdminPageHeading, AdminPagination, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { AdminModal } from "@/components/admin/AdminDialog";
import { useAdminSession } from "@/components/admin/AdminShell";
import { useAdminToast } from "@/components/admin/AdminToast";
import { AdminClientError, fetchAdmin, formatAdminDate, mutateAdmin, type AdminLead, type LeadStatus } from "@/lib/admin-client";

interface LeadResponse {
  leads: AdminLead[];
  total: number;
  pagination?: { currentPage: number; lastPage: number; pageSize: number; total: number };
}

const statusOptions: Array<{ value: LeadStatus | ""; label: string }> = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "new", label: "Mới tiếp nhận" },
  { value: "qualified", label: "Đã xác thực" },
  { value: "contacted", label: "Đã liên hệ" },
  { value: "quotation_sent", label: "Đã gửi báo giá" },
  { value: "sampling", label: "Đang làm mẫu" },
  { value: "negotiation", label: "Đàm phán" },
  { value: "won", label: "Đã chốt" },
  { value: "lost", label: "Không tiếp tục" },
  { value: "spam", label: "Spam" },
];

const statusLabels = Object.fromEntries(statusOptions.map(({ value, label }) => [value, label]));
const pipelineStatusOptions = statusOptions.filter((option): option is { value: LeadStatus; label: string } => Boolean(option.value));

function statusKind(status: LeadStatus): "green" | "amber" | "red" | "blue" | "neutral" {
  if (status === "new" || status === "qualified" || status === "won") return "green";
  if (status === "contacted" || status === "quotation_sent" || status === "sampling" || status === "negotiation") return "blue";
  if (status === "lost" || status === "spam") return "red";
  return "neutral";
}

function deliveryKind(status: AdminLead["deliveryStatus"]): "green" | "amber" | "red" | "neutral" {
  if (status === "delivered") return "green";
  if (status === "failed") return "red";
  if (status === "queued") return "amber";
  return "neutral";
}

export default function AdminLeadsPage() {
  const session = useAdminSession();
  const { showToast } = useAdminToast();
  const [leads, setLeads] = useState<AdminLead[]>([]);
  const [status, setStatus] = useState<LeadStatus | "">("");
  const [query, setQuery] = useState("");
  const [inputQuery, setInputQuery] = useState("");
  const [detailLead, setDetailLead] = useState<AdminLead | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AdminClientError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<AdminClientError | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (status) params.set("status", status);
    if (query) params.set("query", query);
    void (async () => {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setLoading(true);
      setError(null);
      try {
        const result = await fetchAdmin<LeadResponse>(`/api/admin/leads?${params.toString()}`, controller.signal);
        setLeads(result.leads ?? []);
        setTotal(result.total ?? 0);
        setLastPage(result.pagination?.lastPage ?? Math.max(1, Math.ceil((result.total ?? 0) / 20)));
      } catch (reason: unknown) {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể tải inbox yêu cầu.", 0));
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

  async function updateLeadStatus(lead: AdminLead, nextStatus: LeadStatus) {
    if (lead.status === nextStatus) return;
    setUpdatingId(lead.id);
    setMutationError(null);
    try {
      const result = await mutateAdmin<{ lead: AdminLead }>(`/api/admin/leads/${lead.id}`, {
        body: { requestId: crypto.randomUUID(), revision: lead.revision, status: nextStatus },
        method: "PATCH",
      });
      setLeads((current) => current.map((item) => item.id === lead.id ? result.lead : item));
      if (detailLead?.id === lead.id) setDetailLead(result.lead);
      showToast("success", `Đã chuyển “${lead.fullName}” sang ${statusLabels[nextStatus]}.`);
    } catch (reason: unknown) {
      setMutationError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể cập nhật trạng thái lead.", 0));
      showToast("error", reason instanceof AdminClientError ? reason.message : "Không thể cập nhật trạng thái lead.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="admin-content">
      <AdminPageHeading kicker="Kinh doanh / intake" title="Yêu cầu báo giá" subtitle="Inbox tập trung cho các yêu cầu private-label gửi về từ storefront và các kênh tiếp nhận." stamp="HỘP YÊU CẦU" />
      {mutationError ? <p className="admin-editor-error" role="alert">{mutationError.code ? `${mutationError.code} · ` : ""}{mutationError.message}</p> : null}
      <div className="admin-toolbar">
        <form className="admin-search-wrap" onSubmit={submitSearch}>
          <label className="admin-label" htmlFor="lead-search">Tìm theo tên, công ty, email, SĐT</label>
          <Search aria-hidden="true" />
          <input className="admin-input has-icon" data-testid="input-lead-search" id="lead-search" onChange={(event) => setInputQuery(event.target.value)} placeholder="Ví dụ: Nguyễn, công ty ABC, gmail..." value={inputQuery} />
        </form>
        <button className="admin-button admin-button-primary" data-testid="button-lead-search" type="submit">Tìm</button>
        {query ? (
          <button
            className="admin-button admin-button-quiet"
            data-testid="button-lead-clear-search"
            onClick={() => {
              setInputQuery("");
              setQuery("");
              setPage(1);
            }}
            type="button"
          >
            Xóa tìm kiếm
          </button>
        ) : null}
        <div className="admin-filter-field">
          <label className="admin-label" htmlFor="lead-status">Lọc theo trạng thái</label>
          <select className="admin-select" data-testid="select-lead-status" id="lead-status" onChange={(event) => { setStatus(event.target.value as LeadStatus | ""); setPage(1); }} value={status}>
            {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <span className="admin-count"><Filter size={13} style={{ verticalAlign: "middle" }} /> {status ? statusLabels[status] : "Toàn bộ inbox"} · {total} yêu cầu</span>
      </div>
      {error ? <AdminErrorState error={error} onRetry={() => setAttempt((value) => value + 1)} /> : loading ? <AdminLoadingTable /> : (
        <section className="admin-panel admin-table-panel" aria-labelledby="lead-table-heading">
          <div className="admin-panel-heading" style={{ padding: "21px 21px 0" }}><div><h2 className="admin-panel-title" id="lead-table-heading">Danh sách yêu cầu</h2><p className="admin-panel-caption">Mới nhất hiển thị trước · dữ liệu nguyên bản từ API</p></div><ClipboardList aria-hidden="true" color="#6e8c42" size={19} /></div>
          {leads.length === 0 ? <AdminEmptyState title={status ? "Không có yêu cầu ở trạng thái này" : "Inbox chưa có yêu cầu"} description={status ? "Chọn một trạng thái khác để tiếp tục theo dõi pipeline." : "Chưa có lead nào được API trả về. Không hiển thị dữ liệu mẫu."} /> : (
            <>
              <div className="admin-table-scroll">
                <table className="admin-table">
                  <thead><tr><th scope="col">Người liên hệ</th><th scope="col">Liên lạc</th><th scope="col">Nhu cầu</th><th scope="col">Trạng thái</th><th scope="col">Gửi dữ liệu</th><th scope="col">Tiếp nhận</th></tr></thead>
                  <tbody>
                    {leads.map((lead) => (
                      <tr data-testid={`row-lead-${lead.id}`} key={lead.id}>
                        <td>
                          <button
                            className="admin-lead-person"
                            data-testid={`button-lead-detail-${lead.id}`}
                            onClick={() => setDetailLead(lead)}
                            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}
                            type="button"
                          >
                            <strong>{lead.fullName}</strong>
                            <span>{lead.companyName || "Chưa có tên công ty"}{lead.country ? ` · ${lead.country}` : ""} · Xem chi tiết</span>
                          </button>
                        </td>
                        <td><div className="admin-lead-person">{lead.email ? <span><Mail size={12} style={{ verticalAlign: "middle" }} /> {lead.email}</span> : null}{lead.phone ? <span><Phone size={12} style={{ verticalAlign: "middle" }} /> {lead.phone}</span> : null}{!lead.email && !lead.phone ? <span>Chưa có thông tin</span> : null}</div></td>
                        <td><div className="admin-message" title={lead.message ?? undefined}>{lead.message || "Không có nội dung"}</div><div className="admin-item-meta">{lead.source}</div></td>
                        <td>
                          <AdminStatusBadge kind={statusKind(lead.status)} value={statusLabels[lead.status] ?? lead.status} />
                          <select
                            aria-label={`Cập nhật trạng thái cho ${lead.fullName}`}
                            className="admin-select"
                            data-testid={`select-lead-status-${lead.id}`}
                            disabled={updatingId === lead.id}
                            onChange={(event) => void updateLeadStatus(lead, event.target.value as LeadStatus)}
                            style={{ marginTop: 7, minHeight: 34, minWidth: 150 }}
                            value={lead.status}
                          >
                            {pipelineStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </td>
                        <td><AdminStatusBadge kind={deliveryKind(lead.deliveryStatus)} value={lead.deliveryStatus} /></td>
                        <td className="admin-mono">{formatAdminDate(lead.createdAt)}</td>
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
        {detailLead ? (
          <AdminModal labelledBy="admin-lead-detail-title" onClose={() => setDetailLead(null)} title={`Chi tiết yêu cầu — ${detailLead.fullName}`}>
            <h2 hidden id="admin-lead-detail-title">Chi tiết yêu cầu</h2>
            <dl style={{ display: "grid", gap: 10, margin: 0 }}>
              {[
                ["Người liên hệ", detailLead.fullName],
                ["Công ty", detailLead.companyName || "—"],
                ["Quốc gia", detailLead.country || "—"],
                ["Email", detailLead.email || "—"],
                ["Điện thoại", detailLead.phone || "—"],
                ["Nguồn", detailLead.source],
                ["Tiếp nhận", formatAdminDate(detailLead.createdAt)],
                ["Cập nhật", formatAdminDate(detailLead.updatedAt)],
                ["Gửi dữ liệu", detailLead.deliveryStatus],
              ].map(([label, value]) => (
                <div key={label} style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 8 }}>
                  <dt style={{ color: "var(--admin-ink-muted)", fontWeight: 600 }}>{label}</dt>
                  <dd style={{ margin: 0 }}>{value}</dd>
                </div>
              ))}
            </dl>
            <div style={{ marginTop: 14 }}>
              <strong style={{ fontSize: 13 }}>Nội dung</strong>
              <p className="admin-message" style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{detailLead.message || "Không có nội dung"}</p>
            </div>
          </AdminModal>
        ) : null}
      </div>
  );
}
