import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Database,
  Inbox,
  Newspaper,
  Package,
  RefreshCw,
} from "lucide-react";
import { AdminClientError, formatAdminDate } from "@/lib/admin-client";

export function AdminPageHeading({ kicker, title, subtitle, stamp }: { kicker: string; title: string; subtitle: string; stamp?: string }) {
  return (
    <div className="admin-page-heading">
      <div><div className="admin-kicker">{kicker}</div><h1 className="admin-page-title">{title}</h1><p className="admin-page-subtitle">{subtitle}</p></div>
      {stamp ? <span className="admin-stamp">{stamp}</span> : null}
    </div>
  );
}

export function AdminLoadingTable() {
  return <div aria-label="Đang tải dữ liệu" aria-busy="true" role="status" className="admin-skeleton admin-skeleton-table" data-testid="status-table-loading" />;
}

export function AdminErrorState({ error, onRetry }: { error: AdminClientError; onRetry: () => void }) {
  const isMigration = error.code === "INTERNAL_ERROR" || /D1|bảng|table|migration|binding/i.test(error.message);
  return (
    <section className="admin-state" data-testid="status-admin-error" role="alert">
      <div className="admin-state-icon is-error"><AlertTriangle aria-hidden="true" size={19} /></div>
      <div>
        <h2>{isMigration ? "Dữ liệu chưa sẵn sàng" : "Không thể tải dữ liệu"}</h2>
        <p>{isMigration ? "Hệ thống chưa hoàn tất phần chuẩn bị dữ liệu. Hãy thử tải lại; nếu vẫn chưa được, liên hệ người quản trị." : error.message}</p>
        <button className="admin-button admin-button-quiet" data-testid="button-retry-data" onClick={onRetry} type="button"><RefreshCw size={14} /> Thử tải lại</button>
      </div>
    </section>
  );
}

export function AdminEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="admin-table-empty" data-testid="status-admin-empty">
      <Inbox aria-hidden="true" size={25} />
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

export function AdminStatusBadge({ value, kind = "neutral" }: { value: string; kind?: "green" | "amber" | "red" | "blue" | "neutral" }) {
  return <span className={`admin-badge admin-badge-${kind}`}>{value}</span>;
}

export function AdminMetric({ label, value, foot, testId, href }: { label: string; value: number | string; foot: string; testId: string; href?: string }) {
  const metricContent = (
    <div className={`admin-metric${href ? " is-clickable" : ""}`} data-testid={testId}>
      <div className="admin-metric-label">{label}</div>
      <div className="admin-metric-value">{value}</div>
      <div className="admin-metric-foot">{foot}</div>
    </div>
  );
  if (href) {
    return (
      <Link href={href} prefetch={false} style={{ color: "inherit", display: "block", textDecoration: "none" }}>
        {metricContent}
      </Link>
    );
  }
  return metricContent;
}

export function DataReadiness({ data }: { data: Record<string, boolean> }) {
  const labels: Record<string, string> = {
    activeProducts: "Số sản phẩm đang hoạt động",
    activeServices: "Số dịch vụ đang hoạt động",
    adminMembersTable: "Danh sách thành viên",
    auditLogsTable: "Lịch sử thay đổi",
    leadsTable: "Yêu cầu báo giá",
    newsPostsTable: "Bài viết tin tức",
    newLeads: "Số yêu cầu mới",
    productDraftsReady: "Trạng thái bản nháp sản phẩm",
    productMetaTable: "Thông tin bổ sung sản phẩm",
    productsTable: "Danh mục sản phẩm",
    recentLeads: "Yêu cầu mới gần đây",
    serviceMetaTable: "Thông tin bổ sung dịch vụ",
    servicesTable: "Danh mục dịch vụ",
  };
  const entries = Object.entries(data);
  const readyCount = entries.filter(([, ready]) => ready).length;
  return (
    <section className="admin-panel" aria-labelledby="readiness-heading" data-testid="panel-data-readiness">
      <div className="admin-panel-heading"><div><h2 className="admin-panel-title" id="readiness-heading">Trạng thái kết nối dữ liệu</h2><p className="admin-panel-caption">{readyCount}/{entries.length} phân hệ Cloudflare D1 sẵn sàng</p></div><Database aria-hidden="true" color="#6e8c42" size={19} /></div>
      <div className="admin-readiness-list">
        {entries.map(([key, ready]) => <div className="admin-readiness-row" key={key}><span className="admin-readiness-name">{labels[key] ?? key}</span><span className={`admin-ready-state ${ready ? "is-ready" : "is-pending"}`}>{ready ? "Sẵn sàng" : "Chưa tải được"}</span></div>)}
      </div>
      {readyCount < entries.length ? <div className="admin-readiness-note">Một số phần dữ liệu chưa sẵn sàng hoặc chưa tải được. Bạn vẫn có thể xem các phần đã sẵn sàng; hãy liên hệ người quản trị nếu cần hỗ trợ.</div> : null}
    </section>
  );
}

