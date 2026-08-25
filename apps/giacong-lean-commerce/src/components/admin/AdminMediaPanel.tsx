"use client";

import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { AdminConfirmDialog } from "@/components/admin/AdminDialog";
import { AdminClientError, fetchAdmin, mutateAdmin, type AdminProductVariant } from "@/lib/admin-client";

interface MediaAsset {
  altText: string | null;
  byteSize: number;
  contentType: string;
  id: string;
  originalFilename: string;
  publicUrl: string;
  serviceId: number | null;
  status: string;
  variantId: number | null;
}

interface MediaResponse {
  media: MediaAsset[];
}

interface AdminMediaPanelProps {
  productId?: number;
  serviceId?: number;
  title?: string;
}

export function AdminMediaPanel({ productId, serviceId, title }: AdminMediaPanelProps) {
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [variants, setVariants] = useState<AdminProductVariant[]>([]);
  const [variantId, setVariantId] = useState("");
  const [altText, setAltText] = useState("");
  const [altDrafts, setAltDrafts] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [savingAltId, setSavingAltId] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<MediaAsset | null>(null);
  const [settingMainId, setSettingMainId] = useState<string | null>(null);
  const [error, setError] = useState<AdminClientError | null>(null);

  const loadMedia = useCallback(async () => {
    setLoading(true);
    try {
      const mediaParams = new URLSearchParams();
      if (productId) mediaParams.set("productId", String(productId));
      if (serviceId) mediaParams.set("serviceId", String(serviceId));
      const [mediaResult, variantResult] = await Promise.all([
        fetchAdmin<MediaResponse>(`/api/admin/media?${mediaParams.toString()}`),
        productId
          ? fetchAdmin<{ variants: AdminProductVariant[] }>(`/api/admin/products/${productId}/variants`)
          : Promise.resolve({ variants: [] }),
      ]);
      setMedia(mediaResult.media ?? []);
      setAltDrafts(Object.fromEntries((mediaResult.media ?? []).map((asset) => [asset.id, asset.altText ?? ""])));
      setVariants(variantResult.variants ?? []);
      setError(null);
    } catch (reason: unknown) {
      setError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể tải media.", 0));
    } finally {
      setLoading(false);
    }
  }, [productId, serviceId]);

  useEffect(() => {
    void (async () => {
      await Promise.resolve();
      await loadMedia();
    })();
  }, [loadMedia]);

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
  }

  async function upload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    const form = new FormData();
    form.set("file", file);
    if (productId) form.set("productId", String(productId));
    if (serviceId) form.set("serviceId", String(serviceId));
    if (variantId) form.set("variantId", variantId);
    if (altText.trim()) form.set("altText", altText.trim());
    try {
      const response = await fetch("/api/admin/media", { body: form, credentials: "include", method: "POST" });
      const body = await response.json() as { code?: string; data?: { media: MediaAsset }; message?: string; ok?: boolean };
      if (!response.ok || body.ok === false || !body.data) {
        throw new AdminClientError(body.message ?? "Không thể upload media.", response.status, body.code);
      }
      setFile(null);
      setAltText("");
      setVariantId("");
      await loadMedia();
    } catch (reason: unknown) {
      setError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể upload media.", 0));
    } finally {
      setUploading(false);
    }
  }

  async function saveAltText(asset: MediaAsset) {
    setSavingAltId(asset.id);
    setError(null);
    try {
      const response = await mutateAdmin<{ media: MediaAsset }>(`/api/admin/media/${asset.id}`, {
        body: { altText: altDrafts[asset.id] ?? "" },
        method: "PATCH",
      });
      setMedia((current) => current.map((item) => item.id === asset.id ? response.media : item));
      setAltDrafts((current) => ({ ...current, [asset.id]: response.media.altText ?? "" }));
    } catch (reason: unknown) {
      setError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể cập nhật alt text.", 0));
    } finally {
      setSavingAltId(null);
    }
  }

  async function remove(asset: MediaAsset) {
    setError(null);
    try {
      await mutateAdmin(`/api/admin/media/${asset.id}`, { method: "DELETE" });
      await loadMedia();
    } catch (reason: unknown) {
      setError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể xóa media.", 0));
    }
  }

  // Upload alone never touches the product record; this promotes an asset to the
  // product's main image by re-reading the product and patching only imageUrl.
  async function setAsMainImage(asset: MediaAsset) {
    if (!productId) return;
    setSettingMainId(asset.id);
    setError(null);
    try {
      const { product } = await fetchAdmin<{
        product: {
          categoryId: number | null;
          description: string;
          imageUrl: string | null;
          isActive: boolean;
          leadTimeDays: number | null;
          name: string;
          shortDescription: string;
          sku: string;
          slug: string;
          status: string;
        };
      }>(`/api/admin/products/${productId}`);
      await mutateAdmin(`/api/admin/products/${productId}`, {
        body: {
          categoryId: product.categoryId,
          description: product.description,
          imageUrl: asset.publicUrl,
          isActive: product.isActive,
          leadTimeDays: product.leadTimeDays,
          name: product.name,
          shortDescription: product.shortDescription,
          sku: product.sku,
          slug: product.slug,
          status: product.status,
        },
        method: "PATCH",
      });
      window.dispatchEvent(new CustomEvent("admin:product-updated"));
    } catch (reason: unknown) {
      setError(reason instanceof AdminClientError ? reason : new AdminClientError("Kh\u00f4ng th\u1ec3 \u0111\u1eb7t \u1ea3nh ch\u00ednh.", 0));
    } finally {
      setSettingMainId(null);
    }
  }

  // Same promotion rule for services: re-read, then patch only imageUrl.
  async function setAsServiceMainImage(asset: MediaAsset) {
    if (!serviceId) return;
    setSettingMainId(asset.id);
    setError(null);
    try {
      const { service } = await fetchAdmin<{
        service: {
          description: string;
          imageUrl: string | null;
          isActive: boolean;
          leadTimeDays: number | null;
          moqSummary: string | null;
          name: string;
          slug: string;
          status: string;
          summary: string;
        };
      }>(`/api/admin/services/${serviceId}`);
      await mutateAdmin(`/api/admin/services/${serviceId}`, {
        body: {
          description: service.description,
          imageUrl: asset.publicUrl,
          isActive: service.isActive,
          leadTimeDays: service.leadTimeDays,
          moqSummary: service.moqSummary,
          name: service.name,
          slug: service.slug,
          status: service.status,
          summary: service.summary,
        },
        method: "PATCH",
      });
      window.dispatchEvent(new CustomEvent("admin:service-updated"));
    } catch (reason: unknown) {
      setError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể đặt ảnh chính.", 0));
    } finally {
      setSettingMainId(null);
    }
  }
  return (
    <section className="admin-editor" aria-labelledby="media-editor-heading" style={{ marginTop: 18 }}>
      <div className="admin-editor-heading">
        <div>
          <div className="admin-kicker">Catalog / R2 media</div>
          <h3 className="admin-panel-title" id="media-editor-heading">{title ?? (productId ? "Ảnh sản phẩm và variant" : "Ảnh dịch vụ")}</h3>
          <p className="admin-panel-caption">Upload đi qua Worker vào R2, metadata và checksum SHA-256 được lưu trong D1. Chỉ nhận ảnh tối đa 10 MB.</p>
        </div>
        <span className="admin-stamp">{loading ? "ĐANG TẢI" : `${media.length} ASSETS`}</span>
      </div>
      {error ? <p className="admin-editor-error" role="alert">{error.code ? `${error.code} · ` : ""}{error.message}</p> : null}
      <div className="admin-editor-grid">
        <label className="admin-field admin-field-wide"><span>File ảnh</span><input accept="image/jpeg,image/png,image/webp,image/avif" className="admin-input" onChange={chooseFile} type="file" /></label>
        {productId ? <label className="admin-field"><span>Gắn vào variant</span><select className="admin-select" onChange={(event) => setVariantId(event.target.value)} value={variantId}><option value="">Sản phẩm</option>{variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.name} · {variant.sku}</option>)}</select></label> : <div className="admin-field"><span>Namespace</span><div className="admin-input">Dịch vụ</div></div>}
        <label className="admin-field"><span>Alt text</span><input className="admin-input" maxLength={300} onChange={(event) => setAltText(event.target.value)} placeholder="Mô tả ảnh cho accessibility" value={altText} /></label>
      </div>
      <div className="admin-editor-footer">
        <span className="admin-item-meta">{file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB` : "Chưa chọn file"}</span>
        <button className="admin-button admin-button-primary" disabled={!file || uploading} onClick={() => void upload()} type="button">{uploading ? "Đang upload..." : "Upload vào R2"}</button>
      </div>
      <div className="admin-table-scroll" style={{ marginTop: 18 }}>
        <table className="admin-table">
          <thead><tr><th>Preview</th><th>Asset</th><th>Gắn vào</th><th>Checksum / size</th><th /></tr></thead>
          <tbody>
            {media.map((asset) => <tr key={asset.id}>
              <td>
                {/* R2 media URLs are runtime-generated and intentionally bypass Next image optimization. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt={asset.altText ?? ""} src={asset.publicUrl} style={{ borderRadius: 8, height: 52, objectFit: "cover", width: 72 }} />
              </td>
              <td><strong>{asset.originalFilename}</strong><div className="admin-item-meta">{asset.contentType}{asset.altText ? ` · ${asset.altText}` : ""}</div></td>
              <td>{asset.serviceId ? "Dịch vụ" : asset.variantId ? variants.find((variant) => variant.id === asset.variantId)?.name ?? `Variant #${asset.variantId}` : "Sản phẩm"}</td>
              <td className="admin-mono"><div>{formatBytes(asset.byteSize)}</div><div className="admin-item-meta">{asset.id.slice(0, 8)}…</div></td>
              <td>
                <div className="admin-table-actions">
                  <input
                    aria-label={`Alt text cho ${asset.originalFilename}`}
                    className="admin-input"
                    maxLength={300}
                    onChange={(event) => setAltDrafts((current) => ({ ...current, [asset.id]: event.target.value }))}
                    value={altDrafts[asset.id] ?? ""}
                  />
                  <button className="admin-button admin-button-quiet" disabled={savingAltId === asset.id} onClick={() => void saveAltText(asset)} type="button">{savingAltId === asset.id ? "Đang lưu" : "Lưu alt"}</button>
                  {productId && !variantId ? (
                    <button
                      className="admin-button admin-button-quiet"
                      data-testid={`button-media-set-main-${asset.id}`}
                      disabled={settingMainId === asset.id}
                      onClick={() => void setAsMainImage(asset)}
                      type="button"
                    >
                      {settingMainId === asset.id ? "Đang đặt..." : "Dùng làm ảnh chính"}
                    </button>
                  ) : null}
                  {serviceId ? (
                    <button
                      className="admin-button admin-button-quiet"
                      data-testid={`button-media-set-service-main-${asset.id}`}
                      disabled={settingMainId === asset.id}
                      onClick={() => void setAsServiceMainImage(asset)}
                      type="button"
                    >
                      {settingMainId === asset.id ? "Đang đặt..." : "Dùng làm ảnh chính"}
                    </button>
                  ) : null}
                  <button className="admin-button admin-button-danger" onClick={() => setPendingRemove(asset)} type="button">Xóa</button>
                </div>
              </td>
            </tr>)}
            {!loading && media.length === 0 ? <tr><td colSpan={5}>Chưa có media. Asset sẽ được lưu theo namespace product hoặc variant.</td></tr> : null}
          </tbody>
        </table>
      </div>
          {pendingRemove ? (
        <AdminConfirmDialog
          confirmLabel="Xóa media"
          message={`Xóa asset “${pendingRemove.originalFilename}”? Dữ liệu metadata sẽ giữ lại ở trạng thái deleted.`}
          onConfirm={() => void remove(pendingRemove)}
          onDismiss={() => setPendingRemove(null)}
          title="Xóa media asset?"
        />
      ) : null}
</section>
  );
}

function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(2)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}