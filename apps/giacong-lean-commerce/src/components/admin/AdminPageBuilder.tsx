"use client";

import { ArrowDown, ArrowUp, Eye, ExternalLink, Image as ImageIcon, Plus, Save, Send, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRegisterAdminUnsaved } from "@/components/admin/AdminUnsavedGuard";

import { AdminConfirmDialog } from "@/components/admin/AdminDialog";
import { AdminMediaPickerModal } from "@/components/admin/AdminMediaPickerModal";
import { AdminEmptyState, AdminErrorState, AdminPageHeading, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { AdminField } from "@/components/admin/AdminField";
import { useAdminToast } from "@/components/admin/AdminToast";
import { useAdminSession } from "@/components/admin/AdminShell";
import { AdminClientError, fetchAdmin, mutateAdmin } from "@/lib/admin-client";
import { buildServiceArticlePageSeed } from "@/lib/admin-service-articles";
import type { ServiceArticleContext } from "@/lib/admin-service-articles";
import type { PageBlock, PageCta } from "@/lib/page-builder";

interface AdminPageRecord {
  pageKey: string;
  routePath: string;
  title: string;
  draftEnabled: boolean;
  publishedEnabled: boolean;
  draftBlocks: PageBlock[];
  publishedBlocks: PageBlock[];
  draftSeoTitle: string;
  publishedSeoTitle: string;
  draftSeoDescription: string;
  publishedSeoDescription: string;
  version: number;
  dirty: boolean;
}

interface PagesResponse {
  canEdit: boolean;
  canPublish: boolean;
  pages: AdminPageRecord[];
}

interface PendingPageRequest {
  key: string;
  requestId: string;
}

type BuilderBlockType = PageBlock["type"];
type AdminPageBuilderMode = "pages" | "service-article";

const blockLabels: Record<BuilderBlockType, string> = {
  hero: "Ảnh bìa đầu trang",
  rich_text: "Văn bản",
  image: "Ảnh",
  feature_grid: "Lưới điểm nổi bật",
  cta: "Kêu gọi hành động",
  contact: "Liên hệ",
};

interface AdminPageBuilderProps {
  articleContext?: ServiceArticleContext | null;
  embedded?: boolean;
  mode?: AdminPageBuilderMode;
  onClose?: () => void;
}

export function AdminPageBuilder({ articleContext = null, embedded = false, mode = "pages", onClose }: AdminPageBuilderProps = {}) {
  const session = useAdminSession();
  const searchParams = useSearchParams();
  const requestedPage = searchParams.get("page")?.trim().toLowerCase() ?? "";
  const articleRoute = articleContext?.articleRoute ?? searchParams.get("articleRoute") ?? "";
  const articleTitle = articleContext?.articleTitle ?? searchParams.get("articleTitle") ?? "";
  const serviceSlug = articleContext?.serviceSlug ?? searchParams.get("serviceSlug") ?? "";
  const serviceName = articleContext?.serviceName ?? searchParams.get("serviceName")?.trim() ?? "dịch vụ";
  const serviceArticleSeed = useMemo(() => mode === "service-article"
    ? buildServiceArticlePageSeed({ articleRoute, articleTitle, serviceSlug })
    : null, [articleRoute, articleTitle, mode, serviceSlug]);
  const [data, setData] = useState<PagesResponse | null>(null);
  const [selectedKey, setSelectedKey] = useState("");
  const [blocks, setBlocks] = useState<PageBlock[]>([]);
  const [draftEnabled, setDraftEnabled] = useState(false);
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<AdminClientError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(mode === "service-article" && Boolean(serviceArticleSeed));
  const [pendingRemove, setPendingRemove] = useState<{ index: number; type: BuilderBlockType } | null>(null);
  const [pendingPage, setPendingPage] = useState<AdminPageRecord | null>(null);
  const [createForm, setCreateForm] = useState(() => serviceArticleSeed ?? { pageKey: "", routePath: "/", title: "" });
  const saveRequest = useRef<PendingPageRequest | null>(null);
  const publishRequest = useRef<PendingPageRequest | null>(null);
  const createRequest = useRef<PendingPageRequest | null>(null);
  const saveInFlight = useRef(false);
  const publishInFlight = useRef(false);
  const createInFlight = useRef(false);
  const { showToast } = useAdminToast();

  const selectedPage = mode === "service-article"
    ? data?.pages.find((page) => serviceArticleSeed && normalizePageRoute(page.routePath) === serviceArticleSeed.routePath) ?? null
    : data?.pages.find((page) => page.pageKey === selectedKey) ?? null;
  const canEdit = data?.canEdit ?? false;
  const canPublish = data?.canPublish ?? false;
  const selectedStatus = mode === "service-article"
    ? selectedPage?.publishedEnabled
      ? selectedPage.dirty
        ? { kind: "amber" as const, value: "Đã đăng · có bản nháp" }
        : { kind: "green" as const, value: "Đã đăng" }
      : selectedPage?.dirty || draftEnabled
        ? { kind: "amber" as const, value: "Bản nháp chưa đăng" }
        : { kind: "neutral" as const, value: "Chưa đăng" }
    : { kind: draftEnabled ? "green" as const : "neutral" as const, value: draftEnabled ? "Đang bật" : "Đang tắt" };
  const createFormDirty = mode === "service-article"
    ? Boolean(serviceArticleSeed && (createForm.title !== serviceArticleSeed.title || createForm.routePath !== serviceArticleSeed.routePath))
    : Boolean(createForm.pageKey || createForm.title || createForm.routePath !== "/");
  const isDirty = useCallback(() => Boolean(
    (selectedPage && (JSON.stringify(blocks) !== JSON.stringify(selectedPage.draftBlocks) || draftEnabled !== selectedPage.draftEnabled || seoTitle !== selectedPage.draftSeoTitle || seoDescription !== selectedPage.draftSeoDescription))
    || (showCreate && createFormDirty)
  ), [blocks, createFormDirty, draftEnabled, selectedPage, seoDescription, seoTitle, showCreate]);
  useRegisterAdminUnsaved(isDirty, saving || publishing || creating);

  async function loadPages() {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchAdmin<PagesResponse>("/api/admin/pages");
      setData(next);
      const articlePage = mode === "service-article" && serviceArticleSeed
        ? next.pages.find((page) => normalizePageRoute(page.routePath) === serviceArticleSeed.routePath)
        : null;
      const nextKey = mode === "service-article"
        ? articlePage?.pageKey ?? ""
        : next.pages.some((page) => page.pageKey === requestedPage)
          ? requestedPage
          : next.pages.some((page) => page.pageKey === selectedKey)
            ? selectedKey
            : next.pages[0]?.pageKey ?? "";
      const nextPage = next.pages.find((page) => page.pageKey === nextKey);
      setSelectedKey(nextKey);
      if (nextPage) {
        setShowCreate(false);
        hydratePage(nextPage);
      } else if (mode === "service-article" && serviceArticleSeed) {
        setCreateForm(serviceArticleSeed);
        setShowCreate(true);
        setBlocks([]);
        setDraftEnabled(false);
        setSeoTitle(serviceArticleSeed.title);
        setSeoDescription("");
      }
    } catch (reason: unknown) {
      setError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể tải page builder.", 0));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPages();
    // Reload when the selected service article changes; saves update local state below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.subject, mode, serviceArticleSeed?.routePath]);

  function hydratePage(page: AdminPageRecord) {
    setBlocks(page.draftBlocks);
    setDraftEnabled(page.draftEnabled);
    setSeoTitle(page.draftSeoTitle);
    setSeoDescription(page.draftSeoDescription);
    setNotice(null);
  }

  function selectPage(page: AdminPageRecord) {
    setSelectedKey(page.pageKey);
    hydratePage(page);
  }

  function requestSelectPage(page: AdminPageRecord) {
    if (page.pageKey === selectedKey) return;
    if (blocksChanged()) {
      setPendingPage(page);
      return;
    }
    selectPage(page);
  }

  function confirmSelectPage() {
    if (!pendingPage) return;
    selectPage(pendingPage);
    setPendingPage(null);
  }

  function updateBlock(index: number, block: PageBlock) {
    setBlocks((current) => current.map((item, itemIndex) => itemIndex === index ? block : item));
  }

  function moveBlock(index: number, direction: -1 | 1) {
    setBlocks((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function requestRemoveBlock(index: number) {
    const block = blocks[index];
    if (!canEdit || !block) return;
    setPendingRemove({ index, type: block.type });
  }

  function confirmRemoveBlock() {
    if (!pendingRemove) return;
    setBlocks((current) => current.filter((_, itemIndex) => itemIndex !== pendingRemove.index));
    setPendingRemove(null);
  }

  async function saveDraft() {
    if (!selectedPage || !canEdit || saveInFlight.current) return;
    const payload = { blocks, draftEnabled, expectedVersion: selectedPage.version, pageKey: selectedPage.pageKey, seoDescription, seoTitle };
    const requestId = getPageRequestId(saveRequest, JSON.stringify(payload));
    saveInFlight.current = true;
    setSaving(true);
    setNotice(null);
    try {
      const result = await mutateAdmin<{ page: AdminPageRecord }>(`/api/admin/pages/${encodeURIComponent(selectedPage.pageKey)}`, {
        body: { ...payload, requestId },
        method: "PATCH",
      });
      updatePage(result.page);
      saveRequest.current = null;
      setNotice(mode === "service-article" ? "Đã lưu bản nháp bài dịch vụ." : "Đã lưu bản nháp trang.");
      showToast("success", mode === "service-article" ? "Bản nháp bài dịch vụ đã được lưu." : "Bản nháp trang đã được lưu.");
    } catch (reason: unknown) {
      if (!shouldRetryPageRequest(reason)) saveRequest.current = null;
      const clientError = reason instanceof AdminClientError ? reason : new AdminClientError("Không thể lưu page.", 0);
      setError(clientError);
      showToast("error", clientError.message);
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  }

  async function publishPage() {
    if (!selectedPage || !canPublish || !selectedPage.dirty || blocksChanged() || publishInFlight.current) return;
    const payload = { expectedVersion: selectedPage.version, pageKey: selectedPage.pageKey };
    const requestId = getPageRequestId(publishRequest, JSON.stringify(payload));
    publishInFlight.current = true;
    setPublishing(true);
    setNotice(null);
    try {
      const result = await mutateAdmin<{ page: AdminPageRecord }>(`/api/admin/pages/${encodeURIComponent(selectedPage.pageKey)}/publish`, {
        body: { ...payload, requestId },
        method: "POST",
      });
      updatePage(result.page);
      publishRequest.current = null;
      setNotice(mode === "service-article" ? "Bài dịch vụ đã được đăng lên website." : "Trang đã được đăng lên website.");
      showToast("success", mode === "service-article" ? "Bài dịch vụ đã được đăng." : "Trang đã được đăng.");
    } catch (reason: unknown) {
      if (!shouldRetryPageRequest(reason)) publishRequest.current = null;
      const clientError = reason instanceof AdminClientError ? reason : new AdminClientError("Không thể phát hành page.", 0);
      setError(clientError);
      showToast("error", clientError.message);
    } finally {
      publishInFlight.current = false;
      setPublishing(false);
    }
  }

  function blocksChanged() {
    return JSON.stringify(blocks) !== JSON.stringify(selectedPage?.draftBlocks ?? [])
      || draftEnabled !== selectedPage?.draftEnabled
      || seoTitle !== selectedPage?.draftSeoTitle
      || seoDescription !== selectedPage?.draftSeoDescription;
  }

  function updatePage(page: AdminPageRecord) {
    setData((current) => current ? { ...current, pages: current.pages.map((item) => item.pageKey === page.pageKey ? page : item) } : current);
    hydratePage(page);
  }

  async function createPage() {
    if (!canEdit || createInFlight.current) return;
    const requestId = getPageRequestId(createRequest, JSON.stringify(createForm));
    createInFlight.current = true;
    setCreating(true);
    setError(null);
    try {
      const result = await mutateAdmin<{ page: AdminPageRecord }>("/api/admin/pages", { body: { requestId, ...createForm }, method: "POST" });
      setData((current) => current ? { ...current, pages: [...current.pages, result.page] } : current);
      createRequest.current = null;
      setShowCreate(false);
      setCreateForm({ pageKey: "", routePath: "/", title: "" });
      selectPage(result.page);
      if (mode === "service-article") {
        setDraftEnabled(true);
        setSeoTitle(result.page.title);
        setSeoDescription("");
      }
      showToast("success", mode === "service-article"
        ? "Đã mở bản nháp bài dịch vụ. Thêm nội dung, lưu rồi đăng khi sẵn sàng."
        : "Đã tạo trang mới. Hãy thêm khối rồi lưu bản nháp.");
    } catch (reason: unknown) {
      if (!shouldRetryPageRequest(reason)) createRequest.current = null;
      const clientError = reason instanceof AdminClientError ? reason : new AdminClientError("Không thể tạo page.", 0);
      setError(clientError);
      showToast("error", clientError.message);
    } finally {
      createInFlight.current = false;
      setCreating(false);
    }
  }

  return (
    <div className={`admin-content${embedded ? " admin-service-article-embedded" : ""}`}>
      {embedded ? (
        <div className="admin-service-article-inline-heading">
          <div><span className="admin-kicker">BÀI VIẾT DỊCH VỤ</span><h3>{selectedPage?.title ?? serviceArticleSeed?.title ?? "Dịch vụ"}</h3></div>
          <div className="admin-service-article-inline-actions">
            {serviceArticleSeed ? <code className="admin-item-meta">{serviceArticleSeed.routePath}</code> : null}
            {onClose ? <button className="admin-button admin-button-quiet" onClick={onClose} type="button"><X aria-hidden="true" size={14} /> Đóng trình soạn</button> : null}
          </div>
        </div>
      ) : <AdminPageHeading
        kicker={mode === "service-article" ? `Dịch vụ · ${serviceName}` : "Quản lý trang / bố cục"}
        title={mode === "service-article" ? `Bài viết: ${serviceArticleSeed?.title ?? "Dịch vụ"}` : "Thiết kế trang"}
        subtitle={mode === "service-article"
          ? "Soạn nội dung, ảnh và cách trình bày ngay trong mục Dịch vụ. Bài cũ chỉ được thay khi bạn lưu và đăng bài mới."
          : "Sắp xếp khối nội dung, chỉnh nội dung và đăng theo phiên bản. Công cụ dựng trang chỉ nhận mẫu an toàn, không chạy mã web tùy ý."}
        stamp={mode === "service-article" ? "SOẠN BÀI DỊCH VỤ" : "CÔNG CỤ DỰNG TRANG"}
      />}
      {mode === "service-article" && !embedded ? (
        <div className="admin-toolbar">
          <Link className="admin-button admin-button-quiet" href="/admin/dich-vu">Quay lại dịch vụ</Link>
          {serviceArticleSeed ? <code className="admin-item-meta">{serviceArticleSeed.routePath}</code> : null}
        </div>
      ) : mode === "pages" ? (
        <div className="admin-builder-toolbar">
          <div className="admin-builder-page-tabs" role="tablist" aria-label="Các trang có thể sửa">
            {data?.pages.map((page) => (
              <button
                aria-selected={page.pageKey === selectedKey}
                className={`admin-builder-page-tab${page.pageKey === selectedKey ? " is-selected" : ""}`}
                key={page.pageKey}
                onClick={() => requestSelectPage(page)}
                role="tab"
                type="button"
              >
                <span>{page.title}</span>
                <small>{page.routePath}</small>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {mode === "pages" && canEdit ? (
        <details className="admin-builder-advanced" onToggle={(event) => setShowCreate(event.currentTarget.open)} open={showCreate}>
          <summary className="admin-builder-advanced-summary"><span><Plus aria-hidden="true" size={14} /> Tùy chọn nâng cao</span><small>Tạo trang mới</small></summary>
          <section className="admin-panel admin-builder-create" aria-labelledby="builder-create-heading">
            <div className="admin-panel-heading"><div><h2 className="admin-panel-title" id="builder-create-heading">Tạo trang mới</h2><p className="admin-panel-caption">Chỉ dùng đường dẫn nội bộ; trang mới bắt đầu ở trạng thái tắt.</p></div></div>
            <div className="admin-editor-grid">
              <AdminField id="builder-create-key" label="Mã trang" hint="Viết liền không dấu. Ví dụ: gioi-thieu-moi">
                <input className="admin-input" disabled={!canEdit} id="builder-create-key" onChange={(event) => setCreateForm((current) => ({ ...current, pageKey: event.target.value }))} value={createForm.pageKey} />
              </AdminField>
              <AdminField id="builder-create-title" label="Tên trang">
                <input className="admin-input" disabled={!canEdit} id="builder-create-title" onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))} value={createForm.title} />
              </AdminField>
              <AdminField id="builder-create-route" label="Đường dẫn">
                <input className="admin-input" disabled={!canEdit} id="builder-create-route" onChange={(event) => setCreateForm((current) => ({ ...current, routePath: event.target.value }))} value={createForm.routePath} />
              </AdminField>
            </div>
            <div className="admin-editor-actions"><button className="admin-button admin-button-primary" disabled={!createForm.pageKey || !createForm.title || !canEdit || creating} onClick={() => void createPage()} type="button"><Plus size={14} /> {creating ? "Đang tạo" : "Tạo trang"}</button></div>
          </section>
        </details>
      ) : null}
      {mode === "service-article" && canEdit && serviceArticleSeed && !selectedPage ? (
        <section className="admin-panel admin-builder-create" aria-labelledby="service-article-start-heading" data-testid="service-article-create-start">
          <div className="admin-panel-heading">
            <div>
              <h2 className="admin-panel-title" id="service-article-start-heading">Viết bài dịch vụ</h2>
              <p className="admin-panel-caption">Trang cũ đang tiếp tục hiển thị. Bạn tạo bản nháp ở đây; khách chỉ thấy bài mới sau khi đăng.</p>
            </div>
          </div>
          <div className="admin-editor-grid">
            <AdminField id="service-article-title" label="Tên bài viết">
              <input className="admin-input" disabled={creating} id="service-article-title" onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))} value={createForm.title} />
            </AdminField>
            <AdminField id="service-article-route" label="Đường dẫn của dịch vụ">
              <input className="admin-input admin-mono" id="service-article-route" readOnly value={serviceArticleSeed.routePath} />
            </AdminField>
          </div>
          <div className="admin-editor-actions">
            <button className="admin-button admin-button-primary" disabled={!createForm.title.trim() || !canEdit || creating} onClick={() => void createPage()} type="button">
              <Plus size={14} /> {creating ? "Đang tạo bản nháp" : "Bắt đầu viết bài"}
            </button>
          </div>
        </section>
      ) : null}
      {notice ? <div className="admin-content-notice" role="status">{notice}</div> : null}
      {error ? <AdminErrorState error={error} onRetry={() => { setError(null); void loadPages(); }} /> : null}
      {loading ? <div className="admin-skeleton admin-content-skeleton" aria-label="Đang tải page builder" /> : selectedPage ? (
        <div className={`admin-builder-layout${embedded ? " admin-service-article-inline-layout" : ""}`}>
          <section className="admin-builder-editor" aria-labelledby="builder-editor-title">
            <div className="admin-editor-heading">
              <div><div className="admin-kicker">{selectedPage.routePath}</div><h2 className="admin-panel-title" id="builder-editor-title">{selectedPage.title}</h2><p className="admin-panel-caption">v{selectedPage.version} · {selectedPage.dirty ? "Có thay đổi chưa phát hành" : "Đồng bộ với bản public"}</p></div>
              <AdminStatusBadge kind={selectedStatus.kind} value={selectedStatus.value} />
            </div>
            <div className="admin-builder-meta">
              <AdminField id="builder-seo-title" label="Tiêu đề tìm kiếm Google" optional>
                <input className="admin-input" disabled={!canEdit} id="builder-seo-title" onChange={(event) => setSeoTitle(event.target.value)} value={seoTitle} />
              </AdminField>
              <AdminField id="builder-seo-description" label="Mô tả tìm kiếm Google" optional>
                <textarea className="admin-textarea" disabled={!canEdit} id="builder-seo-description" onChange={(event) => setSeoDescription(event.target.value)} rows={3} value={seoDescription} />
              </AdminField>
            </div>
            <div className="admin-builder-section-heading"><div><h3>{mode === "service-article" ? "Nội dung bài viết" : "Các khối nội dung"}</h3><p>{mode === "service-article" ? "Thêm tiêu đề, đoạn văn, ảnh có chú thích hoặc phần liên hệ; sắp xếp thứ tự bằng nút lên/xuống." : "Kéo thứ tự bằng nút lên/xuống; khối mới để trống để tránh đăng nhầm nội dung mẫu."}</p></div><BlockTypeMenu disabled={!canEdit} onAdd={(type) => setBlocks((current) => [...current, createDefaultBlock(type)])} /></div>
            <div className="admin-builder-blocks">
              {blocks.length === 0 ? <div className="admin-table-empty"><Eye size={24} /><strong>Trang chưa có khối</strong><p>Chọn loại khối ở nút “Thêm khối” để bắt đầu.</p></div> : blocks.map((block, index) => (
                <AdminPageBlockEditor
                  block={block}
                  disabled={!canEdit}
                  index={index}
                  key={`${block.type}-${index}`}
                  onChange={(next) => updateBlock(index, next)}
                  onMove={(direction) => moveBlock(index, direction)}
                  onRemove={() => requestRemoveBlock(index)}
                />
              ))}
            </div>
            <div className="admin-editor-footer">
              <label className={`admin-check${canEdit ? "" : " is-disabled"}`}>
                <input checked={draftEnabled} disabled={!canEdit} onChange={(event) => setDraftEnabled(event.target.checked)} type="checkbox" />
                <span>
                  <strong>{mode === "service-article" ? "Đăng bài này tại đường dẫn dịch vụ" : "Cho phép trang này thay bản cũ đã lưu sẵn"}</strong>
                  <small>{mode === "service-article" ? "Bài cũ chỉ được thay sau khi bạn lưu bản nháp và đăng." : "Chỉ có hiệu lực sau khi trang có khối nội dung và được đăng."}</small>
                </span>
              </label>
              <div className="admin-editor-actions">
                <button className="admin-button admin-button-quiet" disabled={!canEdit || saving || !blocksChanged()} onClick={() => void saveDraft()} type="button"><Save size={14} /> {saving ? "Đang lưu" : "Lưu bản nháp"}</button>
                <button className="admin-button admin-button-primary" disabled={!canPublish || publishing || blocksChanged() || !selectedPage.dirty || (mode === "service-article" && blocks.length === 0)} onClick={() => void publishPage()} type="button"><Send size={14} /> {publishing ? "Đang đăng" : mode === "service-article" ? "Đăng bài lên website" : "Đăng lên web"}</button>
              </div>
            </div>
          </section>
          {pendingRemove ? (
            <AdminConfirmDialog
              confirmLabel="Xóa khối"
              message={`Xóa khối “${blockLabels[pendingRemove.type]}” khỏi bản nháp? Bạn có thể hủy trước khi lưu bản nháp.`}
              onConfirm={confirmRemoveBlock}
              onDismiss={() => setPendingRemove(null)}
              title="Xóa khối khỏi bản nháp?"
            />
          ) : null}
          {pendingPage ? (
            <AdminConfirmDialog
              confirmLabel="Vẫn chuyển"
              message="Còn thay đổi chưa lưu. Chuyển trang sẽ mất. Vẫn chuyển?"
              onConfirm={confirmSelectPage}
              onDismiss={() => setPendingPage(null)}
              title="Chuyển trang sẽ mất bản nháp?"
            />
          ) : null}
          {embedded ? null : <LivePageHandoff routePath={selectedPage.routePath} serviceArticle={mode === "service-article"} />}
        </div>
      ) : mode === "service-article" && !serviceArticleSeed ? (
        <AdminEmptyState title="Không nhận diện được bài dịch vụ" description="Hãy quay lại danh sách bài dịch vụ và chọn một hạng mục có đường dẫn hợp lệ." />
      ) : mode === "service-article" ? null : <div className="admin-state"><div><h2>Chưa có trang</h2><p>Chưa tải được dữ liệu trang. Hãy tải lại, nếu vẫn trống thì báo người quản trị hệ thống.</p></div></div>}
    </div>
  );
}

function LivePageHandoff({ routePath, serviceArticle }: { routePath: string; serviceArticle: boolean }) {
  return (
    <aside className="admin-live-storefront-card" aria-label={`Mở trang thật ${routePath}`}>
      <div className="admin-live-storefront-card-heading">
        <div><div className="admin-kicker">TRANG WEB THẬT</div><h2>{serviceArticle ? "Xem bài đang chạy" : "Xem trang đang chạy"}</h2></div>
        <ExternalLink aria-hidden="true" size={17} />
      </div>
      <div className="admin-live-storefront-card-body">
        <p>{serviceArticle ? "Bài viết dùng các khối nội dung có sẵn; không cần tạo mã trang hay viết mã web." : "Công cụ dựng trang chỉ quản lý khối nội dung, tìm kiếm Google và trạng thái đăng. Mình không dựng lại page trong một khung mô phỏng."}</p>
        <p>{serviceArticle ? "Sau khi lưu và đăng, mở đường dẫn bên dưới để xem bài trên website." : "Hãy lưu và phát hành bản nháp, sau đó mở đúng đường dẫn bên dưới để kiểm tra kết quả trên trang thật."}</p>
        <code className="admin-live-storefront-route">{routePath}</code>
      </div>
      <Link className="admin-button admin-button-primary admin-live-storefront-card-action" data-testid="link-open-live-page" href={routePath} rel="noreferrer" target="_blank">
        Mở trang thật
        <ExternalLink aria-hidden="true" size={14} />
      </Link>
      <p className="admin-live-storefront-card-note">Trang web chỉ đọc bản đã đăng; thay đổi chưa đăng sẽ không xuất hiện ở tab mới.</p>
    </aside>
  );
}

function getPageRequestId(
  ref: { current: PendingPageRequest | null },
  key: string,
): string {
  if (!ref.current || ref.current.key !== key) ref.current = { key, requestId: crypto.randomUUID() };
  return ref.current.requestId;
}

function shouldRetryPageRequest(reason: unknown): boolean {
  return reason instanceof AdminClientError && (reason.status === 0 || reason.status >= 500);
}

function normalizePageRoute(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "/") return trimmed;
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}/`;
}

function BlockTypeMenu({ disabled, onAdd }: { disabled: boolean; onAdd: (type: BuilderBlockType) => void }) {
  return (
    <label className="admin-builder-add-select">
      <Plus size={14} />
      <span>Thêm khối</span>
      <select aria-label="Chọn loại khối" disabled={disabled} onChange={(event) => { if (event.target.value) onAdd(event.target.value as BuilderBlockType); event.currentTarget.value = ""; }} value="">
        <option value="">Chọn loại</option>
        {Object.entries(blockLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
  );
}

function AdminPageBlockEditor({ block, disabled, index, onChange, onMove, onRemove }: { block: PageBlock; disabled: boolean; index: number; onChange: (block: PageBlock) => void; onMove: (direction: -1 | 1) => void; onRemove: () => void }) {
  return (
    <article className="admin-builder-block">
      <header className="admin-builder-block-header"><div><span className="admin-builder-block-index">{String(index + 1).padStart(2, "0")}</span><strong>{blockLabels[block.type]}</strong></div><div className="admin-table-actions"><button aria-label="Đưa khối lên" className="admin-button admin-button-quiet" disabled={disabled || index === 0} onClick={() => onMove(-1)} type="button"><ArrowUp size={13} /></button><button aria-label="Đưa khối xuống" className="admin-button admin-button-quiet" disabled={disabled} onClick={() => onMove(1)} type="button"><ArrowDown size={13} /></button><button aria-label="Xóa khối khỏi bản nháp" className="admin-button admin-button-danger" disabled={disabled} onClick={onRemove} type="button"><Trash2 size={13} /></button></div></header>
      <BlockFields block={block} disabled={disabled} index={index} onChange={onChange} />
    </article>
  );
}

function BlockFields({ block, disabled, index, onChange }: { block: PageBlock; disabled: boolean; index: number; onChange: (block: PageBlock) => void }) {
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const fieldId = (id: string) => `block-${index}-${id}`;
  const text = (id: string, label: string, value: string, key: string, optional = false) => { const uniqueId = fieldId(id); return <AdminField id={uniqueId} label={label} optional={optional}><input className="admin-input" disabled={disabled} id={uniqueId} onChange={(event) => onChange({ ...block, [key]: event.target.value } as PageBlock)} value={value} /></AdminField>; };
  const area = (id: string, label: string, value: string, key: string, optional = false) => { const uniqueId = fieldId(id); return <AdminField id={uniqueId} label={label} optional={optional}><textarea className="admin-textarea" disabled={disabled} id={uniqueId} onChange={(event) => onChange({ ...block, [key]: event.target.value } as PageBlock)} rows={4} value={value} /></AdminField>; };
  const imageField = (id: string, label: string, value: string, optional = false) => {
    const uniqueId = fieldId(id);
    return (
      <>
        <AdminField hint="Chọn ảnh đã tải lên thư viện media để dùng trên trang." id={uniqueId} label={label} optional={optional}>
          <div className="admin-builder-media-field">
            <input className="admin-input" disabled={disabled} id={uniqueId} onChange={(event) => onChange({ ...block, imageUrl: event.target.value } as PageBlock)} value={value} />
            <button aria-label={`Chọn ${label.toLowerCase()} từ thư viện ảnh`} className="admin-button admin-button-quiet" disabled={disabled} onClick={() => setShowMediaPicker(true)} type="button">
              <ImageIcon aria-hidden="true" size={14} /> Chọn ảnh
            </button>
          </div>
        </AdminField>
        {showMediaPicker ? (
          <AdminMediaPickerModal
            onClose={() => setShowMediaPicker(false)}
            onSelect={(publicUrl) => {
              onChange({ ...block, imageUrl: publicUrl } as PageBlock);
              setShowMediaPicker(false);
            }}
          />
        ) : null}
      </>
    );
  };
  switch (block.type) {
    case "hero":
      return <div className="admin-editor-grid">{text("hero-eyebrow", "Dòng chữ nhỏ trên tiêu đề", block.eyebrow, "eyebrow", true)}{text("hero-title", "Tiêu đề", block.title, "title")}{area("hero-description", "Mô tả", block.description, "description")} {imageField("hero-image", "Ảnh bìa", block.imageUrl ?? "", true)}<CtaFields block={block} disabled={disabled} fieldId={fieldId} kind="primary" onChange={onChange} /><CtaFields block={block} disabled={disabled} fieldId={fieldId} kind="secondary" onChange={onChange} /></div>;
    case "rich_text":
      return <div className="admin-editor-grid">{text("rich-title", "Tiêu đề", block.title, "title", true)}{area("rich-body", "Nội dung", block.body, "body")}</div>;
    case "image":
      return <div className="admin-editor-grid">{imageField("image-url", "Ảnh", block.imageUrl)}{text("image-alt", "Mô tả ảnh", block.alt, "alt")}{text("image-caption", "Chú thích", block.caption, "caption", true)}</div>;
    case "feature_grid":
      return <div className="admin-builder-feature-fields">{text("feature-title", "Tiêu đề", block.title, "title", true)}<div className="admin-builder-feature-list">{block.items.map((item, index) => <div className="admin-builder-feature-item" key={`${index}-${item.title}`}><strong>Mục {index + 1}</strong><input aria-label={`Tiêu đề mục ${index + 1}`} className="admin-input" disabled={disabled} onChange={(event) => onChange({ ...block, items: block.items.map((current, itemIndex) => itemIndex === index ? { ...current, title: event.target.value } : current) })} value={item.title} /><textarea aria-label={`Mô tả mục ${index + 1}`} className="admin-textarea" disabled={disabled} onChange={(event) => onChange({ ...block, items: block.items.map((current, itemIndex) => itemIndex === index ? { ...current, description: event.target.value } : current) })} rows={2} value={item.description} /></div>)}</div><button className="admin-button admin-button-quiet" disabled={disabled || block.items.length >= 12} onClick={() => onChange({ ...block, items: [...block.items, { title: "", description: "" }] })} type="button"><Plus size={13} /> Thêm mục</button></div>;
    case "cta":
      return <div className="admin-editor-grid">{text("cta-title", "Tiêu đề", block.title, "title")}{area("cta-body", "Mô tả", block.body, "body", true)}{text("cta-label", "Nhãn nút", block.label, "label")}{text("cta-href", "Đường dẫn nút", block.href, "href")}</div>;
    case "contact":
      return <div className="admin-editor-grid">{text("contact-title", "Tiêu đề", block.title, "title")}{area("contact-body", "Mô tả", block.body, "body")}</div>;
  }
}

function CtaFields({ block, disabled, fieldId, kind, onChange }: { block: Extract<PageBlock, { type: "hero" }>; disabled: boolean; fieldId: (id: string) => string; kind: "primary" | "secondary"; onChange: (block: PageBlock) => void }) {
  const cta = block[`${kind}Cta`];
  const labelId = fieldId(`hero-${kind}-label`);
  const hrefId = fieldId(`hero-${kind}-href`);
  const update = (field: keyof PageCta, value: string) => {
    const next = { ...(cta ?? { label: "", href: "" }), [field]: value };
    onChange({ ...block, [`${kind}Cta`]: next.label || next.href ? next : null });
  };
  return <div className="admin-builder-cta-fields"><div className="admin-builder-subheading">Nút bấm {kind === "primary" ? "chính" : "phụ"}</div><AdminField id={labelId} label="Nhãn" optional><input className="admin-input" disabled={disabled} id={labelId} onChange={(event) => update("label", event.target.value)} value={cta?.label ?? ""} /></AdminField><AdminField id={hrefId} label="Đường dẫn" optional><input className="admin-input" disabled={disabled} id={hrefId} onChange={(event) => update("href", event.target.value)} value={cta?.href ?? ""} /></AdminField></div>;
}

function createDefaultBlock(type: BuilderBlockType): PageBlock {
  switch (type) {
    case "hero": return { type, eyebrow: "", title: "", description: "", imageUrl: null, primaryCta: null, secondaryCta: null };
    case "rich_text": return { type, title: "", body: "" };
    case "image": return { type, imageUrl: "", alt: "", caption: "" };
    case "feature_grid": return { type, title: "", items: [{ title: "", description: "" }] };
    case "cta": return { type, title: "", body: "", label: "", href: "" };
    case "contact": return { type, title: "", body: "" };
  }
}
