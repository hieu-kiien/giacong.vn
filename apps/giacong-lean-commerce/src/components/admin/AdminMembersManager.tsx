"use client";

import { Plus, RefreshCw, Save, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

import { AdminField } from "@/components/admin/AdminField";
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
  { value: "owner", label: "Chủ sở hữu (toàn quyền)", description: "Toàn quyền, bao gồm thành viên và quyền." },
  { value: "content_manager", label: "Quản lý nội dung", description: "Nội dung, page, menu, media, tin tức, dịch vụ." },
  { value: "catalog_manager", label: "Quản lý catalog", description: "Sản phẩm, danh mục, biến thể và media catalog." },
  { value: "sales_manager", label: "Quản lý yêu cầu", description: "Yêu cầu báo giá và luồng lead." },
  { value: "viewer", label: "Người xem", description: "Chỉ xem dữ liệu được cấp quyền đọc." },
];

const emptyMember: NewMemberForm = {
  accessSubject: "",
  displayName: "",
  email: "",
  isActive: true,
  role: "viewer",
};

export function AdminMembersManager() {
  const session = useAdminSession();
  const { showToast } = useAdminToast();
  const [members, setMembers] = useState<EditableMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AdminClientError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newMember, setNewMember] = useState<NewMemberForm>(emptyMember);

  const canEdit = canManageMembers(session.role);

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
    setNotice(null);
  }

  async function createMember() {
    if (!canEdit) return;
    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      const result = await mutateAdmin<{ member: AdminMemberRecord }>("/api/admin/members", {
        body: { requestId: crypto.randomUUID(), ...newMember },
        method: "POST",
      });
      setMembers((current) => [...current, toEditableMember(result.member)]);
      setNewMember(emptyMember);
      setShowCreate(false);
      setNotice(`Đã thêm “${result.member.displayName}”. Người dùng còn phải thuộc Cloudflare Access policy tương ứng.`);
      showToast("success", "Đã thêm thành viên admin.");
    } catch (reason: unknown) {
      const clientError = reason instanceof AdminClientError ? reason : new AdminClientError("Không thể thêm thành viên.", 0);
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
      setNotice(`Đã cập nhật quyền của “${result.member.displayName}”.`);
      showToast("success", "Thành viên admin đã được cập nhật.");
    } catch (reason: unknown) {
      const clientError = reason instanceof AdminClientError ? reason : new AdminClientError("Không thể cập nhật thành viên.", 0);
      setError(clientError);
      showToast("error", clientError.message);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="admin-content">
      <AdminPageHeading
        kicker="Access / RBAC"
        title="Thành viên & quyền"
        subtitle="Quyền ứng dụng được lưu trong D1 và kiểm tra ở từng API. Cloudflare Access vẫn là lớp xác thực đầu vào bắt buộc."
        stamp="OWNER CONTROL"
      />
      <div className="admin-content-toolbar">
        <div>
          <div className="admin-content-toolbar-title"><ShieldCheck size={16} /> Granular RBAC</div>
          <p>Owner quản lý thành viên; các vai trò còn lại chỉ thấy màn hình đúng capability. Không dùng một tài khoản administrator chung.</p>
        </div>
        <div className="admin-content-toolbar-actions">
          <AdminStatusBadge kind={canEdit ? "green" : "neutral"} value={canEdit ? "Owner · có quyền" : "Chỉ xem"} />
          <button className="admin-button admin-button-quiet" onClick={() => setAttempt((value) => value + 1)} type="button"><RefreshCw size={14} /> Tải lại</button>
          {canEdit ? <button className="admin-button admin-button-primary" onClick={() => setShowCreate((value) => !value)} type="button"><Plus size={14} /> Thêm thành viên</button> : null}
        </div>
      </div>
      {showCreate && canEdit ? (
        <section className="admin-panel admin-member-create" aria-labelledby="member-create-title">
          <div className="admin-panel-heading"><div><h2 className="admin-panel-title" id="member-create-title">Thêm thành viên</h2><p className="admin-panel-caption">accessSubject phải khớp giá trị mà Cloudflare Access gửi trong phiên đăng nhập.</p></div></div>
          <div className="admin-editor-grid">
            <AdminField id="member-new-subject" hint="Ví dụ email hoặc subject ID từ Access." label="Access subject">
              <input className="admin-input" id="member-new-subject" onChange={(event) => setNewMember((current) => ({ ...current, accessSubject: event.target.value }))} value={newMember.accessSubject} />
            </AdminField>
            <AdminField id="member-new-name" label="Tên hiển thị">
              <input className="admin-input" id="member-new-name" onChange={(event) => setNewMember((current) => ({ ...current, displayName: event.target.value }))} value={newMember.displayName} />
            </AdminField>
            <AdminField id="member-new-email" label="Email" optional>
              <input className="admin-input" id="member-new-email" onChange={(event) => setNewMember((current) => ({ ...current, email: event.target.value }))} type="email" value={newMember.email} />
            </AdminField>
            <RoleField id="member-new-role" onChange={(role) => setNewMember((current) => ({ ...current, role }))} value={newMember.role} />
          </div>
          <div className="admin-member-create-footer">
            <label className="admin-check"><input checked={newMember.isActive} onChange={(event) => setNewMember((current) => ({ ...current, isActive: event.target.checked }))} type="checkbox" /><span><strong>Kích hoạt ngay</strong><small>Có thể tắt sau mà không xóa lịch sử audit.</small></span></label>
            <button className="admin-button admin-button-primary" disabled={creating || !newMember.accessSubject || !newMember.displayName} onClick={() => void createMember()} type="button"><Plus size={14} /> {creating ? "Đang thêm..." : "Thêm thành viên"}</button>
          </div>
        </section>
      ) : null}
      {notice ? <div className="admin-content-notice" role="status">{notice}</div> : null}
      {error ? <AdminErrorState error={error} onRetry={() => { setError(null); setAttempt((value) => value + 1); }} /> : null}
      {loading ? <div className="admin-skeleton admin-content-skeleton" aria-label="Đang tải thành viên" /> : (
        <section className="admin-panel" aria-labelledby="member-list-title">
          <div className="admin-panel-heading"><div><h2 className="admin-panel-title" id="member-list-title">Danh sách thành viên</h2><p className="admin-panel-caption">{members.length} tài khoản · thay đổi quyền có optimistic revision và audit log</p></div><UserRound size={17} /></div>
          {members.length === 0 ? <div className="admin-table-empty"><strong>Chưa có thành viên</strong><p>Chạy migration control plane hoặc thêm owner đầu tiên trong D1.</p></div> : <div className="admin-member-list">{members.map((member) => <MemberEditor canEdit={canEdit} currentMemberId={session.memberId} currentSubject={session.subject} key={member.id} member={member} onChange={updateDraft} onSave={(next) => void saveMember(next)} saving={savingId === member.id} />)}</div>}
        </section>
      )}
    </div>
  );
}

