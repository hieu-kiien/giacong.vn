"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ArrowUp, ArrowDown, Image as ImageIcon, Plus, Trash2, CheckCircle2, Star, Upload, Loader2 } from "lucide-react";
import { useRegisterAdminUnsaved } from "@/components/admin/AdminUnsavedGuard";
import { useAdminToast } from "@/components/admin/AdminToast";
import { AdminClientError, fetchAdmin, mutateAdmin } from "@/lib/admin-client";
import {
  MAX_PRODUCT_GALLERY_IMAGES,
  serializeAdminProductGalleryState,
} from "@/lib/admin-product-gallery-contract";

export interface GalleryImage {
  id?: number;
  imageUrl: string;
  sortOrder: number;
  isPrimary: boolean;
}

interface GalleryResponse {
  images: GalleryImage[];
  revision: number;
}

export function AdminProductGalleryManager({
  onRevisionChange,
  productId,
}: {
  onRevisionChange: (revision: number) => void;
  productId: number;
}) {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [conflictError, setConflictError] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const savedImagesRef = useRef(serializeAdminProductGalleryState([]));
  const productRevisionRef = useRef(0);
  const pendingRequestRef = useRef<{ key: string; requestId: string } | null>(null);
  const { showToast } = useAdminToast();
  const isDirty = useCallback(() => serializeAdminProductGalleryState(images) !== savedImagesRef.current, [images]);

  useRegisterAdminUnsaved(isDirty, saving);

  const loadGallery = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    setLoadError(false);
    setConflictError(false);
    pendingRequestRef.current = null;
    try {
      const res = await fetchAdmin<GalleryResponse>(`/api/admin/products/${productId}/gallery`);
      const nextImages = res.images ?? [];
      productRevisionRef.current = res.revision;
      savedImagesRef.current = serializeAdminProductGalleryState(nextImages);
      setImages(nextImages);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    void loadGallery();
  }, [loadGallery]);

  function handleAddImage(e: React.FormEvent) {
    e.preventDefault();
    if (loading || loadError || saving || uploading) return;
    if (images.length >= MAX_PRODUCT_GALLERY_IMAGES) {
      showToast("error", `Thư viện chỉ hỗ trợ tối đa ${MAX_PRODUCT_GALLERY_IMAGES} ảnh.`);
      return;
    }
    const trimmed = newImageUrl.trim();
    if (!trimmed) return;
    const isFirst = images.length === 0;
    const next: GalleryImage = {
      imageUrl: trimmed,
      sortOrder: images.length,
      isPrimary: isFirst,
    };
    setImages((prev) => [...prev, next]);
    setNewImageUrl("");
    showToast("success", "Đã thêm ảnh vào bộ sưu tập.");
  }

  const [isDragging, setIsDragging] = useState(false);

  async function uploadFile(file: File) {
    if (loading || loadError || saving || uploading) return;
    if (images.length >= MAX_PRODUCT_GALLERY_IMAGES) {
      showToast("error", `Thư viện chỉ hỗ trợ tối đa ${MAX_PRODUCT_GALLERY_IMAGES} ảnh.`);
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.set("requestId", crypto.randomUUID());
      form.set("file", file);
      if (productId) form.set("productId", String(productId));
      const res = await fetch("/api/admin/media", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const data = await res.json() as { ok?: boolean; data?: { media: { publicUrl: string } }; message?: string };
      if (data.data?.media?.publicUrl) {
        setImages((prev) => [
          ...prev,
          { imageUrl: data.data!.media.publicUrl, sortOrder: prev.length, isPrimary: prev.length === 0 }
        ]);
        showToast("success", "Đã tải ảnh lên bộ sưu tập thành công!");
      } else {
        showToast("error", data.message || "Không thể tải ảnh lên.");
      }
    } catch {
      showToast("error", "Lỗi kết nối khi tải ảnh lên.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDirectFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFile(file);
    }
    e.target.value = "";
  }

  function handleSetPrimary(index: number) {
    if (loading || loadError || saving || uploading) return;
    setImages((prev) =>
      prev.map((img, idx) => ({
        ...img,
        isPrimary: idx === index,
      }))
    );
    showToast("success", "Đã đặt làm ảnh chính.");
  }

  function handleRemoveImage(index: number) {
    if (loading || loadError || saving || uploading) return;
    setImages((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      // If we removed the primary image, make the first one primary
      if (prev[index]?.isPrimary && next.length > 0) {
        next[0].isPrimary = true;
      }
      return next.map((img, idx) => ({ ...img, sortOrder: idx }));
    });
    showToast("info", "Đã xóa ảnh.");
  }

  function handleMove(index: number, direction: "up" | "down") {
    if (loading || loadError || saving || uploading) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= images.length) return;
    setImages((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy.map((img, idx) => ({ ...img, sortOrder: idx }));
    });
  }

  async function handleSaveGallery() {
    if (loading || loadError || saving || uploading) return;
    setSaving(true);
    const imagesToSave = images.map(({ imageUrl, isPrimary }) => ({ imageUrl, isPrimary }));
    const key = JSON.stringify({ expectedRevision: productRevisionRef.current, images: imagesToSave });
    const requestId = pendingRequestRef.current?.key === key
      ? pendingRequestRef.current.requestId
      : crypto.randomUUID();
    pendingRequestRef.current = { key, requestId };
    try {
      const result = await mutateAdmin<GalleryResponse & { replayed: boolean }>(`/api/admin/products/${productId}/gallery`, {
        method: "POST",
        body: { expectedRevision: productRevisionRef.current, images: imagesToSave, requestId },
      });
      productRevisionRef.current = result.revision;
      onRevisionChange(result.revision);
      setImages(result.images);
      savedImagesRef.current = serializeAdminProductGalleryState(result.images);
      pendingRequestRef.current = null;
      setConflictError(false);
      showToast("success", "Đã lưu bộ sưu tập ảnh thành công!");
    } catch (err) {
      if (err instanceof AdminClientError && (err.code === "STALE_WRITE" || err.code === "IDEMPOTENCY_CONFLICT")) {
        setConflictError(true);
        pendingRequestRef.current = null;
      }
      const message = err instanceof AdminClientError ? err.message : "Không thể lưu bộ sưu tập ảnh. Hãy thử lại.";
      showToast("error", message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-editor" aria-labelledby="gallery-manager-heading" style={{ marginTop: 18 }}>
      <div className="admin-editor-heading">
        <div>
          <div className="admin-kicker">Đa phương tiện</div>
          <h3 className="admin-panel-title" id="gallery-manager-heading">Thư viện ảnh sản phẩm (Gallery)</h3>
          <p className="admin-panel-caption" aria-live="polite">
            Quản lý nhiều góc chụp kỹ thuật, chi tiết cơ khí và bản vẽ. Kéo thả hoặc di chuyển để đổi thứ tự. {images.length}/{MAX_PRODUCT_GALLERY_IMAGES} ảnh.
          </p>
        </div>
        {images.length > 0 || isDirty() ? (
          <button
            type="button"
            className="admin-button admin-button-primary"
            onClick={handleSaveGallery}
            disabled={loading || loadError || saving || uploading}
          >
            <CheckCircle2 size={14} /> {saving ? "Đang lưu..." : "Lưu bộ ảnh"}
          </button>
        ) : null}
      </div>

      {loadError ? (
        <div role="alert" className="admin-field-error" style={{ alignItems: "center", display: "flex", gap: 10, margin: "8px 0 12px" }}>
          <span>Không tải được thư viện ảnh. Hãy thử tải lại trước khi chỉnh sửa hoặc lưu.</span>
          <button type="button" className="admin-button admin-button-quiet" onClick={() => void loadGallery()}>
            Tải lại
          </button>
        </div>
      ) : null}

      {conflictError ? (
        <div role="alert" className="admin-field-error" style={{ alignItems: "center", display: "flex", gap: 10, margin: "8px 0 12px" }}>
          <span>Sản phẩm đã được cập nhật ở phiên khác. Thay đổi của bạn vẫn đang được giữ ở đây.</span>
          <button type="button" className="admin-button admin-button-quiet" onClick={() => void loadGallery()}>
            Tải bản mới nhất
          </button>
        </div>
      ) : null}

      {/* Add Image Form */}
      <div style={{ display: "flex", gap: 8, marginTop: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <form onSubmit={handleAddImage} style={{ display: "flex", gap: 8, flex: 1, minWidth: 260 }}>
          <input
            type="url"
            className="admin-input"
            placeholder="Nhập URL ảnh kỹ thuật hoặc bản vẽ..."
            value={newImageUrl}
            onChange={(e) => setNewImageUrl(e.target.value)}
            disabled={loading || loadError || saving || uploading}
            style={{ flex: 1 }}
          />
          <button type="submit" className="admin-button admin-button-quiet" disabled={loading || loadError || saving || uploading || images.length >= MAX_PRODUCT_GALLERY_IMAGES || !newImageUrl.trim()}>
            <Plus size={14} /> Thêm qua URL
          </button>
        </form>
        <label
          className="admin-button admin-button-primary"
          style={{ cursor: uploading || loading || loadError || saving || images.length >= MAX_PRODUCT_GALLERY_IMAGES ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          <span>{uploading ? "Đang tải lên..." : "Tải từ máy tính"}</span>
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleDirectFileUpload}
            disabled={uploading || loading || loadError || saving || images.length >= MAX_PRODUCT_GALLERY_IMAGES}
          />
        </label>
      </div>

      {/* Gallery Grid & Drag-and-Drop Dropzone */}
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (loading || loadError || saving || uploading || images.length >= MAX_PRODUCT_GALLERY_IMAGES) return;
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
          if (loading || loadError || saving || uploading) return;
          const dropped = e.dataTransfer.files?.[0];
          if (dropped) void uploadFile(dropped);
        }}
        style={{
          background: isDragging ? "#ecfdf5" : "transparent",
          border: isDragging ? "2px dashed #059669" : "1px dashed transparent",
          borderRadius: 8,
          padding: isDragging ? 8 : 0,
          position: "relative",
          transition: "all 0.2s ease",
        }}
      >
      {loading && images.length === 0 ? (
        <p role="status" className="admin-item-meta" style={{ padding: "16px 0" }}>Đang tải thư viện ảnh…</p>
      ) : loadError ? null : images.length === 0 ? (
        <div className="admin-table-empty" style={{ padding: "24px 16px" }}>
          <ImageIcon size={28} aria-hidden="true" style={{ opacity: 0.5 }} />
          <strong>Chưa có ảnh trong thư viện</strong>
          <p>Thêm các góc chụp kỹ thuật hoặc hình ảnh minh họa cho sản phẩm gia công này.</p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          {images.map((img, idx) => (
            <div
              key={idx}
              style={{
                border: img.isPrimary ? "2px solid #2563eb" : "1px solid #e2e8f0",
                borderRadius: 8,
                overflow: "hidden",
                background: "#ffffff",
                display: "flex",
                flexDirection: "column",
                position: "relative",
              }}
            >
              {img.isPrimary ? (
                <span
                  style={{
                    position: "absolute",
                    top: 6,
                    left: 6,
                    background: "#2563eb",
                    color: "#ffffff",
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "2px 6px",
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                    zIndex: 2,
                  }}
                >
                  <Star size={10} fill="#ffffff" /> Ảnh chính
                </span>
              ) : null}

              <div
                style={{
                  height: 120,
                  background: "#f8fafc",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.imageUrl}
                  alt={`Sản phẩm ${idx + 1}`}
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              </div>

              <div
                style={{
                  padding: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#f8fafc",
                  borderTop: "1px solid #e2e8f0",
                }}
              >
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    type="button"
                    title="Chuyển lên trước"
                    className="admin-button admin-button-quiet"
                    style={{ padding: "3px 6px" }}
                    disabled={loading || loadError || saving || uploading || idx === 0}
                    onClick={() => handleMove(idx, "up")}
                  >
                    <ArrowUp size={12} />
                  </button>
                  <button
                    type="button"
                    title="Chuyển xuống sau"
                    className="admin-button admin-button-quiet"
                    style={{ padding: "3px 6px" }}
                    disabled={loading || loadError || saving || uploading || idx === images.length - 1}
                    onClick={() => handleMove(idx, "down")}
                  >
                    <ArrowDown size={12} />
                  </button>
                </div>

                <div style={{ display: "flex", gap: 4 }}>
                  {!img.isPrimary ? (
                    <button
                      type="button"
                      title="Đặt làm ảnh chính"
                      className="admin-button admin-button-quiet"
                      style={{ padding: "3px 6px" }}
                      disabled={loading || loadError || saving || uploading}
                      onClick={() => handleSetPrimary(idx)}
                    >
                      <Star size={12} />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    title="Xóa ảnh"
                    className="admin-button admin-button-quiet"
                    style={{ padding: "3px 6px", color: "#dc2626" }}
                    disabled={loading || loadError || saving || uploading}
                    onClick={() => handleRemoveImage(idx)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </section>
  );
}
