"use client";

import { ArrowUpRight, ClipboardList, Database, Newspaper, Package, Settings2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AdminErrorState,
  AdminMetric,
  AdminOperationsQueue,
  AdminPageHeading,
  AdminLoadingTable,
  DataReadiness,
} from "@/components/admin/AdminPrimitives";
import { useAdminSession } from "@/components/admin/AdminShell";
import { AdminClientError, fetchAdmin } from "@/lib/admin-client";
import { canManage } from "@/lib/admin-permissions.ts";

interface DashboardData {
  counts: {
    draftProducts: number;
    products: number;
    activeProducts: number;
    services: number;
    activeServices: number;
    leads: number;
    newLeads: number;
    news: number;
  };
  dataReadiness: Record<string, boolean>;
  member: { displayName: string; role: string; email: string | null };
  recentLeads?: Array<{
    createdAt: string;
    fullName: string;
    id: string;
    status: string;
  }>;
}

const dashboardRoleLabels: Record<string, string> = {
  owner: "Admin toàn quyền",
  operator: "Vận hành viên",
  editor: "Biên tập viên",
  viewer: "Người xem",
};

export default function AdminDashboardPage() {
  const session = useAdminSession();
  const canViewServices = canManage(session.role, "services.read");
  const canViewProducts = canManage(session.role, "catalog.read");
  const canViewNews = canManage(session.role, "news.read");
  const canViewLeads = canManage(session.role, "leads.read");
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
      <AdminPageHeading
        kicker="Vận hành"
        title="Tổng quan vận hành"
        subtitle="Trung tâm điều phối tác vụ B2B và theo dõi luồng công việc thời gian thực."
      />
      {loading && !data ? (
        <>
          <div className="admin-skeleton-metrics">
            {Array.from({ length: 4 }, (_, index) => (
              <div className="admin-skeleton admin-skeleton-metric" key={index} />
            ))}
          </div>
          <AdminLoadingTable />
        </>
      ) : error && !data ? (
        <AdminErrorState
          error={error}
          onRetry={() => {
            setError(null);
            setAttempt((value) => value + 1);
          }}
        />
      ) : data ? (
        <>
          <div className="admin-metric-grid">
            {canViewProducts ? (
              <>
                <AdminMetric
                  href="/admin/san-pham"
                  label="Tổng sản phẩm"
                  value={data.dataReadiness.productsTable ? data.counts.products : "—"}
                  foot={!data.dataReadiness.productsTable ? "Chưa tải được số liệu sản phẩm" : data.dataReadiness.activeProducts ? `${data.counts.activeProducts} đang hoạt động` : "Chưa tải được số sản phẩm đang hoạt động"}
                  testId="metric-products"
                />
                <AdminMetric
                  href="/admin/san-pham?status=draft"
                  label="Sản phẩm bản nháp"
                  value={data.dataReadiness.productDraftsReady ? data.counts.draftProducts : "—"}
                  foot={data.dataReadiness.productDraftsReady ? "Cần hoàn thiện trước khi xuất bản" : "Chưa xác định được trạng thái bản nháp"}
                  testId="metric-draft-products"
                />
              </>
            ) : null}
            {canViewServices ? (
              <AdminMetric
                href="/admin/dich-vu"
                label="Dịch vụ gia công"
                value={data.dataReadiness.servicesTable ? data.counts.services : "—"}
                foot={!data.dataReadiness.servicesTable ? "Chưa tải được số liệu dịch vụ" : data.dataReadiness.activeServices ? `${data.counts.activeServices} đang hoạt động` : "Chưa tải được số dịch vụ đang hoạt động"}
                testId="metric-services"
              />
            ) : null}
            {canViewNews ? (
              <AdminMetric
                href="/admin/tin-tuc"
                label="Bài viết tin tức"
                value={data.dataReadiness.newsPostsTable ? data.counts.news : "—"}
                foot={data.dataReadiness.newsPostsTable ? "Bản nháp và bài đã xuất bản" : "Chưa tải được số liệu bài viết"}
                testId="metric-news"
              />
            ) : null}
          </div>

          <div className="admin-grid-2 admin-dashboard-panels">
            {/* Primary Operations Hub: Actionable B2B Work Queue */}
            <AdminOperationsQueue
              counts={data.counts}
              dataReadiness={data.dataReadiness}
              recentLeads={data.recentLeads}
              permissions={{
                canViewLeads,
                canViewProducts,
                canViewServices,
                canViewNews,
              }}
            />

            {/* Sidebar Column: Quick Shortcuts and DevOps Diagnostics */}
            <div className="admin-dashboard-sidebar-column">
              <section className="admin-panel admin-dashboard-shortcuts" aria-labelledby="quick-links-heading">
                <div className="admin-panel-heading">
                  <div>
                    <h2 className="admin-panel-title" id="quick-links-heading">Công việc thường dùng</h2>
                    <p className="admin-panel-caption">Mở nhanh khu vực bạn có quyền truy cập</p>
                  </div>
                  <ArrowUpRight aria-hidden="true" color="#6e8c42" size={19} />
                </div>
                <div className="admin-brief-list">
                  {canViewLeads ? (
                    <Link className="admin-brief-row" data-testid="link-quick-inbox" href="/admin/yeu-cau" prefetch={false}>
                      <span className="admin-brief-icon"><ClipboardList size={16} /></span>
                      <span className="admin-brief-copy">
                        <strong>Hộp thư yêu cầu báo giá</strong>
                        <span>{!data.dataReadiness.leadsTable ? "Chưa tải được số lượng yêu cầu" : !data.dataReadiness.newLeads ? "Chưa xác định được số yêu cầu mới" : data.counts.newLeads > 0 ? `${data.counts.newLeads} yêu cầu mới cần xử lý` : `${data.counts.leads} yêu cầu trong hộp thư`}</span>
                      </span>
                      <ArrowUpRight size={14} />
                    </Link>
                  ) : null}
                  {canViewProducts ? (
                    <Link className="admin-brief-row" data-testid="link-dashboard-products" href="/admin/san-pham" prefetch={false}>
                      <span className="admin-brief-icon"><Package size={16} /></span>
                      <span className="admin-brief-copy">
                        <strong>Quản lý sản phẩm</strong>
                        <span>{data.dataReadiness.productDraftsReady ? `${data.counts.draftProducts} bản nháp cần hoàn thiện` : "Chưa xác định trạng thái bản nháp"}</span>
                      </span>
                      <ArrowUpRight size={14} />
                    </Link>
                  ) : null}
                  {canViewServices ? (
                    <Link className="admin-brief-row" data-testid="link-dashboard-services" href="/admin/dich-vu" prefetch={false}>
                      <span className="admin-brief-icon"><Settings2 size={16} /></span>
                      <span className="admin-brief-copy">
                        <strong>Rà soát dịch vụ</strong>
                        <span>{data.dataReadiness.servicesTable ? `${data.counts.services} dịch vụ gia công` : "Chưa tải được số lượng dịch vụ"}</span>
                      </span>
                      <ArrowUpRight size={14} />
                    </Link>
                  ) : null}
                  {canViewNews ? (
                    <Link className="admin-brief-row" data-testid="link-dashboard-news" href="/admin/tin-tuc" prefetch={false}>
                      <span className="admin-brief-icon"><Newspaper size={16} /></span>
                      <span className="admin-brief-copy">
                        <strong>Biên tập tin tức</strong>
                        <span>Soạn bài, kiểm tra và xuất bản</span>
                      </span>
                      <ArrowUpRight size={14} />
                    </Link>
                  ) : null}
                </div>
                <p className="admin-panel-caption" style={{ marginTop: 19 }}>
                  Tài khoản <strong>{data.member.displayName}</strong> · {dashboardRoleLabels[data.member.role] ?? data.member.role}
                </p>
              </section>

              {/* DevOps Schema Readiness Diagnostic: Kept compact & non-intrusive for owner */}
              {session.role === "owner" && data.dataReadiness ? (
                <details className="admin-readiness-accordion" data-testid="accordion-data-readiness">
                  <summary className="admin-readiness-summary">
                    <span className="admin-readiness-summary-left">
                      <Database size={15} />
                      <strong>Chẩn đoán kết nối D1</strong>
                    </span>
                    <span className="admin-readiness-summary-count">
                      {Object.entries(data.dataReadiness).filter(([, ready]) => ready).length}/
                      {Object.keys(data.dataReadiness).length} sẵn sàng
                    </span>
                  </summary>
                  <div className="admin-readiness-accordion-body">
                  <DataReadiness data={data.dataReadiness} />
                  </div>
                </details>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
