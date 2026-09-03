"use client";

import { ExternalLink, RefreshCw, Save, Send, SendHorizonal, ShieldCheck, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AdminErrorState, AdminPageHeading, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { useAdminSession } from "@/components/admin/AdminShell";
import {
  AdminClientError,
  fetchAdmin,
  formatAdminDate,
  mutateAdmin,
  type AdminSiteSetting,
  type AdminSiteSettingGroup,
} from "@/lib/admin-client";

interface SiteSettingsResponse {
  settings: AdminSiteSetting[];
  canEdit: boolean;
  role: string;
}

const groupLabels: Record<AdminSiteSettingGroup, { label: string; description: string }> = {
  brand: { label: "Brand & nhận diện", description: "Logo, màu chủ đạo và các điểm nhận diện dùng chung." },
  seo: { label: "SEO & chia sẻ", description: "Tiêu đề và mô tả mặc định của website." },
  home: { label: "Trang chủ", description: "Hero, CTA và phần giới thiệu trên trang chủ." },
  contact: { label: "Liên hệ", description: "Hotline, email, Zalo, Messenger và địa chỉ." },
  footer: { label: "Footer", description: "Nội dung giới thiệu và bản quyền cuối trang." },
};

const groupOrder: AdminSiteSettingGroup[] = ["brand", "seo", "home", "contact", "footer"];

export default function AdminContentPage() {
  const session = useAdminSession();
  const [settings, setSettings] = useState<AdminSiteSetting[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AdminClientError | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [publishingKey, setPublishingKey] = useState<string | null>(null);
  const [unsavedKeys, setUnsavedKeys] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [publishingAll, setPublishingAll] = useState(false);
  const publishAllRequestId = useRef<{ key: string; requestId: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchAdmin<SiteSettingsResponse>("/api/admin/site-settings", controller.signal);
        setSettings(result.settings ?? []);
        setCanEdit(result.canEdit);
        setUnsavedKeys(new Set());
      } catch (reason: unknown) {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể tải CMS website.", 0));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [session.subject, attempt]);

  const groupedSettings = useMemo(() => {
    return groupOrder.map((group) => ({
      group,
      ...groupLabels[group],
      items: settings.filter((setting) => setting.group === group),
    }));
  }, [settings]);

  function updateDraft(key: string, value: string) {
    setSettings((current) => current.map((setting) => setting.key === key
      ? { ...setting, draftValue: value, dirty: value !== setting.publishedValue }
      : setting));
    setUnsavedKeys((current) => new Set(current).add(key));
    setNotice(null);
  }

  async function saveDraft(setting: AdminSiteSetting) {
    setSavingKey(setting.key);
    setNotice(null);
    try {
      const requestId = crypto.randomUUID();
      const result = await mutateAdmin<{ setting: AdminSiteSetting }>("/api/admin/site-settings", {
        method: "PATCH",
        body: { requestId, key: setting.key, value: setting.draftValue, expectedVersion: setting.version },
      });
      setSettings((current) => current.map((item) => item.key === setting.key ? result.setting : item));
      setUnsavedKeys((current) => {
        const next = new Set(current);
        next.delete(setting.key);
        return next;
      });
      setNotice(`Đã lưu bản nháp “${setting.label}”.`);
    } catch (reason: unknown) {
      setError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể lưu bản nháp.", 0));
    } finally {
      setSavingKey(null);
    }
  }

  async function uploadImage(setting: AdminSiteSetting, file: File) {
    setUploadingKey(setting.key);
    setNotice(null);
    try {
      const form = new FormData();
      form.set("requestId", crypto.randomUUID());
      form.set("key", setting.key);
      form.set("expectedVersion", String(setting.version));
      form.set("file", file);
      const response = await fetch("/api/admin/site-settings/media", {
        body: form,
        credentials: "include",
        method: "POST",
      });
      const body = await response.json() as { code?: string; data?: { setting: AdminSiteSetting }; message?: string; ok?: boolean };
      if (!response.ok || body.ok === false || !body.data?.setting) {
        throw new AdminClientError(body.message ?? "Không thể upload ảnh thương hiệu.", response.status, body.code);
      }
      setSettings((current) => current.map((item) => item.key === setting.key ? body.data!.setting : item));
      setUnsavedKeys((current) => {
        const next = new Set(current);
        next.delete(setting.key);
        return next;
      });
      setNotice(`Đã upload ảnh và lưu draft cho “${setting.label}”.`);
    } catch (reason: unknown) {
      setError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể upload ảnh thương hiệu.", 0));
    } finally {
      setUploadingKey(null);
    }
  }

  async function publish(setting: AdminSiteSetting) {
    setPublishingKey(setting.key);
    setNotice(null);
    try {
      const requestId = crypto.randomUUID();
      const result = await mutateAdmin<{ setting: AdminSiteSetting }>("/api/admin/site-settings/publish", {
        method: "POST",
        body: { requestId, key: setting.key, expectedVersion: setting.version },
      });
      setSettings((current) => current.map((item) => item.key === setting.key ? result.setting : item));
      setNotice(`Đã phát hành "${setting.label}" ra website.`);
    } catch (reason: unknown) {
      setError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể phát hành nội dung.", 0));
    } finally {
      setPublishingKey(null);
    }
  }

  async function publishAll() {
    if (publishingAll) return;
    const dirtyKey = settings
      .filter((setting) => setting.dirty)
      .map((setting) => `${setting.key}:${setting.version}`)
      .sort()
      .join("|");
    if (!dirtyKey) return;

    const pendingPublish = publishAllRequestId.current?.key === dirtyKey ? publishAllRequestId.current : null;
    const requestId = pendingPublish?.requestId ?? crypto.randomUUID();
    publishAllRequestId.current = { key: dirtyKey, requestId };
    setPublishingAll(true);
    setNotice(null);
    try {
      const result = await mutateAdmin<{ published: AdminSiteSetting[]; skipped: number; count: number }>(
        "/api/admin/site-settings/publish-all",
        { method: "POST", body: { requestId } },
      );
      if (result.published.length > 0) {
        const map = new Map(result.published.map((item) => [item.key, item]));
        setSettings((current) => current.map((item) => map.get(item.key) ?? item));
      }
      if (result.count === 0) {
        setNotice("Không có bản nháp nào cần phát hành.");
      } else {
        setNotice(`Đã phát hành ${result.count} thay đổi ra storefront.${result.skipped > 0 ? ` (${result.skipped} bị bỏ qua do xung đột)` : ""}`);
      }
      if (publishAllRequestId.current?.key === dirtyKey) publishAllRequestId.current = null;
    } catch (reason: unknown) {
      const clientError = reason instanceof AdminClientError
        ? reason
        : new AdminClientError("Không thể phát hành tất cả thay đổi.", 0);
      if (clientError.status >= 400 && clientError.status < 500 && publishAllRequestId.current?.key === dirtyKey) {
        publishAllRequestId.current = null;
      }
      setError(clientError);
    } finally {
      setPublishingAll(false);
    }
  }

  return (
    <div className="admin-content">
      <AdminPageHeading
        kicker="CMS / website"
        title="Nội dung & thương hiệu"
        subtitle="Chỉnh sửa theo cấu trúc an toàn, lưu bản nháp trước rồi phát hành từng thay đổi ra storefront."
        stamp="CONTENT CONTROL"
      />
      <div className="admin-content-toolbar">
        <div>
          <div className="admin-content-toolbar-title"><ShieldCheck size={16} /> Quy trình publish an toàn</div>
          <p>Public chỉ đọc bản đã phát hành. Mỗi thay đổi dùng version để tránh ghi đè khi có nhiều người cùng chỉnh sửa.</p>
        </div>
        <div className="admin-content-toolbar-actions">
          <AdminStatusBadge kind={canEdit ? "green" : "neutral"} value={canEdit ? "Có quyền chỉnh sửa" : "Chỉ xem"} />
          <button className="admin-button admin-button-quiet" data-testid="button-content-refresh" onClick={() => setAttempt((value) => value + 1)} type="button"><RefreshCw size={14} /> Tải lại</button>
          {canEdit ? (
            <button
              className="admin-button admin-button-primary"
              data-testid="button-publish-all"
              disabled={publishingAll || unsavedKeys.size > 0 || !settings.some((setting) => setting.dirty)}
              onClick={() => void publishAll()}
              type="button"
            >
              <SendHorizonal size={14} />
              {publishingAll ? "Đang phát hành..." : "Phát hành tất cả"}
            </button>
          ) : null}
        </div>
      </div>
      {notice ? <div className="admin-content-notice" role="status">{notice}</div> : null}
      {error ? <AdminErrorState error={error} onRetry={() => { setError(null); setAttempt((value) => value + 1); }} /> : null}
      {loading ? <div className="admin-skeleton admin-content-skeleton" aria-label="Đang tải CMS" /> : (
        <div className="admin-content-layout">
          <div className="admin-content-sections">
            {groupedSettings.map(({ group, label, description, items }) => (
              <section className="admin-panel admin-content-section" aria-labelledby={`content-group-${group}`} key={group}>
                <div className="admin-panel-heading">
                  <div><h2 className="admin-panel-title" id={`content-group-${group}`}>{label}</h2><p className="admin-panel-caption">{description}</p></div>
                  {items.some((item) => item.dirty) ? <AdminStatusBadge kind="amber" value="Có bản nháp" /> : <AdminStatusBadge kind="green" value="Đã đồng bộ" />}
                </div>
                <div className="admin-settings-grid">
                  {items.map((setting) => (
                    <SettingEditor
                      key={setting.key}
                      setting={setting}
                      canEdit={canEdit}
                      saving={savingKey === setting.key}
                      uploading={uploadingKey === setting.key}
                      publishing={publishingKey === setting.key}
                      hasUnsavedChanges={unsavedKeys.has(setting.key)}
                      onChange={updateDraft}
                      onSave={() => void saveDraft(setting)}
                      onPublish={() => void publish(setting)}
                      onImageUpload={(file) => void uploadImage(setting, file)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
          <LiveStorefrontHandoff />
        </div>
      )}
    </div>
  );
}

function SettingEditor({
  setting,
  canEdit,
  saving,
  uploading,
  publishing,
  hasUnsavedChanges,
  onChange,
  onSave,
  onPublish,
  onImageUpload,
}: {
  setting: AdminSiteSetting;
  canEdit: boolean;
  saving: boolean;
  uploading: boolean;
  publishing: boolean;
  hasUnsavedChanges: boolean;
  onChange: (key: string, value: string) => void;
  onSave: () => void;
  onPublish: () => void;
  onImageUpload: (file: File) => void;
}) {
  const isMultiline = setting.type === "multiline";
  return (
    <div className={`admin-setting-card${setting.dirty ? " is-dirty" : ""}`} data-testid={`setting-card-${setting.key}`}>
      <div className="admin-setting-card-heading">
        <div><label className="admin-label" htmlFor={`setting-${setting.key}`}>{setting.label}</label><p>{setting.description}</p></div>
        {hasUnsavedChanges
          ? <AdminStatusBadge kind="amber" value="Chưa lưu" />
          : setting.dirty
            ? <AdminStatusBadge kind="blue" value="Draft" />
            : <AdminStatusBadge kind="green" value="Published" />}
      </div>
      <div className={`admin-setting-input-wrap${setting.type === "color" ? " is-color" : ""}`}>
        {setting.type === "color" ? <input aria-label={`${setting.label} preview`} className="admin-color-input" disabled={!canEdit} onChange={(event) => onChange(setting.key, event.target.value)} type="color" value={/^#[0-9a-f]{6}$/i.test(setting.draftValue) ? setting.draftValue : "#6cbe45"} /> : null}
        {isMultiline ? (
          <textarea className="admin-textarea" data-testid={`input-setting-${setting.key}`} disabled={!canEdit} id={`setting-${setting.key}`} onChange={(event) => onChange(setting.key, event.target.value)} rows={4} value={setting.draftValue} />
        ) : (
          <input className={`admin-input${setting.type === "color" ? " admin-input-color-value" : ""}`} data-testid={`input-setting-${setting.key}`} disabled={!canEdit} id={`setting-${setting.key}`} onChange={(event) => onChange(setting.key, event.target.value)} type={setting.type === "url" ? "url" : "text"} value={setting.draftValue} />
        )}
      </div>
      {setting.type === "image" ? (
        <label className="admin-setting-upload">
          <span><Upload size={13} /> Upload ảnh vào R2</span>
          <input
            accept="image/jpeg,image/png,image/webp"
            disabled={!canEdit || uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.currentTarget.value = "";
              if (file) onImageUpload(file);
            }}
            type="file"
          />
          <small>{uploading ? "Đang upload và lưu draft..." : "Tối đa 8 MiB · JPEG, PNG, WebP"}</small>
        </label>
      ) : null}
      <div className="admin-setting-meta">
        <span>v{setting.version} · Cập nhật {formatAdminDate(setting.updatedAt)}</span>
        <div className="admin-setting-actions">
          <button className="admin-button admin-button-quiet" data-testid={`button-setting-save-${setting.key}`} disabled={!canEdit || !hasUnsavedChanges || saving} onClick={onSave} type="button"><Save size={13} /> {saving ? "Đang lưu" : "Lưu nháp"}</button>
          <button className="admin-button admin-button-primary" data-testid={`button-setting-publish-${setting.key}`} disabled={!canEdit || hasUnsavedChanges || !setting.dirty || publishing} onClick={onPublish} type="button"><Send size={13} /> {publishing ? "Đang phát hành" : "Phát hành"}</button>
        </div>
      </div>
    </div>
  );
}

function LiveStorefrontHandoff() {
  return (
    <aside className="admin-live-storefront-card" aria-label="Chỉnh sửa trên storefront thật">
      <div className="admin-live-storefront-card-heading">
        <div><div className="admin-kicker">STOREFRONT THẬT</div><h2>Chỉnh sửa tại nơi hiển thị</h2></div>
        <ExternalLink aria-hidden="true" size={17} />
      </div>
      <div className="admin-live-storefront-card-body">
        <p>Trang này quản lý dữ liệu, bản nháp và phát hành. Không dựng một bản xem trước riêng có thể khác với website thật.</p>
        <p>Muốn thấy đúng layout, menu, ảnh và animation, hãy mở storefront thật rồi bấm nút <strong>Sửa</strong> cạnh vùng nội dung khi phiên của bạn có quyền.</p>
      </div>
      <a className="admin-button admin-button-primary admin-live-storefront-card-action" data-testid="link-open-live-storefront" href="/" rel="noreferrer" target="_blank">
        Mở storefront thật
        <ExternalLink aria-hidden="true" size={14} />
      </a>
      <p className="admin-live-storefront-card-note">Bản nháp chỉ nằm trong trung tâm quản trị. Storefront public chỉ đổi sau khi bạn lưu và phát hành.</p>
    </aside>
  );
}
