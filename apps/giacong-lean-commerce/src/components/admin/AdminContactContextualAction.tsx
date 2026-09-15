"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { AdminConfirmDialog, AdminModal } from "./AdminDialog";
import { useRegisterAdminUnsaved } from "./AdminUnsavedGuard";
import { useAdminVisualContext } from "./AdminVisualMode";
import { AdminClientError, fetchAdmin, mutateAdmin, type AdminSiteSetting } from "@/lib/admin-client";

const editableRoles = new Set(["owner"]);
const contactKeys = [
  "contact_phone",
  "contact_email",
  "contact_address",
  "contact_zalo_url",
  "contact_messenger_url",
] as const;
type ContactKey = (typeof contactKeys)[number];
type ContactSettings = Partial<Record<ContactKey, AdminSiteSetting>>;
type ContactDraft = Record<ContactKey, string>;

const emptyDraft: ContactDraft = {
  contact_address: "",
  contact_email: "",
  contact_messenger_url: "",
  contact_phone: "",
  contact_zalo_url: "",
};

function settingsToDraft(settings: ContactSettings): ContactDraft {
  return contactKeys.reduce((draft, key) => {
    draft[key] = settings[key]?.draftValue ?? "";
    return draft;
  }, { ...emptyDraft });
}

function isDirty(draft: ContactDraft, snapshot: ContactDraft): boolean {
  return contactKeys.some((key) => draft[key] !== snapshot[key]);
}

