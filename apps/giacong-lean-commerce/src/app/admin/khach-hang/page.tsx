"use client";

import { Download, Search } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AdminModal } from "@/components/admin/AdminDialog";
import { AdminCustomerContactDelivery } from "@/components/admin/AdminCustomerContactDelivery";
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoadingTable,
  AdminPageHeading,
  AdminPagination,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";
import { AdminClientError, fetchAdmin, formatAdminDate } from "@/lib/admin-client";
import type { AdminCustomerDetail, AdminCustomerSummary } from "@/lib/admin-customers";

interface CustomerListResponse {
  customers: AdminCustomerSummary[];
  pagination?: { currentPage: number; lastPage: number; pageSize: number; total: number };
  ready?: boolean;
  total: number;
}

const PAGE_SIZE = 20;

const requestStatusLabels: Record<string, { kind: "green" | "amber" | "red" | "blue" | "neutral"; label: string }> = {
  contacted: { kind: "blue", label: "Đã liên hệ" },
  lost: { kind: "red", label: "Không mua" },
  negotiation: { kind: "blue", label: "Đang trao đổi" },
  new: { kind: "green", label: "Mới" },
  qualified: { kind: "green", label: "Mới" },
  quotation_sent: { kind: "blue", label: "Đã liên hệ" },
  sampling: { kind: "blue", label: "Đang trao đổi" },
  spam: { kind: "red", label: "Rác" },
  won: { kind: "green", label: "Đã chốt" },
};

