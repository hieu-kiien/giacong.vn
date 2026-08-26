"use client";

import { Eye, Plus, RefreshCw, Save, Send, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AdminField } from "@/components/admin/AdminField";
import { AdminErrorState, AdminPageHeading, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { useAdminSession } from "@/components/admin/AdminShell";
import { useAdminToast } from "@/components/admin/AdminToast";
import { AdminClientError, fetchAdmin, mutateAdmin } from "@/lib/admin-client";

interface AdminNavigationItem {
  id: string;
  capturedMenuId: string | null;
  draftHref: string;
  draftIsActive: boolean;
  draftLabel: string;
  draftSortOrder: number;
  publishedHref: string;
  publishedIsActive: boolean;
  publishedLabel: string;
  publishedSortOrder: number;
  menuKey: "primary" | "footer";
  version: number;
  updatedAt: string;
  dirty: boolean;
}

interface NavigationResponse {
  canEdit: boolean;
  canPublish: boolean;
  items: AdminNavigationItem[];
}

interface NewNavigationForm {
  href: string;
  label: string;
  sortOrder: string;
}

export function AdminNavigationManager() {
  const session = useAdminSession();
  const { showToast } = useAdminToast();
  const [items, setItems] = useState<AdminNavigationItem[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [canPublish, setCanPublish] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AdminClientError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishingAll, setPublishingAll] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newItem, setNewItem] = useState<NewNavigationForm>({ href: "/", label: "", sortOrder: "" });

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchAdmin<NavigationResponse>("/api/admin/navigation", controller.signal);
        setItems(result.items ?? []);
        setCanEdit(result.canEdit);
        setCanPublish(result.canPublish);
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
  const primaryItems = items.filter((item) => item.menuKey === "primary");
  const footerItems = items.filter((item) => item.menuKey === "footer");

  function updateDraft(id: string, patch: Partial<AdminNavigationItem>) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch, dirty: true } : item));
    setNotice(null);
  }

  function replaceItem(next: AdminNavigationItem) {
    setItems((current) => current.map((item) => item.id === next.id ? next : item));
  }

  async function saveItem(item: AdminNavigationItem) {
    if (!canEdit) return;
    setSavingId(item.id);
    setError(null);
    setNotice(null);
    try {
      const result = await mutateAdmin<{ item: AdminNavigationItem }>(`/api/admin/navigation/${encodeURIComponent(item.id)}`, {
        body: {
          expectedVersion: item.version,
          href: item.draftHref,
          isActive: item.draftIsActive,
          label: item.draftLabel,
          sortOrder: item.draftSortOrder,
        },
        method: "PATCH",
      });
      replaceItem(result.item);
      setNotice(`Đã lưu bản nháp “${item.draftLabel}”.`);
      showToast("success", "Bản nháp điều hướng đã được lưu.");
    } catch (reason: unknown) {
      const clientError = reason instanceof AdminClientError ? reason : new AdminClientError("Không thể lưu điều hướng.", 0);
      setError(clientError);
      showToast("error", clientError.message);
    } finally {
      setSavingId(null);
    }
  }

  async function publishItem(item: AdminNavigationItem) {
    if (!canPublish || item.dirty) return;
    setPublishingId(item.id);
    setError(null);
    setNotice(null);
    try {
      const result = await mutateAdmin<{ item: AdminNavigationItem }>(`/api/admin/navigation/${encodeURIComponent(item.id)}/publish`, {
        body: { expectedVersion: item.version },
        method: "POST",
      });
      replaceItem(result.item);
      setNotice(`Đã phát hành “${item.publishedLabel}” ra storefront.`);
      showToast("success", "Mục điều hướng đã được phát hành.");
    } catch (reason: unknown) {
      const clientError = reason instanceof AdminClientError ? reason : new AdminClientError("Không thể phát hành điều hướng.", 0);
      setError(clientError);
      showToast("error", clientError.message);
    } finally {
      setPublishingId(null);
    }
  }

  async function publishAll() {
    if (!canPublish || dirtyCount === 0) return;
    setPublishingAll(true);
    setError(null);
    setNotice(null);
    try {
      const result = await mutateAdmin<{ count: number; published: AdminNavigationItem[]; skipped: number }>(
        "/api/admin/navigation/publish-all",
        { body: {}, method: "POST" },
      );
      result.published.forEach(replaceItem);
      setNotice(`Đã phát hành ${result.count} mục điều hướng.${result.skipped ? ` Bỏ qua ${result.skipped} mục do xung đột.` : ""}`);
      showToast("success", "Điều hướng đã được phát hành.");
    } catch (reason: unknown) {
      const clientError = reason instanceof AdminClientError ? reason : new AdminClientError("Không thể phát hành điều hướng.", 0);
      setError(clientError);
      showToast("error", clientError.message);
    } finally {
      setPublishingAll(false);
    }
  }

  async function createItem() {
    if (!canEdit) return;
    setError(null);
    try {
      const result = await mutateAdmin<{ item: AdminNavigationItem }>("/api/admin/navigation", {
        body: {
          href: newItem.href,
          isActive: true,
          label: newItem.label,
          menuKey: "primary",
          sortOrder: newItem.sortOrder === "" ? Math.max(0, ...primaryItems.map((item) => item.draftSortOrder)) + 10 : Number(newItem.sortOrder),
        },
        method: "POST",
      });
      setItems((current) => [...current, result.item]);
      setNewItem({ href: "/", label: "", sortOrder: "" });
      setShowCreate(false);
      setNotice("Đã thêm mục điều hướng. Hãy lưu và publish khi sẵn sàng.");
      showToast("success", "Đã thêm mục điều hướng mới.");
    } catch (reason: unknown) {
      const clientError = reason instanceof AdminClientError ? reason : new AdminClientError("Không thể thêm mục điều hướng.", 0);
      setError(clientError);
      showToast("error", clientError.message);
    }
  }

  return (
    <div className="admin-content">
      <AdminPageHeading
        kicker="CMS / navigation"
        title="Điều hướng website"
        subtitle="Đổi nhãn, đường dẫn, thứ tự và trạng thái hiển thị của menu. Storefront chỉ nhận bản đã publish."
        stamp="NAVIGATION CONTROL"
      />
      <div className="admin-content-toolbar">
        <div>
          <div className="admin-content-toolbar-title"><ShieldCheck size={16} /> Kiểm soát thay đổi menu</div>
          <p>Menu captured cũ được nhận diện bằng ID; mục mới được thêm bằng schema an toàn, không chèn HTML tùy ý.</p>
        </div>
        <div className="admin-content-toolbar-actions">
          <AdminStatusBadge kind={canEdit ? "green" : "neutral"} value={canEdit ? "Có quyền chỉnh sửa" : "Chỉ xem"} />
          <button className="admin-button admin-button-quiet" onClick={() => setAttempt((value) => value + 1)} type="button"><RefreshCw size={14} /> Tải lại</button>
          {canEdit ? <button className="admin-button admin-button-quiet" onClick={() => setShowCreate((value) => !value)} type="button"><Plus size={14} /> Thêm mục</button> : null}
          {canPublish ? <button className="admin-button admin-button-primary" disabled={publishingAll || dirtyCount === 0} onClick={() => void publishAll()} type="button"><Send size={14} /> {publishingAll ? "Đang phát hành..." : "Phát hành tất cả"}</button> : null}
        </div>
      </div>
      {showCreate ? (
        <section className="admin-panel admin-navigation-create" aria-labelledby="navigation-create-title">
          <div className="admin-panel-heading"><div><h2 className="admin-panel-title" id="navigation-create-title">Thêm mục primary</h2><p className="admin-panel-caption">Dùng đường dẫn nội bộ như <code>/gioi-thieu/</code> hoặc URL https:// an toàn.</p></div></div>
          <div className="admin-editor-grid">
            <AdminField id="navigation-new-label" label="Nhãn">
              <input className="admin-input" disabled={!canEdit} id="navigation-new-label" onChange={(event) => setNewItem((current) => ({ ...current, label: event.target.value }))} value={newItem.label} />
            </AdminField>
            <AdminField id="navigation-new-href" label="Đường dẫn">
              <input className="admin-input" disabled={!canEdit} id="navigation-new-href" onChange={(event) => setNewItem((current) => ({ ...current, href: event.target.value }))} value={newItem.href} />
            </AdminField>
            <AdminField id="navigation-new-order" hint="Để trống để đặt sau mục hiện có." label="Thứ tự" optional>
              <input className="admin-input" disabled={!canEdit} id="navigation-new-order" min="0" onChange={(event) => setNewItem((current) => ({ ...current, sortOrder: event.target.value }))} type="number" value={newItem.sortOrder} />
            </AdminField>
          </div>
          <div className="admin-editor-actions"><button className="admin-button admin-button-primary" disabled={!canEdit || !newItem.label || !newItem.href} onClick={() => void createItem()} type="button"><Plus size={14} /> Thêm mục</button></div>
        </section>
      ) : null}
      {notice ? <div className="admin-content-notice" role="status">{notice}</div> : null}
      {error ? <AdminErrorState error={error} onRetry={() => { setError(null); setAttempt((value) => value + 1); }} /> : null}
      {loading ? <div className="admin-skeleton admin-content-skeleton" aria-label="Đang tải điều hướng" /> : (
        <div className="admin-navigation-groups">
          <NavigationGroup
            canEdit={canEdit}
            canPublish={canPublish}
            items={primaryItems}
            onChange={updateDraft}
            onPublish={(item) => void publishItem(item)}
            onSave={(item) => void saveItem(item)}
            publishingId={publishingId}
            savingId={savingId}
            title="Primary menu"
          />
          {footerItems.length > 0 ? <NavigationGroup canEdit={canEdit} canPublish={canPublish} items={footerItems} onChange={updateDraft} onPublish={(item) => void publishItem(item)} onSave={(item) => void saveItem(item)} publishingId={publishingId} savingId={savingId} title="Footer menu" /> : null}
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
      <div className="admin-panel-heading"><div><h2 className="admin-panel-title" id={`navigation-group-${title.replace(/\W/g, "-")}`}>{title}</h2><p className="admin-panel-caption">{items.length} mục · giá trị màu xanh là bản public hiện tại</p></div><Eye size={17} /></div>
      {items.length === 0 ? <div className="admin-table-empty"><strong>Chưa có mục menu</strong><p>Thêm mục mới để bắt đầu xây dựng điều hướng.</p></div> : (
        <div className="admin-navigation-list">
          {items.map((item) => <NavigationEditor canEdit={canEdit} canPublish={canPublish} item={item} key={item.id} onChange={onChange} onPublish={onPublish} onSave={onSave} publishing={publishingId === item.id} saving={savingId === item.id} />)}
        </div>
      )}
    </section>
  );
}

function NavigationEditor({ canEdit, canPublish, item, onChange, onPublish, onSave, publishing, saving }: {
  canEdit: boolean;
  canPublish: boolean;
  item: AdminNavigationItem;
  onChange: (id: string, patch: Partial<AdminNavigationItem>) => void;
  onPublish: (item: AdminNavigationItem) => void;
  onSave: (item: AdminNavigationItem) => void;
  publishing: boolean;
  saving: boolean;
}) {
  const fieldPrefix = `navigation-${item.id}`;
  return (
    <article className={`admin-navigation-card${item.dirty ? " is-dirty" : ""}`}>
      <div className="admin-navigation-card-heading">
        <div><strong>{item.draftLabel}</strong><span>{item.capturedMenuId ? `Captured ID: ${item.capturedMenuId}` : "Mục mới"}</span></div>
        <div className="admin-table-actions"><AdminStatusBadge kind={item.dirty ? "amber" : "green"} value={item.dirty ? "Có draft" : "Published"} /><AdminStatusBadge kind={item.draftIsActive ? "blue" : "neutral"} value={item.draftIsActive ? "Đang hiện" : "Đang ẩn"} /></div>
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
      </div>
      <div className="admin-navigation-card-footer">
        <label className={`admin-check${canEdit ? "" : " is-disabled"}`}>
          <input checked={item.draftIsActive} disabled={!canEdit} onChange={(event) => onChange(item.id, { draftIsActive: event.target.checked })} type="checkbox" />
          <span><strong>Hiển thị mục này</strong><small>Public: {item.publishedIsActive ? "đang hiện" : "đang ẩn"} · v{item.version}</small></span>
        </label>
        <div className="admin-setting-actions">
          <button className="admin-button admin-button-quiet" disabled={!canEdit || !item.dirty || saving} onClick={() => onSave(item)} type="button"><Save size={13} /> {saving ? "Đang lưu" : "Lưu nháp"}</button>
          <button className="admin-button admin-button-primary" disabled={!canPublish || item.dirty || publishing} onClick={() => onPublish(item)} type="button"><Send size={13} /> {publishing ? "Đang phát hành" : "Phát hành"}</button>
        </div>
      </div>
    </article>
  );
}
