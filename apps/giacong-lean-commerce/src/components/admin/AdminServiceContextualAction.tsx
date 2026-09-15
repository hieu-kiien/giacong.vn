"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";

import { AdminConfirmDialog, AdminModal } from "./AdminDialog";
import { useRegisterAdminUnsaved } from "./AdminUnsavedGuard";
import { useAdminVisualContext } from "./AdminVisualMode";
import { AdminClientError, fetchAdmin, mutateAdmin, type AdminService } from "@/lib/admin-client";
import { parseAdminServicePayload } from "@/lib/admin-service-input";

const editableRoles = new Set(["owner"]);

type InlineServiceForm = {
  ctaHref: string;
  ctaLabel: string;
  description: string;
  id: number;
  imageUrl: string;
  isActive: boolean;
  leadTimeDays: string;
  moqSummary: string;
  name: string;
  revision: number;
  slug: string;
  offeringsText: string;
  sortOrder: string;
  status: string;
  summary: string;
};

function formatOfferings(offerings: AdminService["offerings"]): string {
  return (offerings ?? []).map((offering) => `${offering.label} | ${offering.href}`).join("\n");
}

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

function toInlineForm(service: AdminService & { revision: number }): InlineServiceForm {
  return {
    ctaHref: service.ctaHref ?? `/lien-he/?service=${service.slug}`,
    ctaLabel: service.ctaLabel ?? "Liên hệ tư vấn",
    description: service.description,
    id: service.id,
    imageUrl: service.imageUrl ?? "",
    isActive: service.isActive,
    leadTimeDays: service.leadTimeDays === null ? "" : String(service.leadTimeDays),
    moqSummary: service.moqSummary ?? "",
    name: service.name,
    revision: service.revision,
    slug: service.slug,
    offeringsText: formatOfferings(service.offerings),
    sortOrder: String(service.sortOrder ?? 0),
    status: service.status,
    summary: service.summary,
  };
}

function isDirty(form: InlineServiceForm | null, snapshot: InlineServiceForm | null): boolean {
  return Boolean(form && snapshot && JSON.stringify(form) !== JSON.stringify(snapshot));
}

