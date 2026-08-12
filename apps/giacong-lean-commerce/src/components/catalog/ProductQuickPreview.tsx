"use client";

import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";

import { ProductConfigurator } from "@/components/catalog/ProductConfigurator";
import styles from "@/components/catalog/catalog.module.css";
import type { CatalogProductDetail } from "@/types/catalog";

interface ProductQuickPreviewProps {
  productName: string;
  slug: string;
}

type PreviewState = "idle" | "loading" | "error" | "ready";

export function ProductQuickPreview({ productName, slug }: ProductQuickPreviewProps) {
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [product, setProduct] = useState<CatalogProductDetail | null>(null);
  const [state, setState] = useState<PreviewState>("idle");
  const [open, setOpen] = useState(false);
  const closingRef = useRef(false);
  const requestId = useRef(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLButtonElement>("[data-preview-close]")?.focus();
    const abort = new AbortController();
    const currentRequest = ++requestId.current;
    void fetch(`/api/catalog/products/${encodeURIComponent(slug)}`, { signal: abort.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("preview_failed");
        const body: unknown = await response.json();
        if (!isPreviewResponse(body)) throw new Error("preview_failed");
        if (requestId.current === currentRequest) {
          setProduct(body.product);
          setState("ready");
        }
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError") && requestId.current === currentRequest) setState("error");
      });
    return () => abort.abort();
  }, [open, slug]);

  function close() {
    requestId.current += 1;
    closingRef.current = true;
    dialogRef.current?.close();
    setProduct(null);
    setState("idle");
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function openPreview() {
    setProduct(null);
    setState("loading");
    setOpen(true);
  }

  function handleDialogClose() {
    if (closingRef.current) {
      closingRef.current = false;
      return;
    }
    setProduct(null);
    setState("idle");
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function trapTab(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const dialog = event.currentTarget;
    const radioGroups = new Set<string>();
    const focusable = [...dialog.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), a[href]")]
      .filter((element) => {
        if (element.hidden || element.tabIndex < 0) return false;
        if (!(element instanceof HTMLInputElement) || element.type !== "radio") return true;
        if (radioGroups.has(element.name)) return element.checked;
        radioGroups.add(element.name);
        return true;
      });
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function retry() {
    close();
    requestAnimationFrame(openPreview);
  }

  return (
    <>
      <button className={styles.quickPreviewAction} onClick={openPreview} ref={triggerRef} type="button">
        Xem nhanh
      </button>
      <dialog
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        className={styles.previewDialog}
        onCancel={(event) => { event.preventDefault(); close(); }}
        onClose={handleDialogClose}
        onKeyDown={trapTab}
        ref={dialogRef}
      >
        <div className={styles.previewHeader}>
          <div>
            <p className={styles.previewEyebrow}>Xem nhanh sản phẩm</p>
            <h2 id={titleId}>{product?.name ?? productName}</h2>
            <p id={descriptionId}>Chọn phiên bản để xem giá và yêu cầu mua hàng.</p>
          </div>
          <button aria-label="Đóng xem nhanh" className={styles.previewClose} data-preview-close onClick={close} type="button">×</button>
        </div>
        {state === "loading" ? <PreviewSkeleton /> : null}
        {state === "error" ? (
          <div className={styles.previewError} role="alert">
            <p>Không thể tải thông tin sản phẩm lúc này.</p>
            <button className={styles.button} onClick={retry} type="button">Thử lại</button>
          </div>
        ) : null}
        {state === "ready" && product ? <ProductConfigurator initialVariantSku={null} product={product} variantQueryWarning={false} /> : null}
      </dialog>
    </>
  );
}

function PreviewSkeleton() {
  return <div aria-busy="true" aria-label="Đang tải sản phẩm" className={styles.previewSkeleton}>
    <span /><span /><span /><span />
  </div>;
}

function isPreviewResponse(value: unknown): value is { product: CatalogProductDetail } {
  return typeof value === "object" && value !== null && "product" in value;
}
