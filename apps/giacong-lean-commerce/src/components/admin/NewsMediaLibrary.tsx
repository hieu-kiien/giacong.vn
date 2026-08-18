"use client";

import { ExternalLink, Upload } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { AdminClientError, fetchAdmin, formatAdminDate, uploadAdmin } from "@/lib/admin-client";

interface AdminNewsMediaAsset {
  altText: string | null;
  articleId: number;
  byteSize: number;
  checksumSha256: string;
  contentType: string;
  createdAt: string;
  id: string;
  originalFilename: string;
  publicUrl: string;
  status: "active" | "deleted";
  storageKey: string;
  updatedAt: string;
}

export function NewsMediaLibrary({
  articleId,
  onSelect,
  selectedUrl,
}: {
  articleId?: number;
  onSelect: (url: string) => void;
  selectedUrl: string;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [media, setMedia] = useState<AdminNewsMediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AdminClientError | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [altText, setAltText] = useState("");
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!articleId) {
      setMedia([]);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    void (async () => {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setLoading(true);
      setError(null);
      try {
        const result = await fetchAdmin<{ media: AdminNewsMediaAsset[] }>(
          `/api/admin/news/${articleId}/media`,
          controller.signal,
        );
        setMedia(result.media ?? []);
      } catch (reason: unknown) {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setError(reason instanceof AdminClientError
            ? reason
            : new AdminClientError("Không thể tải media bài viết.", 0));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [articleId]);

  async function upload() {
    if (!articleId || !file) return;
    setUploading(true);
    setError(null);
    setMessage("");

    const payload = new FormData();
    payload.set("file", file);
    if (altText.trim()) payload.set("altText", altText.trim());

    try {
      const result = await uploadAdmin<{ media: AdminNewsMediaAsset }>(
        `/api/admin/news/${articleId}/media`,
        payload,
      );
      setMedia((items) => [result.media, ...items.filter((item) => item.id !== result.media.id)]);
      onSelect(result.media.publicUrl);
      setFile(null);
      setAltText("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setMessage("Đã upload và chọn ảnh mới. Hãy bấm Lưu bài viết để ghi thumbnail vào article revision hiện tại.");
    } catch (reason: unknown) {
      setError(reason instanceof AdminClientError
        ? reason
        : new AdminClientError("Không thể upload media bài viết.", 0));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="admin-field admin-field-wide" data-testid="news-media-library">
      <span>Media bài viết</span>
      {!articleId ? (
        <div className="admin-readiness-note" role="note">
          Hãy tạo và lưu bản nháp trước. Media cần một article ID ổn định để gắn ownership trong D1/R2.
        </div>
      ) : (
        <>
          <div className="admin-editor-grid">
            <label className="admin-field">
              <span>Chọn file ảnh</span>
              <input
                accept="image/jpeg,image/png,image/webp"
                className="admin-input"
                data-testid="input-news-media-file"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                ref={fileInputRef}
                type="file"
              />
              <small>JPEG, PNG hoặc WebP, tối đa 8 MiB.</small>
            </label>
            <label className="admin-field">
              <span>Alt text</span>
              <input
                className="admin-input"
                data-testid="input-news-media-alt"
                maxLength={300}
                onChange={(event) => setAltText(event.target.value)}
                placeholder="Mô tả ngắn nội dung ảnh"
                value={altText}
              />
            </label>
          </div>

          <div className="admin-table-actions">
            <button
              className="admin-button admin-button-primary"
              data-testid="button-news-media-upload"
              disabled={!file || uploading}
              onClick={() => void upload()}
              type="button"
            >
              <Upload size={14} /> {uploading ? "Đang upload..." : "Upload vào R2"}
            </button>
          </div>

          {message ? <div className="admin-readiness-note" role="status">{message}</div> : null}
          {error ? (
            <div className="admin-editor-error" role="alert">
              {error.code ? `${error.code} · ` : ""}{error.message}
            </div>
          ) : null}

          {loading ? <small>Đang tải media đã upload...</small> : media.length === 0 ? (
            <small>Chưa có media nào gắn với bài viết này.</small>
          ) : (
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">File</th>
                    <th scope="col">Alt text</th>
                    <th scope="col">Upload</th>
                    <th scope="col">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {media.map((asset) => {
                    const selected = selectedUrl === asset.publicUrl;
                    return (
                      <tr data-testid={`row-news-media-${asset.id}`} key={asset.id}>
                        <td>
                          <div className="admin-item-name">
                            {asset.originalFilename}
                            <div className="admin-item-meta admin-mono">{asset.publicUrl}</div>
                          </div>
                        </td>
                        <td className="admin-description">{asset.altText ?? "Chưa có alt text"}</td>
                        <td className="admin-mono">{formatAdminDate(asset.createdAt)}</td>
                        <td>
                          <div className="admin-table-actions">
                            <Link className="admin-button admin-button-quiet" href={asset.publicUrl} target="_blank">
                              <ExternalLink size={14} /> Mở ảnh
                            </Link>
                            <button
                              className="admin-button admin-button-quiet"
                              data-testid={`button-news-media-use-${asset.id}`}
                              disabled={selected}
                              onClick={() => onSelect(asset.publicUrl)}
                              type="button"
                            >
                              {selected ? "Đang chọn" : "Dùng làm ảnh đại diện"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
