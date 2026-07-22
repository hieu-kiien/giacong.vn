"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CommercialVariantEditor } from "@/components/admin/CommercialVariantEditor";
import {
  draftToRequest,
  legacyErrorLabel,
  productToDraft,
  validateCommercialDraft,
  type CommercialErrors,
} from "@/components/admin/commercial-rules";
import type { AdminProductDetail } from "@/lib/admin-contract";

export function ProductCommercialEditor({ initialProduct }: { initialProduct: AdminProductDetail }) {
  const [product, setProduct] = useState(initialProduct);
  const [draft, setDraft] = useState(() => productToDraft(initialProduct));
  const [errors, setErrors] = useState<CommercialErrors>({});
  const [notice, setNotice] = useState("");
  const [conflict, setConflict] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);
  const router = useRouter();

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current) return;
    const validation = validateCommercialDraft(draft);
    setErrors(validation);
    setNotice("");
    setConflict(false);
    if (Object.keys(validation).length > 0) {
      setNotice("Kiểm tra các trường được đánh dấu trước khi lưu.");
      focusPath(Object.keys(validation)[0]);
      return;
    }
    submitLock.current = true;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/quan-tri/san-pham/${encodeURIComponent(product.slug)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftToRequest(draft)),
      });
      const payload = await safeJson(response);
      if (response.status === 200) {
        const canonical = canonicalProduct(payload, draft.variants.map((variant) => variant.id));
        if (!canonical) {
          setNotice("Phản hồi lưu không hợp lệ. Bản nháp vẫn được giữ nguyên.");
          return;
        }
        setProduct(canonical);
        setDraft(productToDraft(canonical));
        setErrors({});
        setNotice("Đã lưu thay đổi.");
        router.refresh();
        return;
      }
      if (response.status === 401 || response.status === 419) {
        const returnTo = `${window.location.pathname}${window.location.search}`;
        router.replace(`/quan-tri/dang-nhap?returnTo=${encodeURIComponent(returnTo)}`);
        return;
      }
      if (response.status === 412) {
        setConflict(true);
        setNotice("Dữ liệu đã thay đổi ở nơi khác. Bản nháp của bạn vẫn được giữ nguyên.");
        return;
      }
      if (response.status === 422) {
        const serverErrors = validationFields(payload);
        setErrors(serverErrors);
        setNotice("Dữ liệu chưa hợp lệ. Bản nháp vẫn được giữ nguyên.");
        if (Object.keys(serverErrors).length > 0) focusPath(Object.keys(serverErrors)[0]);
        return;
      }
      if (response.status === 403) {
        setNotice("Bạn không có quyền lưu sản phẩm này. Bản nháp vẫn được giữ nguyên.");
        return;
      }
      setNotice(response.status === 504
        ? "Dịch vụ quản trị phản hồi chậm. Bản nháp vẫn được giữ nguyên; hãy thử lại."
        : "Dịch vụ quản trị tạm thời không khả dụng. Bản nháp vẫn được giữ nguyên; hãy thử lại.");
    } catch {
      setNotice("Không thể kết nối để lưu. Bản nháp vẫn được giữ nguyên; hãy thử lại.");
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={save} noValidate className="mt-6">
      <section className="rounded-lg border border-[#d7d8c9] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Trạng thái sản phẩm</h2>
            <p className="mt-1 max-w-2xl text-sm text-[#59634d]">Chỉ sản phẩm và biến thể được xuất bản, có quy tắc hợp lệ mới xuất hiện trong khu vực mua hàng.</p>
          </div>
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-[#cfd1bf] bg-[#fbfbf5] px-4 text-sm font-semibold">
            <input
              id="commercial-published"
              type="checkbox"
              checked={draft.published}
              aria-invalid={Boolean(errors.published)}
              aria-describedby={errors.published ? "commercial-published-error" : undefined}
              onChange={(event) => setDraft({ ...draft, published: event.target.checked })}
            />
            Xuất bản sản phẩm
          </label>
        </div>
        {errors.published && <p id="commercial-published-error" className="mt-2 text-sm text-[#9a3412]">{errors.published}</p>}
        {product.validation_errors.length > 0 && (
          <div className="mt-4 rounded-md border border-[#e0c69b] bg-[#fff9ed] p-3 text-sm text-[#714d18]">
            <p className="font-medium">Sản phẩm có dữ liệu cũ cần hoàn thiện</p>
            <ul className="mt-1 list-disc pl-5">{product.validation_errors.map((error) => <li key={error}>{legacyErrorLabel(error)}</li>)}</ul>
          </div>
        )}
      </section>

      <section className="mt-6" aria-labelledby="variant-editor-title">
        <div className="mb-3">
          <h2 id="variant-editor-title" className="text-lg font-semibold">Biến thể và giá bán</h2>
          <p className="mt-1 text-sm text-[#59634d]">Lưu một lần cho toàn bộ {draft.variants.length} biến thể.</p>
        </div>
        <div className="space-y-4">
          {draft.variants.map((variant, index) => (
            <CommercialVariantEditor
              key={variant.id}
              index={index}
              variant={variant}
              errors={errors}
              onChange={(next) => setDraft({
                ...draft,
                variants: draft.variants.map((current) => current.id === next.id ? next : current),
              })}
            />
          ))}
        </div>
      </section>

      <div data-admin-save-bar="true" className="sticky bottom-3 z-20 mt-5 rounded-lg border border-[#c4c8ad] bg-[#f8f8f1]/95 p-3 shadow-[0_5px_22px_rgba(39,51,38,0.13)] backdrop-blur sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div aria-live="polite" role="status" className="min-h-5 text-sm text-[#59634d]">
          {notice || "Các thay đổi chỉ có hiệu lực sau khi lưu."}
          {conflict && <button type="button" onClick={() => window.location.reload()} className="ml-2 font-semibold text-[#3f5712] underline underline-offset-2">Tải dữ liệu mới nhất</button>}
        </div>
        <button type="submit" disabled={submitting} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-[#526f18] px-5 text-sm font-semibold text-white hover:bg-[#405b11] disabled:cursor-wait disabled:opacity-65 sm:mt-0 sm:w-auto">
          <Save size={17} aria-hidden /> {submitting ? "Đang lưu…" : "Lưu thay đổi"}
        </button>
      </div>
    </form>
  );
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json() as unknown;
  } catch {
    return null;
  }
}

function canonicalProduct(payload: unknown, expectedIds: number[]): AdminProductDetail | null {
  if (!isRecord(payload) || !isRecord(payload.data)) return null;
  const data = payload.data;
  if (typeof data.resource_version !== "string" || !/^"[a-f0-9]{64}"$/.test(data.resource_version) || !Array.isArray(data.variants)) return null;
  const ids = data.variants.map((variant) => isRecord(variant) && typeof variant.id === "number" ? variant.id : null);
  if (ids.some((id) => id === null) || ids.length !== expectedIds.length || !expectedIds.every((id) => ids.includes(id))) return null;
  return data as unknown as AdminProductDetail;
}

function validationFields(payload: unknown): CommercialErrors {
  if (!isRecord(payload) || !isRecord(payload.fields)) return {};
  const errors: CommercialErrors = {};
  for (const [path, messages] of Object.entries(payload.fields)) {
    if (Array.isArray(messages) && typeof messages[0] === "string") errors[path] = messages[0];
  }
  return errors;
}

function focusPath(path: string) {
  requestAnimationFrame(() => document.getElementById(`commercial-${path.replaceAll(".", "-")}`)?.focus());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