export function AdminPagination({ page, lastPage, total, pageSize, onPage }: { page: number; lastPage: number; total: number; pageSize: number; onPage: (page: number) => void }) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="admin-pagination">
      <span className="admin-pagination-copy">{from}–{to} trong {total} bản ghi</span>
      <div className="admin-pagination-actions">
        <button aria-label="Trang trước" className="admin-button admin-button-quiet" data-testid="button-page-previous" disabled={page <= 1} onClick={() => onPage(page - 1)} type="button"><ChevronLeft size={14} /> Trước</button>
        <button aria-label="Trang sau" className="admin-button admin-button-quiet" data-testid="button-page-next" disabled={page >= lastPage} onClick={() => onPage(page + 1)} type="button">Sau <ChevronRight size={14} /></button>
      </div>
    </div>
  );
}

export function AdminUnavailableNote() {
  return <div className="admin-readiness-note"><CheckCircle2 size={13} style={{ verticalAlign: "middle" }} /> Dữ liệu được đọc trực tiếp từ hệ thống, không có bản ghi mẫu trong giao diện.</div>;
}

export interface AdminOperationsQueueProps {
  counts: {
    newLeads: number;
    leads: number;
    draftProducts: number;
    products: number;
    activeProducts: number;
    services: number;
    news: number;
  };
  dataReadiness: Record<string, boolean>;
  recentLeads?: Array<{
    id: string;
    fullName: string;
    status: string;
    createdAt: string;
  }>;
  permissions: {
    canViewLeads: boolean;
    canViewProducts: boolean;
    canViewServices: boolean;
    canViewNews: boolean;
  };
}

const queueLeadStatusLabels: Record<string, string> = {
  new: "Mới tiếp nhận",
  qualified: "Đã xác thực",
  contacted: "Đã liên hệ",
  quotation_sent: "Đã báo giá",
  sampling: "Đang làm mẫu",
  negotiation: "Đàm phán",
  won: "Đã chốt",
  lost: "Không tiếp tục",
  spam: "Rác",
};

function queueLeadStatusKind(status: string): "green" | "amber" | "red" | "blue" | "neutral" {
  if (status === "new" || status === "qualified" || status === "won") return "green";
  if (status === "contacted" || status === "quotation_sent" || status === "sampling" || status === "negotiation") return "blue";
  if (status === "lost" || status === "spam") return "red";
  return "neutral";
}

