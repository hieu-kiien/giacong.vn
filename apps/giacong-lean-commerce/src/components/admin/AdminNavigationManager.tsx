"use client";

import { Eye, Plus, RefreshCw, Save, Send, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRegisterAdminUnsaved } from "@/components/admin/AdminUnsavedGuard";

import { AdminField } from "@/components/admin/AdminField";
import { AdminConfirmDialog } from "@/components/admin/AdminDialog";
import { AdminErrorState, AdminPageHeading, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { useAdminSession } from "@/components/admin/AdminShell";
import { useAdminToast } from "@/components/admin/AdminToast";
import { AdminClientError, fetchAdmin, mutateAdmin } from "@/lib/admin-client";

interface AdminNavigationItem {
  id: string;
  capturedMenuId: string | null;
  draftParentId: string | null;
  draftHref: string;
  draftIsActive: boolean;
  draftLabel: string;
  draftSortOrder: number;
  publishedHref: string;
  publishedParentId: string | null;
  publishedIsActive: boolean;
  publishedLabel: string;
  publishedSortOrder: number;
  menuKey: "primary" | "footer";
  version: number;
  updatedAt: string;
  dirty: boolean;
  localDirty?: boolean;
}

interface NavigationResponse {
  canEdit: boolean;
  canPublish: boolean;
  items: AdminNavigationItem[];
}

interface NavigationBulkResult {
  changedCount: number;
  published: AdminNavigationItem[];
  selectedCount: number;
  skipped: Array<{ id: string; reason: "stale" }>;
}

interface NewNavigationForm {
  href: string;
  label: string;
  menuKey: "primary" | "footer";
  parentId: string;
  sortOrder: string;
}

export function AdminNavigationManager() {
  const session = useAdminSession();
  const { showToast } = useAdminToast();
  const [items, setItems] = useState<AdminNavigationItem[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [canPublish, setCanPublish] = useState(false);
  const [permissionsReady, setPermissionsReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AdminClientError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishingAll, setPublishingAll] = useState(false);
  const [publishAllRequestId, setPublishAllRequestId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [confirmReload, setConfirmReload] = useState(false);
  const [newItem, setNewItem] = useState<NewNavigationForm>({ href: "/", label: "", menuKey: "primary", parentId: "", sortOrder: "" });
  const mutationRequestIds = useRef(new Map<string, string>());
  const createRequestId = useRef<string | null>(null);
  const isDirty = useCallback(() => items.some((item) => item.localDirty) || Boolean(newItem.label || newItem.sortOrder || newItem.href !== "/" || newItem.menuKey !== "primary" || newItem.parentId), [items, newItem]);
  useRegisterAdminUnsaved(isDirty, Boolean(savingId || publishingId || publishingAll || creating));

  function requestReload() {
    if (savingId || publishingId || publishingAll || creating) return;
    if (isDirty()) { setConfirmReload(true); return; }
    setAttempt((value) => value + 1);
  }

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      setError(null);
      setCanEdit(false);
      setCanPublish(false);
      setPermissionsReady(false);
      try {
        const result = await fetchAdmin<NavigationResponse>("/api/admin/navigation", controller.signal);
        setItems((result.items ?? []).map((item) => ({ ...item, localDirty: false })));
        setCanEdit(result.canEdit);
        setCanPublish(result.canPublish);
        setPermissionsReady(true);
      } catch (reason: unknown) {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể tải điều hướng website.", 0));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [attempt, session.subject]);

  const dirtyCount = useMemo(() => items.filter((item) => item.dirty).length, [items]);
  const hasUnsavedChanges = useMemo(() => items.some((item) => item.localDirty), [items]);
  const primaryItems = items.filter((item) => item.menuKey === "primary");
  const footerItems = items.filter((item) => item.menuKey === "footer");

  function updateDraft(id: string, patch: Partial<AdminNavigationItem>) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch, dirty: true, localDirty: true } : item));
    setNotice(null);
  }

  function replaceItem(next: AdminNavigationItem) {
    setItems((current) => current.map((item) => item.id === next.id ? { ...next, localDirty: false } : item));
  }

  function getMutationRequestId(operation: "draft" | "publish", id: string): string {
    const key = `${operation}:${id}`;
    const existing = mutationRequestIds.current.get(key);
    if (existing) return existing;
    const requestId = crypto.randomUUID();
    mutationRequestIds.current.set(key, requestId);
    return requestId;
  }

  function clearMutationRequestId(operation: "draft" | "publish", id: string) {
    mutationRequestIds.current.delete(`${operation}:${id}`);
  }

  async function saveItem(item: AdminNavigationItem) {
    if (!canEdit) return;
    setSavingId(item.id);
    setError(null);
    setNotice(null);
    const requestId = getMutationRequestId("draft", item.id);
    try {
      const result = await mutateAdmin<{ item: AdminNavigationItem }>(`/api/admin/navigation/${encodeURIComponent(item.id)}`, {
        body: {
          expectedVersion: item.version,
          href: item.draftHref,
          isActive: item.draftIsActive,
          label: item.draftLabel,
          parentId: item.draftParentId,
          requestId,
          sortOrder: item.draftSortOrder,
        },
        method: "PATCH",
      });
      replaceItem(result.item);
      clearMutationRequestId("draft", item.id);
      setNotice(`Đã lưu bản nháp “${item.draftLabel}”.`);
      showToast("success", "Bản nháp điều hướng đã được lưu.");
    } catch (reason: unknown) {
      const clientError = reason instanceof AdminClientError ? reason : new AdminClientError("Không thể lưu điều hướng.", 0);
      if (clientError.code === "STALE_WRITE" || clientError.code === "VALIDATION_ERROR" || clientError.code === "IDEMPOTENCY_CONFLICT") {
        clearMutationRequestId("draft", item.id);
      }
      setError(clientError);
      showToast("error", clientError.message);
    } finally {
      setSavingId(null);
    }
  }

  async function publishItem(item: AdminNavigationItem) {
    if (!canPublish || !item.dirty || item.localDirty || publishingId === item.id) return;
    setPublishingId(item.id);
    setError(null);
    setNotice(null);
    const requestId = getMutationRequestId("publish", item.id);
    try {
      const result = await mutateAdmin<{ item: AdminNavigationItem }>(`/api/admin/navigation/${encodeURIComponent(item.id)}/publish`, {
        body: { expectedVersion: item.version, requestId },
        method: "POST",
      });
      replaceItem(result.item);
      clearMutationRequestId("publish", item.id);
      setNotice(`Đã phát hành “${item.publishedLabel}” ra storefront.`);
      showToast("success", "Mục điều hướng đã được phát hành.");
    } catch (reason: unknown) {
      const clientError = reason instanceof AdminClientError ? reason : new AdminClientError("Không thể phát hành điều hướng.", 0);
      if (clientError.code === "STALE_WRITE" || clientError.code === "VALIDATION_ERROR" || clientError.code === "IDEMPOTENCY_CONFLICT") {
        clearMutationRequestId("publish", item.id);
      }
      setError(clientError);
      showToast("error", clientError.message);
    } finally {
      setPublishingId(null);
    }
  }

  async function publishAll() {
    if (!canPublish || dirtyCount === 0 || hasUnsavedChanges) return;
    setPublishingAll(true);
    setError(null);
    setNotice(null);
    const requestId = publishAllRequestId ?? crypto.randomUUID();
    setPublishAllRequestId(requestId);
    try {
      const result = await mutateAdmin<NavigationBulkResult>(
        "/api/admin/navigation/publish-all",
        { body: { requestId }, method: "POST" },
      );
      result.published.forEach(replaceItem);
      const skippedSummary = result.skipped.map((item) => `${item.id} (${item.reason})`).join(", ");
      setNotice(result.skipped.length > 0
        ? `Đã phát hành ${result.changedCount} / ${result.selectedCount} mục điều hướng. Chưa xử lý: ${skippedSummary}. Hãy tải lại trước khi thử lại.`
        : result.changedCount === 0
          ? "Không có thay đổi điều hướng cần phát hành."
          : `Đã phát hành ${result.changedCount} mục điều hướng.`);
      showToast(result.skipped.length > 0 ? "info" : "success", result.skipped.length > 0 ? "Điều hướng đã được phát hành một phần." : "Điều hướng đã được phát hành.");
      setPublishAllRequestId(null);
    } catch (reason: unknown) {
      const clientError = reason instanceof AdminClientError ? reason : new AdminClientError("Không thể phát hành điều hướng.", 0);
      setError(clientError);
      showToast("error", clientError.message);
    } finally {
      setPublishingAll(false);
    }
  }

  async function createItem() {
    if (!canEdit || creating) return;
    setCreating(true);
    setError(null);
    setNotice(null);
    const requestId = createRequestId.current ?? crypto.randomUUID();
    createRequestId.current = requestId;
    const targetItems = newItem.menuKey === "footer" ? footerItems : primaryItems;
    try {
      const result = await mutateAdmin<{ item: AdminNavigationItem }>("/api/admin/navigation", {
        body: {
          href: newItem.href,
          isActive: true,
          label: newItem.label,
          menuKey: newItem.menuKey,
          parentId: newItem.parentId || null,
          requestId,
          sortOrder: newItem.sortOrder === "" ? Math.max(0, ...targetItems.map((item) => item.draftSortOrder)) + 10 : Number(newItem.sortOrder),
        },
        method: "POST",
      });
      setItems((current) => [...current, result.item]);
      setNewItem({ href: "/", label: "", menuKey: "primary", parentId: "", sortOrder: "" });
      setShowCreate(false);
      createRequestId.current = null;
      setNotice("Đã thêm mục điều hướng. Hãy lưu và publish khi sẵn sàng.");
      showToast("success", "Đã thêm mục điều hướng mới.");
    } catch (reason: unknown) {
      const clientError = reason instanceof AdminClientError ? reason : new AdminClientError("Không thể thêm mục menu.", 0);
      if (clientError.status >= 400 && clientError.status < 500) createRequestId.current = null;
      setError(clientError);
      showToast("error", clientError.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="admin-content">
      <AdminPageHeading
        kicker="Quản lý menu"
        title="Menu website"
        subtitle="Đổi tên, đường dẫn, thứ tự và trạng thái hiển thị của menu. Trang web chỉ nhận bản đã đăng."
        stamp="QUẢN LÝ MENU"
      />
      <div className="admin-content-toolbar">
        <div>
          <div className="admin-content-toolbar-title"><ShieldCheck size={16} /> Kiểm soát thay đổi menu</div>
          <p>Menu cũ được nhận diện bằng mã; mục mới thêm theo mẫu an toàn, không chèn mã web lạ.</p>
        </div>
        <div className="admin-content-toolbar-actions">
          <AdminStatusBadge kind={permissionsReady && canEdit ? "green" : "neutral"} value={!permissionsReady ? (error ? "Chưa xác định quyền" : "Đang kiểm tra quyền…") : canEdit ? "Có quyền chỉnh sửa" : "Chỉ xem"} />
          <button className="admin-button admin-button-quiet" onClick={requestReload} type="button"><RefreshCw size={14} /> Tải lại</button>
          {permissionsReady && canEdit ? <button className="admin-button admin-button-quiet" onClick={() => setShowCreate((value) => !value)} type="button"><Plus size={14} /> Thêm mục</button> : null}
          {permissionsReady && canPublish ? <button className="admin-button admin-button-primary" disabled={publishingAll || dirtyCount === 0 || hasUnsavedChanges} onClick={() => void publishAll()} type="button"><Send size={14} /> {publishingAll ? "Đang phát hành..." : "Phát hành tất cả"}</button> : null}
        </div>
      </div>
      {showCreate && permissionsReady && canEdit ? (
        <section className="admin-panel admin-navigation-create" aria-labelledby="navigation-create-title">
          <div className="admin-panel-heading"><div><h2 className="admin-panel-title" id="navigation-create-title">Thêm mục menu</h2><p className="admin-panel-caption">Dùng đường dẫn nội bộ như <code>/gioi-thieu/</code> hoặc URL https:// an toàn. Muốn bổ sung dropdown Sản phẩm hoặc Dịch vụ, chọn Menu chính rồi chọn mục cha tương ứng. Mục cuối trang sẽ xuất hiện trong khu vực liên kết cuối trang sau khi đăng.</p></div></div>
          <div className="admin-editor-grid">
            <AdminField id="navigation-new-label" label="Nhãn">
              <input className="admin-input" disabled={!canEdit} id="navigation-new-label" onChange={(event) => { createRequestId.current = null; setNewItem((current) => ({ ...current, label: event.target.value })); }} value={newItem.label} />
            </AdminField>
            <AdminField id="navigation-new-href" label="Đường dẫn">
              <input className="admin-input" disabled={!canEdit} id="navigation-new-href" onChange={(event) => { createRequestId.current = null; setNewItem((current) => ({ ...current, href: event.target.value })); }} value={newItem.href} />
            </AdminField>
            <AdminField id="navigation-new-menu-key" label="Vị trí">
              <select className="admin-input" disabled={!canEdit} id="navigation-new-menu-key" onChange={(event) => { createRequestId.current = null; const menuKey = event.target.value as NewNavigationForm["menuKey"]; setNewItem((current) => ({ ...current, menuKey, parentId: menuKey === "footer" ? "" : current.parentId })); }} value={newItem.menuKey}>
                <option value="primary">Menu chính</option>
                <option value="footer">Liên kết cuối trang</option>
              </select>
            </AdminField>
            <AdminField id="navigation-new-order" hint="Để trống để đặt sau mục hiện có." label="Thứ tự" optional>
              <input className="admin-input" disabled={!canEdit} id="navigation-new-order" min="0" onChange={(event) => { createRequestId.current = null; setNewItem((current) => ({ ...current, sortOrder: event.target.value })); }} type="number" value={newItem.sortOrder} />
            </AdminField>
            {newItem.menuKey === "primary" ? (
              <AdminField id="navigation-new-parent" hint="Để trống nếu là mục cấp cao nhất." label="Mục cha" optional>
                <select className="admin-input" disabled={!canEdit} id="navigation-new-parent" onChange={(event) => { createRequestId.current = null; setNewItem((current) => ({ ...current, parentId: event.target.value })); }} value={newItem.parentId}>
                  <option value="">Cấp cao nhất</option>
                  {primaryItems.map((item) => <option key={item.id} value={item.id}>{item.draftLabel}</option>)}
                </select>
              </AdminField>
            ) : (
              <AdminField id="navigation-new-parent" hint="Liên kết cuối trang luôn ở cấp cao nhất." label="Mục cha" optional>
                <select className="admin-input" disabled id="navigation-new-parent" value=""><option value="">Cấp cao nhất</option></select>
              </AdminField>
            )}
          </div>
          <div className="admin-editor-actions"><button className="admin-button admin-button-primary" disabled={!canEdit || creating || !newItem.label || !newItem.href} onClick={() => void createItem()} type="button"><Plus size={14} /> {creating ? "Đang thêm..." : "Thêm mục"}</button></div>
        </section>
      ) : null}
      {notice ? <div className="admin-content-notice" role="status">{notice}</div> : null}
      {error ? <AdminErrorState error={error} onRetry={requestReload} /> : null}
      {confirmReload ? <AdminConfirmDialog cancelLabel="Ở lại" confirmLabel="Tải lại" message="Tải lại sẽ bỏ các thay đổi menu chưa lưu. Bạn có muốn tiếp tục?" onConfirm={() => setAttempt((value) => value + 1)} onDismiss={() => setConfirmReload(false)} title="Bỏ thay đổi và tải lại?" /> : null}
      {loading ? <div className="admin-skeleton admin-content-skeleton" aria-label="Đang tải menu" /> : (
        <div className="admin-navigation-groups">
          <NavigationGroup
            canEdit={permissionsReady && canEdit}
            canPublish={permissionsReady && canPublish}
            items={primaryItems}
            onChange={updateDraft}
            onPublish={(item) => void publishItem(item)}
            onSave={(item) => void saveItem(item)}
            publishingId={publishingId}
            savingId={savingId}
            title="Menu chính"
          />
          {footerItems.length > 0 ? <NavigationGroup canEdit={permissionsReady && canEdit} canPublish={permissionsReady && canPublish} items={footerItems} onChange={updateDraft} onPublish={(item) => void publishItem(item)} onSave={(item) => void saveItem(item)} publishingId={publishingId} savingId={savingId} title="Menu cuối trang" /> : null}
        </div>
      )}
    </div>
  );
}

function NavigationGroup({ canEdit, canPublish, items, onChange, onPublish, onSave, publishingId, savingId, title }: {
  canEdit: boolean;
  canPublish: boolean;
  items: AdminNavigationItem[];
  onChange: (id: string, patch: Partial<AdminNavigationItem>) => void;
  onPublish: (item: AdminNavigationItem) => void;
  onSave: (item: AdminNavigationItem) => void;
  publishingId: string | null;
  savingId: string | null;
  title: string;
}) {
  return (
    <section className="admin-panel" aria-labelledby={`navigation-group-${title.replace(/\W/g, "-")}`}>
      <div className="admin-panel-heading"><div><h2 className="admin-panel-title" id={`navigation-group-${title.replace(/\W/g, "-")}`}>{title}</h2><p className="admin-panel-caption">{items.length} mục · mục con được thụt vào · giá trị màu xanh là bản khách đang thấy</p></div><Eye size={17} /></div>
      {items.length === 0 ? <div className="admin-table-empty"><strong>Chưa có mục menu</strong><p>Thêm mục mới để bắt đầu tạo menu.</p></div> : (
        <div className="admin-navigation-list">
          {renderNavigationTree(items, (item) => <NavigationEditor canEdit={canEdit} canPublish={canPublish} item={item} key={item.id} onChange={onChange} onPublish={onPublish} onSave={onSave} parentOptions={items} publishing={publishingId === item.id} saving={savingId === item.id} />)}
        </div>
      )}
    </section>
  );
}

function renderNavigationTree(
  items: AdminNavigationItem[],
  renderEditor: (item: AdminNavigationItem) => ReactNode,
) {
  const itemIds = new Set(items.map((item) => item.id));
  const childrenByParent = new Map<string, AdminNavigationItem[]>();
  const rendered = new Set<string>();
  items.forEach((item) => {
    if (!item.draftParentId || !itemIds.has(item.draftParentId)) return;
    const children = childrenByParent.get(item.draftParentId) ?? [];
    children.push(item);
    childrenByParent.set(item.draftParentId, children);
  });

  function renderItem(item: AdminNavigationItem, depth: number, trail: Set<string>): ReactNode {
    if (trail.has(item.id)) return null;
    rendered.add(item.id);
    const nextTrail = new Set(trail).add(item.id);
    const children = childrenByParent.get(item.id) ?? [];
    return (
      <div className="admin-navigation-tree-node" data-depth={depth} key={item.id}>
        {renderEditor(item)}
        {children.map((child) => renderItem(child, depth + 1, nextTrail))}
      </div>
    );
  }

  const roots = items
    .filter((item) => !item.draftParentId || !itemIds.has(item.draftParentId))
    .map((item) => renderItem(item, 0, new Set()));
  return roots.concat(items.filter((item) => !rendered.has(item.id)).map((item) => renderItem(item, 0, new Set())));
}

function NavigationEditor({ canEdit, canPublish, item, onChange, onPublish, onSave, parentOptions, publishing, saving }: {
  canEdit: boolean;
  canPublish: boolean;
  item: AdminNavigationItem;
  onChange: (id: string, patch: Partial<AdminNavigationItem>) => void;
  onPublish: (item: AdminNavigationItem) => void;
  onSave: (item: AdminNavigationItem) => void;
  parentOptions: AdminNavigationItem[];
  publishing: boolean;
  saving: boolean;
}) {
  const fieldPrefix = `navigation-${item.id}`;
  return (
    <article className={`admin-navigation-card${item.dirty ? " is-dirty" : ""}`}>
      <div className="admin-navigation-card-heading">
        <div><strong>{item.draftLabel}</strong><span>{item.capturedMenuId ? `Mã menu cũ: ${item.capturedMenuId}` : "Mục mới"}</span></div>
        <div className="admin-table-actions"><AdminStatusBadge kind={item.dirty ? "amber" : "green"} value={item.dirty ? "Có bản nháp" : "Đã đăng"} /><AdminStatusBadge kind={item.draftIsActive ? "blue" : "neutral"} value={item.draftIsActive ? "Đang hiện" : "Đang ẩn"} /></div>
      </div>
      <div className="admin-editor-grid">
        <AdminField id={`${fieldPrefix}-label`} label="Nhãn">
          <input className="admin-input" disabled={!canEdit} id={`${fieldPrefix}-label`} onChange={(event) => onChange(item.id, { draftLabel: event.target.value })} value={item.draftLabel} />
        </AdminField>
        <AdminField id={`${fieldPrefix}-href`} label="Đường dẫn">
          <input className="admin-input" disabled={!canEdit} id={`${fieldPrefix}-href`} onChange={(event) => onChange(item.id, { draftHref: event.target.value })} value={item.draftHref} />
        </AdminField>
        <AdminField id={`${fieldPrefix}-order`} label="Thứ tự">
          <input className="admin-input" disabled={!canEdit} id={`${fieldPrefix}-order`} min="0" onChange={(event) => onChange(item.id, { draftSortOrder: Number(event.target.value) })} type="number" value={item.draftSortOrder} />
        </AdminField>
        {item.menuKey === "primary" && !item.capturedMenuId ? (
          <AdminField id={`${fieldPrefix}-parent`} hint="Để trống nếu là mục cấp cao nhất." label="Mục cha" optional>
            <select className="admin-input" disabled={!canEdit} id={`${fieldPrefix}-parent`} onChange={(event) => onChange(item.id, { draftParentId: event.target.value || null })} value={item.draftParentId ?? ""}>
              <option value="">Cấp cao nhất</option>
              {parentOptions.filter((candidate) => candidate.id !== item.id).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.draftLabel}</option>)}
            </select>
          </AdminField>
        ) : (
          <AdminField id={`${fieldPrefix}-parent`} hint={item.capturedMenuId ? "Mục menu cũ được giữ ở cấp cao nhất." : "Mục cuối trang luôn ở cấp cao nhất."} label="Mục cha" optional>
            <select className="admin-input" disabled value=""><option value="">Cấp cao nhất</option></select>
          </AdminField>
        )}
      </div>
      <div className="admin-navigation-card-footer">
        <label className={`admin-check${canEdit ? "" : " is-disabled"}`}>
          <input checked={item.draftIsActive} disabled={!canEdit} onChange={(event) => onChange(item.id, { draftIsActive: event.target.checked })} type="checkbox" />
          <span><strong>Hiển thị mục này</strong><small>Ngoài web: {item.publishedIsActive ? "đang hiện" : "đang ẩn"} · bản {item.version}</small></span>
        </label>
        <div className="admin-setting-actions">
          <button className="admin-button admin-button-quiet" disabled={!canEdit || !item.localDirty || saving} onClick={() => onSave(item)} type="button"><Save size={13} /> {saving ? "Đang lưu" : "Lưu nháp"}</button>
          <button className="admin-button admin-button-primary" disabled={!canPublish || !item.dirty || item.localDirty || publishing} onClick={() => onPublish(item)} type="button"><Send size={13} /> {publishing ? "Đang phát hành" : "Phát hành"}</button>
        </div>
      </div>
    </article>
  );
}
