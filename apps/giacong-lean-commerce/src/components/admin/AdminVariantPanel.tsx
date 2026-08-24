"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AdminConfirmDialog } from "@/components/admin/AdminDialog";
import { AdminClientError, fetchAdmin, mutateAdmin, type AdminProductVariant, type AdminTierPrice } from "@/lib/admin-client";

interface VariantResponse {
  variants: AdminProductVariant[];
}

interface VariantDraft {
  attributeCode: string;
  attributeId: string;
  attributeLabel: string;
  contactFromQuantity: string;
  imageUrl: string;
  isAvailable: boolean;
  moq: string;
  name: string;
  optionId: string;
  optionLabel: string;
  quantityStep: string;
  revision?: number;
  sku: string;
  sortOrder: string;
  tierPrices: Array<{ minQuantity: string; price: string }>;
  unit: string;
}

const blankDraft: VariantDraft = {
  attributeCode: "b2b_variant",
  attributeId: "31",
  attributeLabel: "Phiên bản",
  contactFromQuantity: "100",
  imageUrl: "",
  isAvailable: true,
  moq: "1",
  name: "",
  optionId: "1",
  optionLabel: "",
  quantityStep: "1",
  sku: "",
  sortOrder: "0",
  tierPrices: [{ minQuantity: "1", price: "" }],
  unit: "đơn vị",
};