function MemberEditor({ canEdit, currentMemberId, currentSubject, member, onChange, onSave, saving }: { canEdit: boolean; currentMemberId?: string; currentSubject: string; member: EditableMember; onChange: (id: string, patch: Partial<EditableMember>) => void; onSave: (member: EditableMember) => void; saving: boolean }) {
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
        <AdminField id={`${prefix}-name`} label="Tên hiển thị"><input className="admin-input" disabled={!canEdit} id={`${prefix}-name`} onChange={(event) => onChange(member.id, { draftDisplayName: event.target.value })} value={member.draftDisplayName} /></AdminField>
        <AdminField id={`${prefix}-email`} label="Email" optional><input className="admin-input" disabled={!canEdit} id={`${prefix}-email`} onChange={(event) => onChange(member.id, { draftEmail: event.target.value })} type="email" value={member.draftEmail} /></AdminField>
        <RoleField disabled={!canEdit || isCurrent} id={`${prefix}-role`} onChange={(role) => onChange(member.id, { draftRole: role })} value={member.draftRole} />
      </div>
      <div className="admin-member-card-footer">
        <label className={`admin-check${canEdit ? "" : " is-disabled"}`}><input checked={member.draftIsActive} disabled={!canEdit || isCurrent} onChange={(event) => onChange(member.id, { draftIsActive: event.target.checked })} type="checkbox" /><span><strong>Cho phép truy cập</strong><small>{isCurrent ? "Tài khoản hiện tại không thể tự hạ quyền hoặc vô hiệu hóa." : `Revision ${member.revision}`}</small></span></label>
        <button className="admin-button admin-button-primary" disabled={!canEdit || !dirty || saving} onClick={() => onSave(member)} type="button"><Save size={13} /> {saving ? "Đang lưu" : "Lưu quyền"}</button>
      </div>
    </article>
  );
}

function RoleField({ disabled = false, id, onChange, value }: { disabled?: boolean; id: string; onChange: (role: AdminRole) => void; value: AdminRole }) {
  return <AdminField hint={roleOptions.find((option) => option.value === value)?.description} id={id} label="Vai trò"><select className="admin-input" disabled={disabled} id={id} onChange={(event) => onChange(event.target.value as AdminRole)} value={value}>{roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></AdminField>;
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
