"use client";

import { useState } from "react";
import { Globe, Share2, Search, Check } from "lucide-react";

export interface SeoData {
  seoTitle: string;
  seoDescription: string;
  slug: string;
  imageUrl?: string;
}

export function AdminProductSeoPreview({
  initialData,
  onChange,
}: {
  initialData: SeoData;
  onChange: (data: SeoData) => void;
}) {
  const [data, setData] = useState<SeoData>(initialData);
  const [activeTab, setActiveTab] = useState<"google" | "social">("google");

  function updateField<K extends keyof SeoData>(field: K, value: SeoData[K]) {
    const next = { ...data, [field]: value };
    setData(next);
    onChange(next);
  }

  const titleLength = data.seoTitle.length;
  const descLength = data.seoDescription.length;

  return (
    <section className="admin-editor" aria-labelledby="seo-preview-heading" style={{ marginTop: 18 }}>
      <div className="admin-editor-heading">
        <div>
          <div className="admin-kicker">SEO & Chia sẻ Mạng Xã Hội</div>
          <h3 className="admin-panel-title" id="seo-preview-heading">Tối ưu hóa công cụ tìm kiếm (SEO Preview)</h3>
          <p className="admin-panel-caption">
            Xem trước chính xác cách sản phẩm hiển thị trên Google Tìm Kiếm và khi chia sẻ qua Zalo, Facebook.
          </p>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            type="button"
            className={`admin-button ${activeTab === "google" ? "admin-button-primary" : "admin-button-quiet"}`}
            style={{ padding: "4px 8px", fontSize: 12 }}
            onClick={() => setActiveTab("google")}
          >
            <Globe size={13} /> Google SERP
          </button>
          <button
            type="button"
            className={`admin-button ${activeTab === "social" ? "admin-button-primary" : "admin-button-quiet"}`}
            style={{ padding: "4px 8px", fontSize: 12 }}
            onClick={() => setActiveTab("social")}
          >
            <Share2 size={13} /> Social Card
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        {/* Input Fields */}
        <div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label className="admin-field-label">Tiêu đề trang (SEO Title)</label>
              <span style={{ fontSize: 11, color: titleLength > 65 ? "#dc2626" : "#64748b" }}>
                {titleLength} / 60 ký tự khuyến nghị
              </span>
            </div>
            <input
              type="text"
              className="admin-input"
              placeholder="Tiêu đề hiển thị trên thanh trình duyệt & Google..."
              value={data.seoTitle}
              onChange={(e) => updateField("seoTitle", e.target.value)}
              style={{ width: "100%" }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label className="admin-field-label">Mô tả tóm tắt (Meta Description)</label>
              <span style={{ fontSize: 11, color: descLength > 165 ? "#dc2626" : "#64748b" }}>
                {descLength} / 160 ký tự khuyến nghị
              </span>
            </div>
            <textarea
              className="admin-input"
              rows={3}
              placeholder="Đoạn trích dẫn ngắn xuất hiện dưới tiêu đề tìm kiếm..."
              value={data.seoDescription}
              onChange={(e) => updateField("seoDescription", e.target.value)}
              style={{ width: "100%", resize: "vertical" }}
            />
          </div>

          <div>
            <label className="admin-field-label">Đường dẫn tĩnh (URL Slug)</label>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 12, color: "#64748b" }}>/san-pham/</span>
              <input
                type="text"
                className="admin-input"
                placeholder="gia-cong-chi-tiet-cnc"
                value={data.slug}
                onChange={(e) => updateField("slug", e.target.value)}
                style={{ flex: 1 }}
              />
            </div>
          </div>
        </div>

        {/* Live Visual Preview Card */}
        <div>
          <div className="admin-field-label" style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <Search size={14} /> Bản mô phỏng hiển thị thời gian thực
          </div>

          {activeTab === "google" ? (
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: "16px",
                fontFamily: "Arial, sans-serif",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              }}
            >
              <div style={{ fontSize: 12, color: "#202124", display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: "#2563eb",
                    color: "#fff",
                    textAlign: "center",
                    lineHeight: "16px",
                    fontSize: 10,
                  }}
                >
                  G
                </span>
                <span>https://giacong.vn › san-pham › {data.slug || "slug-san-pham"}</span>
              </div>
              <div
                style={{
                  fontSize: 18,
                  color: "#1a0dab",
                  lineHeight: "1.3",
                  marginTop: 4,
                  cursor: "pointer",
                  fontWeight: 400,
                  textDecoration: "none",
                }}
              >
                {data.seoTitle || "Tiêu đề mẫu sản phẩm gia công cơ khí chính xác | Giacong.vn"}
              </div>
              <div style={{ fontSize: 13, color: "#4d5156", marginTop: 4, lineHeight: "1.4" }}>
                {data.seoDescription ||
                  "Dịch vụ gia công chi tiết theo yêu cầu, phay tiện CNC dung sai ±0.01mm, cam kết chất lượng theo tiêu chuẩn ISO 9001:2015. Báo giá nhanh trong 24h."}
              </div>
            </div>
          ) : (
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                overflow: "hidden",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              }}
            >
              <div
                style={{
                  height: 120,
                  background: "#f1f5f9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#64748b",
                  fontSize: 12,
                  backgroundImage: data.imageUrl ? `url(${data.imageUrl})` : undefined,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                {!data.imageUrl ? "Ảnh đại diện mạng xã hội (1200 x 630px)" : null}
              </div>
              <div style={{ padding: "12px", background: "#f8fafc" }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", color: "#64748b", fontWeight: 600 }}>
                  GIACONG.VN
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", marginTop: 2 }}>
                  {data.seoTitle || "Tiêu đề sản phẩm gia công cơ khí chính xác"}
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, lineClamp: 2 }}>
                  {data.seoDescription || "Gia công chế tạo chi tiết theo yêu cầu kỹ thuật với dung sai cực nhỏ..."}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
