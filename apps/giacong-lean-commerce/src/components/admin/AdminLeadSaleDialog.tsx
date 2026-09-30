"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AdminModal } from "@/components/admin/AdminDialog";
import { AdminClientError, fetchAdmin, formatAdminDate, mutateAdmin, type AdminLead, type AdminLeadItem } from "@/lib/admin-client";

interface SaleItemDraft {
  included: boolean;
  leadItemId: string;
  quantity: string;
  unitPrice: string;
  item: AdminLeadItem;
}

interface AdminZaloSale {
  id: string;
  saleCode: string;
  sourceLeadId: string;
  customerId: string;
  confirmedAt: string;
  confirmedBy: string;
  channel: "zalo";
  currency: "VND";
  totalAmount: number;
  customer: { fullName: string; companyName: string | null; email: string | null; phone: string | null };
  items: Array<{
    id: string;
    sourceLeadItemId: string;
    productName: string;
    variantName: string | null;
    variantSku: string | null;
    unit: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  sheetSync: { status: string; message: string };
}

interface SaleResponse {
  sale: AdminZaloSale | null;
}

interface AdminLeadSaleDialogProps {
  lead: AdminLead;
  onClose: () => void;
}

export function AdminLeadSaleDialog({ lead, onClose }: AdminLeadSaleDialogProps) {
  const [sale, setSale] = useState<AdminZaloSale | null>(null);
  const [drafts, setDrafts] = useState<SaleItemDraft[]>(() => toDrafts(lead.items ?? []));
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [retryingSync, setRetryingSync] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(crypto.randomUUID());

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void fetchAdmin<SaleResponse>(`/api/admin/leads/${lead.id}/sales`, controller.signal)
      .then((response) => {
        setSale(response.sale);
        setLoaded(true);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setError(reason instanceof AdminClientError ? reason.message : "Không thể tải thông tin giao dịch.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [lead.id, loadAttempt]);

  const total = useMemo(() => drafts.reduce((sum, draft) => {
    if (!draft.included || !/^\d+$/.test(draft.quantity) || !/^\d+$/.test(draft.unitPrice)) return sum;
    return sum + Number(draft.quantity) * Number(draft.unitPrice);
  }, 0), [drafts]);

  const validDrafts = drafts.filter((draft) => draft.included);
  const canSave = !loading && loaded && !saving && !sale && validDrafts.length > 0
    && validDrafts.every((draft) => Number.isSafeInteger(Number(draft.quantity)) && Number(draft.quantity) > 0
      && Number.isSafeInteger(Number(draft.unitPrice)) && Number(draft.unitPrice) >= 0
      && Number.isSafeInteger(Number(draft.quantity) * Number(draft.unitPrice)))
    && Number.isSafeInteger(total);

  function updateDraft(leadItemId: string, patch: Partial<Pick<SaleItemDraft, "included" | "quantity" | "unitPrice">>) {
    setDrafts((current) => current.map((draft) => draft.leadItemId === leadItemId ? { ...draft, ...patch } : draft));
  }

  async function saveSale() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const response = await mutateAdmin<SaleResponse>(`/api/admin/leads/${lead.id}/sales`, {
        body: {
          requestId: requestId.current,
          items: validDrafts.map((draft) => ({
            leadItemId: draft.leadItemId,
            quantity: Number(draft.quantity),
            unitPrice: Number(draft.unitPrice),
          })),
        },
        method: "POST",
      });
      setSale(response.sale);
    } catch (reason: unknown) {
      setError(reason instanceof AdminClientError ? reason.message : "Không thể lưu giao dịch. Hãy tải lại yêu cầu trước khi thử lại.");
    } finally {
      setSaving(false);
    }
  }

  async function retrySheetSync() {
    if (!sale || sale.sheetSync.status !== "failed" || retryingSync) return;
    setRetryingSync(true);
    setError(null);
    try {
      const response = await mutateAdmin<SaleResponse>(`/api/admin/leads/${lead.id}/sales/retry`, {
        body: { requestId: crypto.randomUUID() },
        method: "POST",
      });
      setSale(response.sale);
    } catch (reason: unknown) {
      setError(reason instanceof AdminClientError ? reason.message : "Không thể thử đồng bộ Google Sheets.");
    } finally {
      setRetryingSync(false);
    }
  }

  return (
    <AdminModal labelledBy="admin-lead-sale-title" onClose={onClose} title={sale ? `Giao dịch ${sale.saleCode}` : "Ghi nhận đã chốt qua Zalo"} width="wide">
      <h2 hidden id="admin-lead-sale-title">{sale ? `Giao dịch ${sale.saleCode}` : "Ghi nhận đã chốt qua Zalo"}</h2>
      {loading ? <p aria-live="polite" className="admin-item-meta">Đang tải thông tin giao dịch…</p> : null}
      {error ? <p className="admin-editor-error" role="alert">{error}</p> : null}
      {!loading && !loaded && !sale ? (
        <button className="admin-button admin-button-quiet" onClick={() => setLoadAttempt((attempt) => attempt + 1)} type="button">Thử tải lại</button>
      ) : null}
      {sale ? (
        <section aria-label="Giao dịch đã lưu">
          <p className="admin-item-meta" style={{ marginTop: 0 }}>
            Khách: <strong>{sale.customer.fullName}</strong>{sale.customer.companyName ? ` · ${sale.customer.companyName}` : ""}
            {sale.customer.phone ? ` · ${sale.customer.phone}` : ""}
          </p>
          <p className="admin-item-meta">Mã giao dịch <strong>{sale.saleCode}</strong> · Xác nhận {formatAdminDate(sale.confirmedAt)} · Qua Zalo</p>
          <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
            {sale.items.map((item) => (
              <div key={item.id} style={{ border: "1px solid var(--admin-border)", borderRadius: 8, padding: 10 }}>
                <strong>{item.productName}</strong>
                <div className="admin-item-meta">{[item.variantName, item.variantSku ? `SKU ${item.variantSku}` : null].filter(Boolean).join(" · ") || "Không có biến thể"}</div>
                <div className="admin-item-meta">{item.quantity} {item.unit || "đơn vị"} × {formatMoney(item.unitPrice)} = <strong>{formatMoney(item.lineTotal)}</strong></div>
              </div>
            ))}
          </div>
          <p style={{ display: "flex", justifyContent: "space-between", margin: "16px 0 0", fontWeight: 700 }}>
            <span>Tổng giao dịch</span><span>{formatMoney(sale.totalAmount)}</span>
          </p>
          <p role="status" style={{ background: "var(--admin-surface-subtle, #f4f6f8)", borderRadius: 8, fontSize: 13, lineHeight: 1.5, margin: "14px 0 0", padding: 10 }}>
            {sale.sheetSync.message}
          </p>
          <footer className="admin-modal-footer">
            {sale.sheetSync.status === "failed" ? (
              <button className="admin-button admin-button-primary" disabled={retryingSync} onClick={() => void retrySheetSync()} type="button">
                {retryingSync ? "Đang đồng bộ lại…" : "Thử đồng bộ lại Google Sheets"}
              </button>
            ) : null}
            <button className="admin-button admin-button-quiet" onClick={onClose} type="button">Đóng</button>
          </footer>
        </section>
      ) : null}
      {!loading && loaded && !sale ? (
        <>
          <p style={{ color: "var(--admin-ink-muted)", fontSize: 13, lineHeight: 1.5, marginTop: 0 }}>
            Chỉ ghi sau khi nhân viên đã chốt với khách trên Zalo. Số lượng và đơn giá bên dưới là số cuối cùng đã thống nhất; dữ liệu được lưu trong D1 và gắn với tài khoản khách của yêu cầu này.
          </p>
          {drafts.length ? (
            <div style={{ display: "grid", gap: 10 }}>
              {drafts.map((draft, index) => (
                <fieldset key={draft.leadItemId} disabled={saving} style={{ border: "1px solid var(--admin-border)", borderRadius: 8, display: "grid", gap: 9, gridTemplateColumns: "minmax(150px, 1fr) 105px 150px", margin: 0, padding: 10 }}>
                  <legend className="admin-item-meta">Dòng {index + 1}</legend>
                  <label style={{ alignItems: "flex-start", display: "flex", gap: 8, gridColumn: "1 / -1" }}>
                    <input checked={draft.included} onChange={(event) => updateDraft(draft.leadItemId, { included: event.target.checked })} type="checkbox" />
                    <span>
                      <strong>{draft.item.productName || draft.item.serviceSlug || "Dòng yêu cầu"}</strong>
                      <span className="admin-item-meta" style={{ display: "block" }}>{[draft.item.variantName, draft.item.variantSku ? `SKU ${draft.item.variantSku}` : null].filter(Boolean).join(" · ") || "Không có biến thể"}</span>
                    </span>
                  </label>
                  <label className="admin-field" style={{ margin: 0 }}>
                    <span className="admin-label">Số lượng</span>
                    <input aria-label={`Số lượng dòng ${index + 1}`} className="admin-input" min="1" onChange={(event) => updateDraft(draft.leadItemId, { quantity: event.target.value })} step="1" type="number" value={draft.quantity} />
                  </label>
                  <label className="admin-field" style={{ margin: 0, gridColumn: "2 / 4" }}>
                    <span className="admin-label">Đơn giá chốt (VND)</span>
                    <input aria-label={`Đơn giá dòng ${index + 1}`} className="admin-input" min="0" onChange={(event) => updateDraft(draft.leadItemId, { unitPrice: event.target.value })} step="1" type="number" value={draft.unitPrice} />
                  </label>
                  <span className="admin-item-meta" style={{ gridColumn: "1 / -1" }}>
                    Thành tiền: {draft.included && /^\d+$/.test(draft.quantity) && /^\d+$/.test(draft.unitPrice)
                      ? formatMoney(Number(draft.quantity) * Number(draft.unitPrice))
                      : "—"}
                  </span>
                </fieldset>
              ))}
            </div>
          ) : <p className="admin-empty-state">Yêu cầu chưa có dòng sản phẩm/dịch vụ để ghi nhận giao dịch.</p>}
          <p style={{ display: "flex", justifyContent: "space-between", margin: "16px 0 0", fontWeight: 700 }}>
            <span>Tổng giao dịch dự kiến</span><span>{formatMoney(total)}</span>
          </p>
          <p className="admin-item-meta" style={{ lineHeight: 1.5 }}>
            Sau khi xác nhận, giao dịch được lưu ở D1 trước rồi tự đồng bộ sang Google Sheets theo mã giao dịch; không cần nhập tay lần nữa.
          </p>
          <footer className="admin-modal-footer">
            <button className="admin-button admin-button-quiet" disabled={saving} onClick={onClose} type="button">Hủy</button>
            <button className="admin-button admin-button-primary" disabled={!canSave} onClick={() => void saveSale()} type="button">
              {saving ? "Đang lưu…" : "Xác nhận giao dịch Zalo"}
            </button>
          </footer>
        </>
      ) : null}
    </AdminModal>
  );
}

function toDrafts(items: AdminLeadItem[]): SaleItemDraft[] {
  return items.map((item) => ({
    included: true,
    leadItemId: item.id,
    quantity: item.quantity === null ? "" : String(item.quantity),
    unitPrice: item.unitPrice === null || !Number.isSafeInteger(item.unitPrice) ? "" : String(item.unitPrice),
    item,
  }));
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("vi-VN", { currency: "VND", maximumFractionDigits: 0, style: "currency" }).format(value);
}
