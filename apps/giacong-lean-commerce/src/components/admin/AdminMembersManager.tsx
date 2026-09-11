"use client";

import { Plus, RefreshCw, Save, ShieldCheck, UserRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useRegisterAdminUnsaved } from "@/components/admin/AdminUnsavedGuard";

import { AdminField } from "@/components/admin/AdminField";
import { AdminConfirmDialog } from "@/components/admin/AdminDialog";
import { AdminErrorState, AdminPageHeading, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { useAdminSession } from "@/components/admin/AdminShell";
import { useAdminToast } from "@/components/admin/AdminToast";
import { AdminClientError, fetchAdmin, mutateAdmin } from "@/lib/admin-client";
import { canManageMembers } from "@/lib/admin-permissions";
import type { AdminRole } from "@/lib/admin-data";

interface AdminMemberRecord {
  id: string;
  accessSubject: string;
  email: string | null;
  displayName: string;
  role: AdminRole;
  isActive: boolean;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

interface EditableMember extends AdminMemberRecord {
  draftDisplayName: string;
  draftEmail: string;
  draftRole: AdminRole;
  draftIsActive: boolean;
}

interface MembersResponse {
  members: AdminMemberRecord[];
  role: string;
}

interface NewMemberForm {
  accessSubject: string;
  displayName: string;
  email: string;
  isActive: boolean;
  role: AdminRole;
}

const roleOptions: Array<{ value: AdminRole; label: string; description: string }> = [
  { value: "owner", label: "Admin toàn quyền", description: "Toàn quyền quản lý website và tài khoản quản trị." },
];

const emptyMember: NewMemberForm = {
  accessSubject: "",
  displayName: "",
  email: "",
  isActive: true,
  role: "owner",
};

export function AdminMembersManager() {
  const session = useAdminSession();
  const { showToast } = useAdminToast();
  const [members, setMembers] = useState<EditableMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AdminClientError | null>(null);
  const [createFieldErrors, setCreateFieldErrors] = useState<Record<string, string>>({});
  const [memberFieldErrors, setMemberFieldErrors] = useState<Record<string, Record<string, string>>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [confirmReload, setConfirmReload] = useState(false);
  const [newMember, setNewMember] = useState<NewMemberForm>(emptyMember);

  const canEdit = canManageMembers(session.role);
  const isDirty = useCallback(() => members.some((member) => member.draftDisplayName !== member.displayName || member.draftEmail !== (member.email ?? "") || member.draftRole !== member.role || member.draftIsActive !== member.isActive) || JSON.stringify(newMember) !== JSON.stringify(emptyMember), [members, newMember]);
  useRegisterAdminUnsaved(isDirty, Boolean(savingId || creating));

  function requestReload() {
    if (savingId || creating) return;
    if (isDirty()) { setConfirmReload(true); return; }
    setAttempt((value) => value + 1);
  }

  function updateNewMember(patch: Partial<NewMemberForm>) {
    setNewMember((current) => ({ ...current, ...patch }));
    setCreateFieldErrors((current) => {
      const next = { ...current };
      for (const field of Object.keys(patch)) delete next[field];
      delete next.form;
      return next;
    });
    setError(null);
  }

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchAdmin<MembersResponse>("/api/admin/members", controller.signal);
        setMembers(result.members.map(toEditableMember));
      } catch (reason: unknown) {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể tải thành viên admin.", 0));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [attempt, session.memberId, session.subject]);

  function updateDraft(id: string, patch: Partial<EditableMember>) {
    setMembers((current) => current.map((member) => member.id === id ? { ...member, ...patch } : member));
    setMemberFieldErrors((current) => {
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
    setNotice(null);
  }

  async function createMember() {
    if (!canEdit) return;
    setCreating(true);
    setError(null);
    setCreateFieldErrors({});
    setNotice(null);
    try {
      const result = await mutateAdmin<{ member: AdminMemberRecord }>("/api/admin/members", {
        body: { requestId: crypto.randomUUID(), ...newMember },
        method: "POST",
      });
      setMembers((current) => [...current, toEditableMember(result.member)]);
      setNewMember(emptyMember);
      setShowCreate(false);
      setCreateFieldErrors({});
      setNotice(`Đã thêm tài khoản quản trị “${result.member.displayName}”. Người dùng còn phải thuộc chính sách Cloudflare Access tương ứng.`);
      showToast("success", "Đã thêm tài khoản quản trị.");
    } catch (reason: unknown) {
      const clientError = reason instanceof AdminClientError ? reason : new AdminClientError("Không thể thêm tài khoản quản trị.", 0);
      setCreateFieldErrors(clientError.fieldErrors ?? {});
      setError(clientError);
      showToast("error", clientError.message);
    } finally {
      setCreating(false);
    }
  }

  async function saveMember(member: EditableMember) {
    if (!canEdit) return;
    setSavingId(member.id);
    setError(null);
    setMemberFieldErrors((current) => ({ ...current, [member.id]: {} }));
    setNotice(null);
    try {
      const result = await mutateAdmin<{ member: AdminMemberRecord }>(`/api/admin/members/${encodeURIComponent(member.id)}`, {
        body: {
          accessSubject: member.accessSubject,
          displayName: member.draftDisplayName,
          email: member.draftEmail || null,
          expectedRevision: member.revision,
          isActive: member.draftIsActive,
          role: member.draftRole,
          requestId: crypto.randomUUID(),
        },
        method: "PATCH",
      });
      setMembers((current) => current.map((item) => item.id === member.id ? toEditableMember(result.member) : item));
      setMemberFieldErrors((current) => {
        const next = { ...current };
        delete next[member.id];
        return next;
      });
      setNotice(`Đã cập nhật quyền của “${result.member.displayName}”.`);
      showToast("success", "Tài khoản quản trị đã được cập nhật.");
    } catch (reason: unknown) {
      const clientError = reason instanceof AdminClientError ? reason : new AdminClientError("Không thể cập nhật tài khoản quản trị.", 0);
      setMemberFieldErrors((current) => ({ ...current, [member.id]: clientError.fieldErrors ?? {} }));
      setError(clientError);
      showToast("error", clientError.message);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="admin-content">
      <AdminPageHeading
        kicker="Tài khoản quản trị"
        title="Tài khoản quản trị"
        subtitle="Website sử dụng một vai trò duy nhất: Admin toàn quyền. Đăng nhập bảo mật Cloudflare Access vẫn bắt buộc trước khi vào."
        stamp="ADMIN TOÀN QUYỀN"
      />
      <div className="admin-content-toolbar">
        <div>
          <div className="admin-content-toolbar-title"><ShieldCheck size={16} /> Quản lý tài khoản quản trị</div>
          <p>Mỗi tài khoản được cấp quyền có thể quản lý toàn bộ website. Chỉ thêm người bạn muốn giao toàn quyền quản trị.</p>
        </div>
        <div className="admin-content-toolbar-actions">
          <AdminStatusBadge kind={canEdit ? "green" : "neutral"} value={canEdit ? "Admin toàn quyền" : "Không có quyền"} />
          <button className="admin-button admin-button-quiet" onClick={requestReload} type="button"><RefreshCw size={14} /> Tải lại</button>
          {canEdit ? <button className="admin-button admin-button-primary" onClick={() => setShowCreate((value) => !value)} type="button"><Plus size={14} /> Thêm tài khoản quản trị</button> : null}
        </div>
      </div>
      {showCreate && canEdit ? (
        <section className="admin-panel admin-member-create" aria-labelledby="member-create-title">
          <div className="admin-panel-heading"><div><h2 className="admin-panel-title" id="member-create-title">Thêm tài khoản quản trị</h2><p className="admin-panel-caption">Cấp quyền quản trị toàn bộ website cho người đã được duyệt đăng nhập Cloudflare Access.</p></div></div>
          <div className="admin-editor-grid">
            <AdminField error={createFieldErrors.accessSubject} id="member-new-subject" hint="Nhập email đúng với tài khoản đăng nhập Cloudflare Access đã duyệt." label="Tài khoản đăng nhập Cloudflare Access">
              <input aria-describedby={createFieldErrors.accessSubject ? "member-new-subject-hint member-new-subject-error" : "member-new-subject-hint"} aria-invalid={Boolean(createFieldErrors.accessSubject)} className="admin-input" id="member-new-subject" onChange={(event) => updateNewMember({ accessSubject: event.target.value })} value={newMember.accessSubject} />
            </AdminField>
            <AdminField error={createFieldErrors.displayName} id="member-new-name" label="Tên hiển thị">
              <input aria-describedby={createFieldErrors.displayName ? "member-new-name-error" : undefined} aria-invalid={Boolean(createFieldErrors.displayName)} className="admin-input" id="member-new-name" onChange={(event) => updateNewMember({ displayName: event.target.value })} value={newMember.displayName} />
            </AdminField>
            <AdminField error={createFieldErrors.email} id="member-new-email" label="Email" optional>
              <input aria-describedby={createFieldErrors.email ? "member-new-email-error" : undefined} aria-invalid={Boolean(createFieldErrors.email)} className="admin-input" id="member-new-email" onChange={(event) => updateNewMember({ email: event.target.value })} type="email" value={newMember.email} />
            </AdminField>
            <RoleField error={createFieldErrors.role} id="member-new-role" onChange={(role) => updateNewMember({ role })} value={newMember.role} />
          </div>
          <div className="admin-member-create-footer">
            <label className="admin-check"><input aria-invalid={Boolean(createFieldErrors.isActive)} checked={newMember.isActive} onChange={(event) => updateNewMember({ isActive: event.target.checked })} type="checkbox" /><span><strong>Kích hoạt ngay</strong><small>Có thể tắt sau mà không xóa lịch sử thay đổi.</small></span></label>
            <button className="admin-button admin-button-primary" disabled={creating || !newMember.accessSubject || !newMember.displayName} onClick={() => void createMember()} type="button"><Plus size={14} /> {creating ? "Đang thêm..." : "Thêm tài khoản quản trị"}</button>
          </div>
        </section>
      ) : null}
      {notice ? <div className="admin-content-notice" role="status">{notice}</div> : null}
      {error ? <AdminErrorState error={error} onRetry={requestReload} /> : null}
      {confirmReload ? <AdminConfirmDialog cancelLabel="Ở lại" confirmLabel="Tải lại" message="Tải lại sẽ bỏ các thay đổi tài khoản chưa lưu. Bạn có muốn tiếp tục?" onConfirm={() => setAttempt((value) => value + 1)} onDismiss={() => setConfirmReload(false)} title="Bỏ thay đổi và tải lại?" /> : null}
      {loading ? <div className="admin-skeleton admin-content-skeleton" aria-label="Đang tải thành viên" /> : (
        <section className="admin-panel" aria-labelledby="member-list-title">
          <div className="admin-panel-heading"><div><h2 className="admin-panel-title" id="member-list-title">Danh sách tài khoản quản trị</h2><p className="admin-panel-caption">{members.length} tài khoản · thay đổi quyền được kiểm tra phiên bản và ghi lịch sử</p></div><UserRound size={17} /></div>
          {members.length === 0 ? <div className="admin-table-empty"><strong>Chưa có tài khoản quản trị</strong><p>Thêm chủ sở hữu đầu tiên để bắt đầu.</p></div> : <div className="admin-member-list">{members.map((member) => <MemberEditor canEdit={canEdit} currentMemberId={session.memberId} currentSubject={session.subject} fieldErrors={memberFieldErrors[member.id] ?? {}} key={member.id} member={member} onChange={updateDraft} onSave={(next) => void saveMember(next)} saving={savingId === member.id} />)}</div>}
        </section>
      )}
    </div>
  );
}

function MemberEditor({ canEdit, currentMemberId, currentSubject, fieldErrors, member, onChange, onSave, saving }: { canEdit: boolean; currentMemberId?: string; currentSubject: string; fieldErrors: Record<string, string>; member: EditableMember; onChange: (id: string, patch: Partial<EditableMember>) => void; onSave: (member: EditableMember) => void; saving: boolean }) {
  const isCurrent = member.id === currentMemberId || member.accessSubject === currentSubject;
  const dirty = member.draftDisplayName !== member.displayName
    || member.draftEmail !== (member.email ?? "")
    || member.draftRole !== member.role
    || member.draftIsActive !== member.isActive;
  const prefix = `member-${member.id}`;
  return (
    <article className={`admin-member-card${dirty ? " is-dirty" : ""}`}>
      <div className="admin-member-card-heading"><div><strong>{member.displayName}</strong><span>{member.accessSubject}{isCurrent ? " · tài khoản hiện tại" : ""}</span></div><div className="admin-table-actions"><AdminStatusBadge kind={member.isActive ? "green" : "neutral"} value={member.isActive ? "Active" : "Inactive"} /><AdminStatusBadge kind={member.role === "owner" ? "blue" : "neutral"} value={roleLabel(member.role)} /></div></div>
      <div className="admin-editor-grid">
        <AdminField error={fieldErrors.displayName} id={`${prefix}-name`} label="Tên hiển thị"><input aria-describedby={fieldErrors.displayName ? `${prefix}-name-error` : undefined} aria-invalid={Boolean(fieldErrors.displayName)} className="admin-input" disabled={!canEdit} id={`${prefix}-name`} onChange={(event) => onChange(member.id, { draftDisplayName: event.target.value })} value={member.draftDisplayName} /></AdminField>
        <AdminField error={fieldErrors.email} id={`${prefix}-email`} label="Email" optional><input aria-describedby={fieldErrors.email ? `${prefix}-email-error` : undefined} aria-invalid={Boolean(fieldErrors.email)} className="admin-input" disabled={!canEdit} id={`${prefix}-email`} onChange={(event) => onChange(member.id, { draftEmail: event.target.value })} type="email" value={member.draftEmail} /></AdminField>
        <RoleField disabled={!canEdit || isCurrent} error={fieldErrors.role} id={`${prefix}-role`} onChange={(role) => onChange(member.id, { draftRole: role })} value={member.draftRole} />
      </div>
      <div className="admin-member-card-footer">
        <label className={`admin-check${canEdit ? "" : " is-disabled"}`}><input checked={member.draftIsActive} disabled={!canEdit || isCurrent} onChange={(event) => onChange(member.id, { draftIsActive: event.target.checked })} type="checkbox" /><span><strong>Cho phép truy cập</strong><small>{isCurrent ? "Tài khoản hiện tại không thể tự hạ quyền hoặc vô hiệu hóa." : `Revision ${member.revision}`}</small></span></label>
        <button className="admin-button admin-button-primary" disabled={!canEdit || !dirty || saving} onClick={() => onSave(member)} type="button"><Save size={13} /> {saving ? "Đang lưu" : "Lưu quyền"}</button>
      </div>
    </article>
  );
}

function RoleField({ error, id }: { disabled?: boolean; error?: string; id: string; onChange: (role: AdminRole) => void; value: AdminRole }) {
  return <AdminField error={error} hint="Toàn quyền quản lý website và tài khoản quản trị." id={id} label="Vai trò quản trị"><input aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`} aria-invalid={Boolean(error)} className="admin-input" id={id} readOnly value="Admin toàn quyền" /></AdminField>;
}

function toEditableMember(member: AdminMemberRecord): EditableMember {
  return {
    ...member,
    draftDisplayName: member.displayName,
    draftEmail: member.email ?? "",
    draftIsActive: member.isActive,
    draftRole: member.role,
  };
}

function roleLabel(role: AdminRole): string {
  return roleOptions.find((option) => option.value === role)?.label ?? role;
}
