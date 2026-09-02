"use client";

import { Edit3, LoaderCircle, MousePointer2, Save, Send, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  AdminClientError,
  fetchAdmin,
  mutateAdmin,
  type AdminSiteSetting,
  type AdminSession,
} from "@/lib/admin-client";

import {
  findAdminVisualTarget,
  homepageDirectTargets,
  type AdminVisualDirectTarget,
} from "./admin-visual-targets";
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
  const [directMode, setDirectMode] = useState(() => editableRoles.has(session.role));
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [settings, setSettings] = useState<AdminSiteSetting[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [localChanges, setLocalChanges] = useState<Set<string>>(new Set());
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const directRestoreFocusRef = useRef<HTMLElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const settingsRef = useRef<AdminSiteSetting[]>([]);

  const definition = regionDefinitions[region];
  const visibleSettings = useMemo(
    () => definition.keys
      .map((key) => settings.find((setting) => setting.key === key))
      .filter((setting): setting is AdminSiteSetting => Boolean(setting)),
    [definition.keys, settings],
  );
  const hasLocalChanges = settings.some((setting) => localChanges.has(setting.key));
  const hasDraft = settings.some((setting) => setting.dirty);
  const selectedSetting = selectedKey
    ? settings.find((setting) => setting.key === selectedKey) ?? null
    : null;

  const selectDirectTarget = useCallback((key: string, opener?: HTMLElement | null) => {
    if (opener) directRestoreFocusRef.current = opener;
    setSelectedKey(key);
    setNotice(null);
    setError(null);
  }, []);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    if (!editableRoles.has(session.role) || (!open && !directMode) || loaded) return;
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
  }, [directMode, loaded, open, session.role]);

  useEffect(() => {
    if (!editableRoles.has(session.role) || !canEdit || !directMode || !loaded) return;

    const cleanups: Array<() => void> = [];
    for (const target of homepageDirectTargets) {
      const element = findAdminVisualTarget(document, target);
      if (!element) continue;

      const previousTabIndex = element.getAttribute("tabindex");
      element.dataset.adminDirectTarget = target.key;
      element.classList.add(styles.directTarget);
      if (!previousTabIndex && element.tagName !== "A") element.tabIndex = 0;

      const onClick = (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        const opener = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
        selectDirectTarget(target.key, opener);
      };
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        const opener = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
        selectDirectTarget(target.key, opener);
      };
      element.addEventListener("click", onClick);
      element.addEventListener("keydown", onKeyDown);
      cleanups.push(() => {
        element.removeEventListener("click", onClick);
        element.removeEventListener("keydown", onKeyDown);
        element.classList.remove(styles.directTarget, styles.directTargetSelected);
        delete element.dataset.adminDirectTarget;
        if (previousTabIndex === null) element.removeAttribute("tabindex");
        else element.setAttribute("tabindex", previousTabIndex);
      });
    }

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [canEdit, directMode, loaded, selectDirectTarget, session.role]);

  useEffect(() => {
    if (!editableRoles.has(session.role) || !directMode || !loaded) return;

    for (const target of homepageDirectTargets) {
      const setting = settings.find((item) => item.key === target.key);
      const element = findAdminVisualTarget(document, target);
      if (setting && element) applyDirectSettingValue(element, setting.draftValue, target);
    }
  }, [directMode, loaded, session.role, settings]);

  useEffect(() => {
    if (!editableRoles.has(session.role) || !directMode || !loaded) return;

    for (const target of homepageDirectTargets) {
      const element = findAdminVisualTarget(document, target);
      element?.classList.toggle(styles.directTargetSelected, target.key === selectedKey);
    }
  }, [directMode, loaded, selectedKey, session.role]);

  useEffect(() => {
    if (!editableRoles.has(session.role) || !loaded || directMode) return;
    restorePublishedDirectTargets(settingsRef.current);
  }, [directMode, loaded, session.role]);

  useEffect(() => () => restorePublishedDirectTargets(settingsRef.current), []);

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

  function closeDirectEditor() {
    setSelectedKey(null);
    window.setTimeout(() => {
      if (directRestoreFocusRef.current?.isConnected) directRestoreFocusRef.current.focus();
      directRestoreFocusRef.current = null;
    }, 0);
  }

  function openRegion(nextRegion: VisualRegion) {
    if (!open && document.activeElement instanceof HTMLElement) restoreFocusRef.current = document.activeElement;
    setRegion(nextRegion);
    setNotice(null);
    setError(null);
    setOpen(true);
  }

  function toggleDirectMode() {
    if (directMode) {
      setDirectMode(false);
      setSelectedKey(null);
      return;
    }
    setDirectMode(true);
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
    const changed = settings.filter((setting) => localChanges.has(setting.key));
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
      setNotice("Đã lưu bản nháp. Thay đổi vẫn đang hiển thị trực tiếp ở storefront quản trị.");
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
      for (const setting of settings.filter((item) => item.dirty)) {
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
        <span className={styles.regionLabel}>Chỉnh sửa trực tiếp trên trang</span>
        <button aria-pressed={directMode} className={directMode ? styles.regionButtonActive : styles.regionButton} onClick={toggleDirectMode} type="button">
          <MousePointer2 aria-hidden="true" size={15} /> {directMode ? "Đang bật" : "Bật chỉnh sửa"}
        </button>
        <button className={styles.regionButton} onClick={() => openRegion("brand")} type="button">
          <Edit3 aria-hidden="true" size={15} /> Nhận diện
        </button>
        <button className={styles.regionButton} onClick={() => openRegion("home")} type="button">
          <Edit3 aria-hidden="true" size={15} /> Nội dung trang chủ
        </button>
      </div>
      {directMode ? (
        <div aria-label="Hành động chỉnh sửa trực tiếp" className={styles.directActionBar}>
          <span>
            {loading ? "Đang tải bản nháp…" : localChanges.size > 0
              ? `${localChanges.size} thay đổi chưa lưu`
              : "Bấm vào nội dung trên trang để sửa ngay tại chỗ"}
          </span>
          <button className={styles.secondaryButton} onClick={() => openRegion("home")} type="button">Bảng nội dung</button>
          <button className={styles.secondaryButton} disabled={!hasLocalChanges || saving} onClick={() => void saveDraft()} type="button">
            <Save size={15} /> {saving ? "Đang lưu…" : "Lưu draft"}
          </button>
          <button className={styles.primaryButton} disabled={!canEdit || hasLocalChanges || !hasDraft || publishing} onClick={() => void publishDraft()} type="button">
            <Send size={15} /> {publishing ? "Đang phát hành…" : "Xuất bản"}
          </button>
        </div>
      ) : null}
      {directMode && selectedSetting ? (
        <DirectEditPopover
          setting={selectedSetting}
          target={homepageDirectTargets.find((item) => item.key === selectedSetting.key) ?? null}
          canEdit={canEdit}
          onChange={updateDraft}
          onClose={closeDirectEditor}
        />
      ) : null}
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
                <div className={styles.fields}>
                  {visibleSettings.map((setting) => <SettingField key={setting.key} setting={setting} canEdit={canEdit} onChange={updateDraft} />)}
                </div>
              ) : null}
              {notice ? <div className={styles.notice} role="status">{notice}</div> : null}
            </div>
            <div className={styles.footer}>
              {canEdit ? <>
                <button className={styles.secondaryButton} disabled={!hasLocalChanges || saving} onClick={() => void saveDraft()} type="button"><Save size={15} /> {saving ? "Đang lưu…" : "Lưu draft"}</button>
                <button className={styles.primaryButton} disabled={hasLocalChanges || !hasDraft || publishing} onClick={() => void publishDraft()} type="button"><Send size={15} /> {publishing ? "Đang phát hành…" : "Xuất bản"}</button>
              </> : <Link className={styles.secondaryButton} href="/admin">Mở trung tâm quản trị</Link>}
            </div>
            <small className={styles.help}>Thay đổi hiển thị ngay trên storefront quản trị; chỉ xuất hiện công khai sau khi bạn bấm Xuất bản. Nhấn Esc để đóng.</small>
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

