"use client";

import { Edit3, LoaderCircle, MousePointer2, Save, Send, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
import { AdminConfirmDialog } from "./AdminDialog";
import { AdminMediaPickerModal } from "./AdminMediaPickerModal";
import { useRegisterAdminUnsaved } from "./AdminUnsavedGuard";

interface SiteSettingsResponse {
  canEdit: boolean;
  role: string;
  settings: AdminSiteSetting[];
}

type VisualRegion = "brand" | "home";

const regionDefinitions: Record<VisualRegion, { description: string; keys: string[]; label: string }> = {
  brand: {
    description: "Tên, khẩu hiệu và màu nhận diện dùng chung.",
    keys: ["brand_name", "brand_tagline", "primary_color", "logo_url"],
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

const editableRoles = new Set(["owner"]);
const supportedKeys = new Set(Object.values(regionDefinitions).flatMap((item) => item.keys));

export function AdminVisualEditor({ session }: { session: AdminSession }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [region, setRegion] = useState<VisualRegion>("brand");
  const [directMode, setDirectMode] = useState(() => editableRoles.has(session.role));
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [settings, setSettings] = useState<AdminSiteSetting[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [confirmation, setConfirmation] = useState<"publish" | "discard" | "reload" | string | null>(null);
  const [mediaKey, setMediaKey] = useState<string | null>(null);
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
  const savedValuesRef = useRef(new Map<string, string>());
  const busyRef = useRef(false);
  const mutationIdsRef = useRef(new Map<string, { signature: string; id: string }>());
  const actionBarRef = useRef<HTMLDivElement>(null);
  const busy = saving || publishing;

  const definition = regionDefinitions[region];
  const visibleSettings = useMemo(
    () => definition.keys
      .map((key) => settings.find((setting) => setting.key === key))
      .filter((setting): setting is AdminSiteSetting => Boolean(setting)),
    [definition.keys, settings],
  );
  const hasLocalChanges = settings.some((setting) => localChanges.has(setting.key));
  const publishable = settings.filter((setting) => supportedKeys.has(setting.key) && setting.dirty);
  const hasDraft = publishable.length > 0;
  useRegisterAdminUnsaved(useCallback(() => hasLocalChanges, [hasLocalChanges]), busy);
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
    function protectNavigation(event: MouseEvent) {
      if ((!hasLocalChanges && !busy) || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("[data-admin-direct-target]")) return;
      const link = target?.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.target === "_blank" || link.getAttribute("href")?.startsWith("#")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (busy) setError("Đang lưu thay đổi. Vui lòng chờ trước khi rời trang.");
      else setConfirmation(link.href);
    }
    document.addEventListener("click", protectNavigation, true);
    return () => document.removeEventListener("click", protectNavigation, true);
  }, [hasLocalChanges, busy]);

  useEffect(() => {
    const bar = actionBarRef.current;
    if (!bar) return;
    const measure = () => document.documentElement.style.setProperty("--admin-visual-action-height", `${bar.getBoundingClientRect().height}px`);
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    measure();
    return () => { observer.disconnect(); document.documentElement.style.removeProperty("--admin-visual-action-height"); };
  }, [directMode]);

  useEffect(() => {
    if (!editableRoles.has(session.role) || (!open && !directMode) || loaded) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void fetchAdmin<SiteSettingsResponse>("/api/admin/site-settings", controller.signal)
      .then((result) => {
        setSettings(result.settings ?? []);
        savedValuesRef.current = new Map((result.settings ?? []).map((setting) => [setting.key, setting.draftValue]));
        setLocalChanges(new Set());
        setCanEdit(result.canEdit);
        setLoaded(true);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof AdminClientError ? reason.message : "Không thể tải bản nháp.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [directMode, loaded, open, session.role, loadAttempt]);

  useEffect(() => {
    if (!editableRoles.has(session.role) || !canEdit || !directMode || !loaded) return;

    const cleanups: Array<() => void> = [];
    for (const target of homepageDirectTargets) {
      const element = findAdminVisualTarget(document, target);
      if (!element) continue;

      const previousTabIndex = element.getAttribute("tabindex");
      const previousTitle = element.getAttribute("title");
      element.title = `Chỉnh sửa: ${target.label}`;
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
        if (previousTitle === null) element.removeAttribute("title");
        else element.setAttribute("title", previousTitle);
        if (previousTabIndex === null) element.removeAttribute("tabindex");
        else element.setAttribute("tabindex", previousTabIndex);
      });
    }

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [canEdit, directMode, loaded, selectDirectTarget, session.role, pathname]);

  useEffect(() => {
    if (!editableRoles.has(session.role) || !directMode || !loaded) return;

    for (const target of homepageDirectTargets) {
      const setting = settings.find((item) => item.key === target.key);
      const element = findAdminVisualTarget(document, target);
      if (setting && element) applyDirectSettingValue(element, setting.draftValue, target);
    }
  }, [directMode, loaded, session.role, settings, pathname]);

  useEffect(() => {
    if (!editableRoles.has(session.role) || !directMode || !loaded) return;

    for (const target of homepageDirectTargets) {
      const element = findAdminVisualTarget(document, target);
      element?.classList.toggle(styles.directTargetSelected, target.key === selectedKey);
    }
  }, [directMode, loaded, selectedKey, session.role, pathname]);

  useEffect(() => {
    if (!editableRoles.has(session.role) || !loaded || directMode) return;
    restorePublishedDirectTargets(settingsRef.current);
  }, [directMode, loaded, session.role]);

  useEffect(() => () => restorePublishedDirectTargets(settingsRef.current), []);

  useEffect(() => {
    if (!editableRoles.has(session.role) || !open || confirmation || mediaKey) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
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
    return () => { document.removeEventListener("keydown", onKeyDown); document.body.style.overflow = previousOverflow; };
  }, [open, session.role, confirmation, mediaKey]);

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
    setSelectedKey(null);
    setOpen(true);
  }

  function toggleDirectMode() {
    if (busy) return;
    if (directMode) {
      setDirectMode(false);
      setSelectedKey(null);
      return;
    }
    setDirectMode(true);
  }

  function updateDraft(key: string, value: string) {
    if (busyRef.current) return;
    setLocalChanges((changes) => {
      const next = new Set(changes);
      if (value === savedValuesRef.current.get(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setSettings((current) => current.map((setting) => setting.key === key ? { ...setting, draftValue: value } : setting));
    setNotice(null);
    setError(null);
  }

  async function saveDraft() {
    const changed = settings.filter((setting) => localChanges.has(setting.key));
    if (!canEdit || changed.length === 0 || busyRef.current) return;
    busyRef.current = true;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      for (const setting of changed) {
        const result = await mutateAdmin<{ setting: AdminSiteSetting }>("/api/admin/site-settings", {
          body: {
            expectedVersion: setting.version,
            key: setting.key,
            requestId: mutationRequestId("save", setting),
            value: setting.draftValue,
          },
          method: "PATCH",
        });
        savedValuesRef.current.set(setting.key, result.setting.draftValue);
        mutationIdsRef.current.delete(`save:${setting.key}`);
        setSettings((current) => current.map((item) => item.key === setting.key ? result.setting : item));
        setLocalChanges((current) => { const next = new Set(current); next.delete(setting.key); return next; });
      }
      setNotice("Đã lưu bản nháp. Bấm Xuất bản để cập nhật website.");
    } catch (reason: unknown) {
      setError(reason instanceof AdminClientError ? reason.message : "Không thể lưu bản nháp.");
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  }

  async function publishDraft() {
    if (!canEdit || hasLocalChanges || !hasDraft || busyRef.current) return;
    busyRef.current = true;
    setPublishing(true);
    setError(null);
    setNotice(null);
    try {
      for (const setting of publishable) {
        const result = await mutateAdmin<{ setting: AdminSiteSetting }>("/api/admin/site-settings/publish", {
          body: {
            expectedVersion: setting.version,
            key: setting.key,
            requestId: mutationRequestId("publish", setting),
          },
          method: "POST",
        });
        savedValuesRef.current.set(setting.key, result.setting.draftValue);
        mutationIdsRef.current.delete(`publish:${setting.key}`);
        setSettings((current) => current.map((item) => item.key === setting.key ? result.setting : item));
      }
      setNotice("Đã xuất bản thay đổi lên website.");
    } catch (reason: unknown) {
      setError(reason instanceof AdminClientError ? reason.message : "Không thể phát hành thay đổi.");
    } finally {
      busyRef.current = false;
      setPublishing(false);
    }
  }

  function mutationRequestId(operation: string, setting: AdminSiteSetting): string {
    const key = `${operation}:${setting.key}`;
    const signature = JSON.stringify([setting.version, setting.draftValue]);
    const previous = mutationIdsRef.current.get(key);
    if (previous?.signature === signature) return previous.id;
    const id = crypto.randomUUID();
    mutationIdsRef.current.set(key, { signature, id });
    return id;
  }

  async function uploadImage(key: string, file: File) {
    const setting = settings.find((item) => item.key === key);
    if (!canEdit || !setting || busyRef.current) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size === 0 || file.size > 8 * 1024 * 1024) {
      setError("Chọn ảnh JPEG, PNG hoặc WebP, tối đa 8 MB.");
      return;
    }
    busyRef.current = true;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("key", key);
      form.set("expectedVersion", String(setting.version));
      form.set("requestId", crypto.randomUUID());
      const response = await fetch("/api/admin/site-settings/media", { method: "POST", body: form, credentials: "same-origin" });
      const body = await response.json() as { ok?: boolean; data?: { setting: AdminSiteSetting }; message?: string; code?: string };
      if (!response.ok || !body.ok || !body.data) throw new AdminClientError(body.message ?? "Không thể tải ảnh lên.", response.status, body.code);
      const next = body.data.setting;
      savedValuesRef.current.set(key, next.draftValue);
      setSettings((current) => current.map((item) => item.key === key ? next : item));
      setLocalChanges((current) => { const remaining = new Set(current); remaining.delete(key); return remaining; });
      setNotice("Đã tải ảnh và lưu bản nháp. Bấm Xuất bản để cập nhật website.");
    } catch (reason: unknown) {
      setError(reason instanceof AdminClientError ? reason.message : "Không thể tải ảnh lên. Nội dung đang sửa được giữ lại.");
    } finally { busyRef.current = false; setSaving(false); }
  }

  function reloadSettings() {
    if (busyRef.current) return;
    setLoaded(false);
    setLoadAttempt((attempt) => attempt + 1);
    setError(null);
  }

  function discardChanges() {
    setSettings((current) => current.map((setting) => ({ ...setting, draftValue: savedValuesRef.current.get(setting.key) ?? setting.draftValue })));
    setLocalChanges(new Set());
    setNotice("Đã bỏ thay đổi chưa lưu. Bản nháp đã lưu được giữ lại.");
    setError(null);
  }

  if (!editableRoles.has(session.role)) return null;

  return (
    <>
      <div aria-label="Vùng trang web có thể chỉnh sửa" className={styles.regionToolbar} data-admin-role={session.role}>
        <span className={styles.regionLabel}>Chỉnh sửa trực tiếp trên trang</span>
        <button aria-pressed={directMode} disabled={busy} className={directMode ? styles.regionButtonActive : styles.regionButton} onClick={toggleDirectMode} type="button">
          <MousePointer2 aria-hidden="true" size={15} /> {directMode ? "Xem bản đã đăng" : "Bật chỉnh sửa"}
        </button>
        <button className={styles.regionButton} onClick={() => openRegion("brand")} type="button">
          <Edit3 aria-hidden="true" size={15} /> Nhận diện
        </button>
        <button className={styles.regionButton} onClick={() => openRegion("home")} type="button">
          <Edit3 aria-hidden="true" size={15} /> Nội dung trang chủ
        </button>
      </div>
      {directMode ? (
        <div aria-label="Hành động chỉnh sửa trực tiếp" className={styles.directActionBar} ref={actionBarRef}>
          <span>
            {loading ? "Đang tải bản nháp…" : localChanges.size > 0
              ? `${localChanges.size} thay đổi chưa lưu`
              : hasDraft ? `${publishable.length} mục đã lưu nháp, chưa xuất bản` : "Bấm vào nội dung trên trang để sửa ngay tại chỗ"}
          </span>
          <button className={styles.secondaryButton} onClick={() => openRegion("home")} type="button">Bảng nội dung</button>
          <button className={styles.secondaryButton} disabled={!canEdit || !hasLocalChanges || busy} onClick={() => void saveDraft()} type="button">
            <Save size={15} /> {saving ? "Đang lưu…" : "Lưu bản nháp"}
          </button>
          <button className={styles.primaryButton} disabled={!canEdit || hasLocalChanges || !hasDraft || busy} onClick={() => setConfirmation("publish")} type="button">
            <Send size={15} /> {publishing ? "Đang phát hành…" : "Xuất bản"}
          </button>
          {hasLocalChanges ? <button className={styles.secondaryButton} disabled={busy} onClick={() => setConfirmation("discard")} type="button">Bỏ thay đổi</button> : null}
          {!open && error ? <div className={styles.error} role="alert">{error}<button disabled={busy} onClick={() => hasLocalChanges ? setConfirmation("reload") : reloadSettings()} type="button">Tải lại dữ liệu</button></div> : null}
          {!open && notice ? <div className={styles.notice} role="status">{notice}</div> : null}
        </div>
      ) : null}
      {directMode && selectedSetting && !confirmation && !mediaKey ? (
        <DirectEditPopover
          key={selectedSetting.key}
          setting={selectedSetting}
          target={homepageDirectTargets.find((item) => item.key === selectedSetting.key) ?? null}
          canEdit={canEdit && !busy}
          onPickImage={() => setMediaKey(selectedSetting.key)}
          onUpload={(file) => void uploadImage(selectedSetting.key, file)}
          linkSetting={selectedSetting.key.endsWith("cta_label") ? settings.find((item) => item.key === selectedSetting.key.replace(/_label$/, "_url")) : undefined}
          onChange={updateDraft}
          onClose={closeDirectEditor}
        />
      ) : null}
      {open ? (
        <div className={styles.overlay} onMouseDown={(event) => { if (event.target === event.currentTarget) closeEditor(); }}>
          <aside aria-describedby="admin-visual-editor-description" aria-labelledby="admin-visual-editor-title" aria-modal="true" className={styles.drawer} ref={drawerRef} role="dialog" tabIndex={-1}>
            <div className={styles.header}>
              <div>
                <span className={styles.kicker}>TRÌNH SỬA TRỰC TIẾP</span>
                <h2 id="admin-visual-editor-title">{definition.label}</h2>
                <p id="admin-visual-editor-description">{definition.description}</p>
              </div>
              <button ref={closeRef} aria-label="Đóng trình sửa" className={styles.iconButton} onClick={closeEditor} type="button"><X aria-hidden="true" size={18} /></button>
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
              {error ? <div className={styles.error} role="alert">{error}<button disabled={busy} onClick={() => hasLocalChanges ? setConfirmation("reload") : reloadSettings()} type="button">Tải lại dữ liệu</button></div> : null}
              {!loading && !error && !canEdit && loaded ? <div className={styles.readOnly} role="status">Bạn đang ở chế độ chỉ xem. <Link href="/admin">Mở trung tâm quản trị</Link> để kiểm tra quyền chỉnh sửa.</div> : null}
              {!loading && loaded ? (
                <div className={styles.fields}>
                  {visibleSettings.map((setting) => <SettingField key={setting.key} setting={setting} canEdit={canEdit && !busy} onChange={updateDraft} onPickImage={() => setMediaKey(setting.key)} onUpload={(file) => void uploadImage(setting.key, file)} />)}
                </div>
              ) : null}
              {notice ? <div className={styles.notice} role="status">{notice}</div> : null}
            </div>
            <div className={styles.footer}>
              {canEdit ? <>
                <button className={styles.secondaryButton} disabled={!hasLocalChanges || busy} onClick={() => void saveDraft()} type="button"><Save size={15} /> {saving ? "Đang lưu…" : "Lưu bản nháp"}</button>
                <button className={styles.primaryButton} disabled={hasLocalChanges || !hasDraft || busy} onClick={() => setConfirmation("publish")} type="button"><Send size={15} /> {publishing ? "Đang phát hành…" : "Xuất bản"}</button>
              </> : <Link className={styles.secondaryButton} href="/admin">Mở trung tâm quản trị</Link>}
            </div>
            <small className={styles.help}>Thay đổi hiển thị ngay trên trang xem thử dành cho quản trị; chỉ xuất hiện công khai sau khi bạn bấm Xuất bản. Nhấn Esc để đóng.</small>
          </aside>
        </div>
      ) : null}
      <div className={styles.dialogScope}>
        {mediaKey ? <AdminMediaPickerModal onClose={() => setMediaKey(null)} onSelect={(url) => { updateDraft(mediaKey, url); setMediaKey(null); }} /> : null}
        {confirmation ? <AdminConfirmDialog
          title={confirmation === "publish" ? "Xuất bản thay đổi?" : confirmation === "discard" || confirmation === "reload" ? "Bỏ thay đổi chưa lưu?" : "Rời trang đang sửa?"}
          message={confirmation === "publish" ? `Cập nhật ${publishable.length} mục lên website: ${publishable.map((setting) => setting.label).join(", ")}.` : "Nội dung đang sửa chưa được lưu. Bản nháp đã lưu trước đó vẫn được giữ lại."}
          cancelLabel="Ở lại"
          confirmLabel={confirmation === "publish" ? "Xuất bản" : confirmation === "reload" ? "Bỏ thay đổi và tải lại" : "Bỏ thay đổi"}
          confirmKind={confirmation === "publish" ? "primary" : "danger"}
          onDismiss={() => setConfirmation(null)}
          onConfirm={() => {
            if (confirmation === "publish") void publishDraft();
            else if (confirmation === "reload") { discardChanges(); reloadSettings(); }
            else if (confirmation === "discard") discardChanges();
            else { discardChanges(); window.setTimeout(() => window.location.assign(confirmation), 0); }
          }}
        /> : null}
      </div>
    </>
  );
}

function SettingField({ setting, canEdit, onChange, onPickImage, onUpload }: { canEdit: boolean; onChange: (key: string, value: string) => void; onPickImage: () => void; onUpload: (file: File) => void; setting: AdminSiteSetting }) {
  const multiline = setting.type === "multiline";
  return (
    <div className={styles.field}>
      <label>
      <span>{setting.label}<small>{setting.dirty ? " · Có bản nháp" : " · Đã đăng"}</small></span>
      {multiline ? <textarea disabled={!canEdit} onChange={(event) => onChange(setting.key, event.target.value)} value={setting.draftValue} /> : <input disabled={!canEdit} onChange={(event) => onChange(setting.key, event.target.value)} type={setting.type === "color" ? "color" : "text"} value={setting.draftValue} />}
      </label>
      {setting.type === "image" ? <button className={styles.secondaryButton} disabled={!canEdit} onClick={onPickImage} type="button">Chọn ảnh từ thư viện</button> : null}
      {setting.type === "image" ? <ImageUploadField disabled={!canEdit} onUpload={onUpload} /> : null}
      <small>{setting.description}</small>
    </div>
  );
}

function DirectEditPopover({
  canEdit,
  onChange,
  onClose,
  setting,
  target,
  onPickImage,
  linkSetting,
  onUpload,
}: {
  canEdit: boolean;
  onChange: (key: string, value: string) => void;
  onClose: () => void;
  setting: AdminSiteSetting;
  target: AdminVisualDirectTarget | null;
  onPickImage: () => void;
  linkSetting?: AdminSiteSetting;
  onUpload: (file: File) => void;
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
        <span>{target.label}<small>{setting.dirty ? " · Có bản nháp" : " · Đã đăng"}</small></span>
        {multiline ? <textarea autoFocus disabled={!canEdit} onChange={(event) => onChange(setting.key, event.target.value)} value={setting.draftValue} /> : <input autoFocus disabled={!canEdit} onChange={(event) => onChange(setting.key, event.target.value)} type="text" value={setting.draftValue} />}
      </label>
      {target.inputType === "image" ? <button className={styles.secondaryButton} disabled={!canEdit} onClick={onPickImage} type="button">Chọn ảnh từ thư viện</button> : null}
      {target.inputType === "image" ? <ImageUploadField disabled={!canEdit} onUpload={onUpload} /> : null}
      {linkSetting ? <label className={styles.inlineField}><span>Đường dẫn khi bấm nút</span><input disabled={!canEdit} onChange={(event) => onChange(linkSetting.key, event.target.value)} type="text" value={linkSetting.draftValue} /></label> : null}
      <small className={styles.inlineHelp}>Bạn đang thay đổi đúng nội dung đang nhìn thấy. Bấm Lưu bản nháp để giữ, rồi Xuất bản khi muốn đưa ra công khai.</small>
    </section>
  );
}

const originalDirectImages = new WeakMap<HTMLImageElement, { src: string | null; srcset: string | null; sizes: string | null }>();

function ImageUploadField({ disabled, onUpload }: { disabled: boolean; onUpload: (file: File) => void }) {
  return <label className={styles.inlineField}>
    <span>Tải ảnh từ máy</span>
    <input accept="image/jpeg,image/png,image/webp" disabled={disabled} type="file" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) onUpload(file); }} />
    <small className={styles.inlineHelp}>JPEG, PNG, WebP · tối đa 8 MB. Ảnh tải lên được lưu thành bản nháp.</small>
  </label>;
}

function applyDirectSettingValue(element: HTMLElement, value: string, target: AdminVisualDirectTarget): void {
  if (target.inputType === "image") {
    if (!(element instanceof HTMLImageElement)) return;
    if (!originalDirectImages.has(element)) originalDirectImages.set(element, { src: element.getAttribute("src"), srcset: element.getAttribute("srcset"), sizes: element.getAttribute("sizes") });
    if (!value) {
      const original = originalDirectImages.get(element)!;
      for (const [name, attribute] of Object.entries(original)) {
        if (attribute === null) element.removeAttribute(name);
        else element.setAttribute(name, attribute);
      }
      return;
    }
    const safe = value.startsWith("/") && !value.startsWith("//") || /^https:\/\//i.test(value);
    if (!safe) return;
    element.removeAttribute("srcset");
    element.removeAttribute("sizes");
    element.src = value;
    return;
  }
  if (target.inputType === "url") {
    if (value.startsWith("/") && !value.startsWith("//") || /^https:\/\//i.test(value)) element.setAttribute("href", value);
    return;
  }
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
