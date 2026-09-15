"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";

import { AdminConfirmDialog, AdminModal } from "./AdminDialog";
import { useRegisterAdminUnsaved } from "./AdminUnsavedGuard";
import { useAdminVisualContext } from "./AdminVisualMode";
import styles from "./AdminNewsContextualAction.module.css";
import { AdminClientError, fetchAdmin, mutateAdmin } from "@/lib/admin-client";
import { parseAdminNewsPayload } from "@/lib/admin-news-input";

const editableRoles = new Set(["owner"]);

interface NewsFormState {
  content: string;
  coverImageUrl: string;
  excerpt: string;
  id?: number;
  revision?: number;
  slug: string;
  title: string;
}

interface AdminNewsPost {
  draft: Pick<NewsFormState, "content" | "coverImageUrl" | "excerpt" | "slug" | "title">;
  id: number;
  revision: number;
}

const emptyForm: NewsFormState = {
  content: "",
  coverImageUrl: "",
  excerpt: "",
  slug: "",
  title: "",
};

function toForm(post: AdminNewsPost): NewsFormState {
  return {
    content: post.draft.content,
    coverImageUrl: post.draft.coverImageUrl ?? "",
    excerpt: post.draft.excerpt,
    id: post.id,
    revision: post.revision,
    slug: post.draft.slug,
    title: post.draft.title,
  };
}

function isDirty(form: NewsFormState | null, snapshot: NewsFormState | null): boolean {
  return Boolean(form && snapshot && JSON.stringify(form) !== JSON.stringify(snapshot));
}

export function AdminNewsContextualAction({
  label = "Sửa bài viết",
  newsId,
}: {
  label?: string;
  newsId: number;
}) {
  return <InlineNewsAction label={label} newsId={newsId} />;
}

export function AdminNewsCreateContextualAction({ label = "Thêm bài viết" }: { label?: string }) {
  return <InlineNewsAction label={label} />;
}