export function AdminServiceContextualAction({ serviceId, serviceSlug }: { serviceId: number | null; serviceSlug: string }) {
  const { session, status } = useAdminVisualContext();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<InlineServiceForm | null>(null);
  const [snapshot, setSnapshot] = useState<InlineServiceForm | null>(null);
  const [error, setError] = useState<AdminClientError | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const hasUnsavedChanges = useCallback(() => isDirty(form, snapshot), [form, snapshot]);
  useRegisterAdminUnsaved(hasUnsavedChanges, saving);

  if (status !== "ready" || !session || !editableRoles.has(session.role) || serviceId === null) return null;

  function resetEditor() {
    setOpen(false);
    setLoading(false);
    setForm(null);
    setSnapshot(null);
    setError(null);
    setFieldErrors({});
    setNotice(null);
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

  async function openEditor() {
    setOpen(true);
    setLoading(true);
    setError(null);
    setFieldErrors({});
    setNotice(null);
    try {
      const result = await fetchAdmin<{ service: AdminService & { revision: number } }>(`/api/admin/services/${serviceId}`);
      const next = toInlineForm(result.service);
      setForm(next);
      setSnapshot(next);
    } catch (reason: unknown) {
      setError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể tải dịch vụ.", 0));
    } finally {
      setLoading(false);
    }
  }

  function update<K extends keyof InlineServiceForm>(key: K, value: InlineServiceForm[K]) {
    setForm((current) => current ? { ...current, [key]: value } : current);
    setNotice(null);
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
      revision: form.revision,
      slug: form.slug,
      status: form.status,
      summary: form.summary,
      offerings: parseOfferingLines(form.offeringsText),
      sortOrder: form.sortOrder === "" ? null : Number(form.sortOrder),
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
      const result = await mutateAdmin<{ service: AdminService & { revision: number } }>(`/api/admin/services/${form.id}`, {
        body: payload,
        method: "PATCH",
      });
      const next = toInlineForm(result.service);
      setForm(next);
      setSnapshot(next);
      setFieldErrors({});
      setNotice("Đã lưu dịch vụ. Website sẽ đọc nội dung mới sau khi bản ghi được bật hiển thị và tải lại.");
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
      <div className="mt-3 flex w-full max-w-xs" data-service-slug={serviceSlug} data-testid={`admin-service-contextual-action-${serviceId}`}>
        <button
          aria-haspopup="dialog"
          aria-label="Sửa dịch vụ"
          className="flex min-h-9 w-full items-center justify-center rounded-commerce-control border border-commerce-brand px-3 text-[11px] font-bold text-commerce-brand-dark hover:bg-commerce-active-surface focus-visible:commerce-focus-ring"
          onClick={() => void openEditor()}
          type="button"
        >
          Sửa dịch vụ
        </button>
      </div>

      {open ? (
        <AdminModal labelledBy={`admin-inline-service-title-${serviceId}`} onClose={requestClose} title="Sửa dịch vụ" width="wide">
          <div className="admin-editor" data-testid="admin-inline-service-editor">
            <div className="admin-editor-heading">
              <div>
                <div className="admin-kicker">Thuê gia công / đang xem</div>
                <h2 className="admin-panel-title" id={`admin-inline-service-title-${serviceId}`}>{form?.name ?? "Đang tải dịch vụ"}</h2>
                <p className="admin-panel-caption">Nội dung dịch vụ thuộc nhóm vận hành và có thể sửa qua admin; thay đổi trạng thái để quyết định việc hiển thị.</p>
              </div>
              {form ? <span className="admin-stamp">Mã {form.id}</span> : null}
            </div>

            {loading ? <p className="admin-item-meta" role="status">Đang tải dữ liệu dịch vụ…</p> : null}
            {error ? (
              <div className="admin-editor-error" role="alert">
                <p>{error.message}</p>
                <button className="admin-button admin-button-quiet" onClick={() => void openEditor()} type="button">Thử lại</button>
              </div>
            ) : null}
            {notice ? <p className="admin-content-notice" role="status">{notice}</p> : null}

            {form ? (
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
                    <select className="admin-select" disabled={saving} onChange={(event) => {
                      const status = event.target.value;
                      update("status", status);
                      if (status !== "published") update("isActive", false);
                    }} value={form.status}>
                      <option value="draft">Bản nháp</option>
                      <option value="review">Chờ duyệt</option>
                      <option value="published">Đã đăng</option>
                      <option value="archived">Lưu trữ</option>
                    </select>
                    {fieldErrors.status ? <small className="admin-field-error">{fieldErrors.status}</small> : null}
                  </label>
                  <label className="admin-field">
                    <span>Thời gian làm hàng (ngày)</span>
                    <input className="admin-input admin-mono" disabled={saving} inputMode="numeric" min="0" onChange={(event) => update("leadTimeDays", event.target.value)} type="number" value={form.leadTimeDays} />
                    {fieldErrors.leadTimeDays ? <small className="admin-field-error">{fieldErrors.leadTimeDays}</small> : null}
                  </label>
                  <label className="admin-field">
                    <span>Số lượng tối thiểu</span>
                    <input className="admin-input" disabled={saving} onChange={(event) => update("moqSummary", event.target.value)} value={form.moqSummary} />
                    {fieldErrors.moqSummary ? <small className="admin-field-error">{fieldErrors.moqSummary}</small> : null}
                  </label>
                  <label className="admin-field admin-field-wide">
                    <span>Ảnh chính</span>
                    <input className="admin-input" disabled={saving} onChange={(event) => update("imageUrl", event.target.value)} placeholder="/media/services/... hoặc https://..." value={form.imageUrl} />
                    {fieldErrors.imageUrl ? <small className="admin-field-error">{fieldErrors.imageUrl}</small> : null}
                  </label>
                  <label className="admin-field admin-field-wide">
                    <span>Dịch vụ trong nhóm</span>
                    <textarea
                      className="admin-textarea admin-mono"
                      disabled={saving}
                      onChange={(event) => update("offeringsText", event.target.value)}
                      placeholder="Gia công sữa hạt | /gia-cong-sua-hat/"
                      rows={6}
                      value={form.offeringsText}
                    />
                    <small className="admin-item-meta">Mỗi dòng một mục theo dạng “Tên hiển thị | /đường-dẫn/”. Thứ tự từ trên xuống sẽ là thứ tự ngoài website.</small>
                    {fieldErrors.offerings ? <small className="admin-field-error">{fieldErrors.offerings}</small> : null}
                  </label>
                  <label className="admin-field">
                    <span>Nhãn nút liên hệ</span>
                    <input className="admin-input" disabled={saving} onChange={(event) => update("ctaLabel", event.target.value)} value={form.ctaLabel} />
                    {fieldErrors.ctaLabel ? <small className="admin-field-error">{fieldErrors.ctaLabel}</small> : null}
                  </label>
                  <label className="admin-field">
                    <span>Đường dẫn nút liên hệ</span>
                    <input className="admin-input admin-mono" disabled={saving} onChange={(event) => update("ctaHref", event.target.value)} placeholder="/lien-he/?service=..." value={form.ctaHref} />
                    {fieldErrors.ctaHref ? <small className="admin-field-error">{fieldErrors.ctaHref}</small> : null}
                  </label>
                  <label className="admin-field">
                    <span>Thứ tự nhóm</span>
                    <input className="admin-input admin-mono" disabled={saving} inputMode="numeric" min="0" onChange={(event) => update("sortOrder", event.target.value)} type="number" value={form.sortOrder} />
                    {fieldErrors.sortOrder ? <small className="admin-field-error">{fieldErrors.sortOrder}</small> : null}
                  </label>
                  <label className="admin-field admin-field-wide">
                    <span>Tóm tắt</span>
                    <textarea className="admin-textarea" disabled={saving} onChange={(event) => update("summary", event.target.value)} rows={2} value={form.summary} />
                    {fieldErrors.summary ? <small className="admin-field-error">{fieldErrors.summary}</small> : null}
                  </label>
                  <label className="admin-field admin-field-wide">
                    <span>Nội dung chi tiết</span>
                    <textarea className="admin-textarea" disabled={saving} onChange={(event) => update("description", event.target.value)} rows={6} value={form.description} />
                    {fieldErrors.description ? <small className="admin-field-error">{fieldErrors.description}</small> : null}
                  </label>
                </div>
                <div className="admin-editor-footer">
                  <label className={`admin-check${form.status !== "published" ? " is-disabled" : ""}`}>
                    <input checked={form.isActive} disabled={saving || form.status !== "published"} onChange={(event) => update("isActive", event.target.checked)} type="checkbox" />
                    <span><strong>Hiển thị trên website</strong><small>{form.status === "published" ? "Khách có thể truy cập trang dịch vụ." : "Chỉ dịch vụ đã đăng mới có thể hiển thị."}</small></span>
                  </label>
                  <div className="admin-editor-actions">
                    <Link className="admin-button admin-button-quiet" href={`/admin/dich-vu?edit=${form.id}`} prefetch={false}>Mở quản trị đầy đủ</Link>
                    <button className="admin-button admin-button-quiet" disabled={saving} onClick={requestClose} type="button">Đóng</button>
                    <button className="admin-button admin-button-primary" disabled={saving} type="submit">{saving ? "Đang lưu…" : "Lưu dịch vụ"}</button>
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
