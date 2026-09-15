"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";

import { AdminConfirmDialog, AdminModal } from "./AdminDialog";
import { AdminMediaPickerModal } from "./AdminMediaPickerModal";
import { useRegisterAdminUnsaved } from "./AdminUnsavedGuard";
import { useAdminVisualContext } from "./AdminVisualMode";
import { AdminClientError, mutateAdmin, type AdminService } from "@/lib/admin-client";
import { parseAdminServicePayload } from "@/lib/admin-service-input";

const editableRoles = new Set(["owner"]);

type InlineServiceCreateForm = {
  ctaHref: string;
  ctaLabel: string;
  description: string;
  imageUrl: string;
  isActive: boolean;
  leadTimeDays: string;
  moqSummary: string;
  name: string;
  offeringsText: string;
  sortOrder: string;
  slug: string;
  status: string;
  summary: string;
};

const emptyForm: InlineServiceCreateForm = {
  ctaHref: "/lien-he/",
  ctaLabel: "Liên hệ tư vấn",
  description: "",
  imageUrl: "",
  isActive: false,
  leadTimeDays: "",
  moqSummary: "",
  name: "",
  offeringsText: "",
  sortOrder: "",
  slug: "",
  status: "draft",
  summary: "",
};

function parseOfferingLines(value: string): Array<{ href: string; label: string }> {
  return value.split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf("|");
      if (separator < 0) return { href: "", label: line };
      return { href: line.slice(separator + 1).trim(), label: line.slice(0, separator).trim() };
    });
}

function isDirty(form: InlineServiceCreateForm | null, snapshot: InlineServiceCreateForm | null): boolean {
  return Boolean(form && snapshot && JSON.stringify(form) !== JSON.stringify(snapshot));
}

