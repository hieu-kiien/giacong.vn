"use client";

import { ArrowUpRight, ClipboardList, Package, Settings2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminErrorState, AdminMetric, AdminPageHeading, AdminLoadingTable, DataReadiness } from "@/components/admin/AdminPrimitives";
import { useAdminSession } from "@/components/admin/AdminShell";
import { AdminClientError, fetchAdmin } from "@/lib/admin-client";

interface DashboardData {
  counts: { products: number; activeProducts: number; services: number; activeServices: number; leads: number };
  dataReadiness: Record<string, boolean>;
  member: { displayName: string; role: string; email: string | null };
}

export default function AdminDashboardPage() {
  const session = useAdminSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<AdminClientError | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setLoading(true);
      setError(null);
      try {
        setData(await fetchAdmin<DashboardData>("/api/admin/dashboard", controller.signal));
      } catch (reason: unknown) {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể tải tổng quan.", 0));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [session.subject, attempt]);

  return (
    <div className="admin-content">
      <AdminPageHeading kicker="Bảng điều hành" title="Tổng quan vận hành" subtitle="Một điểm nhìn vào sức khỏe catalog và luồng yêu cầu báo giá của Giacong.vn." stamp="LIVE · D1 CATALOG" />
      {loading && !data ? <><div className="admin-skeleton-metrics">{Array.from({ length: 5 }, (_, index) => <div className="admin-skeleton admin-skeleton-metric" key={index} />)}</div><AdminLoadingTable /></> : error && !data ? <AdminErrorState error={error} onRetry={() => { setError(null); setAttempt((value) => value + 1); }} /> : data ? (
        <>
          <div className="admin-metric-grid">
            <AdminMetric label="Tổng sản phẩm" value={data.counts.products} foot={`${data.counts.activeProducts} đang hoạt động`} testId="metric-products" />
            <AdminMetric label="Sản phẩm hoạt động" value={data.counts.activeProducts} foot="Đang hiển thị trên storefront" testId="metric-active-products" />
            <AdminMetric label="Dịch vụ gia công" value={data.counts.services} foot={`${data.counts.activeServices} đang hoạt động`} testId="metric-services" />
            <AdminMetric label="Dịch vụ hoạt động" value={data.counts.activeServices} foot="Đang nhận yêu cầu" testId="metric-active-services" />
            <AdminMetric label="Yêu cầu báo giá" value={data.counts.leads} foot="Tổng lead đã tiếp nhận" testId="metric-leads" />
          </div>
          <div className="admin-grid-2">
            <DataReadiness data={data.dataReadiness} />
            <section className="admin-panel" aria-labelledby="quick-links-heading">
              <div className="admin-panel-heading"><div><h2 className="admin-panel-title" id="quick-links-heading">Điểm vào nhanh</h2><p className="admin-panel-caption">Các màn hình cần dùng hàng ngày</p></div><ArrowUpRight aria-hidden="true" color="#6e8c42" size={19} /></div>
              <div className="admin-brief-list">
                <Link className="admin-brief-row" data-testid="link-dashboard-products" href="/admin/san-pham"><span className="admin-brief-icon"><Package size={16} /></span><span className="admin-brief-copy"><strong>Kiểm tra catalog</strong><span>{data.counts.products} sản phẩm trong hệ thống</span></span><ArrowUpRight size={14} /></Link>
                <Link className="admin-brief-row" data-testid="link-dashboard-services" href="/admin/dich-vu"><span className="admin-brief-icon"><Settings2 size={16} /></span><span className="admin-brief-copy"><strong>Rà soát dịch vụ</strong><span>{data.counts.services} dịch vụ gia công</span></span><ArrowUpRight size={14} /></Link>
                <Link className="admin-brief-row" data-testid="link-dashboard-leads" href="/admin/yeu-cau"><span className="admin-brief-icon"><ClipboardList size={16} /></span><span className="admin-brief-copy"><strong>Mở inbox yêu cầu</strong><span>{data.counts.leads} yêu cầu cần theo dõi</span></span><ArrowUpRight size={14} /></Link>
              </div>
              <p className="admin-panel-caption" style={{ marginTop: 19 }}>Đang truy cập với vai trò <strong>{data.member.displayName}</strong> · {data.member.role}</p>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}