function InlineNewsAction({ label, newsId }: { label: string; newsId?: number }) {
  const { session, status } = useAdminVisualContext();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<NewsFormState | null>(null);
  const [snapshot, setSnapshot] = useState<NewsFormState | null>(null);
  const [error, setError] = useState<AdminClientError | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const hasUnsavedChanges = useCallback(() => isDirty(form, snapshot), [form, snapshot]);
  useRegisterAdminUnsaved(hasUnsavedChanges, saving);

  if (status !== "ready" || !session || !editableRoles.has(session.role)) return null;

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
    setError(null);
    setFieldErrors({});
    setNotice(null);
    if (newsId === undefined) {
      setForm({ ...emptyForm });
      setSnapshot({ ...emptyForm });
      return;
    }
    setLoading(true);
    try {
      const result = await fetchAdmin<{ post: AdminNewsPost }>(`/api/admin/news/${newsId}`);
      const next = toForm(result.post);
      setForm(next);
      setSnapshot(next);
    } catch (reason: unknown) {
      setError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể tải bài viết.", 0));
    } finally {
      setLoading(false);
    }
  }

  function update<K extends keyof NewsFormState>(key: K, value: NewsFormState[K]) {
    setForm((current) => current ? { ...current, [key]: value } : current);
    setNotice(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || saving) return;
    const requestId = crypto.randomUUID();
    const payload: Record<string, unknown> = {
      content: form.content,
      coverImageUrl: form.coverImageUrl.trim() || null,
      excerpt: form.excerpt,
      requestId,
      slug: form.slug,
      title: form.title,
    };
    if (form.id !== undefined && form.revision !== undefined) payload.revision = form.revision;
    const parsed = parseAdminNewsPayload(payload);
    setFieldErrors(parsed.fieldErrors);
    setError(null);
    setNotice(null);
    if (!parsed.input) {
      setError(new AdminClientError("Dữ liệu bài viết chưa hợp lệ.", 422, "VALIDATION_ERROR", parsed.fieldErrors));
      return;
    }

    setSaving(true);
    try {
      const result = await mutateAdmin<{ post: AdminNewsPost }>(
        form.id === undefined ? "/api/admin/news" : `/api/admin/news/${form.id}`,
        { body: payload, method: form.id === undefined ? "POST" : "PATCH" },
      );
      const next = toForm(result.post);
      setForm(next);
      setSnapshot(next);
      setFieldErrors({});
      setNotice("Đã lưu bản nháp bài viết. Bài chỉ xuất hiện công khai sau khi bạn phát hành trong quản trị.");
      router.refresh();
    } catch (reason: unknown) {
      const clientError = reason instanceof AdminClientError
        ? reason
        : new AdminClientError("Không thể lưu bài viết.", 0);
      setError(clientError);
      setFieldErrors(clientError.fieldErrors ?? {});
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className={styles.action} data-testid={`admin-news-contextual-action-${newsId ?? "create"}`}>
        <button aria-haspopup="dialog" className={styles.trigger} onClick={() => void openEditor()} type="button">{label}</button>
      </div>

      {open ? (
        <AdminModal labelledBy={`admin-inline-news-title-${newsId ?? "create"}`} onClose={requestClose} title={newsId === undefined ? "Thêm bài viết" : "Sửa bài viết"} width="wide">
          <div className="admin-editor" data-testid="admin-inline-news-editor">
            <div className="admin-editor-heading">
              <div>
                <div className="admin-kicker">Tin tức / biên tập</div>
                <h2 className="admin-panel-title" id={`admin-inline-news-title-${newsId ?? "create"}`}>{form?.title || (newsId === undefined ? "Bài viết mới" : "Đang tải bài viết")}</h2>
                <p className="admin-panel-caption">Lưu nháp trước. Bản đang hiển thị công khai không đổi cho tới khi xuất bản riêng trong admin.</p>
              </div>
              {form?.id ? <span className="admin-stamp">Mã {form.id}</span> : null}
            </div>
            {loading ? <p className="admin-item-meta" role="status">Đang tải nội dung bài viết…</p> : null}
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
                    <span>Tiêu đề <b aria-hidden="true">*</b></span>
                    <input className="admin-input" disabled={saving} onChange={(event) => update("title", event.target.value)} required value={form.title} />
                    {fieldErrors.title ? <small className="admin-field-error">{fieldErrors.title}</small> : null}
                  </label>
                  <label className="admin-field">
                    <span>Đường dẫn (slug) <b aria-hidden="true">*</b></span>
                    <input className="admin-input admin-mono" disabled={saving} onChange={(event) => update("slug", event.target.value)} required value={form.slug} />
                    {fieldErrors.slug ? <small className="admin-field-error">{fieldErrors.slug}</small> : null}
                  </label>
                  <label className="admin-field admin-field-wide">
                    <span>Ảnh đại diện</span>
                    <input className="admin-input" disabled={saving} onChange={(event) => update("coverImageUrl", event.target.value)} placeholder="/media/news/... hoặc https://..." value={form.coverImageUrl} />
                    {fieldErrors.coverImageUrl ? <small className="admin-field-error">{fieldErrors.coverImageUrl}</small> : null}
                  </label>
                  <label className="admin-field admin-field-wide">
                    <span>Tóm tắt</span>
                    <textarea className="admin-textarea" disabled={saving} onChange={(event) => update("excerpt", event.target.value)} rows={3} value={form.excerpt} />
                    {fieldErrors.excerpt ? <small className="admin-field-error">{fieldErrors.excerpt}</small> : null}
                  </label>
                  <label className="admin-field admin-field-wide">
                    <span>Nội dung bài viết</span>
                    <textarea className="admin-textarea" disabled={saving} onChange={(event) => update("content", event.target.value)} rows={10} value={form.content} />
                    {fieldErrors.content ? <small className="admin-field-error">{fieldErrors.content}</small> : null}
                  </label>
                </div>
                <div className="admin-editor-footer">
                  <p className="admin-item-meta">Nút phát hành/gỡ xuất bản và xóa vẫn ở trang Tin tức trong admin.</p>
                  <div className="admin-editor-actions">
                    {form.id ? <Link className="admin-button admin-button-quiet" href={`/admin/tin-tuc?edit=${form.id}`} prefetch={false}>Mở quản trị đầy đủ</Link> : null}
                    <button className="admin-button admin-button-quiet" disabled={saving} onClick={requestClose} type="button">Đóng</button>
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
          message="Bài viết còn thay đổi chưa lưu. Bỏ thay đổi sẽ mất nội dung đang nhập."
          onConfirm={resetEditor}
          onDismiss={() => setConfirmClose(false)}
          title="Bỏ thay đổi chưa lưu?"
        />
      ) : null}
    </>
  );
}
