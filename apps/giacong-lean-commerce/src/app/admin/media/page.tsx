"use client";

import {
  Check,
  Copy,
  ExternalLink,
  Eye,
  FileImage,
  FolderArchive,
  Grid,
  HardDrive,
  Image as ImageIcon,
  Layers,
  List,
  Pencil,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminConfirmDialog, AdminModal } from "@/components/admin/AdminDialog";
import { AdminEmptyState, AdminPageHeading } from "@/components/admin/AdminPrimitives";
import { useAdminSession } from "@/components/admin/AdminShell";
import { useAdminToast } from "@/components/admin/AdminToast";
import { AdminClientError, fetchAdmin, formatAdminDate, mutateAdmin } from "@/lib/admin-client";
import { canManage, canManageMedia } from "@/lib/admin-permissions";

export interface MediaAssetItem {
  altText: string | null;
  byteSize: number;
  checksumSha256: string;
  contentType: string;
  createdAt: string;
  id: string;
  namespace: "product" | "service" | "variant";
  originalFilename: string;
  productId: number | null;
  publicUrl: string;
  revision: number;
  serviceId: number | null;
  status: "active" | "deleted" | "orphaned" | "replaced";
  storageKey: string;
  updatedAt: string;
  variantId: number | null;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function AdminMediaPage() {
  const session = useAdminSession();
  const { showToast } = useAdminToast();
  const hasReadPermission = canManage(session.role, "media.read");
  const hasWritePermission = canManageMedia(session.role);

  const [assets, setAssets] = useState<MediaAssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [namespaceFilter, setNamespaceFilter] = useState<"all" | "product" | "service" | "variant">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Interaction modals
  const [previewAsset, setPreviewAsset] = useState<MediaAssetItem | null>(null);
  const [editingAsset, setEditingAsset] = useState<MediaAssetItem | null>(null);
  const [editAltText, setEditAltText] = useState("");
  const [savingAlt, setSavingAlt] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<MediaAssetItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteConflictMessage, setDeleteConflictMessage] = useState<string | null>(null);

