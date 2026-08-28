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
    description: "Nội dung chính người xem gặp đầu tiên ở trang chủ.",
    keys: ["hero_eyebrow", "hero_title", "hero_description", "hero_primary_cta_label"],
    label: "Hero trang chủ",
  },
};

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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

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
    if (!open || loaded) return;
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
  }, [loaded, open]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function closeEditor() {
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  function openRegion(nextRegion: VisualRegion) {
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

  return (
    <>
      <div className={styles.regionToolbar} aria-label="Vùng storefront có thể chỉnh sửa" data-admin-role={session.role}>
        <span className={styles.regionLabel}>Đang chỉnh sửa storefront</span>
        <button ref={triggerRef} className={styles.regionButton} onClick={() => openRegion("brand")} type="button">
          <Edit3 aria-hidden="true" size={15} /> Nhận diện
        </button>
        <button className={styles.regionButton} onClick={() => openRegion("home")} type="button">
          <Edit3 aria-hidden="true" size={15} /> Hero trang chủ
        </button>
      </div>
      {open ? (
        <div className={styles.overlay} onMouseDown={(event) => { if (event.target === event.currentTarget) closeEditor(); }}>
          <aside aria-label={`Chỉnh sửa ${definition.label}`} aria-modal="true" className={styles.drawer} role="dialog">
            <div className={styles.header}>
              <div>
                <span className={styles.kicker}>EDITOR TRỰC TIẾP</span>
                <h2>{definition.label}</h2>
                <p>{definition.description}</p>
              </div>
              <button ref={closeRef} aria-label="Đóng editor" className={styles.iconButton} onClick={closeEditor} type="button"><X aria-hidden="true" size={18} /></button>
            </div>
            <div className={styles.tabs} role="tablist" aria-label="Chọn vùng chỉnh sửa">
              {(Object.keys(regionDefinitions) as VisualRegion[]).map((item) => (
                <button aria-selected={region === item} className={region === item ? styles.tabActive : styles.tab} key={item} onClick={() => openRegion(item)} role="tab" type="button">{regionDefinitions[item].label}</button>
              ))}
            </div>
            {loading ? <div className={styles.loading} role="status"><LoaderCircle className={styles.spinner} size={18} /> Đang tải bản nháp…</div> : null}
            {error ? <div className={styles.error} role="alert">{error}<button onClick={() => { setLoaded(false); setError(null); }} type="button">Tải lại</button></div> : null}
            {!loading && !error && !canEdit && loaded ? <div className={styles.readOnly} role="status">Bạn đang ở chế độ chỉ xem. <Link href="/admin">Mở trung tâm quản trị</Link> để kiểm tra quyền chỉnh sửa.</div> : null}
            {!loading && !error && loaded ? (
              preview ? <DraftPreview settings={visibleSettings} /> : (
                <div className={styles.fields}>
                  {visibleSettings.map((setting) => <SettingField key={setting.key} setting={setting} canEdit={canEdit} onChange={updateDraft} />)}
                </div>
              )
            ) : null}
            {notice ? <div className={styles.notice} role="status">{notice}</div> : null}
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
    <div className={styles.preview} aria-label="Preview bản nháp">
      <span className={styles.kicker}>DRAFT PREVIEW</span>
      <strong>{value("brand_name") || "Giacong.vn"}</strong>
      <small>{value("brand_tagline") || value("hero_eyebrow") || "Giải pháp gia công toàn diện"}</small>
      <h3>{value("hero_title") || "Giải pháp gia công toàn diện chuyên nghiệp"}</h3>
      <p>{value("hero_description") || "Nội dung hero bản nháp sẽ hiển thị ở đây."}</p>
      <button type="button">{value("hero_primary_cta_label") || "Xem thêm"}</button>
    </div>
  );
}
