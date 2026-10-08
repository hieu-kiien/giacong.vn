"use client";
import { useEffect, useRef, useState } from "react";
import { fetchAdmin, mutateAdmin } from "@/lib/admin-client";
import type { CustomerContactDeliveryStatus } from "@/lib/customer-contact-delivery-status";
const labels = { pending: "Chờ gửi", delivered: "Đã gửi", not_required: "Chưa có thông tin liên hệ mới" };
export function AdminCustomerContactDelivery({ customerId }: { customerId: string }) {
  const [delivery,setDelivery] = useState<CustomerContactDeliveryStatus | null>(null);
  const [error,setError] = useState(""); const [pending,setPending] = useState(false); const inFlight = useRef(false);
  const endpoint = `/api/admin/customers/${encodeURIComponent(customerId)}/contact-delivery`;
  useEffect(() => {
    const controller = new AbortController();
    void fetchAdmin<{ delivery: CustomerContactDeliveryStatus }>(endpoint,controller.signal).then(result => { if (!controller.signal.aborted) setDelivery(result.delivery); }).catch(() => { if (!controller.signal.aborted) setError("Chưa tải được trạng thái đồng bộ."); });
    return () => controller.abort();
  },[endpoint]);
  async function retry() {
    if (inFlight.current) return; inFlight.current = true; setPending(true); setError("");
    try { const result = await mutateAdmin<{ delivery: CustomerContactDeliveryStatus }>(endpoint,{ method: "POST" }); setDelivery(result.delivery); }
    catch { setError("Chưa thử đồng bộ được. Vui lòng thử lại."); }
    finally { inFlight.current = false; setPending(false); }
  }
  return <section aria-label="Thông báo và đồng bộ khách hàng" className="grid gap-2">
    <h3 className="admin-panel-title">Thông báo và đồng bộ</h3>
    {delivery ? <><p className="admin-panel-caption">Google Sheets: {labels[delivery.sheet]} · Email khách mới: {labels[delivery.email]}</p>
      {delivery.reviewRequired ? <p role="alert">Cần đối soát lần gửi email trước với dịch vụ email để tránh gửi trùng.</p> : delivery.failed ? <p role="alert">Có kênh chưa gửi được. Thông tin khách vẫn đã lưu; kiểm tra cấu hình rồi thử lại.</p> : null}
      {(delivery.sheet === "pending" || delivery.email === "pending" && !delivery.reviewRequired) ? <button type="button" className="admin-button admin-button-quiet" disabled={pending} onClick={() => void retry()}>{pending ? "Đang thử lại…" : delivery.reviewRequired ? "Thử đồng bộ Google Sheets" : "Thử đồng bộ lại"}</button> : null}
    </> : <p>{error ? "" : "Đang kiểm tra đồng bộ…"}</p>}
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}
