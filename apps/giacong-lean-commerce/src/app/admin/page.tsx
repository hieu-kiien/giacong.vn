"use client";

import { ArrowUpRight, ClipboardList, Newspaper, Package, Settings2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminErrorState, AdminMetric, AdminPageHeading, AdminLoadingTable, DataReadiness } from "@/components/admin/AdminPrimitives";
import { useAdminSession } from "@/components/admin/AdminShell";
import { AdminClientError, fetchAdmin, formatAdminDate } from "@/lib/admin-client";
import { canManage } from "@/lib/admin-permissions.ts";

interface DashboardData {
  counts: { draftProducts: number; products: number; activeProducts: number; services: number; activeServices: number; leads: number; newLeads: number; news: number };
  dataReadiness: Record<string, boolean>;
  member: { displayName: string; role: string; email: string | null };
  recentLeads: Array<{ createdAt: string; fullName: string; id: string; status: string }>;
}

const dashboardLeadStatusLabels: Record<string, string> = {
  new: "Mới tiếp nhận",
  qualified: "Đã xác thực",
  contacted: "Đã liên hệ",
  quotation_sent: "Đã gửi báo giá",
  sampling: "Đang làm mẫu",
  negotiation: "Đàm phán",
  won: "Đã chốt",
  lost: "Không tiếp tục",
  spam: "Rác",
};

const dashboardRoleLabels: Record<string, string> = {
  owner: "Admin toàn quyền",
};

export default function AdminDashboardPage() {
  const session = useAdminSession();
  const canViewLeads = canManage(session.role, "leads.read");
  const canViewServices = canManage(session.role, "services.read");
  const canViewProducts = canManage(session.role, "catalog.read");
  const canViewNews = canManage(session.role, "news.read");
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
      <AdminPageHeading kicker="Vận hành" title="Tổng quan vận hành" subtitle="Theo dõi nội dung, hàng hóa và các yêu cầu cần xử lý." />
      {loading && !data ? <><div className="admin-skeleton-metrics">{Array.from({ length: 5 }, (_, index) => <div className="admin-skeleton admin-skeleton-metric" key={index} />)}</div><AdminLoadingTable /></> : error && !data ? <AdminErrorState error={error} onRetry={() => { setError(null); setAttempt((value) => value + 1); }} /> : data ? (
        <>
          <div className="admin-metric-grid">
            {canViewLeads ? <AdminMetric label="Yêu cầu mới" value={data.counts.newLeads} foot={`${data.counts.leads} yêu cầu đã tiếp nhận`} testId="metric-leads" /> : null}
            {canViewProducts ? <><AdminMetric label="Tổng sản phẩm" value={data.counts.products} foot={`${data.counts.activeProducts} đang hoạt động`} testId="metric-products" /><AdminMetric label="Sản phẩm bản nháp" value={data.counts.draftProducts} foot="Cần hoàn thiện trước khi xuất bản" testId="metric-draft-products" /></> : null}
            {canViewServices ? <AdminMetric label="Dịch vụ gia công" value={data.counts.services} foot={`${data.counts.activeServices} đang hoạt động`} testId="metric-services" /> : null}
            {canViewNews ? <AdminMetric label="Bài viết tin tức" value={data.counts.news} foot="Bản nháp và bài đã xuất bản" testId="metric-news" /> : null}
          </div>
          <div className="admin-grid-2 admin-dashboard-panels">
            {canViewLeads ? <section className="admin-panel" aria-labelledby="recent-leads-heading">
              <div className="admin-panel-heading"><div><h2 className="admin-panel-title" id="recent-leads-heading">Yêu cầu mới nhất</h2><p className="admin-panel-caption">5 yêu cầu gần đây nhất từ hộp thư</p></div><ClipboardList aria-hidden="true" color="#6e8c42" size={19} /></div>
              <div className="admin-brief-list">
                {data.recentLeads.length === 0 ? <p style={{ color: "var(--admin-ink-muted)", padding: "0 21px 16px" }}>Chưa có yêu cầu nào được tiếp nhận.</p> : data.recentLeads.map((lead) => (
                  <Link className="admin-brief-row" href="/admin/yeu-cau" key={lead.id} prefetch={false}>
                    <span className="admin-brief-copy"><strong>{lead.fullName}</strong><span>{dashboardLeadStatusLabels[lead.status] ?? lead.status} · {formatAdminDate(lead.createdAt)}</span></span>
                    <ArrowUpRight size={14} />
                  </Link>
                ))}
              </div>
            </section> : null}
            <section className="admin-panel admin-dashboard-shortcuts" aria-labelledby="quick-links-heading">
              <div className="admin-panel-heading"><div><h2 className="admin-panel-title" id="quick-links-heading">Công việc thường dùng</h2><p className="admin-panel-caption">Mở nhanh khu vực bạn có quyền truy cập</p></div><ArrowUpRight aria-hidden="true" color="#6e8c42" size={19} /></div>
              <div className="admin-brief-list">
                {canViewProducts ? <Link className="admin-brief-row" data-testid="link-dashboard-products" href="/admin/san-pham" prefetch={false}><span className="admin-brief-icon"><Package size={16} /></span><span className="admin-brief-copy"><strong>Quản lý sản phẩm</strong><span>{data.counts.draftProducts} bản nháp cần hoàn thiện</span></span><ArrowUpRight size={14} /></Link> : null}
                {canViewServices ? <Link className="admin-brief-row" data-testid="link-dashboard-services" href="/admin/dich-vu" prefetch={false}><span className="admin-brief-icon"><Settings2 size={16} /></span><span className="admin-brief-copy"><strong>Rà soát dịch vụ</strong><span>{data.counts.services} dịch vụ gia công</span></span><ArrowUpRight size={14} /></Link> : null}
                {canViewNews ? <Link className="admin-brief-row" data-testid="link-dashboard-news" href="/admin/tin-tuc" prefetch={false}><span className="admin-brief-icon"><Newspaper size={16} /></span><span className="admin-brief-copy"><strong>Biên tập tin tức</strong><span>Soạn bài, kiểm tra và xuất bản</span></span><ArrowUpRight size={14} /></Link> : null}
                {canViewLeads ? <Link className="admin-brief-row" data-testid="link-dashboard-leads" href="/admin/yeu-cau" prefetch={false}><span className="admin-brief-icon"><ClipboardList size={16} /></span><span className="admin-brief-copy"><strong>Mở hộp thư yêu cầu</strong><span>{data.counts.newLeads} yêu cầu mới chưa xử lý</span></span><ArrowUpRight size={14} /></Link> : null}
              </div>
              <p className="admin-panel-caption" style={{ marginTop: 19 }}>Tài khoản <strong>{data.member.displayName}</strong> · {dashboardRoleLabels[data.member.role] ?? data.member.role}</p>
            </section>
            {session.role === "owner" ? <DataReadiness data={data.dataReadiness} /> : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
