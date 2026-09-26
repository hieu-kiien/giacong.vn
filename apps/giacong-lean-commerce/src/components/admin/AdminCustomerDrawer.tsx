"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  UserCheck,
  Clock,
  Users,
  ShieldCheck,
  Plus,
} from "lucide-react";
import { AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { AdminTimelineFeed } from "@/components/admin/AdminTimelineFeed";
import { AdminModal } from "@/components/admin/AdminDialog";
import { fetchAdmin, formatAdminDate } from "@/lib/admin-client";
import type { CrmCustomer, CrmContact } from "@/lib/admin-crm-types";

const tierLabels: Record<string, { label: string; kind: "green" | "amber" | "blue" | "neutral" }> = {
  vip: { label: "Khách hàng VIP", kind: "green" },
  strategic: { label: "Đối tác Chiến lược", kind: "blue" },
  potential: { label: "Khách Tiềm năng", kind: "amber" },
  standard: { label: "Tiêu chuẩn", kind: "neutral" },
  dormant: { label: "Ít tương tác", kind: "neutral" },
};

const industryLabels: Record<string, string> = {
  mechanical_cnc: "Cơ khí chính xác & CNC",
  sheet_metal: "Kim loại tấm & Chấn dập",
  plastic_injection: "Đúc & Ép nhựa kỹ thuật",
  casting_forging: "Đúc kim loại & Rèn dập",
  apparel_textile: "May mặc & Phụ liệu công nghiệp",
  packaging_carton: "Bao bì carton & Màng phức hợp",
  electronics_pcba: "Lắp ráp bản mạch PCBA",
  wood_furniture: "Gia công gỗ & Nội thất",
  automation_jigs: "Đồ gá & Tự động hóa",
  other: "Ngành nghề khác",
};

export function AdminCustomerDrawer({
  customerId,
  leadId,
  onClose,
}: {
  customerId: string;
  leadId?: string;
  onClose: () => void;
}) {
  const [customer, setCustomer] = useState<CrmCustomer | null>(null);
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "contacts" | "timeline">("overview");

  const loadCustomer = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    try {
      const res = await fetchAdmin<{ customer: CrmCustomer; contacts?: CrmContact[] }>(
        `/api/admin/crm/customers/${customerId}`
      );
      setCustomer(res.customer);
      setContacts(res.contacts ?? []);
    } catch {
      // Mock fallback if customer record was auto-linked
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    void loadCustomer();
  }, [loadCustomer]);

  return (
    <AdminModal
      labelledBy="customer-drawer-title"
      onClose={onClose}
      title={customer?.company_name || "Chi tiết Doanh nghiệp"}
      width="wide"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Header summary */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
            paddingBottom: 10,
            borderBottom: "1px solid var(--admin-border, #e2e8f0)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--admin-ink-muted, #64748b)", textTransform: "uppercase" }}>
              {customer?.code ?? "HỒ SƠ KHÁCH HÀNG B2B"}
            </span>
            {customer?.tier ? (
              <AdminStatusBadge
                kind={tierLabels[customer.tier]?.kind ?? "neutral"}
                value={tierLabels[customer.tier]?.label ?? customer.tier}
              />
            ) : null}
          </div>
          <div style={{ fontSize: 12, color: "var(--admin-ink-muted, #64748b)" }}>
            MST: <strong>{customer?.tax_code || "Chưa có"}</strong> · Ngành:{" "}
            {customer ? industryLabels[customer.industry] || customer.industry : "Chưa xác định"}
          </div>
        </div>

        {/* Sub-tabs */}
        <div
          style={{
            display: "flex",
            gap: 4,
            padding: "8px 16px",
            borderBottom: "1px solid #e2e8f0",
            background: "#ffffff",
          }}
        >
          <button
            type="button"
            className={`admin-button ${activeTab === "overview" ? "admin-button-primary" : "admin-button-quiet"}`}
            style={{ fontSize: 12, padding: "5px 12px" }}
            onClick={() => setActiveTab("overview")}
          >
            <Building2 size={13} /> Tổng quan
          </button>
          <button
            type="button"
            className={`admin-button ${activeTab === "contacts" ? "admin-button-primary" : "admin-button-quiet"}`}
            style={{ fontSize: 12, padding: "5px 12px" }}
            onClick={() => setActiveTab("contacts")}
          >
            <Users size={13} /> Danh bạ ({contacts.length})
          </button>
          <button
            type="button"
            className={`admin-button ${activeTab === "timeline" ? "admin-button-primary" : "admin-button-quiet"}`}
            style={{ fontSize: 12, padding: "5px 12px" }}
            onClick={() => setActiveTab("timeline")}
          >
            <Clock size={13} /> Dòng thời gian
          </button>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "32px", color: "#64748b" }}>
              Đang tải dữ liệu hồ sơ...
            </div>
          ) : activeTab === "overview" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Financial & Terms */}
              <div
                style={{
                  background: "#f8fafc",
                  borderRadius: 8,
                  padding: 12,
                  border: "1px solid #e2e8f0",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <CreditCard size={14} /> Chính sách công nợ & Thanh toán
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
                  <div>
                    <span style={{ color: "#64748b" }}>Hạn mức công nợ:</span>{" "}
                    <strong>
                      {customer?.credit_limit
                        ? `${new Intl.NumberFormat("vi-VN").format(customer.credit_limit)}đ`
                        : "Chưa cấp hạn mức"}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>Thời hạn nợ:</span>{" "}
                    <strong>{customer?.credit_term_days ? `Net ${customer.credit_term_days} ngày` : "Thanh toán ngay"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>Số yêu cầu RFQ:</span>{" "}
                    <strong>{customer?.total_rfq_count ?? 0} lần</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>Tổng giá trị chốt:</span>{" "}
                    <strong>
                      {customer?.total_won_value
                        ? `${new Intl.NumberFormat("vi-VN").format(customer.total_won_value)}đ`
                        : "0đ"}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Location info */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: 8,
                  padding: 12,
                  border: "1px solid #e2e8f0",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <MapPin size={14} /> Địa chỉ & Trụ sở
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                  <div>
                    <span style={{ color: "#64748b" }}>Trụ sở chính:</span>{" "}
                    <span>{customer?.headquarters_address || "Chưa cập nhật"}</span>
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>Nhà xưởng / Điểm giao:</span>{" "}
                    <span>{customer?.factory_address || "Chưa cập nhật"}</span>
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>Khu vực:</span>{" "}
                    <span>{customer?.city || "Việt Nam"}</span>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: 8,
                  padding: 12,
                  border: "1px solid #e2e8f0",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <Phone size={14} /> Thông tin liên hệ công ty
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
                  <div>
                    <span style={{ color: "#64748b" }}>Hotline/SĐT:</span>{" "}
                    <strong>{customer?.phone || "Chưa có"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>Email:</span>{" "}
                    <strong>{customer?.email || "Chưa có"}</strong>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <span style={{ color: "#64748b" }}>Website:</span>{" "}
                    <a href={customer?.website || "#"} target="_blank" rel="noreferrer" style={{ color: "#2563eb" }}>
                      {customer?.website || "Chưa có"}
                    </a>
                  </div>
                </div>
              </div>

              {/* Internal Notes */}
              {customer?.internal_notes ? (
                <div style={{ background: "#fffbeb", padding: 12, borderRadius: 8, border: "1px solid #fde68a" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#92400e", marginBottom: 4 }}>
                    Ghi chú nội bộ
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: "#78350f" }}>{customer.internal_notes}</p>
                </div>
              ) : null}
            </div>
          ) : activeTab === "contacts" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {contacts.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px", color: "#64748b", fontSize: 12 }}>
                  Chưa có danh bạ nhân sự liên hệ trong ban mua hàng.
                </div>
              ) : (
                contacts.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      padding: 12,
                      background: c.is_primary ? "#f0fdf4" : "#ffffff",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong>{c.full_name}</strong>
                      {c.is_decision_maker ? (
                        <span style={{ background: "#dbeafe", color: "#1e40af", fontSize: 10, padding: "2px 6px", borderRadius: 4 }}>
                          Người ra quyết định
                        </span>
                      ) : null}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                      {c.job_title} · {c.department}
                    </div>
                    <div style={{ display: "flex", gap: 12, fontSize: 12, marginTop: 6, color: "#334155" }}>
                      {c.phone ? <span><Phone size={11} style={{ display: "inline" }} /> {c.phone}</span> : null}
                      {c.email ? <span><Mail size={11} style={{ display: "inline" }} /> {c.email}</span> : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <AdminTimelineFeed customerId={customerId} leadId={leadId} />
          )}
        </div>
      </div>
    </AdminModal>
  );
}