export function AdminContactContextualAction() {
  const { session, status } = useAdminVisualContext();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<ContactSettings>({});
  const [draft, setDraft] = useState<ContactDraft>({ ...emptyDraft });
  const [snapshot, setSnapshot] = useState<ContactDraft>({ ...emptyDraft });
  const [error, setError] = useState<AdminClientError | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const hasUnsavedChanges = useCallback(() => isDirty(draft, snapshot), [draft, snapshot]);
  useRegisterAdminUnsaved(hasUnsavedChanges, saving);

  const openEditor = useCallback(async () => {
    setOpen(true);
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const result = await fetchAdmin<{ settings: AdminSiteSetting[] }>("/api/admin/site-settings");
      const nextSettings = Object.fromEntries(
        (result.settings ?? [])
          .filter((setting) => (contactKeys as readonly string[]).includes(setting.key))
          .map((setting) => [setting.key, setting]),
      ) as ContactSettings;
      const nextDraft = settingsToDraft(nextSettings);
      setSettings(nextSettings);
      setDraft(nextDraft);
      setSnapshot(nextDraft);
    } catch (reason: unknown) {
      setError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể tải thông tin liên hệ.", 0));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status !== "ready" || !session || !editableRoles.has(session.role)) return;
    const target = document.querySelector<HTMLElement>("#content") ?? document.querySelector<HTMLElement>("main");
    if (!target || target.querySelector("[data-testid='admin-contact-contextual-action']")) return;

    const wrapper = document.createElement("div");
    wrapper.className = "admin-contact-contextual-action";
    wrapper.dataset.testid = "admin-contact-contextual-action";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "admin-contact-contextual-action__button";
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-label", "Sửa thông tin liên hệ");
    button.textContent = "Sửa thông tin liên hệ";
    const handleClick = () => { void openEditor(); };
    button.addEventListener("click", handleClick);
    wrapper.append(button);
    target.prepend(wrapper);
    return () => {
      button.removeEventListener("click", handleClick);
      wrapper.remove();
    };
  }, [openEditor, session, status]);

  if (status !== "ready" || !session || !editableRoles.has(session.role)) return null;

  function resetEditor() {
    setOpen(false);
    setLoading(false);
    setSettings({});
    setDraft({ ...emptyDraft });
    setSnapshot({ ...emptyDraft });
    setError(null);
    setNotice(null);
    setConfirmClose(false);
  }

  function requestClose() {
    if (saving) return;
    if (isDirty(draft, snapshot)) {
      setConfirmClose(true);
      return;
    }
    resetEditor();
  }

  function update(key: ContactKey, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
    setNotice(null);
  }

  async function save(publish: boolean) {
    if (saving) return;
    const changedKeys = contactKeys.filter((key) => draft[key] !== snapshot[key]);
    if (changedKeys.length === 0) {
      setNotice("Không có thay đổi liên hệ cần lưu.");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    let nextSettings = { ...settings };
    try {
      for (const key of changedKeys) {
        const setting = nextSettings[key];
        if (!setting) throw new AdminClientError(`Không tìm thấy thiết lập “${key}”.`, 404);
        const result = await mutateAdmin<{ setting: AdminSiteSetting }>("/api/admin/site-settings", {
          method: "PATCH",
          body: {
            expectedVersion: setting.version,
            key,
            requestId: crypto.randomUUID(),
            value: draft[key],
          },
        });
        nextSettings = { ...nextSettings, [key]: result.setting };
        setSettings(nextSettings);
      }
      if (publish) {
        for (const key of changedKeys) {
          const setting = nextSettings[key];
          if (!setting) continue;
          const result = await mutateAdmin<{ setting: AdminSiteSetting }>("/api/admin/site-settings/publish", {
            method: "POST",
            body: { expectedVersion: setting.version, key, requestId: crypto.randomUUID() },
          });
          nextSettings = { ...nextSettings, [key]: result.setting };
          setSettings(nextSettings);
        }
      }
      const nextDraft = settingsToDraft(nextSettings);
      setDraft(nextDraft);
      setSnapshot(nextDraft);
      setNotice(publish
        ? "Đã lưu và phát hành thông tin liên hệ ra website."
        : "Đã lưu bản nháp liên hệ. Website chưa đổi cho tới khi phát hành.");
      router.refresh();
    } catch (reason: unknown) {
      setError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể lưu thông tin liên hệ.", 0));
      setSettings(nextSettings);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {open ? (
        <AdminModal labelledBy="admin-inline-contact-title" onClose={requestClose} title="Sửa thông tin liên hệ" width="wide">
          <div className="admin-editor" data-testid="admin-inline-contact-editor">
            <div className="admin-editor-heading">
              <div>
                <div className="admin-kicker">Nội dung & thương hiệu / liên hệ</div>
                <h2 className="admin-panel-title" id="admin-inline-contact-title">Thông tin đang dùng trên website</h2>
                <p className="admin-panel-caption">Ô trống vẫn có thể dùng giá trị mặc định. Hãy kiểm tra hiệu lực bên dưới trước khi phát hành.</p>
              </div>
            </div>
            {loading ? <p className="admin-item-meta" role="status">Đang tải thiết lập liên hệ…</p> : null}
            {error ? <p className="admin-editor-error" role="alert">{error.message}</p> : null}
            {notice ? <p className="admin-content-notice" role="status">{notice}</p> : null}
            {!loading && !error ? (
              <div className="admin-editor-grid">
                <ContactField label="Hotline" setting={settings.contact_phone} value={draft.contact_phone} onChange={(value) => update("contact_phone", value)} />
                <ContactField label="Email tư vấn" setting={settings.contact_email} value={draft.contact_email} onChange={(value) => update("contact_email", value)} type="email" />
                <ContactField label="Link Zalo" setting={settings.contact_zalo_url} value={draft.contact_zalo_url} onChange={(value) => update("contact_zalo_url", value)} />
                <ContactField label="Link Messenger" setting={settings.contact_messenger_url} value={draft.contact_messenger_url} onChange={(value) => update("contact_messenger_url", value)} />
                <ContactField label="Địa chỉ" setting={settings.contact_address} value={draft.contact_address} onChange={(value) => update("contact_address", value)} multiline />
              </div>
            ) : null}
            <div className="admin-editor-footer">
              <p className="admin-item-meta">Mọi thay đổi đều kiểm tra phiên bản máy chủ; xung đột sẽ giữ nguyên nội dung bạn đang nhập.</p>
              <div className="admin-editor-actions">
                <button className="admin-button admin-button-quiet" disabled={saving} onClick={requestClose} type="button">Đóng</button>
                <button className="admin-button admin-button-quiet" disabled={saving || loading} onClick={() => void save(false)} type="button">{saving ? "Đang lưu…" : "Lưu bản nháp"}</button>
                <button className="admin-button admin-button-primary" disabled={saving || loading} onClick={() => void save(true)} type="button">Lưu & phát hành</button>
              </div>
            </div>
          </div>
        </AdminModal>
      ) : null}
      {confirmClose ? (
        <AdminConfirmDialog
          cancelLabel="Ở lại"
          confirmLabel="Bỏ thay đổi"
          message="Thông tin liên hệ còn thay đổi chưa lưu. Bỏ thay đổi sẽ mất nội dung đang nhập."
          onConfirm={resetEditor}
          onDismiss={() => setConfirmClose(false)}
          title="Bỏ thay đổi chưa lưu?"
        />
      ) : null}
    </>
  );
}

function ContactField({
  label,
  multiline = false,
  onChange,
  setting,
  type = "text",
  value,
}: {
  label: string;
  multiline?: boolean;
  onChange: (value: string) => void;
  setting?: AdminSiteSetting;
  type?: "email" | "text";
  value: string;
}) {
  const websiteState = setting
    ? setting.isDefaultValue
      ? "giá trị mặc định"
      : "bản đã phát hành"
    : "chưa có dữ liệu";
  const draftState = value.trim()
    ? setting && value === setting.publishedValue
      ? "Bản nháp khớp website."
      : "Bản nháp có thay đổi chưa phát hành."
    : "Bản nháp đang để trống.";

  return (
    <label className="admin-field admin-field-wide">
      <span>{label}</span>
      {multiline ? <textarea className="admin-textarea" onChange={(event) => onChange(event.target.value)} rows={3} value={value} /> : <input className="admin-input" onChange={(event) => onChange(event.target.value)} type={type} value={value} />}
      <small className="admin-item-meta">Website đang dùng: {setting?.effectiveValue || "(trống)"} · {websiteState} {draftState}</small>
    </label>
  );
}
