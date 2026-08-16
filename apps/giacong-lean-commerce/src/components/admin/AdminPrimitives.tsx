import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Database, Inbox, RefreshCw } from "lucide-react";
import { AdminClientError } from "@/lib/admin-client";

export function AdminPageHeading({ kicker, title, subtitle, stamp }: { kicker: string; title: string; subtitle: string; stamp?: string }) {
  return (
    <div className="admin-page-heading">
      <div><div className="admin-kicker">{kicker}</div><h1 className="admin-page-title">{title}</h1><p className="admin-page-subtitle">{subtitle}</p></div>
      {stamp ? <span className="admin-stamp">{stamp}</span> : null}
    </div>
  );
}

export function AdminLoadingTable() {
  return <div aria-label="Đang tải dữ liệu" className="admin-skeleton admin-skeleton-table" data-testid="status-table-loading" />;
}

export function AdminErrorState({ error, onRetry }: { error: AdminClientError; onRetry: () => void }) {
  const isMigration = error.code === "INTERNAL_ERROR" || /D1|bảng|table|migration|binding/i.test(error.message);
  return (
    <section className="admin-state" data-testid="status-admin-error">
      <div className="admin-state-icon is-error"><AlertTriangle aria-hidden="true" size={19} /></div>
      <div>
        <h2>{isMigration ? "Dữ liệu chưa sẵn sàng trong D1" : "Không thể tải dữ liệu"}</h2>
        <p>{isMigration ? "API đã kết nối nhưng schema hoặc binding D1 chưa hoàn tất. Không hiển thị dữ liệu thay thế để tránh nhầm lẫn." : error.message}</p>
        <button className="admin-button admin-button-quiet" data-testid="button-retry-data" onClick={onRetry} type="button"><RefreshCw size={14} /> Thử tải lại</button>
      </div>
    </section>
  );
}

export function AdminEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="admin-table-empty" data-testid="status-admin-empty">
      <Inbox aria-hidden="true" size={25} />
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

export function AdminStatusBadge({ value, kind = "neutral" }: { value: string; kind?: "green" | "amber" | "red" | "blue" | "neutral" }) {
  return <span className={`admin-badge admin-badge-${kind}`}>{value}</span>;
}

export function AdminMetric({ label, value, foot, testId }: { label: string; value: number | string; foot: string; testId: string }) {
  return <div className="admin-metric" data-testid={testId}><div className="admin-metric-label">{label}</div><div className="admin-metric-value">{value}</div><div className="admin-metric-foot">{foot}</div></div>;
}

export function DataReadiness({ data }: { data: Record<string, boolean> }) {
  const labels: Record<string, string> = {
    adminMembersTable: "Bảng thành viên admin",
    auditLogsTable: "Bảng audit logs",
    leadsTable: "Bảng lead / yêu cầu",
    productMetaTable: "Metadata sản phẩm",
    serviceMetaTable: "Metadata dịch vụ",
  };
  const entries = Object.entries(data);
  const readyCount = entries.filter(([, ready]) => ready).length;
  return (
    <section className="admin-panel" aria-labelledby="readiness-heading" data-testid="panel-data-readiness">
      <div className="admin-panel-heading"><div><h2 className="admin-panel-title" id="readiness-heading">Độ sẵn sàng dữ liệu</h2><p className="admin-panel-caption">{readyCount}/{entries.length} thành phần đã phản hồi</p></div><Database aria-hidden="true" color="#6e8c42" size={19} /></div>
      <div className="admin-readiness-list">
        {entries.map(([key, ready]) => <div className="admin-readiness-row" key={key}><span className="admin-readiness-name">{labels[key] ?? key}</span><span className={`admin-ready-state ${ready ? "is-ready" : "is-pending"}`}>{ready ? "Sẵn sàng" : "Chưa có"}</span></div>)}
      </div>
      {readyCount < entries.length ? <div className="admin-readiness-note">Một số bảng tùy chọn chưa được migrate. Các màn hình vẫn giữ dữ liệu thật và sẽ không tự tạo bản ghi thay thế.</div> : null}
    </section>
  );
}

export function AdminPagination({ page, lastPage, total, pageSize, onPage }: { page: number; lastPage: number; total: number; pageSize: number; onPage: (page: number) => void }) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="admin-pagination">
      <span className="admin-pagination-copy">{from}–{to} trong {total} bản ghi</span>
      <div className="admin-pagination-actions">
        <button aria-label="Trang trước" className="admin-button admin-button-quiet" data-testid="button-page-previous" disabled={page <= 1} onClick={() => onPage(page - 1)} type="button"><ChevronLeft size={14} /> Trước</button>
        <button aria-label="Trang sau" className="admin-button admin-button-quiet" data-testid="button-page-next" disabled={page >= lastPage} onClick={() => onPage(page + 1)} type="button">Sau <ChevronRight size={14} /></button>
      </div>
    </div>
  );
}

export function AdminUnavailableNote() {
  return <div className="admin-readiness-note"><CheckCircle2 size={13} style={{ verticalAlign: "middle" }} /> Dữ liệu được đọc trực tiếp từ API admin, không có bản ghi mẫu trong giao diện.</div>;
}