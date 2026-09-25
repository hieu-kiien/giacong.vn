"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import { Search, Building2, UserPlus, Phone, Mail, CreditCard, ShieldCheck } from "lucide-react";
import {
  AdminPageHeading,
  AdminLoadingTable,
  AdminEmptyState,
  AdminErrorState,
  AdminStatusBadge,
  AdminPagination,
} from "@/components/admin/AdminPrimitives";
import { AdminCustomerDrawer } from "@/components/admin/AdminCustomerDrawer";
import { AdminModal } from "@/components/admin/AdminDialog";
import { useAdminToast } from "@/components/admin/AdminToast";
import { useAdminSession } from "@/components/admin/AdminShell";
import { AdminClientError, fetchAdmin, formatAdminDate, mutateAdmin } from "@/lib/admin-client";
import { canManageCrm } from "@/lib/admin-permissions";
import type { CrmCustomer, CrmIndustry, CrmCustomerTier } from "@/lib/admin-crm-types";

const tierLabels: Record<string, { label: string; kind: "green" | "amber" | "blue" | "neutral" }> = {
  vip: { label: "VIP", kind: "green" },
  strategic: { label: "Chiến lược", kind: "blue" },
  potential: { label: "Tiềm năng", kind: "amber" },
  standard: { label: "Tiêu chuẩn", kind: "neutral" },
  dormant: { label: "Ít liên hệ", kind: "neutral" },
};

const industryLabels: Record<string, string> = {
  mechanical_cnc: "Cơ khí CNC",
  sheet_metal: "Kim loại tấm",
  plastic_injection: "Ép nhựa kỹ thuật",
  casting_forging: "Đúc - Rèn",
  apparel_textile: "May mặc công nghiệp",
  packaging_carton: "Bao bì carton",
  electronics_pcba: "Mạch điện tử PCBA",
  wood_furniture: "Nội thất gỗ",
  automation_jigs: "Đồ gá & Jigs",
  other: "Khác",
};

interface CustomerResponse {
  items: CrmCustomer[];
  pagination: {
    currentPage: number;
    lastPage: number;
    pageSize: number;
    total: number;
  };
}

