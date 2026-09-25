"use client";

import { useState, useEffect, useCallback } from "react";
import {
  MessageSquare,
  Phone,
  Calendar,
  FileText,
  Clock,
  Send,
  Pin,
  CheckCircle2,
  AlertCircle,
  Wrench,
  Package,
} from "lucide-react";
import { useAdminToast } from "@/components/admin/AdminToast";
import { AdminClientError, fetchAdmin, mutateAdmin, formatAdminDate } from "@/lib/admin-client";
import type { CrmTimelineEvent, CrmTimelineEventType } from "@/lib/admin-crm-types";

const eventTypeIcons: Record<string, React.ReactNode> = {
  note_internal: <MessageSquare size={13} />,
  call_outgoing: <Phone size={13} />,
  call_incoming: <Phone size={13} />,
  zalo_chat: <MessageSquare size={13} />,
  email_sent: <Send size={13} />,
  meeting_client: <Calendar size={13} />,
  technical_dfm_review: <Wrench size={13} />,
  cad_drawing_uploaded: <FileText size={13} />,
  site_audit_visit: <Calendar size={13} />,
  sample_dispatched: <Package size={13} />,
  quote_delivered: <FileText size={13} />,
  price_negotiation: <Clock size={13} />,
  contract_signed: <CheckCircle2 size={13} />,
};

const eventTypeLabels: Record<string, string> = {
  note_internal: "Ghi chú nội bộ",
  call_outgoing: "Cuộc gọi đi",
  call_incoming: "Cuộc gọi đến",
  zalo_chat: "Trao đổi Zalo",
  email_sent: "Email đã gửi",
  meeting_client: "Gặp khách hàng",
  technical_dfm_review: "Thẩm định DFM kỹ thuật",
  cad_drawing_uploaded: "Tải lên bản vẽ CAD",
  site_audit_visit: "Khảo sát nhà xưởng",
  sample_dispatched: "Gửi mẫu thử FAI",
  quote_delivered: "Đã gửi báo giá",
  price_negotiation: "Đàm phán chiết khấu",
  contract_signed: "Ký hợp đồng",
};

export function AdminTimelineFeed({
  customerId,
  leadId,
}: {
  customerId: string;
  leadId?: string;
}) {
  const [events, setEvents] = useState<CrmTimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [eventType, setEventType] = useState<CrmTimelineEventType>("note_internal");
  const [isPinned, setIsPinned] = useState(false);
  const [requiresFollowup, setRequiresFollowup] = useState(false);
  const [saving, setSaving] = useState(false);
  const { showToast } = useAdminToast();

  const loadTimeline = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    try {
      const res = await fetchAdmin<{ events: CrmTimelineEvent[] }>(
        `/api/admin/crm/customers/${customerId}/timeline`
      );
      setEvents(res.events ?? []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    void loadTimeline();
  }, [loadTimeline]);

  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!newContent.trim()) return;
    setSaving(true);
    try {
      await mutateAdmin(`/api/admin/crm/customers/${customerId}/timeline`, {
        method: "POST",
        body: {
          lead_id: leadId || null,
          event_type: eventType,
          title: newTitle.trim() || eventTypeLabels[eventType] || "Tương tác",
          content: newContent.trim(),
          is_pinned: isPinned ? 1 : 0,
          requires_followup: requiresFollowup ? 1 : 0,
        },
      });
      showToast("success", "Đã ghi nhận tương tác vào dòng thời gian.");
      setNewTitle("");
      setNewContent("");
      setIsPinned(false);
      setRequiresFollowup(false);
      await loadTimeline();
    } catch (err) {
      const msg = err instanceof AdminClientError ? err.message : "Không thể thêm sự kiện timeline.";
      showToast("error", msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-timeline-feed">
      {/* Quick Add Event Form */}
      <form
        onSubmit={handleAddEvent}
        style={{
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          padding: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          <select
            className="admin-select"
            value={eventType}
            onChange={(e) => setEventType(e.target.value as CrmTimelineEventType)}
            style={{ fontSize: 12, padding: "4px 8px" }}
          >
            {Object.entries(eventTypeLabels).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
          <input
            type="text"
            className="admin-input"
            placeholder="Tiêu đề tóm tắt (tùy chọn)..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            style={{ flex: 1, fontSize: 12 }}
          />
        </div>

        <textarea
          className="admin-textarea"
          rows={2}
          placeholder="Nội dung trao đổi, ghi chú thỏa thuận vật liệu, dung sai, hẹn lịch..."
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          required
          style={{ width: "100%", fontSize: 12, resize: "vertical" }}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 8,
          }}
        >
          <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#64748b" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
              />
              <Pin size={12} /> Ghim lên đầu
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={requiresFollowup}
                onChange={(e) => setRequiresFollowup(e.target.checked)}
              />
              <Clock size={12} /> Cần theo dõi tiếp
            </label>
          </div>

          <button
            type="submit"
            className="admin-button admin-button-primary"
            style={{ padding: "4px 10px", fontSize: 12 }}
            disabled={saving || !newContent.trim()}
          >
            <Send size={12} /> {saving ? "Đang gửi..." : "Ghi nhận"}
          </button>
        </div>
      </form>

      {/* Events Timeline Feed */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "16px", color: "#64748b", fontSize: 12 }}>
          Đang tải dòng thời gian...
        </div>
      ) : events.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "24px 16px",
            background: "#f8fafc",
            borderRadius: 8,
            color: "#64748b",
            fontSize: 12,
          }}
        >
          <Clock size={20} style={{ margin: "0 auto 6px", opacity: 0.5 }} />
          Chưa có ghi chép tương tác nào cho khách hàng này.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {events.map((evt) => (
            <div
              key={evt.id}
              style={{
                borderLeft: evt.is_pinned ? "3px solid #2563eb" : "3px solid #cbd5e1",
                background: evt.is_pinned ? "#eff6ff" : "#ffffff",
                border: "1px solid #e2e8f0",
                borderLeftWidth: 3,
                borderRadius: 6,
                padding: "10px 12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 4,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600 }}>
                  <span style={{ color: "#2563eb" }}>{eventTypeIcons[evt.event_type] || <MessageSquare size={13} />}</span>
                  <span>{evt.title}</span>
                  {evt.is_pinned ? (
                    <span style={{ color: "#2563eb", display: "flex", alignItems: "center" }}>
                      <Pin size={11} fill="#2563eb" />
                    </span>
                  ) : null}
                  {evt.requires_followup && !evt.followup_completed ? (
                    <span
                      style={{
                        background: "#fef3c7",
                        color: "#b45309",
                        fontSize: 10,
                        padding: "1px 5px",
                        borderRadius: 3,
                      }}
                    >
                      Cần gọi lại
                    </span>
                  ) : null}
                </div>
                <span style={{ fontSize: 11, color: "#64748b" }}>
                  {formatAdminDate(evt.created_at)}
                </span>
              </div>

              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#334155", whiteSpace: "pre-wrap" }}>
                {evt.content}
              </p>

              <div
                style={{
                  marginTop: 6,
                  fontSize: 11,
                  color: "#64748b",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>Người ghi: <strong>{evt.author_name}</strong></span>
                <span style={{ textTransform: "capitalize" }}>{eventTypeLabels[evt.event_type] ?? evt.event_type}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