function DirectEditPopover({
  canEdit,
  onChange,
  onClose,
  setting,
  target,
}: {
  canEdit: boolean;
  onChange: (key: string, value: string) => void;
  onClose: () => void;
  setting: AdminSiteSetting;
  target: AdminVisualDirectTarget | null;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!target) return null;
  const multiline = target.inputType === "multiline";
  return (
    <section aria-label={`Đang sửa ${setting.label}`} className={styles.inlineEditor} role="dialog">
      <div className={styles.inlineEditorHeader}>
        <div>
          <span className={styles.kicker}>ĐANG SỬA TRÊN TRANG</span>
          <strong>{setting.label}</strong>
        </div>
        <button aria-label="Đóng chỉnh sửa trực tiếp" className={styles.iconButton} onClick={onClose} type="button"><X aria-hidden="true" size={16} /></button>
      </div>
      <label className={styles.inlineField}>
        <span>{target.label}<small>{setting.dirty ? " · Có draft" : " · Đã publish"}</small></span>
        {multiline ? <textarea autoFocus disabled={!canEdit} onChange={(event) => onChange(setting.key, event.target.value)} value={setting.draftValue} /> : <input autoFocus disabled={!canEdit} onChange={(event) => onChange(setting.key, event.target.value)} type="text" value={setting.draftValue} />}
      </label>
      <small className={styles.inlineHelp}>Bạn đang thay đổi đúng nội dung đang nhìn thấy. Bấm Lưu draft để giữ bản nháp, rồi Xuất bản khi muốn đưa ra công khai.</small>
    </section>
  );
}

function applyDirectSettingValue(element: HTMLElement, value: string, target: AdminVisualDirectTarget): void {
  if (target.inputType !== "multiline") {
    element.textContent = value;
    return;
  }

  const fragments = value.split(/\r?\n/);
  element.replaceChildren(
    ...fragments.flatMap((fragment, index) => index === 0
      ? [document.createTextNode(fragment)]
      : [document.createElement("br"), document.createTextNode(fragment)]),
  );
}

function restorePublishedDirectTargets(settings: AdminSiteSetting[]): void {
  for (const target of homepageDirectTargets) {
    const setting = settings.find((item) => item.key === target.key);
    const element = findAdminVisualTarget(document, target);
    if (setting && element) applyDirectSettingValue(element, setting.publishedValue, target);
  }
}
