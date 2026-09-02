"use client";

import { Edit3, Eye, LoaderCircle, Save, Send, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  AdminClientError,
  fetchAdmin,
  mutateAdmin,
  type AdminSiteSetting,
  type AdminSession,
} from "@/lib/admin-client";

import styles from "./AdminVisualEditor.module.css";

interface SiteSettingsResponse {
  canEdit: boolean;
  role: string;
  settings: AdminSiteSetting[];
}

type VisualRegion = "brand" | "home";

const regionDefinitions: Record<VisualRegion, { description: string; keys: string[]; label: string }> = {
  brand: {
    description: "Tên, khẩu hiệu và màu nhận diện dùng chung.",
    keys: ["brand_name", "brand_tagline", "primary_color"],
    label: "Nhận diện thương hiệu",
  },
  home: {
    description: "Hero, lời giới thiệu và các nút hành động trên trang chủ.",
    keys: [
      "hero_eyebrow",
      "hero_title",
      "hero_description",
      "hero_primary_cta_label",
      "hero_primary_cta_url",
      "hero_secondary_cta_label",
      "hero_secondary_cta_url",
      "hero_image_url",
      "about_title",
      "about_description",
    ],
    label: "Nội dung trang chủ",
  },
};

const editableRoles = new Set(["owner", "content_manager"]);

