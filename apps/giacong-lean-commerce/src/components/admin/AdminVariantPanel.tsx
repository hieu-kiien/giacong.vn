"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { AdminConfirmDialog } from "@/components/admin/AdminDialog";
import { useRegisterAdminUnsaved } from "@/components/admin/AdminUnsavedGuard";
import { AdminClientError, fetchAdmin, mutateAdmin, type AdminProductVariant, type AdminTierPrice } from "@/lib/admin-client";

interface VariantResponse {
  variants: AdminProductVariant[];
}

interface VariantDraft {
  attributeCode: string;
  attributeId: string;
  attributeLabel: string;
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

/** Suggest a stable, readable SKU from the option label so staff never have to invent one. */
function suggestVariantSku(productId: number, label: string): string {
  const slug = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `QC-${productId}-${slug}`.slice(0, 100) : "";
}

/** Saving of each higher tier versus the lowest-quantity (retail) tier, computed from the entered prices. */
function describeTierSaving(tiers: VariantDraft["tierPrices"], index: number): string {
  const parsed = tiers
    .map((tier, tierIndex) => ({ index: tierIndex, minQuantity: Number(tier.minQuantity), price: Number(tier.price) }))
    .filter((tier) => Number.isFinite(tier.minQuantity) && tier.minQuantity > 0 && Number.isFinite(tier.price) && tier.price > 0);
  if (parsed.length < 2) return "—";
  const base = parsed.reduce((lowest, tier) => (tier.minQuantity < lowest.minQuantity ? tier : lowest));
  const current = parsed.find((tier) => tier.index === index);
  if (!current) return "—";
  if (current.index === base.index) return "Giá lẻ";
  const percent = Math.round((1 - current.price / base.price) * 100);
  return percent > 0 ? `Giảm ${percent}%` : "—";
}

export function AdminVariantPanel({ productId }: { productId: number }) {
  const [variants, setVariants] = useState<AdminProductVariant[]>([]);
  const [draft, setDraft] = useState<VariantDraft>(blankDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pendingArchive, setPendingArchive] = useState<AdminProductVariant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<AdminClientError | null>(null);
  const [draftSnapshot, setDraftSnapshot] = useState<VariantDraft>(blankDraft);
  const variantRequestRef = useRef<{ key: string; requestId: string } | null>(null);
  const isUnsavedDirty = useCallback(() => JSON.stringify(draft) !== JSON.stringify(draftSnapshot), [draft, draftSnapshot]);
  useRegisterAdminUnsaved(isUnsavedDirty, saving);

  const loadVariants = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchAdmin<VariantResponse>(`/api/admin/products/${productId}/variants`);
      setVariants(result.variants ?? []);
      setError(null);
    } catch (reason: unknown) {
      setError(reason instanceof AdminClientError ? reason : new AdminClientError("Không thể tải danh sách quy cách. Hãy thử lại.", 0));
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
    const nextDraft = toDraft(variant);
    setEditingId(variant.id);
    setDraft(nextDraft);
    setDraftSnapshot(nextDraft);
    setError(null);
  }

  function resetDraft() {
    const nextDraft = { ...blankDraft, tierPrices: [{ ...blankDraft.tierPrices[0] }] };
    setEditingId(null);
    setDraft(nextDraft);
    setDraftSnapshot(nextDraft);
    setError(null);
  }