export function AdminServiceCreateContextualAction() {
  const { session, status } = useAdminVisualContext();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<InlineServiceCreateForm | null>(null);
  const [snapshot, setSnapshot] = useState<InlineServiceCreateForm | null>(null);
  const [createdService, setCreatedService] = useState<AdminService | null>(null);
  const [error, setError] = useState<AdminClientError | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const hasUnsavedChanges = useCallback(() => isDirty(form, snapshot), [form, snapshot]);
  useRegisterAdminUnsaved(hasUnsavedChanges, saving);

  if (status !== "ready" || !session || !editableRoles.has(session.role)) return null;

  function resetEditor() {
    setOpen(false);
    setForm(null);
    setSnapshot(null);
    setCreatedService(null);
    setError(null);
    setFieldErrors({});
    setNotice(null);
    setPickerOpen(false);
    setConfirmClose(false);
  }

  function requestClose() {
    if (saving) return;
    if (isDirty(form, snapshot)) {
      setConfirmClose(true);
      return;
    }
    resetEditor();
  }

  function openEditor() {
    const next = { ...emptyForm };
    setOpen(true);
    setForm(next);
    setSnapshot(next);
    setCreatedService(null);
    setError(null);
    setFieldErrors({});
    setNotice(null);
  }

  function update<K extends keyof InlineServiceCreateForm>(key: K, value: InlineServiceCreateForm[K]) {
    setForm((current) => current ? { ...current, [key]: value } : current);
    setNotice(null);
    setError(null);
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || saving) return;
    const requestId = crypto.randomUUID();
    const payload = {
      ctaHref: form.ctaHref.trim() || null,
      ctaLabel: form.ctaLabel.trim() || null,
      description: form.description,
      imageUrl: form.imageUrl.trim() || null,
      isActive: form.isActive,
      leadTimeDays: form.leadTimeDays === "" ? null : Number(form.leadTimeDays),
      moqSummary: form.moqSummary.trim() || null,
      name: form.name,
      requestId,
      offerings: parseOfferingLines(form.offeringsText),
      sortOrder: form.sortOrder === "" ? null : Number(form.sortOrder),
      slug: form.slug,
      status: form.status,
      summary: form.summary,
    };
    const parsed = parseAdminServicePayload(payload);
    setFieldErrors(parsed.fieldErrors);
    setError(null);
    setNotice(null);
    if (!parsed.input) {
      setError(new AdminClientError("Dữ liệu dịch vụ chưa hợp lệ.", 422, "VALIDATION_ERROR", parsed.fieldErrors));
      return;
    }

    setSaving(true);
    try {
      const result = await mutateAdmin<{ service: AdminService }>("/api/admin/services", {
        body: payload,
        method: "POST",
      });
      setCreatedService(result.service);
      setForm(null);
      setSnapshot(null);
      setFieldErrors({});
      setNotice("Đã lưu bản nháp dịch vụ. Dịch vụ chưa xuất hiện công khai cho tới khi được xuất bản và bật hiển thị.");
      router.refresh();
    } catch (reason: unknown) {
      const clientError = reason instanceof AdminClientError
        ? reason
        : new AdminClientError("Không thể lưu dịch vụ.", 0);
      setError(clientError);
      setFieldErrors(clientError.fieldErrors ?? {});
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        aria-haspopup="dialog"
        aria-label="Thêm dịch vụ"
        className="inline-flex min-h-9 items-center justify-center rounded-commerce-control border border-commerce-brand px-3 text-[11px] font-bold text-commerce-brand-dark hover:bg-commerce-active-surface focus-visible:commerce-focus-ring"
        data-testid="admin-service-create-contextual-action"
        onClick={openEditor}
        type="button"
      >
        Thêm dịch vụ
      </button>

      {open ? (
        <AdminModal labelledBy="admin-inline-service-create-title" onClose={requestClose} title="Thêm dịch vụ" width="wide">
          <div className="admin-editor" data-testid="admin-inline-service-create-editor">
            <div className="admin-editor-heading">
              <div>
                <div className="admin-kicker">Dịch vụ / tạo mới</div>
                <h2 className="admin-panel-title" id="admin-inline-service-create-title">Dịch vụ mới</h2>
                <p className="admin-panel-caption">Lưu bản nháp trước; chỉ dịch vụ đã xuất bản và bật hiển thị mới xuất hiện trên website.</p>
              </div>
              <span className="admin-stamp">BẢN GHI MỚI</span>
            </div>

            {error ? <div className="admin-editor-error" role="alert"><p>{error.message}</p></div> : null}
            {notice ? <p className="admin-content-notice" role="status">{notice}</p> : null}

            {createdService ? (
              <div className="admin-modal-footer" data-testid="admin-inline-service-create-success">
                <p className="admin-item-meta">Mã dịch vụ: <strong>{createdService.id}</strong> · {createdService.name}</p>
                <div className="admin-editor-actions">
                  <Link className="admin-button admin-button-quiet" href={`/admin/dich-vu?edit=${createdService.id}`} prefetch={false}>Mở quản trị đầy đủ</Link>
                  <button className="admin-button admin-button-primary" onClick={resetEditor} type="button">Đóng</button>
                </div>
              </div>
            ) : form ? (
              <form noValidate onSubmit={(event) => void submit(event)}>
                <div className="admin-editor-grid">
                  <label className="admin-field">
                    <span>Tên dịch vụ <b aria-hidden="true">*</b></span>
                    <input className="admin-input" disabled={saving} onChange={(event) => update("name", event.target.value)} required value={form.name} />
                    {fieldErrors.name ? <small className="admin-field-error">{fieldErrors.name}</small> : null}
                  </label>
                  <label className="admin-field">
                    <span>Đường dẫn (slug) <b aria-hidden="true">*</b></span>
                    <input className="admin-input admin-mono" disabled={saving} onChange={(event) => update("slug", event.target.value)} required value={form.slug} />
                    {fieldErrors.slug ? <small className="admin-field-error">{fieldErrors.slug}</small> : null}
                  </label>
                  <label className="admin-field">
                    <span>Trạng thái</span>
                    <input className="admin-input" disabled value="Bản nháp" />
                    <small className="admin-item-meta">Shortcut này chỉ tạo bản nháp. Mở quản trị đầy đủ sau khi lưu để kiểm tra và xuất bản.</small>
                    {fieldErrors.status ? <small className="admin-field-error">{fieldErrors.status}</small> : null}
                  </label>
                  <label className="admin-field">
                    <span>Thời gian làm hàng (ngày)</span>
                    <input className="admin-input admin-mono" disabled={saving} inputMode="numeric" min="0" onChange={(event) => update("leadTimeDays", event.target.value)} type="number" value={form.leadTimeDays} />
                    {fieldErrors.leadTimeDays ? <small className="admin-field-error">{fieldErrors.leadTimeDays}</small> : null}
                  </label>
                  <label className="admin-field admin-field-wide">
                    <span>Số lượng tối thiểu</span>
                    <input className="admin-input" disabled={saving} onChange={(event) => update("moqSummary", event.target.value)} placeholder="Ví dụ: từ 500 kg / mẻ" value={form.moqSummary} />
                    {fieldErrors.moqSummary ? <small className="admin-field-error">{fieldErrors.moqSummary}</small> : null}
                  </label>
                  <label className="admin-field admin-field-wide">
                    <span>Ảnh chính</span>
                    <div className="admin-input-actions">
                      <input className="admin-input" disabled={saving} onChange={(event) => update("imageUrl", event.target.value)} placeholder="/media/services/... hoặc https://..." value={form.imageUrl} />
                      <button className="admin-button admin-button-quiet" disabled={saving} onClick={() => setPickerOpen(true)} type="button">Chọn từ thư viện</button>
                    </div>
                    {fieldErrors.imageUrl ? <small className="admin-field-error">{fieldErrors.imageUrl}</small> : null}
                    {pickerOpen ? (
                      <AdminMediaPickerModal
                        onClose={() => setPickerOpen(false)}
                        onSelect={(publicUrl) => {
                          update("imageUrl", publicUrl);
                          setPickerOpen(false);
                        }}
                      />
                    ) : null}
                  </label>
                  <label className="admin-field admin-field-wide">
                    <span>Dịch vụ trong nhóm</span>
                    <textarea className="admin-textarea admin-mono" disabled={saving} onChange={(event) => update("offeringsText", event.target.value)} placeholder="Tên hiển thị | /đường-dẫn/" rows={6} value={form.offeringsText} />
                    <small className="admin-item-meta">Mỗi dòng một mục; thứ tự từ trên xuống sẽ là thứ tự ngoài website.</small>
                    {fieldErrors.offerings ? <small className="admin-field-error">{fieldErrors.offerings}</small> : null}
                  </label>
                  <label className="admin-field">
                    <span>Nhãn nút liên hệ</span>
                    <input className="admin-input" disabled={saving} onChange={(event) => update("ctaLabel", event.target.value)} value={form.ctaLabel} />
                    {fieldErrors.ctaLabel ? <small className="admin-field-error">{fieldErrors.ctaLabel}</small> : null}
                  </label>
                  <label className="admin-field">
                    <span>Đường dẫn nút liên hệ</span>
                    <input className="admin-input admin-mono" disabled={saving} onChange={(event) => update("ctaHref", event.target.value)} value={form.ctaHref} />
                    {fieldErrors.ctaHref ? <small className="admin-field-error">{fieldErrors.ctaHref}</small> : null}
                  </label>
                  <label className="admin-field">
                    <span>Thứ tự nhóm</span>
                    <input className="admin-input admin-mono" disabled={saving} inputMode="numeric" min="0" onChange={(event) => update("sortOrder", event.target.value)} type="number" value={form.sortOrder} />
                    {fieldErrors.sortOrder ? <small className="admin-field-error">{fieldErrors.sortOrder}</small> : null}
                  </label>
                  <label className="admin-field admin-field-wide">
                    <span>Tóm tắt</span>
                    <textarea className="admin-textarea" disabled={saving} onChange={(event) => update("summary", event.target.value)} rows={3} value={form.summary} />
                    {fieldErrors.summary ? <small className="admin-field-error">{fieldErrors.summary}</small> : null}
                  </label>
                  <label className="admin-field admin-field-wide">
                    <span>Nội dung chi tiết</span>
                    <textarea className="admin-textarea" disabled={saving} onChange={(event) => update("description", event.target.value)} rows={6} value={form.description} />
                    {fieldErrors.description ? <small className="admin-field-error">{fieldErrors.description}</small> : null}
                  </label>
                </div>
                <div className="admin-editor-footer">
                  <p className="admin-item-meta">Dịch vụ chưa xuất hiện công khai khi còn là bản nháp.</p>
                  <div className="admin-editor-actions">
                    <button className="admin-button admin-button-quiet" disabled={saving} onClick={requestClose} type="button">Hủy</button>
                    <button className="admin-button admin-button-primary" disabled={saving} type="submit">{saving ? "Đang lưu…" : "Lưu bản nháp"}</button>
                  </div>
                </div>
              </form>
            ) : null}
          </div>
        </AdminModal>
      ) : null}

      {confirmClose ? (
        <AdminConfirmDialog
          cancelLabel="Ở lại"
          confirmLabel="Bỏ thay đổi"
          message="Dịch vụ còn thay đổi chưa lưu. Bỏ thay đổi sẽ mất nội dung đang nhập."
          onConfirm={resetEditor}
          onDismiss={() => setConfirmClose(false)}
          title="Bỏ thay đổi chưa lưu?"
        />
      ) : null}
    </>
  );
}