  const [cleanupModalOpen, setCleanupModalOpen] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadMedia = useCallback(async () => {
    if (!hasReadPermission) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdmin<{ media: MediaAssetItem[] }>("/api/admin/media?all=1");
      setAssets(res.media ?? []);
    } catch (err) {
      const msg = err instanceof AdminClientError ? err.message : "Không thể tải danh sách tài nguyên R2.";
      setError(msg);
      showToast("error", msg);
    } finally {
      setLoading(false);
    }
  }, [hasReadPermission, showToast]);

  useEffect(() => {
    void loadMedia();
  }, [loadMedia]);

  const filteredAssets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return assets.filter((asset) => {
      if (namespaceFilter !== "all" && asset.namespace !== namespaceFilter) {
        return false;
      }
      if (!q) return true;
      return (
        asset.originalFilename.toLowerCase().includes(q) ||
        asset.storageKey.toLowerCase().includes(q) ||
        (asset.altText && asset.altText.toLowerCase().includes(q))
      );
    });
  }, [assets, namespaceFilter, searchQuery]);

  const stats = useMemo(() => {
    const totalBytes = assets.reduce((sum, a) => sum + (a.byteSize || 0), 0);
    const productCount = assets.filter((a) => a.namespace === "product").length;
    const serviceCount = assets.filter((a) => a.namespace === "service").length;
    const variantCount = assets.filter((a) => a.namespace === "variant").length;
    return {
      productCount,
      serviceCount,
      totalBytes,
      totalCount: assets.length,
      variantCount,
    };
  }, [assets]);

  function handleCopyUrl(asset: MediaAssetItem) {
    const fullUrl = asset.publicUrl.startsWith("http")
      ? asset.publicUrl
      : `${window.location.origin}${asset.publicUrl}`;
    void navigator.clipboard.writeText(fullUrl);
    setCopiedId(asset.id);
    showToast("success", "Đã sao chép đường dẫn hình ảnh R2.");
    setTimeout(() => {
      setCopiedId((current) => (current === asset.id ? null : current));
    }, 2000);
  }

  function handleOpenEditAlt(asset: MediaAssetItem) {
    setEditingAsset(asset);
    setEditAltText(asset.altText || "");
  }

  async function handleSaveAltText() {
    if (!editingAsset) return;
    setSavingAlt(true);
    try {
      const res = await mutateAdmin<{ media: MediaAssetItem }>(`/api/admin/media/${editingAsset.id}`, {
        body: {
          altText: editAltText.trim() || null,
          requestId: crypto.randomUUID(),
          revision: editingAsset.revision,
        },
        method: "PATCH",
      });
      setAssets((prev) =>
        prev.map((a) => (a.id === editingAsset.id ? { ...a, ...res.media } : a)),
      );
      showToast("success", "Đã cập nhật mô tả hình ảnh (Alt text).");
      setEditingAsset(null);
    } catch (err) {
      const msg = err instanceof AdminClientError ? err.message : "Không thể lưu mô tả ảnh.";
      showToast("error", msg);
    } finally {
      setSavingAlt(false);
    }
  }

  async function handleDeleteAsset() {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteConflictMessage(null);
    try {
      await mutateAdmin(`/api/admin/media/${pendingDelete.id}`, {
        body: {
          requestId: crypto.randomUUID(),
          revision: pendingDelete.revision,
        },
        method: "DELETE",
      });
      setAssets((prev) => prev.filter((a) => a.id !== pendingDelete.id));
      showToast("success", `Đã xóa file "${pendingDelete.originalFilename}" khỏi Cloudflare R2.`);
      setPendingDelete(null);
    } catch (err) {
      if (err instanceof AdminClientError && err.code === "MEDIA_IN_USE") {
        setDeleteConflictMessage(err.message);
      } else {
        const msg = err instanceof AdminClientError ? err.message : "Không thể xóa file R2.";
        showToast("error", msg);
        setPendingDelete(null);
      }
    } finally {
      setDeleting(false);
    }
  }

  async function handleCleanupOrphans() {
    setCleaning(true);
    try {
      const res = await mutateAdmin<{ deleted: number; scanned: number }>("/api/admin/media/cleanup", {
        body: { limit: 100 },
        method: "POST",
      });
      setCleanupModalOpen(false);
      showToast("success", `Đã quét ${res.scanned} tệp trên R2, dọn dẹp ${res.deleted} tệp rác thành công.`);
      void loadMedia();
    } catch (err) {
      const msg = err instanceof AdminClientError ? err.message : "Không thể thực hiện dọn dẹp R2.";
      showToast("error", msg);
    } finally {
      setCleaning(false);
    }
  }

  if (!hasReadPermission) {
    return (
      <div className="admin-content">
        <AdminPageHeading
          kicker="Bảo mật & Quyền truy cập"
          stamp="TRUY CẬP BỊ TỪ CHỐI"
          subtitle="Tài khoản hiện tại không có quyền xem thư viện tài nguyên đa phương tiện."
          title="Thư viện Media (Cloudflare R2)"
        />
      </div>
    );
  }

  return (
    <div className="admin-content">
      <AdminPageHeading
        kicker="Quản lý tập trung"
        stamp="CLOUDFLARE R2"
        subtitle="Quản lý toàn bộ tài sản hình ảnh sản phẩm, dịch vụ gia công và bản vẽ kỹ thuật lưu trữ trực tiếp trên Cloudflare R2 Bucket."
        title="Thư viện Media (R2)"
      />

      {/* KPI Stats Overview */}
      <div className="admin-metric-grid" style={{ marginBottom: 20 }}>
        <div className="admin-metric-card">
          <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between" }}>
            <span className="admin-metric-label">Tổng tệp R2</span>
            <FileImage color="var(--admin-primary, #059669)" size={20} />
          </div>
          <div className="admin-metric-value">{stats.totalCount}</div>
          <span className="admin-metric-detail">Đang hoạt động trong D1 & R2</span>
        </div>

        <div className="admin-metric-card">
          <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between" }}>
            <span className="admin-metric-label">Tổng dung lượng</span>
            <HardDrive color="var(--admin-ink, #0f172a)" size={20} />
          </div>
          <div className="admin-metric-value">{formatBytes(stats.totalBytes)}</div>
          <span className="admin-metric-detail">Dung lượng thực tế trên R2</span>
        </div>

        <div className="admin-metric-card">
          <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between" }}>
            <span className="admin-metric-label">Phân bố danh mục</span>
            <Layers color="var(--admin-ink-muted, #64748b)" size={20} />
          </div>
          <div className="admin-metric-value" style={{ fontSize: 16, marginTop: 4 }}>
            <span>SP: <strong>{stats.productCount}</strong></span> ·{" "}
            <span>Dịch vụ: <strong>{stats.serviceCount}</strong></span> ·{" "}
            <span>Biến thể: <strong>{stats.variantCount}</strong></span>
          </div>
          <span className="admin-metric-detail">Tự động phân nhóm theo đối tượng</span>
        </div>

        <div className="admin-metric-card">
          <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between" }}>
            <span className="admin-metric-label">Bộ nhớ đệm Edge CDN</span>
            <Sparkles color="#d97706" size={20} />
          </div>
          <div className="admin-metric-value" style={{ color: "#059669", fontSize: 18 }}>
            Tối ưu 1 năm
          </div>
          <span className="admin-metric-detail">Cache-Control: immutable</span>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div
        className="admin-haravan-card"
        style={{
          alignItems: "center",
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          justifyContent: "space-between",
          marginBottom: 16,
          padding: "12px 16px",
        }}
      >
        <div style={{ alignItems: "center", display: "flex", flex: 1, flexWrap: "wrap", gap: 10, minWidth: 280 }}>
          {/* Search Input */}
          <div className="admin-search-wrap" style={{ flex: 1, minWidth: 220 }}>
            <Search aria-hidden="true" size={16} />
            <input
              className="admin-input has-icon"
              data-testid="input-media-search"
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên file, đường dẫn, alt text..."
              value={searchQuery}
            />
          </div>

          {/* Namespace Filter */}
          <select
            className="admin-select"
            data-testid="select-media-namespace"
            onChange={(e) => setNamespaceFilter(e.target.value as any)}
            style={{ width: "auto" }}
            value={namespaceFilter}
          >
            <option value="all">Tất cả vị trí ({assets.length})</option>
            <option value="product">Sản phẩm ({stats.productCount})</option>
            <option value="service">Dịch vụ ({stats.serviceCount})</option>
            <option value="variant">Biến thể ({stats.variantCount})</option>
          </select>
        </div>

        {/* Action Buttons */}
        <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
          {/* View Mode Toggle */}
          <div
            style={{
              background: "var(--admin-border-subtle, #f1f5f9)",
              borderRadius: 6,
              display: "inline-flex",
              padding: 2,
            }}
          >
            <button
              aria-label="Xem dạng lưới"
              className="admin-button"
              onClick={() => setViewMode("grid")}
              style={{
                background: viewMode === "grid" ? "#fff" : "transparent",
                border: "none",
                borderRadius: 4,
                boxShadow: viewMode === "grid" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                color: viewMode === "grid" ? "var(--admin-ink, #0f172a)" : "var(--admin-ink-muted, #64748b)",
                padding: "6px 8px",
              }}
              type="button"
            >
              <Grid size={15} />
            </button>
            <button
              aria-label="Xem dạng danh sách"
              className="admin-button"
              onClick={() => setViewMode("list")}
              style={{
                background: viewMode === "list" ? "#fff" : "transparent",
                border: "none",
                borderRadius: 4,
                boxShadow: viewMode === "list" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                color: viewMode === "list" ? "var(--admin-ink, #0f172a)" : "var(--admin-ink-muted, #64748b)",
                padding: "6px 8px",
              }}
              type="button"
            >
              <List size={15} />
            </button>
          </div>

          <button
            className="admin-button admin-button-quiet"
            data-testid="button-media-refresh"
            disabled={loading}
            onClick={() => void loadMedia()}
            title="Tải lại danh sách"
            type="button"
          >
            <RefreshCw className={loading ? "animate-spin" : ""} size={14} />
            <span>Làm mới</span>
          </button>

          {hasWritePermission ? (
            <button
              className="admin-button admin-button-quiet"
              data-testid="button-media-cleanup"
              onClick={() => setCleanupModalOpen(true)}
              style={{ color: "#b45309" }}
              title="Dọn dẹp file R2 mồ côi không còn liên kết"
              type="button"
            >
              <Sparkles size={14} />
              <span>Dọn rác R2</span>
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="admin-editor-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      ) : null}

      {/* Main Content Area */}
      {loading ? (
        <div className="admin-haravan-card" style={{ padding: "40px 20px", textAlign: "center" }}>
          <RefreshCw className="animate-spin" size={24} style={{ color: "var(--admin-primary, #059669)", margin: "0 auto 12px" }} />
          <p style={{ color: "var(--admin-ink-muted)", margin: 0 }}>Đang tải danh sách tài nguyên từ Cloudflare R2...</p>
        </div>
      ) : filteredAssets.length === 0 ? (
        <AdminEmptyState
          description={searchQuery ? "Không tìm thấy file nào khớp với từ khóa tìm kiếm." : "Chưa có file hình ảnh nào được lưu trữ trên R2."}
          title="Không có ảnh nào"
        />
      ) : viewMode === "grid" ? (
        /* GRID VIEW */
        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          }}
        >
          {filteredAssets.map((asset) => (
            <div
              className="admin-haravan-card"
              key={asset.id}
              style={{
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                padding: 0,
                transition: "box-shadow 0.2s ease",
              }}
            >
              {/* Thumbnail Container */}
              <div
                style={{
                  alignItems: "center",
                  background: "#f8fafc",
                  borderBottom: "1px solid var(--admin-border-subtle, #f1f5f9)",
                  display: "flex",
                  height: 160,
                  justifyContent: "center",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={asset.altText || asset.originalFilename}
                  loading="lazy"
                  src={asset.publicUrl}
                  style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }}
                />

                {/* Badge Namespace */}
                <span
                  style={{
                    background:
                      asset.namespace === "product"
                        ? "#0284c7"
                        : asset.namespace === "service"
                        ? "#059669"
                        : "#7c3aed",
                    borderRadius: 4,
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 600,
                    left: 8,
                    padding: "2px 6px",
                    position: "absolute",
                    textTransform: "uppercase",
                    top: 8,
                  }}
                >
                  {asset.namespace === "product"
                    ? "Sản phẩm"
                    : asset.namespace === "service"
                    ? "Dịch vụ"
                    : "Biến thể"}
                </span>

                {/* Quick Preview overlay on hover */}
                <button
                  aria-label="Xem ảnh lớn"
                  className="admin-button"
                  onClick={() => setPreviewAsset(asset)}
                  style={{
                    background: "rgba(15, 23, 42, 0.7)",
                    border: "none",
                    borderRadius: "50%",
                    bottom: 8,
                    color: "#fff",
                    cursor: "pointer",
                    height: 32,
                    padding: 0,
                    position: "absolute",
                    right: 8,
                    width: 32,
                  }}
                  type="button"
                >
                  <Eye size={15} style={{ margin: "auto" }} />
                </button>
              </div>

              {/* Info Body */}
              <div style={{ display: "flex", flex: 1, flexDirection: "column", padding: "12px 14px" }}>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 4,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={asset.originalFilename}
                >
                  {asset.originalFilename}
                </span>

                <div style={{ color: "var(--admin-ink-muted, #64748b)", fontSize: 11, marginBottom: 8 }}>
                  <span>{formatBytes(asset.byteSize)}</span> · <span>{formatAdminDate(asset.createdAt)}</span>
                </div>

                {asset.altText ? (
                  <p
                    style={{
                      background: "#f8fafc",
                      borderRadius: 4,
                      color: "var(--admin-ink, #334155)",
                      fontSize: 11,
                      fontStyle: "italic",
                      lineHeight: "1.4",
                      marginBottom: 10,
                      overflow: "hidden",
                      padding: "4px 8px",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={`Mô tả: ${asset.altText}`}
                  >
                    "{asset.altText}"
                  </p>
                ) : (
                  <p style={{ color: "#94a3b8", fontSize: 11, fontStyle: "italic", marginBottom: 10 }}>
                    Chưa có alt text
                  </p>
                )}

                {/* Action Buttons */}
                <div
                  style={{
                    alignItems: "center",
                    borderTop: "1px solid var(--admin-border-subtle, #f1f5f9)",
                    display: "flex",
                    gap: 6,
                    justifyContent: "space-between",
                    marginTop: "auto",
                    paddingTop: 8,
                  }}
                >
                  <button
                    className="admin-button admin-button-quiet"
                    onClick={() => handleCopyUrl(asset)}
                    style={{ fontSize: 11, padding: "3px 6px" }}
                    title="Sao chép liên kết R2"
                    type="button"
                  >
                    {copiedId === asset.id ? <Check color="#059669" size={13} /> : <Copy size={13} />}
                    <span>{copiedId === asset.id ? "Đã copy" : "Copy URL"}</span>
                  </button>

                  <div style={{ display: "flex", gap: 4 }}>
                    {hasWritePermission ? (
                      <button
                        aria-label="Sửa alt text"
                        className="admin-button admin-button-quiet"
                        onClick={() => handleOpenEditAlt(asset)}
                        style={{ padding: "4px 6px" }}
                        title="Sửa alt text"
                        type="button"
                      >
                        <Pencil size={13} />
                      </button>
                    ) : null}

                    {hasWritePermission ? (
                      <button
                        aria-label="Xóa file khỏi R2"
                        className="admin-button admin-button-quiet"
                        onClick={() => {
                          setDeleteConflictMessage(null);
                          setPendingDelete(asset);
                        }}
                        style={{ color: "#ef4444", padding: "4px 6px" }}
                        title="Xóa khỏi R2"
                        type="button"
                      >
                        <Trash2 size={13} />
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="admin-haravan-card" style={{ padding: 0 }}>
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>Ảnh</th>
                  <th>Tên tệp tin</th>
                  <th>Phân loại</th>
                  <th>Mô tả (Alt text)</th>
                  <th>Dung lượng</th>
                  <th>Ngày tải lên</th>
                  <th style={{ textAlign: "right", width: 140 }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.map((asset) => (
                  <tr key={asset.id}>
                    <td>
                      <div
                        onClick={() => setPreviewAsset(asset)}
                        style={{
                          alignItems: "center",
                          background: "#f1f5f9",
                          borderRadius: 4,
                          cursor: "pointer",
                          display: "flex",
                          height: 40,
                          justifyContent: "center",
                          overflow: "hidden",
                          width: 40,
                        }}
                        title="Xem ảnh lớn"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          alt=""
                          src={asset.publicUrl}
                          style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "cover" }}
                        />
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{asset.originalFilename}</div>
                      <div className="admin-mono" style={{ color: "var(--admin-ink-muted)", fontSize: 11 }}>
                        {asset.storageKey}
                      </div>
                    </td>
                    <td>
                      <span
                        className="admin-status-badge"
                        style={{
                          background:
                            asset.namespace === "product"
                              ? "#e0f2fe"
                              : asset.namespace === "service"
                              ? "#d1fae5"
                              : "#ede9fe",
                          color:
                            asset.namespace === "product"
                              ? "#0369a1"
                              : asset.namespace === "service"
                              ? "#047857"
                              : "#6d28d9",
                        }}
                      >
                        {asset.namespace === "product"
                          ? "Sản phẩm"
                          : asset.namespace === "service"
                          ? "Dịch vụ"
                          : "Biến thể"}
                      </span>
                    </td>
                    <td style={{ maxWidth: 220 }}>
                      <span style={{ color: asset.altText ? "inherit" : "#94a3b8", fontStyle: asset.altText ? "normal" : "italic" }}>
                        {asset.altText || "Chưa thiết lập"}
                      </span>
                    </td>
                    <td>{formatBytes(asset.byteSize)}</td>
                    <td>{formatAdminDate(asset.createdAt)}</td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 4 }}>
                        <button
                          className="admin-button admin-button-quiet"
                          onClick={() => handleCopyUrl(asset)}
                          style={{ padding: "4px 8px" }}
                          title="Copy liên kết"
                          type="button"
                        >
                          {copiedId === asset.id ? <Check color="#059669" size={13} /> : <Copy size={13} />}
                        </button>
                        {hasWritePermission ? (
                          <button
                            className="admin-button admin-button-quiet"
                            onClick={() => handleOpenEditAlt(asset)}
                            style={{ padding: "4px 8px" }}
                            title="Sửa Alt text"
                            type="button"
                          >
                            <Pencil size={13} />
                          </button>
                        ) : null}
                        {hasWritePermission ? (
                          <button
                            className="admin-button admin-button-quiet"
                            onClick={() => {
                              setDeleteConflictMessage(null);
                              setPendingDelete(asset);
                            }}
                            style={{ color: "#ef4444", padding: "4px 8px" }}
                            title="Xóa khỏi R2"
                            type="button"
                          >
                            <Trash2 size={13} />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: PREVIEW IMAGE LIGHTBOX */}
      {previewAsset ? (
        <AdminModal
          labelledBy="admin-media-preview-title"
          onClose={() => setPreviewAsset(null)}
          title="Chi tiết tệp R2"
          width="wide"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              style={{
                alignItems: "center",
                background: "#0f172a",
                borderRadius: 8,
                display: "flex",
                justifyContent: "center",
                maxHeight: "65vh",
                overflow: "hidden",
                padding: 16,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={previewAsset.altText || previewAsset.originalFilename}
                src={previewAsset.publicUrl}
                style={{ maxHeight: "55vh", maxWidth: "100%", objectFit: "contain" }}
              />
            </div>

            <div className="admin-haravan-card" style={{ margin: 0, padding: 14 }}>
              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                <div>
                  <span className="admin-label">Tên tệp</span>
                  <strong>{previewAsset.originalFilename}</strong>
                </div>
                <div>
                  <span className="admin-label">Đường dẫn Cloudflare R2 Key</span>
                  <span className="admin-mono" style={{ fontSize: 12 }}>{previewAsset.storageKey}</span>
                </div>
                <div>
                  <span className="admin-label">Dung lượng</span>
                  <span>{formatBytes(previewAsset.byteSize)}</span>
                </div>
                <div>
                  <span className="admin-label">Định dạng MIME</span>
                  <span>{previewAsset.contentType}</span>
                </div>
                <div>
                  <span className="admin-label">Mô tả hiển thị (Alt Text)</span>
                  <span>{previewAsset.altText || "Chưa có"}</span>
                </div>
                <div>
                  <span className="admin-label">Mã băm SHA-256</span>
                  <span className="admin-mono" style={{ fontSize: 11 }}>{previewAsset.checksumSha256.slice(0, 16)}...</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
                <a
                  className="admin-button admin-button-quiet"
                  href={previewAsset.publicUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <ExternalLink size={14} /> Mở tab mới
                </a>
                <button
                  className="admin-button admin-button-primary"
                  onClick={() => handleCopyUrl(previewAsset)}
                  type="button"
                >
                  <Copy size={14} /> Copy đường dẫn
                </button>
              </div>
            </div>
          </div>
        </AdminModal>
      ) : null}

      {/* MODAL 2: EDIT ALT TEXT */}
      {editingAsset ? (
        <AdminModal
          labelledBy="admin-media-alt-title"
          onClose={() => setEditingAsset(null)}
          title="Chỉnh sửa mô tả hình ảnh (Alt Text)"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ color: "var(--admin-ink-muted)", fontSize: 13, margin: 0 }}>
              Alt text hỗ trợ công cụ tìm kiếm (SEO hình ảnh) và người dùng khiếm thị khi duyệt web.
            </p>

            <div style={{ alignItems: "center", display: "flex", gap: 10 }}>
              <div
                style={{
                  background: "#f1f5f9",
                  borderRadius: 6,
                  height: 60,
                  overflow: "hidden",
                  width: 60,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt=""
                  src={editingAsset.publicUrl}
                  style={{ height: "100%", objectFit: "cover", width: "100%" }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {editingAsset.originalFilename}
                </strong>
                <span className="admin-mono" style={{ color: "var(--admin-ink-muted)", fontSize: 11 }}>
                  {editingAsset.storageKey}
                </span>
              </div>
            </div>

            <label className="admin-field">
              <span style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Nội dung Alt Text (SEO)</span>
                <span style={{ color: editAltText.length > 300 ? "#ef4444" : "var(--admin-ink-muted)", fontSize: 12 }}>
                  {editAltText.length}/300
                </span>
              </span>
              <input
                className="admin-input"
                maxLength={300}
                onChange={(e) => setEditAltText(e.target.value)}
                placeholder="Ví dụ: Quy trình gia công đóng gói cà phê hòa tan 3in1..."
                value={editAltText}
              />
            </label>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
              <button
                className="admin-button admin-button-quiet"
                disabled={savingAlt}
                onClick={() => setEditingAsset(null)}
                type="button"
              >
                Hủy
              </button>
              <button
                className="admin-button admin-button-primary"
                disabled={savingAlt || editAltText.length > 300}
                onClick={() => void handleSaveAltText()}
                type="button"
              >
                {savingAlt ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </AdminModal>
      ) : null}

      {/* MODAL 3: DELETE CONFIRMATION OR CONFLICT */}
      {deleteConflictMessage ? (
        <AdminModal
          labelledBy="admin-media-conflict-title"
          onClose={() => {
            setDeleteConflictMessage(null);
            setPendingDelete(null);
          }}
          title="Không thể xóa ảnh đang sử dụng"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              className="admin-editor-error"
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 6,
                color: "#991b1b",
                fontSize: 13,
                padding: "10px 12px",
              }}
            >
              {deleteConflictMessage}
            </div>
            <p style={{ color: "var(--admin-ink-muted)", fontSize: 13, margin: 0 }}>
              Để bảo vệ dữ liệu hiển thị trên website, bạn cần thay thế hoặc gỡ ảnh này khỏi các sản phẩm / dịch vụ đang dùng trước khi xóa khỏi Cloudflare R2.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                className="admin-button admin-button-primary"
                onClick={() => {
                  setDeleteConflictMessage(null);
                  setPendingDelete(null);
                }}
                type="button"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </AdminModal>
      ) : pendingDelete ? (
        <AdminConfirmDialog
          cancelLabel="Hủy"
          confirmKind="danger"
          confirmLabel={deleting ? "Đang xóa..." : "Xóa vĩnh viễn khỏi R2"}
          message={`Bạn có chắc chắn muốn xóa file "${pendingDelete.originalFilename}" khỏi Cloudflare R2? Thao tác này sẽ xóa tệp vĩnh viễn.`}
          onConfirm={() => void handleDeleteAsset()}
          onDismiss={() => setPendingDelete(null)}
          title="Xác nhận xóa tệp R2"
        />
      ) : null}

      {/* MODAL 4: CLEANUP ORPHANS CONFIRMATION */}
      {cleanupModalOpen ? (
        <AdminConfirmDialog
          cancelLabel="Hủy"
          confirmKind="primary"
          confirmLabel={cleaning ? "Đang quét & dọn dẹp..." : "Quét & dọn rác ngay"}
          message="Hệ thống sẽ đối soát toàn bộ tệp tin trong R2 Bucket với cơ sở dữ liệu D1. Các tệp tin mồ côi (không còn bản ghi hoặc bị đánh dấu đã thay thế/xóa) sẽ được xóa an toàn khỏi R2 để tiết kiệm dung lượng."
          onConfirm={() => void handleCleanupOrphans()}
          onDismiss={() => setCleanupModalOpen(false)}
          title="Dọn dẹp tài nguyên rác R2"
        />
      ) : null}
    </div>
  );
}