  async function saveVariant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const optionLabel = draft.optionLabel.trim();
    const payload = {
      ...draft,
      attributeId: Number(draft.attributeId),
      contactFromQuantity: editingId
        ? variants.find((variant) => variant.id === editingId)?.contactFromQuantity ?? 1
        : Math.max(Number(draft.moq), ...draft.tierPrices.map((tier) => Number(tier.minQuantity))) + Number(draft.quantityStep),
      moq: Number(draft.moq),
      // One visible name: the internal name follows the option label unless an older record already has its own.
      name: draft.name.trim() || optionLabel,
      optionId: Number(draft.optionId),
      optionLabel,
      quantityStep: Number(draft.quantityStep),
      sku: draft.sku.trim() || suggestVariantSku(productId, optionLabel),
      sortOrder: Number(draft.sortOrder),
      tierPrices: draft.tierPrices.map((tier) => ({
        currency: "VND" as const,
        minQuantity: Number(tier.minQuantity),
        price: Number(tier.price),
      })),
    };
    const requestKey = JSON.stringify({ payload, productId, editingId });
    const requestId = variantRequestRef.current?.key === requestKey
      ? variantRequestRef.current.requestId
      : crypto.randomUUID();
    variantRequestRef.current = { key: requestKey, requestId };
    try {
      await mutateAdmin(
        editingId
          ? `/api/admin/products/${productId}/variants/${editingId}`
          : `/api/admin/products/${productId}/variants`,
        { body: { ...payload, requestId }, method: editingId ? "PATCH" : "POST" },
      );
      if (variantRequestRef.current?.key === requestKey) variantRequestRef.current = null;
      await loadVariants();
      resetDraft();
    } catch (reason: unknown) {
      setError(reason instanceof AdminClientError ? reason : new AdminClientError("Chưa lưu được quy cách. Hãy thử lại.", 0));
    } finally {
      setSaving(false);
    }
  }

  async function archiveVariant(variant: AdminProductVariant) {
    setError(null);
    try {
      await mutateAdmin(`/api/admin/products/${productId}/variants/${variant.id}`, {
        body: { requestId: crypto.randomUUID(), revision: variant.revision },
        method: "DELETE",
      });
      await loadVariants();
      if (editingId === variant.id) resetDraft();
    } catch (reason: unknown) {
      setError(reason instanceof AdminClientError ? reason : new AdminClientError("Chưa ẩn được quy cách. Hãy thử lại.", 0));
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

  const skuSuggestion = suggestVariantSku(productId, draft.optionLabel);

  return (
    <section className="admin-editor" aria-labelledby="variant-editor-heading" style={{ marginTop: 18 }}>
      <div className="admin-editor-heading">
        <div>
          <div className="admin-kicker">Giá bán</div>
          <h3 className="admin-panel-title" id="variant-editor-heading">Quy cách và bảng giá</h3>
          <p className="admin-panel-caption">
            Mỗi quy cách (ví dụ: hộp 500g, thùng 20kg) có giá riêng. Thêm giá theo số lượng nếu muốn bán sỉ. Khách luôn chốt đơn qua Zalo.
          </p>
        </div>
        <span className="admin-stamp">{loading ? "ĐANG TẢI" : `${variants.length} QUY CÁCH`}</span>
      </div>
      {error ? <p className="admin-editor-error" role="alert">{error.message}</p> : null}
      <div className="admin-table-scroll">
        <table className="admin-table">
          <thead><tr><th>Quy cách</th><th>Mua tối thiểu</th><th>Bảng giá</th><th>Trạng thái</th><th /></tr></thead>
          <tbody>
            {variants.map((variant) => (
              <tr key={variant.id}>
                <td><strong>{variant.optionLabel || variant.name}</strong><div className="admin-item-meta">Mã: {variant.sku}</div></td>
                <td className="admin-mono">{variant.moq} {variant.unit}{variant.quantityStep > 1 ? ` · tăng theo ${variant.quantityStep}` : ""}</td>
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
            {!loading && variants.length === 0 ? <tr><td colSpan={5}>Chưa có quy cách nào. Thêm quy cách đầu tiên bên dưới để sản phẩm có giá.</td></tr> : null}
          </tbody>
        </table>
      </div>
      <form onSubmit={saveVariant} style={{ marginTop: 18 }}>
        <div className="admin-editor-heading" style={{ padding: 0, marginBottom: 12 }}>
          <div><strong>{editingId ? "Sửa quy cách" : "Thêm quy cách"}</strong><div className="admin-item-meta">Nếu sản phẩm chỉ có một loại, chỉ cần thêm một quy cách.</div></div>
          {editingId ? <button className="admin-button admin-button-quiet" onClick={resetDraft} type="button">Thêm quy cách mới</button> : null}
        </div>
        <div className="admin-editor-grid">
          <Field label="Tên quy cách" value={draft.optionLabel} onChange={(value) => updateDraft("optionLabel", value)} placeholder="Ví dụ: Hộp 500g" required />
          <Field label="Đơn vị bán" value={draft.unit} onChange={(value) => updateDraft("unit", value)} placeholder="hộp, thùng, kg..." required />
          <Field label="Số lượng mua tối thiểu" mono type="number" min="1" value={draft.moq} onChange={(value) => updateDraft("moq", value)} required />
        </div>
        <div className="admin-editor-grid">
          <label className="admin-field admin-field-wide">
            <span>Ảnh riêng cho quy cách (tùy chọn)</span>
            <input className="admin-input" onChange={(event) => updateDraft("imageUrl", event.target.value)} placeholder="/media/products/... hoặc https://..." value={draft.imageUrl} />
          </label>
        </div>
        <div className="admin-panel-heading" style={{ padding: "16px 0 8px" }}>
          <div>
            <strong>Bảng giá (VND)</strong>
            <div className="admin-item-meta">Dòng đầu là giá lẻ, bắt đầu từ số lượng mua tối thiểu. Thêm dòng để giảm giá khi khách mua nhiều.</div>
          </div>
          <button className="admin-button admin-button-quiet" onClick={() => updateDraft("tierPrices", [...draft.tierPrices, { minQuantity: "", price: "" }])} type="button">+ Thêm mức giá</button>
        </div>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead><tr><th>Từ số lượng</th><th>Đơn giá (VND / {draft.unit.trim() || "đơn vị"})</th><th>So với giá lẻ</th><th /></tr></thead>
            <tbody>
              {draft.tierPrices.map((tier, index) => (
                <tr key={`${index}-${tier.minQuantity}`}>
                  <td><input aria-label={`Mức giá ${index + 1} từ số lượng`} className="admin-input admin-mono" min="1" onChange={(event) => updateTier(index, "minQuantity", event.target.value)} required type="number" value={tier.minQuantity} /></td>
                  <td><input aria-label={`Mức giá ${index + 1} đơn giá`} className="admin-input admin-mono" min="1" onChange={(event) => updateTier(index, "price", event.target.value)} required type="number" value={tier.price} /></td>
                  <td className="admin-mono">{describeTierSaving(draft.tierPrices, index)}</td>
                  <td><button className="admin-button admin-button-danger" onClick={() => updateDraft("tierPrices", draft.tierPrices.filter((_, tierIndex) => tierIndex !== index))} type="button">Xóa</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <details className="admin-variant-advanced">
          <summary>Tùy chọn nâng cao</summary>
          <p className="admin-field-hint">Thường không cần chỉnh. Mã hàng tự tạo theo tên quy cách nếu để trống.</p>
          <div className="admin-editor-grid">
            <Field label="Mã hàng (SKU)" mono value={draft.sku} onChange={(value) => updateDraft("sku", value)} placeholder={skuSuggestion || "Tự tạo theo tên quy cách"} />
            <Field label="Số lượng tăng theo bước" mono type="number" min="1" value={draft.quantityStep} onChange={(value) => updateDraft("quantityStep", value)} />
            <Field label="Thứ tự hiển thị" mono type="number" min="0" value={draft.sortOrder} onChange={(value) => updateDraft("sortOrder", value)} />
          </div>
          <p className="admin-field-hint">Chỉ đổi các mã dưới đây khi đang đồng bộ với một nhóm thuộc tính đã có.</p>
          <div className="admin-editor-grid">
            <Field label="Mã nhóm (số)" mono type="number" min="1" value={draft.attributeId} onChange={(value) => updateDraft("attributeId", value)} />
            <Field label="Mã nhóm (chữ)" mono value={draft.attributeCode} onChange={(value) => updateDraft("attributeCode", value)} />
            <Field label="Tên nhóm lựa chọn" value={draft.attributeLabel} onChange={(value) => updateDraft("attributeLabel", value)} />
            <Field label="Mã lựa chọn (số)" mono type="number" min="1" value={draft.optionId} onChange={(value) => updateDraft("optionId", value)} />
          </div>
        </details>
        <div className="admin-editor-footer">
          <label className="admin-check"><input checked={draft.isAvailable} onChange={(event) => updateDraft("isAvailable", event.target.checked)} type="checkbox" /><span><strong>Đang bán quy cách này</strong><small>Bỏ chọn để tạm ẩn, bảng giá vẫn được giữ.</small></span></label>
          <div className="admin-editor-actions"><button className="admin-button admin-button-quiet" onClick={resetDraft} type="button">Hủy</button><button className="admin-button admin-button-primary" disabled={saving} type="submit">{saving ? "Đang lưu..." : "Lưu quy cách"}</button></div>
        </div>
      </form>

      {pendingArchive ? (
        <AdminConfirmDialog
          confirmLabel="Ẩn quy cách"
          message={`Ẩn quy cách “${pendingArchive.optionLabel || pendingArchive.name}” khỏi trang web? Bảng giá vẫn được giữ.`}
          onConfirm={() => void archiveVariant(pendingArchive)}
          onDismiss={() => setPendingArchive(null)}
          title="Ẩn quy cách?"
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
  placeholder,
  required = false,
  type = "text",
  value,
}: {
  label: string;
  mono?: boolean;
  min?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return <label className="admin-field"><span>{label}{required ? <b aria-hidden="true"> *</b> : null}</span><input className={`admin-input${mono ? " admin-mono" : ""}`} min={min} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} type={type} value={value} /></label>;
}

function toDraft(variant: AdminProductVariant): VariantDraft {
  return {
    attributeCode: variant.attributeCode,
    attributeId: String(variant.attributeId),
    attributeLabel: variant.attributeLabel,
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
  return tiers.length ? tiers.map((tier) => `từ ${tier.minQuantity}: ${tier.price.toLocaleString("vi-VN")}đ`).join(" · ") : "Chưa có giá";
}
