"use client";

import { ArrowLeft, Mail, Phone } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { AdminEmptyState, AdminErrorState, AdminPageHeading, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { AdminClientError, fetchAdmin, formatAdminDate, type LeadStatus } from "@/lib/admin-client";

interface LeadItem {
  currency: string | null;
  id: string;
  lineTotal: number | null;
  notes: string | null;
  productName: string | null;
  productSlug: string | null;
  quantity: number | null;
  serviceSlug: string | null;
  snapshot: unknown;
  unit: string | null;
  unitPrice: number | null;
  variantName: string | null;
  variantSku: string | null;
}

interface LeadEvent {
  actorSubject: string | null;
  createdAt: string;
  eventType: string;
  id: string;
  message: string | null;
}

interface LeadDetail {
  assignedTo: string | null;
  companyName: string | null;
  country: string | null;
  createdAt: string;
  deliveredAt: string | null;
  deliveryAttempts: number;
  deliveryError: string | null;
  deliveryStatus: "pending" | "queued" | "delivered" | "failed";
  email: string | null;
  events: LeadEvent[];
  fullName: string;
  id: string;
  items: LeadItem[];
  message: string | null;
  payload: unknown;
  phone: string | null;
  publicReference: string | null;
  requestId: string | null;
  source: string;
  status: LeadStatus;
  updatedAt: string;
  webhookReference: string | null;
}

function deliveryKind(status: LeadDetail["deliveryStatus"]): "green" | "amber" | "red" | "neutral" {
  if (status === "delivered") return "green";
  if (status === "failed") return "red";
  if (status === "queued") return "amber";
  return "neutral";
}

export default function AdminLeadDetailPage() {
  const params = useParams<{ id: string }>();
  const leadId = typeof params.id === "string" ? params.id : "";
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AdminClientError | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      await Promise.resolve();
      if (controller.signal.aborted || !leadId) return;
      setLoading(true);
      setError(null);
      try {
        const result = await fetchAdmin<{ lead: LeadDetail }>(`/api/admin/leads/${leadId}`, controller.signal);
        setLead(result.lead);
      } catch (reason: unknown) {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể tải chi tiết lead.", 0));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [leadId, attempt]);

  return (
    <div className="admin-content">
      <div style={{ marginBottom: 18 }}>
        <Link className="admin-button admin-button-quiet" href="/admin/yeu-cau"><ArrowLeft size={14} /> Quay lại inbox</Link>
      </div>
      <AdminPageHeading
        kicker="Kinh doanh / đối soát"
        title={lead?.fullName ?? "Chi tiết yêu cầu"}
        subtitle="Dữ liệu lead, nhu cầu, trạng thái delivery và lịch sử sự kiện được đọc trực tiếp từ D1."
        stamp={lead?.publicReference ?? "LEAD DETAIL"}
      />

      {error ? <AdminErrorState error={error} onRetry={() => setAttempt((value) => value + 1)} /> : loading ? (
        <section className="admin-panel" style={{ padding: 24 }} aria-live="polite">Đang tải chi tiết yêu cầu...</section>
      ) : !lead ? <AdminEmptyState title="Không tìm thấy yêu cầu" description="Lead có thể đã bị xóa hoặc ID không hợp lệ." /> : (
        <>
          <section className="admin-panel" style={{ padding: 22, marginBottom: 22 }} aria-labelledby="lead-summary-heading">
            <div className="admin-panel-heading">
              <div><h2 className="admin-panel-title" id="lead-summary-heading">Thông tin yêu cầu</h2><p className="admin-panel-caption">ID D1: <span className="admin-mono">{lead.id}</span></p></div>
              <AdminStatusBadge kind={deliveryKind(lead.deliveryStatus)} value={lead.deliveryStatus} />
            </div>
            <div className="admin-editor-grid" style={{ marginTop: 18 }}>
              <Info label="Người liên hệ" value={lead.fullName} />
              <Info label="Công ty" value={lead.companyName} />
              <Info label="Quốc gia" value={lead.country} />
              <Info label="Nguồn" value={lead.source} />
              <Info label="Pipeline" value={lead.status} />
              <Info label="Public reference" value={lead.publicReference} mono />
              <Info label="Request ID" value={lead.requestId} mono />
              <Info label="Số lần delivery" value={String(lead.deliveryAttempts)} mono />
              <Info label="Webhook reference" value={lead.webhookReference} mono />
              <Info label="Tiếp nhận" value={formatAdminDate(lead.createdAt)} />
              <Info label="Giao thành công" value={lead.deliveredAt ? formatAdminDate(lead.deliveredAt) : null} />
              <Info label="Cập nhật" value={formatAdminDate(lead.updatedAt)} />
            </div>
            <div className="admin-lead-person" style={{ marginTop: 18 }}>
              {lead.email ? <span><Mail size={13} style={{ verticalAlign: "middle" }} /> {lead.email}</span> : null}
              {lead.phone ? <span><Phone size={13} style={{ verticalAlign: "middle" }} /> {lead.phone}</span> : null}
              {lead.message ? <div className="admin-message" style={{ marginTop: 8 }}>{lead.message}</div> : null}
              {lead.deliveryError ? <div className="admin-editor-error" role="note">Delivery error: {lead.deliveryError}</div> : null}
            </div>
          </section>

          <section className="admin-panel admin-table-panel" style={{ marginBottom: 22 }} aria-labelledby="lead-items-heading">
            <div className="admin-panel-heading" style={{ padding: "21px 21px 0" }}><div><h2 className="admin-panel-title" id="lead-items-heading">Dòng nhu cầu</h2><p className="admin-panel-caption">Snapshot được lưu cùng lead tại thời điểm gửi yêu cầu.</p></div><span className="admin-count">{lead.items.length} dòng</span></div>
            {lead.items.length === 0 ? <AdminEmptyState title="Không có dòng nhu cầu" description="Lead này chỉ chứa thông tin liên hệ hoặc nội dung tự do." /> : (
              <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Sản phẩm / dịch vụ</th><th>Biến thể</th><th>Số lượng</th><th>Đơn giá</th><th>Thành tiền</th><th>Ghi chú</th></tr></thead><tbody>{lead.items.map((item) => <tr key={item.id}><td><div className="admin-item-name">{item.productName ?? item.productSlug ?? item.serviceSlug ?? "Không xác định"}<div className="admin-item-meta">{item.productSlug ?? item.serviceSlug ?? ""}</div></div></td><td>{item.variantName ?? item.variantSku ?? "—"}</td><td className="admin-mono">{item.quantity ?? "—"}{item.unit ? ` ${item.unit}` : ""}</td><td className="admin-mono">{formatMoney(item.unitPrice, item.currency)}</td><td className="admin-mono">{formatMoney(item.lineTotal, item.currency)}</td><td className="admin-description">{item.notes ?? "—"}</td></tr>)}</tbody></table></div>
            )}
          </section>

          <section className="admin-panel admin-table-panel" style={{ marginBottom: 22 }} aria-labelledby="lead-events-heading">
            <div className="admin-panel-heading" style={{ padding: "21px 21px 0" }}><div><h2 className="admin-panel-title" id="lead-events-heading">Lịch sử sự kiện</h2><p className="admin-panel-caption">Tối đa 50 sự kiện gần nhất, mới nhất trước.</p></div><span className="admin-count">{lead.events.length} sự kiện</span></div>
            {lead.events.length === 0 ? <AdminEmptyState title="Chưa có sự kiện" description="Không có event nào được ghi cho lead này." /> : (
              <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Sự kiện</th><th>Actor</th><th>Nội dung</th><th>Thời điểm</th></tr></thead><tbody>{lead.events.map((event) => <tr key={event.id}><td><strong>{event.eventType}</strong></td><td className="admin-mono">{event.actorSubject ?? "system"}</td><td className="admin-description">{event.message ?? "—"}</td><td className="admin-mono">{formatAdminDate(event.createdAt)}</td></tr>)}</tbody></table></div>
            )}
          </section>

          <details className="admin-panel" style={{ padding: 22 }}>
            <summary><strong>Payload nguyên bản đã lưu</strong></summary>
            <p className="admin-panel-caption">Chỉ dùng để đối soát. Nội dung dưới đây được render dưới dạng text, không thực thi HTML.</p>
            <pre className="admin-mono" style={{ overflow: "auto", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify(lead.payload, null, 2)}</pre>
          </details>
        </>
      )}
    </div>
  );
}

function Info({ label, mono = false, value }: { label: string; mono?: boolean; value: string | null }) {
  return <div className="admin-field"><span>{label}</span><div className={mono ? "admin-mono" : undefined}>{value || "Chưa ghi nhận"}</div></div>;
}

function formatMoney(value: number | null, currency: string | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  if (currency === "VND") return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
  return `${new Intl.NumberFormat("vi-VN").format(value)}${currency ? ` ${currency}` : ""}`;
}