export function AdminOperationsQueue({
  counts,
  dataReadiness,
  recentLeads,
  permissions,
}: AdminOperationsQueueProps) {
  const { canViewLeads, canViewProducts, canViewNews } = permissions;
  const leadsReady = dataReadiness.leadsTable;
  const newLeadsReady = dataReadiness.newLeads;
  const recentLeadsReady = dataReadiness.recentLeads;
  const productDraftsReady = dataReadiness.productDraftsReady;
  const newsReady = dataReadiness.newsPostsTable;

  return (
    <div className="admin-operations-queue" data-testid="panel-operations-queue">
      {/* Task 1: Pending RFQ Leads Queue */}
      {canViewLeads ? (
        <section className="admin-panel admin-queue-section" aria-labelledby="queue-rfq-heading">
          <div className="admin-panel-heading">
            <div>
              <div className="admin-queue-title-wrap">
                <h2 className="admin-panel-title" id="queue-rfq-heading">
                  Hàng đợi yêu cầu báo giá B2B
                </h2>
                {!leadsReady ? (
                  <span className="admin-badge admin-badge-neutral">Chưa tải được</span>
                ) : !newLeadsReady ? (
                  <span className="admin-badge admin-badge-neutral">Chưa xác định</span>
                ) : counts.newLeads > 0 ? (
                  <span className="admin-badge admin-badge-amber admin-badge-pulse">
                    {counts.newLeads} yêu cầu mới
                  </span>
                ) : (
                  <span className="admin-badge admin-badge-neutral">
                    Không có yêu cầu mới
                  </span>
                )}
              </div>
              <p className="admin-panel-caption">
                Yêu cầu báo giá và năng lực gia công tiếp nhận từ khách hàng doanh nghiệp
              </p>
            </div>
            <Link
              href="/admin/yeu-cau"
              className="admin-queue-view-all"
              prefetch={false}
              title="Xem tất cả trong hộp thư"
            >
              {leadsReady ? `Xem hộp thư (${counts.leads})` : "Mở hộp thư yêu cầu"}
              <ArrowUpRight size={14} />
            </Link>
          </div>

          {!leadsReady ? (
            <div className="admin-queue-empty">
              <ClipboardList size={22} className="admin-queue-empty-icon" />
              <p>Chưa thể tải yêu cầu báo giá. Hãy kiểm tra trạng thái kết nối dữ liệu.</p>
            </div>
          ) : !recentLeadsReady ? (
            <div className="admin-queue-empty">
              <ClipboardList size={22} className="admin-queue-empty-icon" />
              <p>Chưa thể tải danh sách yêu cầu gần đây. Hãy mở hộp thư yêu cầu để kiểm tra thêm.</p>
            </div>
          ) : recentLeads && recentLeads.length > 0 ? (
            <div className="admin-queue-leads-list">
              {recentLeads.map((lead) => (
                <div className="admin-queue-lead-row" key={lead.id}>
                  <div className="admin-queue-lead-info">
                    <span className="admin-queue-lead-name">
                      {lead.fullName || "Khách hàng doanh nghiệp"}
                    </span>
                    <span className="admin-queue-lead-meta">
                      <AdminStatusBadge
                        value={queueLeadStatusLabels[lead.status] ?? lead.status}
                        kind={queueLeadStatusKind(lead.status)}
                      />
                      <span className="admin-queue-dot" aria-hidden="true">·</span>
                      <span className="admin-queue-date">
                        <Clock size={12} style={{ display: "inline", verticalAlign: "-1px", marginRight: 3 }} />
                        {formatAdminDate(lead.createdAt)}
                      </span>
                    </span>
                  </div>
                  <div className="admin-queue-lead-action">
                    <Link
                      href={`/admin/yeu-cau?id=${lead.id}`}
                      className="admin-button admin-button-quiet admin-button-compact"
                      prefetch={false}
                    >
                      Xử lý
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="admin-queue-empty">
              <ClipboardList size={22} className="admin-queue-empty-icon" />
              <p>Chưa có yêu cầu báo giá nào trong hàng đợi.</p>
            </div>
          )}

          <div className="admin-queue-footer">
            <Link
              href="/admin/yeu-cau"
              className="admin-button admin-button-quiet admin-button-compact"
              prefetch={false}
            >
              {leadsReady ? `Mở hộp thư yêu cầu (${counts.leads})` : "Mở hộp thư yêu cầu"}
            </Link>
            {leadsReady && newLeadsReady && counts.newLeads > 0 ? (
              <Link
                href="/admin/yeu-cau?status=new"
                className="admin-button admin-button-primary admin-button-compact"
                prefetch={false}
              >
                Xử lý {counts.newLeads} yêu cầu mới
                <ArrowRight size={13} />
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Task 2: Draft Products Pipeline */}
      {canViewProducts ? (
        <section className="admin-panel admin-queue-section" aria-labelledby="queue-drafts-heading">
          <div className="admin-panel-heading">
            <div>
              <div className="admin-queue-title-wrap">
                <h2 className="admin-panel-title" id="queue-drafts-heading">
                  Sản phẩm chờ duyệt &amp; xuất bản
                </h2>
                {!productDraftsReady ? (
                  <span className="admin-badge admin-badge-neutral">Chưa xác định</span>
                ) : counts.draftProducts > 0 ? (
                  <span className="admin-badge admin-badge-amber">
                    {counts.draftProducts} bản nháp
                  </span>
                ) : (
                  <span className="admin-badge admin-badge-green">
                    Không có bản nháp
                  </span>
                )}
              </div>
              <p className="admin-panel-caption">
                Tiến độ chuẩn hóa danh mục, thông số kỹ thuật và hình ảnh hàng hóa
              </p>
            </div>
            <Package aria-hidden="true" color="#6e8c42" size={19} />
          </div>

          <div className={`admin-queue-pipeline-card ${!productDraftsReady ? "is-unavailable" : counts.draftProducts > 0 ? "has-pending" : "is-clear"}`}>
            {!productDraftsReady ? (
              <>
                <p className="admin-queue-pipeline-desc">
                  Chưa xác định trạng thái bản nháp vì dữ liệu sản phẩm chưa sẵn sàng. Không thể kết luận danh mục đã được rà soát.
                </p>
                <div className="admin-queue-pipeline-actions">
                  <Link href="/admin/san-pham" className="admin-button admin-button-quiet admin-button-compact" prefetch={false}>
                    Kiểm tra danh mục sản phẩm
                  </Link>
                </div>
              </>
            ) : counts.draftProducts > 0 ? (
              <>
                <p className="admin-queue-pipeline-desc">
                  Ghi nhận <strong>{counts.draftProducts}</strong> sản phẩm đang soạn thảo hoặc chờ kiểm duyệt. Cần bổ sung đầy đủ thông số kỹ thuật, bảng giá MOQ và ảnh minh họa trước khi phát hành.
                </p>
                <div className="admin-queue-pipeline-stats">
                  {dataReadiness.activeProducts ? (
                    <span>Hoạt động: <strong>{counts.activeProducts}</strong> / {counts.products} sản phẩm</span>
                  ) : (
                    <span>Chưa tải được số lượng sản phẩm đang hoạt động.</span>
                  )}
                </div>
                <div className="admin-queue-pipeline-actions">
                  <Link
                    href="/admin/san-pham?status=draft"
                    className="admin-button admin-button-primary admin-button-compact"
                    prefetch={false}
                  >
                    Duyệt bản nháp ngay ({counts.draftProducts})
                    <ArrowRight size={13} />
                  </Link>
                  <Link
                    href="/admin/san-pham"
                    className="admin-button admin-button-quiet admin-button-compact"
                    prefetch={false}
                  >
                    Xem tất cả sản phẩm
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p className="admin-queue-pipeline-desc">
                  Không có sản phẩm ở trạng thái nháp hoặc chờ duyệt. Danh mục có <strong>{counts.products}</strong> hồ sơ{dataReadiness.activeProducts ? <>, trong đó <strong>{counts.activeProducts}</strong> sản phẩm đang hiển thị công khai.</> : "; chưa tải được số lượng sản phẩm đang hoạt động."}
                </p>
                <div className="admin-queue-pipeline-actions">
                  <Link
                    href="/admin/san-pham"
                    className="admin-button admin-button-quiet admin-button-compact"
                    prefetch={false}
                  >
                    Quản lý danh mục sản phẩm
                  </Link>
                </div>
              </>
            )}
          </div>
        </section>
      ) : null}

      {/* Task 3: Editorial & News Status */}
      {canViewNews ? (
        <section className="admin-panel admin-queue-section" aria-labelledby="queue-news-heading">
          <div className="admin-panel-heading">
            <div>
              <div className="admin-queue-title-wrap">
                <h2 className="admin-panel-title" id="queue-news-heading">
                  Nhịp độ biên tập &amp; Tin tức thị trường
                </h2>
                <span className={`admin-badge ${newsReady ? "admin-badge-blue" : "admin-badge-neutral"}`}>
                  {newsReady ? `${counts.news} bài viết` : "Chưa tải được"}
                </span>
              </div>
              <p className="admin-panel-caption">
                Duy trì tần suất nội dung công nghệ gia công, tối ưu SEO và nâng cao nhận diện
              </p>
            </div>
            <Newspaper aria-hidden="true" color="#6e8c42" size={19} />
          </div>

          <div className="admin-queue-pipeline-card">
            <p className="admin-queue-pipeline-desc">
              {newsReady ? <>Hệ thống đang lưu trữ <strong>{counts.news}</strong> bài viết chuyên đề. Thường xuyên cập nhật tin tức về máy móc công nghiệp, vật liệu mới và phân tích thị trường giúp gia tăng lượng truy cập tự nhiên.</> : "Chưa tải được số liệu bài viết. Hãy kiểm tra trạng thái kết nối dữ liệu trước khi đánh giá kho nội dung."}
            </p>
            <div className="admin-queue-pipeline-actions">
              <Link
                href="/admin/tin-tuc"
                className="admin-button admin-button-quiet admin-button-compact"
                prefetch={false}
              >
                {newsReady ? `Mở chuyên mục tin tức (${counts.news})` : "Mở chuyên mục tin tức"}
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
