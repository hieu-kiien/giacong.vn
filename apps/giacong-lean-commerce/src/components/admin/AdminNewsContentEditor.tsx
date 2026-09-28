"use client";

import { ArrowDown, ArrowUp, ImagePlus, Link2, List, Plus, Quote, Type, X } from "lucide-react";
import { useId, useState } from "react";

import { NewsArticleBody } from "@/components/NewsArticleBody";
import { AdminMediaPickerModal } from "@/components/admin/AdminMediaPickerModal";
import { isSafeNewsArticleUrl, parseNewsArticleBlocks, serializeNewsArticleBlocks, type NewsArticleBlock } from "@/lib/news-article-content";
import styles from "./AdminNewsContentEditor.module.css";

export function AdminNewsContentEditor({
  disabled = false,
  error,
  label = "Nội dung bài viết",
  onChange,
  value,
}: {
  disabled?: boolean;
  error?: string;
  label?: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  const generatedId = useId().replace(/:/g, "");
  const labelId = `news-content-label-${generatedId}`;
  const parsedBlocks = parseNewsArticleBlocks(value);
  const blocks: NewsArticleBlock[] = parsedBlocks.length > 0
    ? parsedBlocks
    : [{ type: "paragraph", text: "" }];

  function commit(next: NewsArticleBlock[]) {
    onChange(serializeNewsArticleBlocks(next));
  }

  function updateBlock(index: number, next: NewsArticleBlock) {
    commit(blocks.map((block, blockIndex) => blockIndex === index ? next : block));
  }

  function addBlock(block: NewsArticleBlock) {
    if (blocks.length >= 80) return;
    const emptyStarter = blocks.length === 1 && blocks[0]?.type === "paragraph" && !blocks[0].text.trim();
    commit(emptyStarter ? [block] : [...blocks, block]);
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    commit(next);
  }

  function removeBlock(index: number) {
    commit(blocks.filter((_, blockIndex) => blockIndex !== index));
  }

  return (
    <section aria-labelledby={labelId} className={styles.editor} data-testid="news-content-editor">
      <div>
        <h3 className={styles.editorTitle} id={labelId}>{label}</h3>
        <p className="admin-field-hint">Thêm, sắp xếp tiêu đề, đoạn văn, ảnh có chú thích, danh sách, trích dẫn hoặc liên kết. Nội dung cũ vẫn được giữ nguyên.</p>
      </div>
      <div className={styles.toolbar}>
        <span className={styles.toolbarLabel}>Thêm khối nội dung</span>
        <button className="admin-button admin-button-quiet" disabled={disabled || blocks.length >= 80} onClick={() => addBlock({ type: "paragraph", text: "" })} type="button"><Plus size={14} /> Đoạn văn</button>
        <button className="admin-button admin-button-quiet" disabled={disabled || blocks.length >= 80} onClick={() => addBlock({ type: "heading", text: "" })} type="button"><Type size={14} /> Tiêu đề</button>
        <button className="admin-button admin-button-quiet" disabled={disabled || blocks.length >= 80} onClick={() => addBlock({ type: "subheading", text: "" })} type="button">Tiêu đề phụ</button>
        <button className="admin-button admin-button-quiet" disabled={disabled || blocks.length >= 80} onClick={() => addBlock({ type: "list", ordered: false, items: [""] })} type="button"><List size={14} /> Danh sách</button>
        <button className="admin-button admin-button-quiet" disabled={disabled || blocks.length >= 80} onClick={() => addBlock({ type: "quote", text: "" })} type="button"><Quote size={14} /> Trích dẫn</button>
        <button className="admin-button admin-button-quiet" disabled={disabled || blocks.length >= 80} onClick={() => addBlock({ type: "image", url: "", alt: "", caption: "" })} type="button"><ImagePlus size={14} /> Ảnh + chú thích</button>
        <button className="admin-button admin-button-quiet" disabled={disabled || blocks.length >= 80} onClick={() => addBlock({ type: "link", url: "", label: "" })} type="button"><Link2 size={14} /> Liên kết</button>
      </div>

      {blocks.map((block, index) => (
        <article aria-label={`Khối ${index + 1}`} className={styles.block} data-testid={`news-content-block-${index}`} key={index}>
          <header className={styles.blockHeader}>
            <span className={styles.blockTitle}>{blockLabel(block.type)} {index + 1}</span>
            <div className={styles.blockActions}>
              <button aria-label={`Đưa khối ${index + 1} lên`} className="admin-button admin-button-quiet" disabled={disabled || index === 0} onClick={() => moveBlock(index, -1)} type="button"><ArrowUp size={14} /></button>
              <button aria-label={`Đưa khối ${index + 1} xuống`} className="admin-button admin-button-quiet" disabled={disabled || index === blocks.length - 1} onClick={() => moveBlock(index, 1)} type="button"><ArrowDown size={14} /></button>
              <button aria-label={`Xóa khối ${index + 1}`} className="admin-button admin-button-quiet" disabled={disabled} onClick={() => removeBlock(index)} type="button"><X size={14} /> Xóa</button>
            </div>
          </header>
          {block.type === "paragraph" || block.type === "heading" || block.type === "subheading" || block.type === "quote" ? (
            <label className={styles.blockField}>
              <span>{block.type === "paragraph" ? "Nội dung đoạn" : block.type === "quote" ? "Nội dung trích dẫn" : "Văn bản tiêu đề"}</span>
              <textarea aria-label={`${blockLabel(block.type)} ${index + 1}`} className={`admin-textarea ${styles.textArea}`} disabled={disabled} onChange={(event) => updateBlock(index, { ...block, text: event.target.value })} value={block.text} />
            </label>
          ) : null}
          {block.type === "list" ? (
            <>
              <label className={styles.blockField}>
                <span>Kiểu danh sách</span>
                <select aria-label={`Kiểu danh sách ${index + 1}`} className={`admin-input ${styles.textInput}`} disabled={disabled} onChange={(event) => updateBlock(index, { ...block, ordered: event.target.value === "ordered" })} value={block.ordered ? "ordered" : "bulleted"}>
                  <option value="bulleted">Gạch đầu dòng</option>
                  <option value="ordered">Đánh số thứ tự</option>
                </select>
              </label>
              <label className={styles.blockField}>
                <span>Mỗi dòng là một mục</span>
                <textarea aria-label={`Các mục danh sách ${index + 1}`} className={`admin-textarea ${styles.textArea}`} disabled={disabled} onChange={(event) => updateBlock(index, { ...block, items: event.target.value.split("\n") })} value={block.items.join("\n")} />
              </label>
            </>
          ) : null}
          {block.type === "image" ? (
            <>
              <div className={styles.blockField}>
                <span>Ảnh trong bài viết</span>
                <div className="admin-input-actions">
                  <input aria-label={`Đường dẫn ảnh ${index + 1}`} className={`admin-input ${styles.textInput}`} disabled={disabled} onChange={(event) => updateBlock(index, { ...block, url: event.target.value })} placeholder="Chọn từ thư viện hoặc nhập URL an toàn" value={block.url} />
                  <button className="admin-button admin-button-quiet" disabled={disabled} onClick={() => setPickerIndex(index)} type="button">Chọn từ thư viện</button>
                </div>
                {isSafeNewsArticleUrl(block.url, true)
                  ? // eslint-disable-next-line @next/next/no-img-element
                    <img alt="Xem trước ảnh nội dung" className={styles.imagePreview} src={block.url} />
                  : <small className="admin-field-hint">Ảnh sẽ tự co theo đúng tỷ lệ; sẽ không bị cắt.</small>}
              </div>
              <label className={styles.blockField}>
                <span>Mô tả ảnh (hỗ trợ trình đọc màn hình)</span>
                <input aria-label={`Mô tả ảnh ${index + 1}`} className={`admin-input ${styles.textInput}`} disabled={disabled} onChange={(event) => updateBlock(index, { ...block, alt: event.target.value })} value={block.alt} />
              </label>
              <label className={styles.blockField}>
                <span>Chú thích ảnh</span>
                <input aria-label={`Chú thích ảnh ${index + 1}`} className={`admin-input ${styles.textInput}`} disabled={disabled} onChange={(event) => updateBlock(index, { ...block, caption: event.target.value })} value={block.caption} />
              </label>
            </>
          ) : null}
          {block.type === "link" ? (
            <div className="admin-editor-grid">
              <label className={styles.blockField}>
                <span>Chữ hiển thị</span>
                <input aria-label={`Chữ liên kết ${index + 1}`} className={`admin-input ${styles.textInput}`} disabled={disabled} onChange={(event) => updateBlock(index, { ...block, label: event.target.value })} value={block.label} />
              </label>
              <label className={styles.blockField}>
                <span>Đường dẫn</span>
                <input aria-label={`Đường dẫn liên kết ${index + 1}`} className={`admin-input ${styles.textInput}`} disabled={disabled} onChange={(event) => updateBlock(index, { ...block, url: event.target.value })} placeholder="/lien-he/ hoặc https://..." value={block.url} />
              </label>
            </div>
          ) : null}
        </article>
      ))}

      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <details className={styles.preview}>
        <summary className={styles.previewSummary}>Xem trước bài viết</summary>
        <div className={styles.previewContent}><NewsArticleBody content={value} /></div>
      </details>
      {pickerIndex !== null ? (
        <AdminMediaPickerModal
          onClose={() => setPickerIndex(null)}
          onSelect={(url) => {
            const block = blocks[pickerIndex];
            if (block?.type === "image") updateBlock(pickerIndex, { ...block, url });
            setPickerIndex(null);
          }}
        />
      ) : null}
    </section>
  );
}

function blockLabel(type: NewsArticleBlock["type"]): string {
  switch (type) {
    case "paragraph": return "Đoạn văn";
    case "heading": return "Tiêu đề";
    case "subheading": return "Tiêu đề phụ";
    case "list": return "Danh sách";
    case "quote": return "Trích dẫn";
    case "image": return "Ảnh";
    case "link": return "Liên kết";
  }
}
