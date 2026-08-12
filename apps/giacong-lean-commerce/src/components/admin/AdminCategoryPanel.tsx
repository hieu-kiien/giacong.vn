"use client";

import { useMemo, useState } from "react";

import { emptyAdminCategory, toAdminCategoryForm } from "@/components/admin/admin-catalog-types";
import type { AdminCategory, AdminCategoryFormValue } from "@/components/admin/admin-catalog-types";

interface AdminCategoryPanelProps {
  categories: AdminCategory[];
  onChanged: () => void;
}

const fieldClass = "mt-1 min-h-11 w-full rounded-commerce-control border border-hairline-strong bg-white px-3 text-sm text-ink outline-none placeholder:text-ink-muted focus-visible:commerce-focus-ring";
const textAreaClass = `${fieldClass} min-h-28 resize-y py-2`;
const labelClass = "text-sm font-medium text-ink-soft";

export function AdminCategoryPanel({ categories, onChanged }: AdminCategoryPanelProps) {
  const [form, setForm] = useState<AdminCategoryFormValue>(emptyAdminCategory);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "hidden">("all");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredCategories = useMemo(() => {
    const search = query.trim().toLowerCase();
    return categories.filter((category) => {
      const matchesSearch = !search || [category.name, category.slug].some((field) => field.toLowerCase().includes(search));
      const matchesStatus = status === "all" || (status === "active" ? category.isActive : !category.isActive);
      return matchesSearch && matchesStatus;
    });
  }, [categories, query, status]);

  const setField = <K extends keyof AdminCategoryFormValue>(field: K, value: AdminCategoryFormValue[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const openCreate = () => {
    setForm(emptyAdminCategory());
    setMessage(null);
    setError(null);
    document.getElementById("category-name")?.focus();
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    const endpoint = form.id ? `/api/admin/categories/${form.id}` : "/api/admin/categories";
    try {
      const response = await fetch(endpoint, {
        body: JSON.stringify({ ...form, imageUrl: form.imageUrl.trim() || null }),
        headers: { "Content-Type": "application/json" },
        method: form.id ? "PUT" : "POST",
      });
      const body = await response.json().catch(() => null) as { error?: string; fields?: Record<string, string> } | null;
      if (!response.ok) throw new Error(body?.fields ? Object.values(body.fields)[0] : body?.error ?? "Không lưu được danh mục.");
      setForm(emptyAdminCategory());
      setMessage(form.id ? "Đã cập nhật danh mục." : "Đã tạo danh mục.");
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không lưu được danh mục.");
    } finally {
      setBusy(false);
    }
  };

  const hide = async (id: number) => {
    if (!window.confirm("Ẩn danh mục này khỏi bộ lọc trên website?")) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Không ẩn được danh mục.");
      setMessage("Đã ẩn danh mục.");
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không ẩn được danh mục.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(22rem,0.8fr)]" id="categories">
      <div className="commerce-card-surface min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4 sm:px-6">
          <div><h2 className="text-lg font-bold text-ink">Danh mục sản phẩm</h2><p className="mt-1 text-sm text-ink-soft">Danh mục quyết định bộ lọc và cách khách tìm thấy sản phẩm.</p></div>
          <button className="commerce-target rounded-commerce-control border border-commerce-brand px-3 text-sm font-semibold text-commerce-brand-dark hover:bg-commerce-active-surface focus-visible:commerce-focus-ring" disabled={busy} onClick={openCreate} type="button">+ Thêm danh mục</button>
        </div>
        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="min-w-0 flex-1"><span className="sr-only">Tìm danh mục</span><input className={fieldClass} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên hoặc slug" value={query} /></label>
            <label className="sm:w-44"><span className="sr-only">Lọc trạng thái</span><select className={fieldClass} onChange={(event) => setStatus(event.target.value as typeof status)} value={status}><option value="all">Tất cả trạng thái</option><option value="active">Đang dùng</option><option value="hidden">Đang ẩn</option></select></label>
          </div>
          <p aria-live="polite" className="text-xs text-ink-soft">Hiển thị {filteredCategories.length}/{categories.length} danh mục</p>
          {filteredCategories.length === 0 ? <div className="rounded-commerce-control border border-dashed border-hairline-strong px-4 py-10 text-center"><p className="text-sm font-semibold text-ink">Chưa có danh mục phù hợp</p><p className="mt-1 text-sm text-ink-soft">Tạo danh mục đầu tiên hoặc đổi bộ lọc.</p></div> : <div className="overflow-x-auto rounded-commerce-control border border-hairline bg-white"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b border-hairline bg-surface-subtle text-xs uppercase tracking-wide text-ink-soft"><tr><th className="px-4 py-3">Danh mục</th><th className="px-4 py-3">Sản phẩm</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3 text-right">Thao tác</th></tr></thead><tbody className="divide-y divide-hairline">{filteredCategories.map((category) => <tr className="align-top transition-colors hover:bg-surface-subtle" key={category.id}><td className="px-4 py-4"><p className="font-bold text-ink">{category.name}</p><p className="mt-1 text-xs text-ink-soft">/{category.slug}</p></td><td className="px-4 py-4 text-ink-soft">{category.productCount ?? 0}</td><td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${category.isActive ? "bg-commerce-active-surface text-commerce-brand-dark" : "bg-surface-subtle text-ink-soft"}`}>{category.isActive ? "Đang dùng" : "Đang ẩn"}</span></td><td className="px-4 py-4"><div className="flex justify-end gap-2"><button className="commerce-target rounded-commerce-control border border-commerce-brand px-3 text-sm font-semibold text-commerce-brand-dark hover:bg-commerce-active-surface focus-visible:commerce-focus-ring" disabled={busy} onClick={() => { setForm(toAdminCategoryForm(category)); setMessage(null); setError(null); document.getElementById("category-name")?.focus(); }} type="button">Sửa</button>{category.isActive ? <button className="commerce-target rounded-commerce-control border border-red-300 px-3 text-sm font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600" disabled={busy} onClick={() => void hide(category.id)} type="button">Ẩn</button> : null}</div></td></tr>)}</tbody></table></div>}
        </div>
      </div>

      <form className="commerce-card-surface min-w-0 self-start p-5 sm:p-6" id="category-form" onSubmit={submit}>
        <div className="mb-5 border-b border-hairline pb-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-commerce-brand-dark">{form.id ? "Chỉnh sửa" : "Tạo mới"}</p><h2 className="mt-1 text-lg font-bold text-ink">{form.id ? "Sửa danh mục" : "Thêm danh mục"}</h2><p className="mt-1 text-sm leading-6 text-ink-soft">Tên và slug sẽ xuất hiện trong bộ lọc catalog của khách.</p></div>
        {message ? <p className="mb-4 rounded-commerce-control border border-brand-200 bg-surface-tinted px-3 py-2 text-sm text-commerce-brand-dark" role="status">{message}</p> : null}
        {error ? <p className="mb-4 rounded-commerce-control border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p> : null}
        <div className="space-y-4">
          <label className={labelClass}>Tên danh mục *<input autoFocus={false} className={fieldClass} id="category-name" onChange={(event) => setField("name", event.target.value)} required value={form.name} /></label>
          <label className={labelClass}>Slug *<input className={fieldClass} pattern="[a-z0-9](?:[a-z0-9-]{0,158}[a-z0-9])?" onChange={(event) => setField("slug", event.target.value)} required value={form.slug} /></label>
          <label className={labelClass}>Mô tả<textarea className={textAreaClass} onChange={(event) => setField("description", event.target.value)} value={form.description} /></label>
          <label className={labelClass}>URL ảnh danh mục<input className={fieldClass} inputMode="url" onChange={(event) => setField("imageUrl", event.target.value)} placeholder="https://... hoặc /media/..." value={form.imageUrl} /></label>
          <div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>Thứ tự<input className={fieldClass} min={0} onChange={(event) => setField("sortOrder", Number(event.target.value))} required type="number" value={form.sortOrder} /></label><label className="flex items-end gap-2 pb-2 text-sm font-medium text-ink"><input checked={form.isActive} className="size-4 accent-commerce-brand" onChange={(event) => setField("isActive", event.target.checked)} type="checkbox" /> Hiển thị danh mục</label></div>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-hairline pt-4"><button className="commerce-target rounded-commerce-control border border-hairline-strong px-4 text-sm font-semibold text-ink hover:bg-surface-subtle focus-visible:commerce-focus-ring" disabled={busy || !form.id} onClick={() => setForm(emptyAdminCategory())} type="button">Làm mới</button><button className="commerce-target rounded-commerce-control bg-commerce-brand-dark px-4 text-sm font-bold text-white hover:bg-commerce-brand focus-visible:commerce-focus-ring disabled:cursor-wait disabled:opacity-60" disabled={busy} type="submit">{busy ? "Đang lưu..." : form.id ? "Lưu thay đổi" : "Tạo danh mục"}</button></div>
      </form>
    </section>
  );
}
