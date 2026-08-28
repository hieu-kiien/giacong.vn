"use client";

import { Eye, Image as ImageIcon, Palette, RefreshCw, Save, Send, SendHorizonal, ShieldCheck, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
    setPublishingAll(true);
    setNotice(null);
    try {
      const requestId = crypto.randomUUID();
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
    } catch (reason: unknown) {
      setError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể phát hành tất cả thay đổi.", 0));
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
          <ContentPreview settings={settings} />
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
        {setting.type === "color" ? <input aria-label={`${setting.label} preview`} className="admin-color-input" onChange={(event) => onChange(setting.key, event.target.value)} type="color" value={/^#[0-9a-f]{6}$/i.test(setting.draftValue) ? setting.draftValue : "#6cbe45"} /> : null}
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

function ContentPreview({ settings }: { settings: AdminSiteSetting[] }) {
  const value = (key: string) => settings.find((setting) => setting.key === key)?.draftValue ?? "";
  const primary = /^#[0-9a-f]{6}$/i.test(value("primary_color")) ? value("primary_color") : "#6cbe45";
  const accent = /^#[0-9a-f]{6}$/i.test(value("accent_color")) ? value("accent_color") : "#bde875";
  const logo = value("logo_url");
  return (
    <aside className="admin-content-preview" aria-label="Xem trước nhận diện">
      <div className="admin-content-preview-heading"><div><div className="admin-kicker">Live draft preview</div><h2>Nhìn nhanh storefront</h2></div><Eye size={17} /></div>
      <div className="admin-preview-browser">
        <div className="admin-preview-browser-bar"><span /><span /><span /><small>kienhieu.id.vn</small></div>
        <div className="admin-preview-page" style={{ "--preview-primary": primary, "--preview-accent": accent } as React.CSSProperties}>
          <div className="admin-preview-nav">
            <div className="admin-preview-logo">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" src={logo} />
              ) : <span>{value("brand_name").slice(0, 1).toLowerCase() || "g"}. </span>}
              <strong>{value("brand_name") || "Giacong.vn"}</strong>
            </div>
            <span className="admin-preview-menu">Sản phẩm&nbsp;&nbsp; Dịch vụ&nbsp;&nbsp; Liên hệ</span>
          </div>
          <div className="admin-preview-hero">
            <div><small>{value("hero_eyebrow") || "Giacong.vn cung cấp"}</small><h3>{value("hero_title") || "Giải pháp gia công toàn diện chuyên nghiệp"}</h3><p>{value("hero_description") || "Nội dung hero sẽ hiển thị ở đây."}</p><button type="button">{value("hero_primary_cta_label") || "Về chúng tôi"}</button></div>
            <div className="admin-preview-art"><Palette size={26} /><ImageIcon size={21} /></div>
          </div>
          <div className="admin-preview-contact"><strong>{value("contact_phone") || "Hotline"}</strong><span>{value("contact_email") || "Email tư vấn"}</span></div>
        </div>
      </div>
      <p className="admin-content-preview-note">Preview dùng bản nháp để bạn kiểm tra nhận diện trước khi publish.</p>
    </aside>
  );
}