export function AdminVisualEditor({ session }: { session: AdminSession }) {
  const [open, setOpen] = useState(false);
  const [region, setRegion] = useState<VisualRegion>("brand");
  const [settings, setSettings] = useState<AdminSiteSetting[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [localChanges, setLocalChanges] = useState<Set<string>>(new Set());
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const definition = regionDefinitions[region];
  const visibleSettings = useMemo(
    () => definition.keys
      .map((key) => settings.find((setting) => setting.key === key))
      .filter((setting): setting is AdminSiteSetting => Boolean(setting)),
    [definition.keys, settings],
  );
  const hasLocalChanges = visibleSettings.some((setting) => localChanges.has(setting.key));
  const hasDraft = visibleSettings.some((setting) => setting.dirty);

  useEffect(() => {
    if (!editableRoles.has(session.role) || !open || loaded) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void fetchAdmin<SiteSettingsResponse>("/api/admin/site-settings", controller.signal)
      .then((result) => {
        setSettings(result.settings ?? []);
        setLocalChanges(new Set());
        setCanEdit(result.canEdit);
        setLoaded(true);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof AdminClientError ? reason.message : "Không thể tải nội dung draft.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [loaded, open, session.role]);

  useEffect(() => {
    if (!editableRoles.has(session.role) || !open) return;
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeEditor();
        return;
      }
      if (event.key !== "Tab") return;
      const drawer = drawerRef.current;
      if (!drawer) return;
      const focusable = Array.from(drawer.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) {
        event.preventDefault();
        drawer.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !drawer.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !drawer.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, session.role]);

  function closeEditor() {
    setOpen(false);
    window.setTimeout(() => {
      if (restoreFocusRef.current?.isConnected) restoreFocusRef.current?.focus();
      restoreFocusRef.current = null;
    }, 0);
  }

  function openRegion(nextRegion: VisualRegion) {
    if (!open && document.activeElement instanceof HTMLElement) restoreFocusRef.current = document.activeElement;
    setRegion(nextRegion);
    setPreview(false);
    setNotice(null);
    setError(null);
    setOpen(true);
  }

  function updateDraft(key: string, value: string) {
    const currentSetting = settings.find((setting) => setting.key === key);
    setLocalChanges((changes) => {
      const next = new Set(changes);
      if (value === currentSetting?.draftValue) next.delete(key);
      else next.add(key);
      return next;
    });
    setSettings((current) => current.map((setting) => setting.key === key ? { ...setting, draftValue: value } : setting));
    setNotice(null);
    setError(null);
  }

  async function saveDraft() {
    const changed = visibleSettings.filter((setting) => localChanges.has(setting.key));
    if (!canEdit || changed.length === 0) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      let nextSettings = settings;
      for (const setting of changed) {
        const result = await mutateAdmin<{ setting: AdminSiteSetting }>("/api/admin/site-settings", {
          body: {
            expectedVersion: setting.version,
            key: setting.key,
            requestId: crypto.randomUUID(),
            value: setting.draftValue,
          },
          method: "PATCH",
        });
        nextSettings = nextSettings.map((item) => item.key === setting.key ? result.setting : item);
      }
      setSettings(nextSettings);
      setLocalChanges(new Set());
      setNotice("Đã lưu bản nháp. Bạn có thể xem trước hoặc phát hành khi sẵn sàng.");
    } catch (reason: unknown) {
      setError(reason instanceof AdminClientError ? reason.message : "Không thể lưu bản nháp.");
    } finally {
      setSaving(false);
    }
  }

  async function publishDraft() {
    if (!canEdit || hasLocalChanges || !hasDraft) return;
    setPublishing(true);
    setError(null);
    setNotice(null);
    try {
      let nextSettings = settings;
      for (const setting of visibleSettings.filter((item) => item.dirty)) {
        const result = await mutateAdmin<{ setting: AdminSiteSetting }>("/api/admin/site-settings/publish", {
          body: {
            expectedVersion: setting.version,
            key: setting.key,
            requestId: crypto.randomUUID(),
          },
          method: "POST",
        });
        nextSettings = nextSettings.map((item) => item.key === setting.key ? result.setting : item);
      }
      setSettings(nextSettings);
      setNotice("Đã phát hành thay đổi ra storefront công khai.");
    } catch (reason: unknown) {
      setError(reason instanceof AdminClientError ? reason.message : "Không thể phát hành thay đổi.");
    } finally {
      setPublishing(false);
    }
  }

  if (!editableRoles.has(session.role)) return null;

  return (
    <>
      <div aria-label="Vùng storefront có thể chỉnh sửa" className={styles.regionToolbar} data-admin-role={session.role}>
        <span className={styles.regionLabel}>Đang chỉnh sửa storefront</span>
        <button className={styles.regionButton} onClick={() => openRegion("brand")} type="button">
          <Edit3 aria-hidden="true" size={15} /> Nhận diện
        </button>
        <button className={styles.regionButton} onClick={() => openRegion("home")} type="button">
          <Edit3 aria-hidden="true" size={15} /> Nội dung trang chủ
        </button>
      </div>
      {open ? (
        <div className={styles.overlay} onMouseDown={(event) => { if (event.target === event.currentTarget) closeEditor(); }}>
          <aside aria-describedby="admin-visual-editor-description" aria-labelledby="admin-visual-editor-title" aria-modal="true" className={styles.drawer} ref={drawerRef} role="dialog" tabIndex={-1}>
            <div className={styles.header}>
              <div>
                <span className={styles.kicker}>EDITOR TRỰC TIẾP</span>
                <h2 id="admin-visual-editor-title">{definition.label}</h2>
                <p id="admin-visual-editor-description">{definition.description}</p>
              </div>
              <button ref={closeRef} aria-label="Đóng editor" className={styles.iconButton} onClick={closeEditor} type="button"><X aria-hidden="true" size={18} /></button>
            </div>
            <div aria-label="Chọn vùng chỉnh sửa" aria-orientation="horizontal" className={styles.tabs} role="tablist">
              {(Object.keys(regionDefinitions) as VisualRegion[]).map((item) => (
                <button aria-controls={`admin-visual-editor-panel-${item}`} aria-selected={region === item} className={region === item ? styles.tabActive : styles.tab} id={`admin-visual-editor-tab-${item}`} key={item} onClick={() => openRegion(item)} onKeyDown={(event) => {
                  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                  event.preventDefault();
                  const regions = Object.keys(regionDefinitions) as VisualRegion[];
                  const currentIndex = regions.indexOf(item);
                  const nextIndex = event.key === "ArrowRight"
                    ? (currentIndex + 1) % regions.length
                    : (currentIndex - 1 + regions.length) % regions.length;
                  const nextRegion = regions[nextIndex];
                  openRegion(nextRegion);
                  window.setTimeout(() => document.getElementById(`admin-visual-editor-tab-${nextRegion}`)?.focus(), 0);
                }} role="tab" tabIndex={region === item ? 0 : -1} type="button">{regionDefinitions[item].label}</button>
              ))}
            </div>
            <div aria-labelledby={`admin-visual-editor-tab-${region}`} className={styles.panel} id={`admin-visual-editor-panel-${region}`} role="tabpanel" tabIndex={0}>
              {loading ? <div aria-busy="true" aria-label="Đang tải bản nháp" className={styles.loading} role="status"><LoaderCircle className={styles.spinner} size={18} /> Đang tải bản nháp…</div> : null}
              {error ? <div className={styles.error} role="alert">{error}<button onClick={() => { setLoaded(false); setError(null); }} type="button">Tải lại</button></div> : null}
              {!loading && !error && !canEdit && loaded ? <div className={styles.readOnly} role="status">Bạn đang ở chế độ chỉ xem. <Link href="/admin">Mở trung tâm quản trị</Link> để kiểm tra quyền chỉnh sửa.</div> : null}
              {!loading && !error && loaded ? (
                preview ? <DraftPreview settings={settings} /> : (
                  <div className={styles.fields}>
                    {visibleSettings.map((setting) => <SettingField key={setting.key} setting={setting} canEdit={canEdit} onChange={updateDraft} />)}
                  </div>
                )
              ) : null}
              {notice ? <div className={styles.notice} role="status">{notice}</div> : null}
            </div>
            <div className={styles.footer}>
              <button className={styles.secondaryButton} onClick={() => setPreview((value) => !value)} type="button"><Eye size={15} /> {preview ? "Quay lại chỉnh sửa" : "Xem trước draft"}</button>
              {canEdit ? <>
                <button className={styles.secondaryButton} disabled={!hasLocalChanges || saving} onClick={() => void saveDraft()} type="button"><Save size={15} /> {saving ? "Đang lưu…" : "Lưu draft"}</button>
                <button className={styles.primaryButton} disabled={hasLocalChanges || !hasDraft || publishing} onClick={() => void publishDraft()} type="button"><Send size={15} /> {publishing ? "Đang phát hành…" : "Publish"}</button>
              </> : <Link className={styles.secondaryButton} href="/admin">Mở trung tâm quản trị</Link>}
            </div>
            <small className={styles.help}>Thay đổi chỉ xuất hiện công khai sau khi bạn bấm Publish. Nhấn Esc để đóng.</small>
          </aside>
        </div>
      ) : null}
    </>
  );
}

function SettingField({ setting, canEdit, onChange }: { canEdit: boolean; onChange: (key: string, value: string) => void; setting: AdminSiteSetting }) {
  const multiline = setting.type === "multiline";
  return (
    <label className={styles.field}>
      <span>{setting.label}<small>{setting.dirty ? " · Có draft" : " · Đã publish"}</small></span>
      {multiline ? <textarea disabled={!canEdit} onChange={(event) => onChange(setting.key, event.target.value)} value={setting.draftValue} /> : <input disabled={!canEdit} onChange={(event) => onChange(setting.key, event.target.value)} type={setting.type === "color" ? "text" : setting.type} value={setting.draftValue} />}
      <small>{setting.description}</small>
    </label>
  );
}

function DraftPreview({ settings }: { settings: AdminSiteSetting[] }) {
  const value = (key: string) => settings.find((setting) => setting.key === key)?.draftValue ?? "";
  return (
    <div className={styles.preview} aria-label="Xem trước nội dung trang chủ bản nháp">
      <span className={styles.kicker}>DRAFT PREVIEW · TRANG CHỦ</span>
      <strong>{value("brand_name") || "Giacong.vn"}</strong>
      <small>{value("brand_tagline") || value("hero_eyebrow") || "Giải pháp gia công toàn diện"}</small>
      <h3>{value("hero_title") || "Giải pháp gia công toàn diện chuyên nghiệp"}</h3>
      <p>{value("hero_description") || "Nội dung hero bản nháp sẽ hiển thị ở đây."}</p>
      <small>{value("hero_image_url") ? "Ảnh hero: URL tùy chỉnh" : "Ảnh hero: ảnh mặc định"}</small>
      <div className={styles.previewActions}>
        <button type="button">{value("hero_primary_cta_label") || "Xem thêm"}</button>
        <button className={styles.previewSecondaryButton} type="button">{value("hero_secondary_cta_label") || "Liên hệ ngay"}</button>
      </div>
      <div className={styles.previewAbout}>
        <span className={styles.kicker}>PHẦN GIỚI THIỆU</span>
        <h4>{value("about_title") || "Đồng hành cùng doanh nghiệp trong thời đại mới"}</h4>
        <p>{value("about_description") || "Mô tả phần giới thiệu bản nháp sẽ hiển thị ở đây."}</p>
      </div>
    </div>
  );
}