const money = new Intl.NumberFormat("vi-VN");

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<AdminCustomerSummary[]>([]);
  const [query, setQuery] = useState("");
  const [inputQuery, setInputQuery] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [ready, setReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AdminClientError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminCustomerDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [salesPage, setSalesPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const exportController = useRef<AbortController | null>(null);

  useEffect(() => () => exportController.current?.abort(), []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (query) params.set("query", query);
    void (async () => {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setLoading(true);
      setError(null);
      try {
        const result = await fetchAdmin<CustomerListResponse>(`/api/admin/customers?${params.toString()}`, controller.signal);
        setCustomers(result.customers ?? []);
        setTotal(result.total ?? 0);
        setReady(result.ready !== false);
        setLastPage(result.pagination?.lastPage ?? Math.max(1, Math.ceil((result.total ?? 0) / PAGE_SIZE)));
      } catch (reason: unknown) {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể tải danh sách khách hàng.", 0));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [page, query, attempt]);

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    void (async () => {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setDetail(null);
      setDetailError(null);
      try {
        const result = await fetchAdmin<{ customer: AdminCustomerDetail }>(
          `/api/admin/customers/${encodeURIComponent(selectedId)}?salesPage=${salesPage}`,
          controller.signal,
        );
        setDetail(result.customer);
      } catch (reason: unknown) {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setDetailError(reason instanceof AdminClientError ? reason.message : "Không thể tải thông tin khách hàng.");
        }
      }
    })();
    return () => controller.abort();
  }, [selectedId, salesPage]);

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

  const exportHref = `/api/admin/customers/export?format=xlsx${query ? `&query=${encodeURIComponent(query)}` : ""}`;
  async function exportCustomers() {
    const controller = new AbortController();
    exportController.current?.abort();
    exportController.current = controller;
    setExporting(true);
    setExportError("");
    try {
      const response = await fetch(exportHref, { cache: "no-store", signal: controller.signal });
      if (!response.ok) {
        const body: unknown = await response.json();
        throw new Error(typeof body === "object" && body !== null && "message" in body && typeof body.message === "string" ? body.message : "Không thể xuất danh sách khách hàng.");
      }
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `khach-hang-${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) {
      if (!controller.signal.aborted) setExportError(reason instanceof Error ? reason.message : "Không thể xuất danh sách khách hàng.");
    } finally {
      if (!controller.signal.aborted) setExporting(false);
    }
  }

  return (
    <div className="admin-content">
      <AdminPageHeading
        kicker="Bán hàng / khách hàng"
        title="Khách hàng"
        subtitle="Những người đã đăng ký tài khoản trên website, cùng yêu cầu mua và đơn đã chốt của họ."
      />

      <form className="admin-toolbar" onSubmit={submitSearch}>
        <div className="admin-search-wrap">
          <label className="admin-label" htmlFor="customer-search">Tìm theo tên, email hoặc số điện thoại</label>
          <Search aria-hidden="true" />
          <input
            className="admin-input has-icon"
            data-testid="input-customer-search"
            id="customer-search"
            onChange={(event) => setInputQuery(event.target.value)}
            placeholder="Ví dụ: Nguyễn Văn A, 0912…, email"
            value={inputQuery}
          />
        </div>
        <button className="admin-button admin-button-primary" data-testid="button-customer-search" type="submit">
          <Search size={15} /> Tìm khách hàng
        </button>
        {query ? (
          <button className="admin-button admin-button-quiet" onClick={clearSearch} type="button">Xóa tìm kiếm</button>
        ) : null}
        <button
          className="admin-button admin-button-quiet"
          data-testid="link-customer-export"
          aria-busy={exporting}
          disabled={exporting || loading || !ready}
          onClick={exportCustomers}
          type="button"
        >
          <Download size={14} /> {exporting ? "Đang xuất…" : "Xuất Excel"}
        </button>
      </form>
      {exportError ? <p role="alert">{exportError}</p> : null}
      <p className="admin-panel-caption">Tệp Excel gồm khách hàng và giao dịch đã chốt theo danh sách đang tìm kiếm.</p>

      {error ? (
        <AdminErrorState error={error} onRetry={() => setAttempt((value) => value + 1)} />
      ) : loading ? (
        <AdminLoadingTable />
      ) : (
        <section className="admin-panel admin-table-panel" aria-labelledby="customer-table-heading">
          <div className="admin-panel-heading" style={{ padding: "21px 21px 12px" }}>
            <div>
              <h2 className="admin-panel-title" id="customer-table-heading">Danh sách khách hàng</h2>
              <p className="admin-panel-caption">{query ? `Kết quả cho “${query}”` : "Khách có yêu cầu gần đây nhất hiển thị trước"}</p>
            </div>
            <span aria-live="polite" className="admin-count">{total} khách</span>
          </div>
          {customers.length === 0 ? (
            <AdminEmptyState
              title={query ? "Không tìm thấy khách hàng phù hợp" : ready ? "Chưa có khách hàng đăng ký" : "Chưa có dữ liệu khách hàng"}
              description={
                query
                  ? "Thử tên, email hoặc số điện thoại khác."
                  : ready
                    ? "Khi khách đăng nhập và gửi yêu cầu mua hàng, họ sẽ xuất hiện ở đây."
                    : "Tính năng tài khoản khách hàng chưa được bật trên máy chủ này."
              }
            />
          ) : (
            <>
              <div className="admin-table-scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col">Khách hàng</th>
                      <th scope="col">Liên hệ</th>
                      <th scope="col">Yêu cầu mua</th>
                      <th scope="col">Đã chốt</th>
                      <th scope="col">Gần nhất</th>
                      <th scope="col">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((customer) => (
                      <tr data-testid={`row-customer-${customer.id}`} key={customer.id}>
                        <td data-label="Khách hàng">
                          <button
                            className="admin-product-name-btn"
                            onClick={() => { setSalesPage(1); setSelectedId(customer.id); }}
                            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}
                            type="button"
                          >
                            <div style={{ color: "var(--admin-brand)", fontSize: 14, fontWeight: 600 }}>{customer.name}</div>
                            <div style={{ color: "var(--admin-ink-muted)", fontSize: 11 }}>
                              Đăng ký {formatAdminDate(customer.createdAt)}
                            </div>
                          </button>
                        </td>
                        <td data-label="Liên hệ">
                          <div>{customer.email}</div>
                          <div className="admin-item-meta">{customer.phone || "Chưa có số điện thoại"}</div>
                        </td>
                        <td className="admin-mono" data-label="Yêu cầu mua">{customer.requestCount} lần</td>
                        <td className="admin-mono" data-label="Đã chốt">
                          {customer.saleCount > 0 ? `${customer.saleCount} đơn · ${money.format(customer.saleTotal)}đ` : "—"}
                        </td>
                        <td className="admin-mono" data-label="Gần nhất">
                          {customer.lastRequestAt ? formatAdminDate(customer.lastRequestAt) : "Chưa có"}
                        </td>
                        <td className="admin-sticky-actions">
                          <div className="admin-table-actions">
                            <button
                              className="admin-button admin-button-quiet"
                              onClick={() => { setSalesPage(1); setSelectedId(customer.id); }}
                              style={{ fontSize: 12, padding: "4px 8px" }}
                              type="button"
                            >
                              Xem chi tiết
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <AdminPagination lastPage={lastPage} onPage={setPage} page={page} pageSize={PAGE_SIZE} total={total} />
            </>
          )}
        </section>
      )}

      {selectedId ? (
        <AdminModal
          labelledBy="customer-detail-title"
          onClose={() => setSelectedId(null)}
          title={detail?.name ?? "Thông tin khách hàng"}
          width="wide"
        >
          <h2 hidden id="customer-detail-title">Thông tin khách hàng</h2>
          {detailError ? (
            <p role="alert">{detailError}</p>
          ) : !detail ? (
            <AdminLoadingTable />
          ) : (
            <div data-testid="customer-detail" style={{ display: "grid", gap: 18 }}>
              <dl style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", margin: 0 }}>
                {[
                  ["Họ tên", detail.name],
                  ["Email", detail.email],
                  ["Số điện thoại", detail.phone || "Chưa có"],
                  ["Ngày đăng ký", formatAdminDate(detail.createdAt)],
                  ["Tổng đã chốt", detail.saleCount > 0 ? `${detail.saleCount} đơn · ${money.format(detail.saleTotal)}đ` : "Chưa có đơn"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="admin-item-meta">{label}</dt>
                    <dd style={{ margin: 0, overflowWrap: "anywhere" }}>{value}</dd>
                  </div>
                ))}
              </dl>

              <AdminCustomerContactDelivery key={selectedId} customerId={selectedId} />

              <section aria-labelledby="customer-requests-title">
                <h3 className="admin-panel-title" id="customer-requests-title">Yêu cầu mua gần đây</h3>
                {detail.requests.length === 0 ? (
                  <p className="admin-panel-caption">Khách chưa gửi yêu cầu nào.</p>
                ) : (
                  <ul style={{ display: "grid", gap: 10, listStyle: "none", margin: "8px 0 0", padding: 0 }}>
                    {detail.requests.map((request) => {
                      const status = requestStatusLabels[request.status] ?? { kind: "neutral" as const, label: request.status };
                      return (
                        <li key={request.id} style={{ borderBottom: "1px solid var(--admin-line, #e5e7eb)", paddingBottom: 8 }}>
                          <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between" }}>
                            <span className="admin-mono">{formatAdminDate(request.createdAt)}</span>
                            <AdminStatusBadge kind={status.kind} value={status.label} />
                          </div>
                          {request.items.length > 0 ? (
                            <div className="admin-item-meta" style={{ marginTop: 4 }}>{request.items.join(" · ")}</div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section aria-labelledby="customer-sales-title">
                <h3 className="admin-panel-title" id="customer-sales-title">Đơn đã chốt qua Zalo</h3>
                {detail.sales.length === 0 ? (
                  <p className="admin-panel-caption">Chưa có đơn nào được ghi nhận.</p>
                ) : (
                  <ul style={{ display: "grid", gap: 6, listStyle: "none", margin: "8px 0 0", padding: 0 }}>
                    {detail.sales.map((sale) => (
                      <li key={sale.id} style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between" }}>
                        <span><strong className="admin-mono">{sale.saleCode}</strong> · {formatAdminDate(sale.confirmedAt)}</span>
                        <span className="admin-mono">{money.format(sale.totalAmount)}đ</span>
                      </li>
                    ))}
                  </ul>
                )}
                {detail.salesPagination?.lastPage > 1 ? (
                  <AdminPagination page={detail.salesPagination.currentPage} lastPage={detail.salesPagination.lastPage} onPage={setSalesPage} total={detail.saleCount} pageSize={20} />
                ) : null}
              </section>
            </div>
          )}
        </AdminModal>
      ) : null}
    </div>
  );
}
