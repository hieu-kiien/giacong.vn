"use client";

import { Filter, History, Search, ShieldCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { AdminEmptyState, AdminErrorState, AdminLoadingTable, AdminPageHeading, AdminPagination, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { useAdminSession } from "@/components/admin/AdminShell";
import { AdminClientError, fetchAdmin, formatAdminDate } from "@/lib/admin-client";

interface AuditEntry {
  action: string;
  actorSubject: string;
  createdAt: string;
  entityKey: string;
  entityType: string;
  operation: string | null;
  previousRevision: number | null;
  requestId: string | null;
  resultingRevision: number | null;
  source: string;
}

interface AuditResponse {
  entries: AuditEntry[];
  pagination: { currentPage: number; lastPage: number; pageSize: number; total: number };
  total: number;
}

const entityOptions = [
  ["", "Tất cả đối tượng"],
  ["product", "Sản phẩm"],
  ["service", "Dịch vụ"],
  ["news_post", "Tin tức"],
  ["site_setting", "Thiết lập website"],
  ["page", "Trang"],
  ["site_navigation", "Menu"],
  ["category", "Danh mục"],
  ["media", "Ảnh & file"],
  ["lead", "Yêu cầu"],
  ["member", "Thành viên"],
] as const;

const entityLabels: Record<string, string> = Object.fromEntries(entityOptions.filter(([value]) => value).map(([value, label]) => [value, label]));

const actionLabels: Record<string, string> = {
  create: "Tạo",
  delete: "Ẩn / xóa",
  update: "Cập nhật",
  upload: "Tải lên",
};

const operationLabels: Record<string, string> = {
  draft: "Bản nháp",
  publish: "Phát hành",
  publish_all: "Phát hành hàng loạt",
  status_batch: "Đổi trạng thái hàng loạt",
  unpublish: "Ẩn khỏi website",
  delete: "Xóa",
};

export default function AdminAuditPage() {
  const session = useAdminSession();
  const [data, setData] = useState<AuditResponse | null>(null);
  const [inputQuery, setInputQuery] = useState("");
  const [query, setQuery] = useState("");
  const [entityType, setEntityType] = useState("");
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AdminClientError | null>(null);

  useEffect(() => {
    if (session.role !== "owner") {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (query) params.set("query", query);
    if (entityType) params.set("entityType", entityType);
    void (async () => {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setLoading(true);
      setError(null);
      try {
        setData(await fetchAdmin<AuditResponse>("/api/admin/audit?" + params.toString(), controller.signal));
      } catch (reason: unknown) {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể tải lịch sử thay đổi.", 0));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [session.role, page, query, entityType, attempt]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setQuery(inputQuery.trim());
  }

  if (session.role !== "owner") {
    return (
      <div className="admin-content">
        <AdminPageHeading kicker="Vận hành / kiểm soát" title="Lịch sử thay đổi" subtitle="Lịch sử hệ thống chỉ dành cho chủ sở hữu để kiểm tra nguồn gốc và phiên bản dữ liệu." stamp="CHỈ CHỦ SỞ HỮU" />
        <section className="admin-panel" aria-labelledby="audit-owner-only-heading">
          <div className="admin-panel-heading">
            <div>
              <h2 className="admin-panel-title" id="audit-owner-only-heading">Bạn không có quyền xem trang này</h2>
              <p className="admin-panel-caption">Vai trò hiện tại chỉ được xem các màn hình nghiệp vụ được cấp quyền.</p>
            </div>
            <ShieldCheck aria-hidden="true" color="#6e8c42" size={20} />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="admin-content">
      <AdminPageHeading kicker="Vận hành / kiểm soát" title="Lịch sử thay đổi" subtitle="Kiểm tra ai đã thay đổi gì, khi nào và phiên bản nào. Trang này chỉ đọc, không sửa dữ liệu." stamp="CHỈ CHỦ · CHỈ XEM" />
      <form className="admin-toolbar" onSubmit={submitSearch}>
        <div className="admin-search-wrap">
          <label className="admin-label" htmlFor="audit-search">Tìm người, hành động hoặc đối tượng</label>
          <Search aria-hidden="true" />
          <input className="admin-input has-icon" data-testid="input-audit-search" id="audit-search" onChange={(event) => setInputQuery(event.target.value)} placeholder="Ví dụ: tên món, thêm mới, đăng bài..." value={inputQuery} />
        </div>
        <button className="admin-button admin-button-primary" data-testid="button-audit-search" type="submit"><Search aria-hidden="true" size={15} /> Tìm</button>
        <div className="admin-filter-field">
          <label className="admin-label" htmlFor="audit-entity-type">Lọc đối tượng</label>
          <select className="admin-select" data-testid="select-audit-entity" id="audit-entity-type" onChange={(event) => { setEntityType(event.target.value); setPage(1); }} value={entityType}>
            {entityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <span aria-live="polite" className="admin-count"><Filter aria-hidden="true" size={13} style={{ verticalAlign: "middle" }} /> {loading ? "Đang tải…" : `${data?.total ?? 0} sự kiện`}</span>
      </form>
      {error ? <AdminErrorState error={error} onRetry={() => setAttempt((value) => value + 1)} /> : loading ? <AdminLoadingTable /> : data?.entries.length === 0 ? <AdminEmptyState title="Chưa có lịch sử phù hợp" description="Không có sự kiện nào khớp bộ lọc hiện tại." /> : data ? (
        <section className="admin-panel admin-table-panel" aria-labelledby="audit-table-heading">
          <div className="admin-panel-heading" style={{ padding: "21px 21px 0" }}>
            <div><h2 className="admin-panel-title" id="audit-table-heading">Dòng thời gian vận hành</h2><p className="admin-panel-caption">Dữ liệu tổng hợp từ các bảng lịch sử hiện có · không hiện nội dung chi tiết.</p></div>
            <History aria-hidden="true" color="#6e8c42" size={20} />
          </div>
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead><tr><th scope="col">Thời gian</th><th scope="col">Người thực hiện</th><th scope="col">Thao tác</th><th scope="col">Đối tượng</th><th scope="col">Bản lưu</th><th scope="col">Mã yêu cầu</th></tr></thead>
              <tbody>
                {data.entries.map((entry, index) => (
                  <tr key={entry.source + entry.createdAt + entry.requestId + String(index)}>
                    <td className="admin-mono">{formatAuditDate(entry.createdAt)}</td>
                    <td><strong>{entry.actorSubject}</strong><div className="admin-item-meta">{entry.source}</div></td>
                    <td><AdminStatusBadge kind={entry.action === "delete" ? "red" : entry.action === "create" ? "green" : "blue"} value={operationLabels[entry.operation ?? ""] ?? actionLabels[entry.action] ?? entry.action} /></td>
                    <td><strong>{entityLabels[entry.entityType] ?? entry.entityType}</strong><div className="admin-item-meta">{entry.entityKey}</div></td>
                    <td className="admin-mono">{entry.previousRevision === null && entry.resultingRevision === null ? "—" : String(entry.previousRevision ?? "—") + " → " + String(entry.resultingRevision ?? "—")}</td>
                    <td className="admin-mono">{entry.requestId ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <AdminPagination lastPage={data.pagination.lastPage} onPage={setPage} page={page} pageSize={data.pagination.pageSize} total={data.total} />
        </section>
      ) : null}
    </div>
  );
}

function formatAuditDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? formatAdminDate(value) : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date);
}
