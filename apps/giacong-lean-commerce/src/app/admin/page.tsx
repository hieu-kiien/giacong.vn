"use client";

import { ArrowUpRight, ClipboardList, Package, Settings2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminErrorState, AdminMetric, AdminPageHeading, AdminLoadingTable, DataReadiness } from "@/components/admin/AdminPrimitives";
import { useAdminSession } from "@/components/admin/AdminShell";
import { AdminClientError, fetchAdmin } from "@/lib/admin-client";
import { canManageLeads, canManageServices } from "@/lib/admin-permissions.ts";

interface DashboardData {
  counts: { draftProducts: number; products: number; activeProducts: number; services: number; activeServices: number; leads: number; newLeads: number; news: number };
  dataReadiness: Record<string, boolean>;
  member: { displayName: string; role: string; email: string | null };
  recentLeads: Array<{ createdAt: string; fullName: string; id: string; status: string }>;
}

export default function AdminDashboardPage() {
  const session = useAdminSession();
  const canViewLeads = canManageLeads(session.role);
  const canViewServices = canManageServices(session.role);
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
            <AdminMetric label="Yêu cầu báo giá" value={data.counts.leads} foot={`${data.counts.newLeads} mới chưa xử lý`} testId="metric-leads" />
            <AdminMetric label="Sản phẩm bản nháp" value={data.counts.draftProducts} foot="Chưa xuất bản trên storefront" testId="metric-draft-products" />
            <AdminMetric label="Bài viết tin tức" value={data.counts.news} foot="Tổng bài trong /tin-tuc" testId="metric-news" />
          </div>
          <div className="admin-grid-2">
            {canViewLeads ? <section className="admin-panel" aria-labelledby="recent-leads-heading">
              <div className="admin-panel-heading"><div><h2 className="admin-panel-title" id="recent-leads-heading">Yêu cầu mới nhất</h2><p className="admin-panel-caption">5 lead gần đây nhất từ inbox</p></div><ClipboardList aria-hidden="true" color="#6e8c42" size={19} /></div>
              <div className="admin-brief-list">
                {data.recentLeads.length === 0 ? <p style={{ color: "var(--admin-ink-muted)", padding: "0 21px 16px" }}>Chưa có yêu cầu nào được tiếp nhận.</p> : data.recentLeads.map((lead) => (
                  <Link className="admin-brief-row" href="/admin/yeu-cau" key={lead.id}>
                    <span className="admin-brief-copy"><strong>{lead.fullName}</strong><span>{lead.status} · {lead.createdAt.slice(0, 10)}</span></span>
                    <ArrowUpRight size={14} />
                  </Link>
                ))}
              </div>
            </section> : null}
            <DataReadiness data={data.dataReadiness} />
            <section className="admin-panel" aria-labelledby="quick-links-heading">
              <div className="admin-panel-heading"><div><h2 className="admin-panel-title" id="quick-links-heading">Điểm vào nhanh</h2><p className="admin-panel-caption">Các màn hình cần dùng hàng ngày</p></div><ArrowUpRight aria-hidden="true" color="#6e8c42" size={19} /></div>
              <div className="admin-brief-list">
                <Link className="admin-brief-row" data-testid="link-dashboard-products" href="/admin/san-pham"><span className="admin-brief-icon"><Package size={16} /></span><span className="admin-brief-copy"><strong>Kiểm tra catalog</strong><span>{data.counts.products} sản phẩm trong hệ thống</span></span><ArrowUpRight size={14} /></Link>
                {canViewServices ? <Link className="admin-brief-row" data-testid="link-dashboard-services" href="/admin/dich-vu"><span className="admin-brief-icon"><Settings2 size={16} /></span><span className="admin-brief-copy"><strong>Rà soát dịch vụ</strong><span>{data.counts.services} dịch vụ gia công</span></span><ArrowUpRight size={14} /></Link> : null}
                {canViewLeads ? <Link className="admin-brief-row" data-testid="link-dashboard-leads" href="/admin/yeu-cau"><span className="admin-brief-icon"><ClipboardList size={16} /></span><span className="admin-brief-copy"><strong>Mở inbox yêu cầu</strong><span>{data.counts.leads} yêu cầu cần theo dõi</span></span><ArrowUpRight size={14} /></Link> : null}
              </div>
              <p className="admin-panel-caption" style={{ marginTop: 19 }}>Đang truy cập với vai trò <strong>{data.member.displayName}</strong> · {data.member.role}</p>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