export function AdminVariantPanel({ productId }: { productId: number }) {
  const [variants, setVariants] = useState<AdminProductVariant[]>([]);
  const [draft, setDraft] = useState<VariantDraft>(blankDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pendingArchive, setPendingArchive] = useState<AdminProductVariant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<AdminClientError | null>(null);

  const loadVariants = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchAdmin<VariantResponse>(`/api/admin/products/${productId}/variants`);
      setVariants(result.variants ?? []);
      setError(null);
    } catch (reason: unknown) {
      setError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể tải variants.", 0));
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    void (async () => {
      await Promise.resolve();
      await loadVariants();
    })();
  }, [loadVariants]);

  function editVariant(variant: AdminProductVariant) {
    setEditingId(variant.id);
    setDraft(toDraft(variant));
    setError(null);
  }

  function resetDraft() {
    setEditingId(null);
    setDraft({ ...blankDraft, tierPrices: [{ ...blankDraft.tierPrices[0] }] });
    setError(null);
  }

  async function saveVariant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      ...draft,
      attributeId: Number(draft.attributeId),
      contactFromQuantity: Number(draft.contactFromQuantity),
      moq: Number(draft.moq),
      optionId: Number(draft.optionId),
      quantityStep: Number(draft.quantityStep),
      sortOrder: Number(draft.sortOrder),
      tierPrices: draft.tierPrices.map((tier) => ({
        currency: "VND" as const,
        minQuantity: Number(tier.minQuantity),
        price: Number(tier.price),
      })),
    };
    try {
      await mutateAdmin(
        editingId
          ? `/api/admin/products/${productId}/variants/${editingId}`
          : `/api/admin/products/${productId}/variants`,
        { body: payload, method: editingId ? "PATCH" : "POST" },
      );
      await loadVariants();
      resetDraft();
    } catch (reason: unknown) {
      setError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể lưu variant.", 0));
    } finally {
      setSaving(false);
    }
  }

  async function archiveVariant(variant: AdminProductVariant) {
    setError(null);
    try {
      await mutateAdmin(`/api/admin/products/${productId}/variants/${variant.id}`, { method: "DELETE" });
      await loadVariants();
      if (editingId === variant.id) resetDraft();
    } catch (reason: unknown) {
      setError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể ẩn variant.", 0));
    }
  }

  function updateDraft<K extends keyof VariantDraft>(key: K, value: VariantDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateTier(index: number, key: "minQuantity" | "price", value: string) {
    setDraft((current) => ({
      ...current,
      tierPrices: current.tierPrices.map((tier, tierIndex) => tierIndex === index ? { ...tier, [key]: value } : tier),
    }));
  }

  return (
    <section className="admin-editor" aria-labelledby="variant-editor-heading" style={{ marginTop: 18 }}>
      <div className="admin-editor-heading">
        <div>
          <div className="admin-kicker">Catalog / variants</div>
          <h3 className="admin-panel-title" id="variant-editor-heading">Biến thể, MOQ và bảng giá</h3>
          <p className="admin-panel-caption">Các bậc giá phải bắt đầu tại MOQ, tăng theo quantity step và nằm trước ngưỡng chuyển sang yêu cầu báo giá.</p>
        </div>
        <span className="admin-stamp">{loading ? "ĐANG TẢI" : `${variants.length} VARIANTS`}</span>
      </div>
      {error ? <p className="admin-editor-error" role="alert">{error.code ? `${error.code} · ` : ""}{error.message}</p> : null}
      <div className="admin-table-scroll">
        <table className="admin-table">
          <thead><tr><th>Variant</th><th>MOQ / bước</th><th>Ngưỡng liên hệ</th><th>Bảng giá</th><th>Trạng thái</th><th /></tr></thead>
          <tbody>
            {variants.map((variant) => (
              <tr key={variant.id}>
                <td><strong>{variant.name}</strong><div className="admin-item-meta">{variant.sku} · {variant.optionLabel}</div></td>
                <td className="admin-mono">{variant.moq} / {variant.quantityStep} {variant.unit}</td>
                <td className="admin-mono">{variant.contactFromQuantity}</td>
                <td className="admin-mono">{formatTiers(variant.tierPrices)}</td>
                <td>{variant.isAvailable ? "Đang bán" : "Đã ẩn"}</td>
                <td>
                  <div className="admin-table-actions">
                    <button className="admin-button admin-button-quiet" onClick={() => editVariant(variant)} type="button">Sửa</button>
                    {variant.isAvailable ? <button className="admin-button admin-button-danger" onClick={() => setPendingArchive(variant)} type="button">Ẩn</button> : null}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && variants.length === 0 ? <tr><td colSpan={6}>Chưa có variant. Tạo variant đầu tiên bên dưới.</td></tr> : null}
          </tbody>
        </table>
      </div>
      <form onSubmit={saveVariant} style={{ marginTop: 18 }}>
        <div className="admin-editor-heading" style={{ padding: 0, marginBottom: 12 }}>
          <div><strong>{editingId ? `Sửa variant #${editingId}` : "Thêm variant"}</strong><div className="admin-item-meta">SKU phải duy nhất trên toàn catalog.</div></div>
          {editingId ? <button className="admin-button admin-button-quiet" onClick={resetDraft} type="button">Tạo mới</button> : null}
        </div>
        <div className="admin-editor-grid">
          <Field label="Tên variant" value={draft.name} onChange={(value) => updateDraft("name", value)} required />
          <Field label="SKU" mono value={draft.sku} onChange={(value) => updateDraft("sku", value)} required />
          <Field label="Nhãn lựa chọn" value={draft.optionLabel} onChange={(value) => updateDraft("optionLabel", value)} required />
          <Field label="Đơn vị" value={draft.unit} onChange={(value) => updateDraft("unit", value)} required />
          <Field label="MOQ" mono type="number" min="1" value={draft.moq} onChange={(value) => updateDraft("moq", value)} required />
          <Field label="Bước số lượng" mono type="number" min="1" value={draft.quantityStep} onChange={(value) => updateDraft("quantityStep", value)} required />
          <Field label="Ngưỡng liên hệ" mono type="number" min="2" value={draft.contactFromQuantity} onChange={(value) => updateDraft("contactFromQuantity", value)} required />
          <Field label="Thứ tự" mono type="number" min="0" value={draft.sortOrder} onChange={(value) => updateDraft("sortOrder", value)} required />
          <Field label="Attribute ID" mono type="number" min="1" value={draft.attributeId} onChange={(value) => updateDraft("attributeId", value)} required />
          <Field label="Attribute code" mono value={draft.attributeCode} onChange={(value) => updateDraft("attributeCode", value)} required />
          <Field label="Tên nhóm lựa chọn" value={draft.attributeLabel} onChange={(value) => updateDraft("attributeLabel", value)} required />
          <Field label="Option ID" mono type="number" min="1" value={draft.optionId} onChange={(value) => updateDraft("optionId", value)} required />
          <label className="admin-field admin-field-wide">
            <span>Ảnh variant</span>
            <input className="admin-input" onChange={(event) => updateDraft("imageUrl", event.target.value)} placeholder="/media/products/... hoặc https://..." value={draft.imageUrl} />
          </label>
        </div>
        <div className="admin-panel-heading" style={{ padding: "16px 0 8px" }}><div><strong>Bậc giá (VND)</strong><div className="admin-item-meta">Để trống nếu variant chỉ nhận báo giá thủ công.</div></div><button className="admin-button admin-button-quiet" onClick={() => updateDraft("tierPrices", [...draft.tierPrices, { minQuantity: "", price: "" }])} type="button">+ Thêm bậc</button></div>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead><tr><th>Số lượng tối thiểu</th><th>Giá / đơn vị</th><th /></tr></thead>
            <tbody>
              {draft.tierPrices.map((tier, index) => (
                <tr key={`${index}-${tier.minQuantity}`}>
                  <td><input aria-label={`Bậc ${index + 1} số lượng`} className="admin-input admin-mono" min="1" onChange={(event) => updateTier(index, "minQuantity", event.target.value)} required={index === 0} type="number" value={tier.minQuantity} /></td>
                  <td><input aria-label={`Bậc ${index + 1} giá`} className="admin-input admin-mono" min="1" onChange={(event) => updateTier(index, "price", event.target.value)} required={index === 0} type="number" value={tier.price} /></td>
                  <td>{draft.tierPrices.length > 1 ? <button className="admin-button admin-button-danger" onClick={() => updateDraft("tierPrices", draft.tierPrices.filter((_, tierIndex) => tierIndex !== index))} type="button">Xóa</button> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="admin-editor-footer">
          <label className="admin-check"><input checked={draft.isAvailable} onChange={(event) => updateDraft("isAvailable", event.target.checked)} type="checkbox" /><span><strong>Cho phép chọn trên storefront</strong><small>Ẩn tạm không xóa dữ liệu bậc giá.</small></span></label>
          <div className="admin-editor-actions"><button className="admin-button admin-button-quiet" onClick={resetDraft} type="button">Hủy</button><button className="admin-button admin-button-primary" disabled={saving} type="submit">{saving ? "Đang lưu..." : "Lưu variant"}</button></div>
        </div>
      </form>
    
      {pendingArchive ? (
        <AdminConfirmDialog
          confirmLabel="Ẩn variant"
          message={`Ẩn variant “${pendingArchive.name}” khỏi lựa chọn public? Dữ liệu tier price vẫn được giữ.`}
          onConfirm={() => void archiveVariant(pendingArchive)}
          onDismiss={() => setPendingArchive(null)}
          title="Ẩn variant?"
        />
      ) : null}
</section>
  );
}

function Field({
  label,
  mono = false,
  min,
  onChange,
  required = false,
  type = "text",
  value,
}: {
  label: string;
  mono?: boolean;
  min?: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return <label className="admin-field"><span>{label}{required ? <b aria-hidden="true"> *</b> : null}</span><input className={`admin-input${mono ? " admin-mono" : ""}`} min={min} onChange={(event) => onChange(event.target.value)} required={required} type={type} value={value} /></label>;
}

function toDraft(variant: AdminProductVariant): VariantDraft {
  return {
    attributeCode: variant.attributeCode,
    attributeId: String(variant.attributeId),
    attributeLabel: variant.attributeLabel,
    contactFromQuantity: String(variant.contactFromQuantity),
    imageUrl: variant.imageUrl ?? "",
    isAvailable: variant.isAvailable,
    moq: String(variant.moq),
    name: variant.name,
    optionId: String(variant.optionId),
    optionLabel: variant.optionLabel,
    quantityStep: String(variant.quantityStep),
    revision: variant.revision,
    sku: variant.sku,
    sortOrder: String(variant.sortOrder),
    tierPrices: variant.tierPrices.map((tier) => ({ minQuantity: String(tier.minQuantity), price: String(tier.price) })),
    unit: variant.unit,
  };
}

function formatTiers(tiers: AdminTierPrice[]): string {
  return tiers.length ? tiers.map((tier) => `${tier.minQuantity}: ${tier.price.toLocaleString("vi-VN")}`).join(" · ") : "Báo giá";
}