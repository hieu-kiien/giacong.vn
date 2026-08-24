"use client";

// Library-wide media picker: lists every active asset and returns the chosen
// public URL. Upload stays in the per-entity media panels; this modal only picks.

import { ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminModal } from "@/components/admin/AdminDialog";
import { AdminClientError, fetchAdmin } from "@/lib/admin-client";

interface PickerAsset {
  id: string;
  namespace: string;
  originalFilename: string;
  publicUrl: string;
}

export function AdminMediaPickerModal({
  onSelect,
  onClose,
}: {
  onSelect: (publicUrl: string) => void;
  onClose: () => void;
}) {
  const [assets, setAssets] = useState<PickerAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      try {
        const result = await fetchAdmin<{ media: PickerAsset[] }>("/api/admin/media?all=1", controller.signal);
        setAssets(result.media ?? []);
      } catch (reason: unknown) {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof AdminClientError ? reason.message : "Không thể tải thư viện ảnh.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  return (
    <AdminModal labelledBy="admin-media-picker-title" onClose={onClose} title="Chọn ảnh từ thư viện" width="wide">
      <h2 hidden id="admin-media-picker-title">Chọn ảnh từ thư viện</h2>
      {error ? <p className="admin-editor-error" role="alert">{error}</p> : null}
      {loading ? (
        <p style={{ color: "var(--admin-ink-muted)" }}>Đang tải thư viện ảnh...</p>
      ) : assets.length === 0 ? (
        <p style={{ color: "var(--admin-ink-muted)" }}>
          Thư viện chưa có ảnh. Hãy mở một sản phẩm hoặc dịch vụ và upload qua panel Ảnh & media trước.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}>
          {assets.map((asset) => (
            <button
              aria-label={`Chọn ${asset.originalFilename}`}
              className="admin-picker-cell"
              data-testid={`button-picker-${asset.id}`}
              key={asset.id}
              onClick={() => onSelect(asset.publicUrl)}
              type="button"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" loading="lazy" src={asset.publicUrl} />
              <span>{asset.originalFilename}</span>
            </button>
          ))}
        </div>
      )}
      {!loading && assets.length > 0 ? (
        <p style={{ color: "var(--admin-ink-muted)", fontSize: 12.5, marginTop: 12 }}>
          <ImageIcon aria-hidden="true" size={12} style={{ verticalAlign: "middle" }} /> {assets.length} ảnh đang hoạt động trong thư viện. Nhấp vào ảnh để chọn.
        </p>
      ) : null}
    </AdminModal>
  );
}