export default function AdminCustomersPage() {
  const session = useAdminSession();
  const { showToast } = useAdminToast();
  const canManage = canManageCrm(session.role);
  const [customers, setCustomers] = useState<CrmCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AdminClientError | null>(null);
  const [query, setQuery] = useState("");
  const [inputQuery, setInputQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTierModal, setBulkTierModal] = useState(false);
  const [targetBulkTier, setTargetBulkTier] = useState<CrmCustomerTier>("standard");
  const [bulkUpdating, setBulkUpdating] = useState(false);

  // New Customer Form State
  const [newCompany, setNewCompany] = useState("");
  const [newTaxCode, setNewTaxCode] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newIndustry, setNewIndustry] = useState<CrmIndustry>("mechanical_cnc");
  const [newTier, setNewTier] = useState<CrmCustomerTier>("standard");

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "20",
        query,
      });
      if (tierFilter !== "all") {
        params.set("tier", tierFilter);
      }
      const res = await fetchAdmin<CustomerResponse>(`/api/admin/crm/customers?${params.toString()}`);
      setCustomers(res.items ?? []);
      setTotal(res.pagination?.total ?? 0);
      setLastPage(res.pagination?.lastPage ?? 1);
    } catch (err) {
      setError(
        err instanceof AdminClientError
          ? err
          : new AdminClientError("Chưa thể tải danh sách khách hàng CRM.", 0)
      );
    } finally {
      setLoading(false);
    }
  }, [page, query, tierFilter]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  async function handleBulkUpdateTier() {
    if (!canManage || selectedIds.size === 0 || bulkUpdating) return;
    setBulkUpdating(true);
    const selectedCustomers = customers.filter((c) => selectedIds.has(c.id));
    let successCount = 0;
    for (const cust of selectedCustomers) {
      try {
        await mutateAdmin(`/api/admin/crm/customers/${cust.id}`, {
          method: "PATCH",
          body: {
            requestId: crypto.randomUUID(),
            revision: cust.revision,
            tier: targetBulkTier,
          },
        });
        successCount++;
      } catch {
        // continue
      }
    }
    setBulkUpdating(false);
    setBulkTierModal(false);
    setSelectedIds(new Set());
    showToast("success", `Đã cập nhật phân hạng ${successCount}/${selectedCustomers.length} khách hàng sang ${tierLabels[targetBulkTier]?.label || targetBulkTier}.`);
    await loadCustomers();
  }

  function handleSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPage(1);
    setQuery(inputQuery.trim());
  }

  async function handleCreateCustomer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!newCompany.trim()) return;
    setCreating(true);
    try {
      await mutateAdmin("/api/admin/crm/customers", {
        method: "POST",
        body: {
          company_name: newCompany.trim(),
          tax_code: newTaxCode.trim() || null,
          phone: newPhone.trim() || null,
          email: newEmail.trim() || null,
          industry: newIndustry,
          tier: newTier,
        },
      });
      showToast("success", "Đã tạo hồ sơ khách hàng doanh nghiệp thành công.");
      setIsCreateOpen(false);
      setNewCompany("");
      setNewTaxCode("");
      setNewPhone("");
      setNewEmail("");
      await loadCustomers();
    } catch (err) {
      const msg = err instanceof AdminClientError ? err.message : "Lỗi khi tạo khách hàng.";
      showToast("error", msg);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="admin-content">
      <AdminPageHeading
        kicker="Khách hàng & Báo giá"
        title="Quản lý Khách hàng Doanh nghiệp (CRM)"
        subtitle="Hồ sơ hợp nhất (Customer 360), dòng thời gian tương tác, lịch sử báo giá và công nợ B2B."
        stamp="B2B CRM"
      />

      {/* Toolbar */}
      <form className="admin-toolbar" onSubmit={handleSearch}>
        <div className="admin-search-wrap">
          <label className="admin-label" htmlFor="crm-search">
            Tìm theo tên công ty, mã khách hàng, MST hoặc số điện thoại
          </label>
          <Search aria-hidden="true" />
          <input
            className="admin-input has-icon"
            id="crm-search"
            placeholder="Tìm theo tên công ty, MST, SĐT..."
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
          />
        </div>
        <button className="admin-button admin-button-primary" type="submit">
          <Search size={15} /> Tìm kiếm
        </button>
        {query ? (
          <button
            className="admin-button admin-button-quiet"
            type="button"
            onClick={() => {
              setInputQuery("");
              setQuery("");
            }}
          >
            Xóa tìm
          </button>
        ) : null}
        {canManage && selectedIds.size > 0 ? (
          <div className="admin-bulk-toolbar" style={{ alignItems: "center", display: "inline-flex", flexWrap: "wrap", gap: 8 }}>
            <span aria-live="polite" className="admin-item-meta" data-testid="customer-selection-count">
              Đã chọn <strong>{selectedIds.size}</strong>
            </span>
            <button
              className="admin-button admin-button-primary"
              data-testid="button-customer-batch-tier"
              onClick={() => setBulkTierModal(true)}
              style={{ fontSize: 12, minHeight: 30, padding: "0 10px" }}
              type="button"
            >
              Đổi phân hạng đã chọn
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
        <button
          className="admin-button admin-button-primary"
          type="button"
          onClick={() => setIsCreateOpen(true)}
        >
          <UserPlus size={15} /> Thêm khách hàng
        </button>
      </form>

      {/* Create Modal */}
      {isCreateOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(15, 23, 42, 0.4)",
          }}
          onClick={() => setIsCreateOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "500px",
              background: "#ffffff",
              borderRadius: "10px",
              padding: "20px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px" }}>
              Tạo Hồ Sơ Khách Hàng Doanh Nghiệp Mới
            </h3>
            <form onSubmit={handleCreateCustomer} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label className="admin-field-label">Tên công ty / Đơn vị đặt hàng *</label>
                <input
                  type="text"
                  className="admin-input"
                  required
                  placeholder="Ví dụ: Công ty Cơ khí An Phát"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="admin-field-label">Mã số thuế (MST)</label>
                  <input
                    type="text"
                    className="admin-input"
                    placeholder="0312345678"
                    value={newTaxCode}
                    onChange={(e) => setNewTaxCode(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label className="admin-field-label">Số điện thoại</label>
                  <input
                    type="text"
                    className="admin-input"
                    placeholder="0901234567"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
              </div>
              <div>
                <label className="admin-field-label">Email liên hệ</label>
                <input
                  type="email"
                  className="admin-input"
                  placeholder="contact@anphat.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="admin-field-label">Ngành nghề sản xuất</label>
                  <select
                    className="admin-select"
                    value={newIndustry}
                    onChange={(e) => setNewIndustry(e.target.value as CrmIndustry)}
                    style={{ width: "100%" }}
                  >
                    {Object.entries(industryLabels).map(([val, label]) => (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="admin-field-label">Phân hạng khách hàng</label>
                  <select
                    className="admin-select"
                    value={newTier}
                    onChange={(e) => setNewTier(e.target.value as CrmCustomerTier)}
                    style={{ width: "100%" }}
                  >
                    <option value="standard">Tiêu chuẩn</option>
                    <option value="potential">Tiềm năng</option>
                    <option value="strategic">Chiến lược</option>
                    <option value="vip">VIP</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  className="admin-button admin-button-quiet"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="admin-button admin-button-primary"
                  disabled={creating || !newCompany.trim()}
                >
                  {creating ? "Đang lưu..." : "Tạo khách hàng"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Main Table */}
      {error ? (
        <AdminErrorState error={error} onRetry={() => void loadCustomers()} />
      ) : loading ? (
        <AdminLoadingTable />
      ) : (
        <section className="admin-panel admin-table-panel" aria-labelledby="customers-table-heading">
          <div className="admin-panel-heading" style={{ padding: "20px 20px 12px" }}>
            <div>
              <h2 className="admin-panel-title" id="customers-table-heading">
                Hồ sơ khách hàng
              </h2>
              <p className="admin-panel-caption">
                {query ? `Kết quả tìm kiếm cho “${query}”` : "Sắp xếp theo thời gian tương tác gần nhất"}
              </p>
            </div>
            <span className="admin-count">{total} doanh nghiệp</span>
          </div>

          <div style={{ padding: "0 20px 12px" }}>
            <div className="admin-filter-tabs">
              {[
                { label: "Tất cả", value: "all" },
                { label: "VIP", value: "vip" },
                { label: "Chiến lược", value: "strategic" },
                { label: "Tiềm năng", value: "potential" },
                { label: "Tiêu chuẩn", value: "standard" },
                { label: "Ít liên hệ", value: "dormant" },
              ].map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  className={`admin-filter-tab${tierFilter === tab.value ? " is-active" : ""}`}
                  onClick={() => { setTierFilter(tab.value); setPage(1); }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {customers.length === 0 ? (
            <AdminEmptyState
              title={query ? "Không tìm thấy khách hàng phù hợp" : "Chưa có khách hàng B2B"}
              description={query ? "Thử tìm kiếm với tên công ty hoặc MST khác." : "Hệ thống sẽ tự động liên kết khi khách hàng nộp yêu cầu báo giá."}
            />
          ) : (
            <>
              <div className="admin-table-scroll">
                <table className="admin-table admin-product-table">
                  <thead>
                    <tr>
                      {canManage ? (
                        <th style={{ width: 44 }} scope="col">
                          <input
                            aria-label="Chọn tất cả khách hàng trên trang này"
                            checked={customers.length > 0 && selectedIds.size === customers.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedIds(new Set(customers.map((c) => c.id)));
                              } else {
                                setSelectedIds(new Set());
                              }
                            }}
                            type="checkbox"
                          />
                        </th>
                      ) : null}
                      <th scope="col">Doanh nghiệp / Mã</th>
                      <th scope="col">Mã số thuế</th>
                      <th scope="col">Ngành nghề</th>
                      <th scope="col">Phân hạng</th>
                      <th scope="col">Yêu cầu RFQ</th>
                      <th scope="col">Tương tác cuối</th>
                      <th scope="col">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c) => (
                      <tr key={c.id}>
                        {canManage ? (
                          <td style={{ width: 44 }}>
                            <input
                              aria-label={`Chọn khách hàng ${c.company_name}`}
                              checked={selectedIds.has(c.id)}
                              onChange={() => {
                                setSelectedIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(c.id)) next.delete(c.id);
                                  else next.add(c.id);
                                  return next;
                                });
                              }}
                              type="checkbox"
                            />
                          </td>
                        ) : null}
                        <td>
                          <button
                            type="button"
                            className="admin-product-name-btn"
                            onClick={() => setSelectedCustomerId(c.id)}
                            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}
                          >
                            <div style={{ fontWeight: 600, color: "var(--admin-brand)", fontSize: 14 }}>{c.company_name}</div>
                            <div style={{ fontSize: 11, color: "var(--admin-ink-muted)" }}>{c.code} · Bấm xem 360°</div>
                          </button>
                        </td>
                        <td>
                          <span className="admin-mono">{c.tax_code || "—"}</span>
                        </td>
                        <td>{industryLabels[c.industry] || c.industry}</td>
                        <td>
                          <AdminStatusBadge
                            kind={tierLabels[c.tier]?.kind ?? "neutral"}
                            value={tierLabels[c.tier]?.label ?? c.tier}
                          />
                        </td>
                        <td className="admin-mono">{c.total_rfq_count ?? 0} lần</td>
                        <td className="admin-mono">
                          {c.last_interaction_at ? formatAdminDate(c.last_interaction_at) : "Chưa có"}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="admin-button admin-button-quiet"
                            onClick={() => setSelectedCustomerId(c.id)}
                            style={{ fontSize: 12, padding: "4px 8px" }}
                          >
                            Xem 360°
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <AdminPagination
                lastPage={lastPage}
                onPage={setPage}
                page={page}
                pageSize={20}
                total={total}
              />
            </>
          )}
        </section>
      )}

      {/* Bulk Tier Modal */}
      {bulkTierModal ? (
        <AdminModal
          labelledBy="customer-bulk-title"
          onClose={() => setBulkTierModal(false)}
          title="Đổi phân hạng khách hàng hàng loạt"
        >
          <h2 hidden id="customer-bulk-title">Đổi phân hạng khách hàng hàng loạt</h2>
          <p style={{ margin: "0 0 16px", color: "var(--admin-ink-muted)" }}>
            Đang chọn <strong>{selectedIds.size}</strong> khách hàng. Vui lòng chọn phân hạng mới:
          </p>
          <div className="admin-field">
            <label className="admin-label" htmlFor="bulk-target-tier">Phân hạng mới</label>
            <select
              className="admin-select"
              id="bulk-target-tier"
              onChange={(e) => setTargetBulkTier(e.target.value as CrmCustomerTier)}
              style={{ width: "100%", minHeight: 38 }}
              value={targetBulkTier}
            >
              <option value="standard">Tiêu chuẩn</option>
              <option value="potential">Tiềm năng</option>
              <option value="strategic">Chiến lược</option>
              <option value="vip">VIP</option>
              <option value="dormant">Ít liên hệ</option>
            </select>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
            <button
              className="admin-button admin-button-quiet"
              onClick={() => setBulkTierModal(false)}
              type="button"
            >
              Hủy
            </button>
            <button
              className="admin-button admin-button-primary"
              disabled={bulkUpdating}
              onClick={() => void handleBulkUpdateTier()}
              type="button"
            >
              {bulkUpdating ? "Đang cập nhật..." : "Xác nhận đổi"}
            </button>
          </div>
        </AdminModal>
      ) : null}

      {/* Customer 360 Drawer */}
      {selectedCustomerId ? (
        <AdminCustomerDrawer
          customerId={selectedCustomerId}
          onClose={() => setSelectedCustomerId(null)}
        />
      ) : null}
    </div>
  );
}
