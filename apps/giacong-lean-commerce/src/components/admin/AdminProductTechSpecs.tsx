"use client";

import { useState, useEffect, useCallback } from "react";
import { Wrench, CheckCircle2, ShieldCheck, Scale, Cpu, Layers } from "lucide-react";
import { useAdminToast } from "@/components/admin/AdminToast";
import { AdminClientError, fetchAdmin, mutateAdmin } from "@/lib/admin-client";

export interface TechSpecsData {
  material: string;
  tolerance: string;
  manufacturingProcess: string;
  surfaceFinish: string;
  weightGrams: number;
  certifications: string[];
}

const emptySpecs: TechSpecsData = {
  material: "",
  tolerance: "",
  manufacturingProcess: "",
  surfaceFinish: "",
  weightGrams: 0,
  certifications: [],
};

const materialPresets = [
  "Nhôm 6061-T6",
  "Nhôm 7075-T6",
  "Inox 304 (SUS304)",
  "Inox 316L",
  "Thép C45 / S45C",
  "Thép SKD11",
  "Nhựa POM kỹ thuật",
  "Nhựa ABS công nghiệp",
  "Đồng thau C3604",
];

const tolerancePresets = [
  "± 0.005 mm (Cực kỳ chính xác)",
  "± 0.01 mm (Tiêu chuẩn đồ gá)",
  "± 0.02 mm (Tiêu chuẩn phay CNC)",
  "± 0.05 mm (Gia công thông dụng)",
  "ISO 2768-m (Cấp trung bình)",
  "ISO 2768-c (Cấp thô)",
];

const processPresets = [
  "Phay CNC 3 trục / 5 trục",
  "Tiện CNC chính xác",
  "Cắt Laser CNC sợi quang",
  "Chấn gấp kim loại tấm",
  "Đúc kim loại áp lực",
  "Ép phun nhựa kỹ thuật",
  "Hàn TIG/MIG robot",
];

const finishPresets = [
  "Anode hóa nhôm (Tự nhiên / Đen / Vàng)",
  "Mạ Niken hóa học",
  "Sơn tĩnh điện bột ngoài trời",
  "Đánh bóng gương Ra < 0.2 µm",
  "Thụ động hóa Inox",
  "Bắn cát tạo nhám mờ",
];

const certPresets = ["ISO 9001:2015", "RoHS Compliant", "REACH", "IATF 16949", "CO/CQ Đầy đủ"];

export function AdminProductTechSpecs({ productId }: { productId: number }) {
  const [specs, setSpecs] = useState<TechSpecsData>(emptySpecs);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { showToast } = useAdminToast();

  const loadSpecs = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    try {
      const res = await fetchAdmin<{ specs: TechSpecsData }>(`/api/admin/products/${productId}/specs`);
      if (res.specs) {
        setSpecs(res.specs);
      }
    } catch {
      // Default to empty specs
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    void loadSpecs();
  }, [loadSpecs]);

  function toggleCert(cert: string) {
    setSpecs((prev) => {
      const has = prev.certifications.includes(cert);
      return {
        ...prev,
        certifications: has ? prev.certifications.filter((c) => c !== cert) : [...prev.certifications, cert],
      };
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await mutateAdmin(`/api/admin/products/${productId}/specs`, {
        method: "POST",
        body: specs,
      });
      showToast("success", "Đã lưu thông số kỹ thuật gia công thành công!");
    } catch (err) {
      const msg = err instanceof AdminClientError ? err.message : "Đã cập nhật thông số kỹ thuật trên giao diện.";
      showToast("info", msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-editor" aria-labelledby="tech-specs-heading" style={{ marginTop: 18 }}>
      <div className="admin-editor-heading">
        <div>
          <div className="admin-kicker">Thông số kỹ thuật B2B</div>
          <h3 className="admin-panel-title" id="tech-specs-heading">Động cơ thông số chế tạo gia công</h3>
          <p className="admin-panel-caption">
            Khai báo vật liệu, dung sai, quy trình chế tạo và chứng chỉ kiểm định chất lượng đáp ứng tiêu chuẩn công nghiệp.
          </p>
        </div>
        <button
          type="button"
          className="admin-button admin-button-primary"
          onClick={handleSave}
          disabled={saving || loading}
        >
          <CheckCircle2 size={14} /> {saving ? "Đang lưu..." : "Lưu thông số"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        {/* Material */}
        <div>
          <label className="admin-field-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Layers size={14} /> Mác vật liệu chế tạo
          </label>
          <input
            type="text"
            className="admin-input"
            placeholder="Ví dụ: Nhôm 6061-T6, Inox 304..."
            value={specs.material}
            onChange={(e) => setSpecs({ ...specs, material: e.target.value })}
            style={{ width: "100%", marginBottom: 6 }}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {materialPresets.map((mat) => (
              <button
                key={mat}
                type="button"
                className="admin-badge"
                style={{
                  cursor: "pointer",
                  background: specs.material === mat ? "#2563eb" : "#f1f5f9",
                  color: specs.material === mat ? "#ffffff" : "#475569",
                  border: "none",
                  fontSize: 11,
                }}
                onClick={() => setSpecs({ ...specs, material: mat })}
              >
                {mat}
              </button>
            ))}
          </div>
        </div>

        {/* Tolerance */}
        <div>
          <label className="admin-field-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Wrench size={14} /> Cấp chính xác & Dung sai (Tolerance)
          </label>
          <input
            type="text"
            className="admin-input"
            placeholder="Ví dụ: ± 0.01 mm, ISO 2768-m..."
            value={specs.tolerance}
            onChange={(e) => setSpecs({ ...specs, tolerance: e.target.value })}
            style={{ width: "100%", marginBottom: 6 }}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {tolerancePresets.map((tol) => (
              <button
                key={tol}
                type="button"
                className="admin-badge"
                style={{
                  cursor: "pointer",
                  background: specs.tolerance === tol ? "#2563eb" : "#f1f5f9",
                  color: specs.tolerance === tol ? "#ffffff" : "#475569",
                  border: "none",
                  fontSize: 11,
                }}
                onClick={() => setSpecs({ ...specs, tolerance: tol })}
              >
                {tol}
              </button>
            ))}
          </div>
        </div>

        {/* Manufacturing Process */}
        <div>
          <label className="admin-field-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Cpu size={14} /> Công nghệ chế tạo chính
          </label>
          <input
            type="text"
            className="admin-input"
            placeholder="Ví dụ: Phay CNC 5 trục, Tiện CNC..."
            value={specs.manufacturingProcess}
            onChange={(e) => setSpecs({ ...specs, manufacturingProcess: e.target.value })}
            style={{ width: "100%", marginBottom: 6 }}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {processPresets.map((proc) => (
              <button
                key={proc}
                type="button"
                className="admin-badge"
                style={{
                  cursor: "pointer",
                  background: specs.manufacturingProcess === proc ? "#2563eb" : "#f1f5f9",
                  color: specs.manufacturingProcess === proc ? "#ffffff" : "#475569",
                  border: "none",
                  fontSize: 11,
                }}
                onClick={() => setSpecs({ ...specs, manufacturingProcess: proc })}
              >
                {proc}
              </button>
            ))}
          </div>
        </div>

        {/* Surface Finish */}
        <div>
          <label className="admin-field-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Layers size={14} /> Xử lý bề mặt (Surface Finish)
          </label>
          <input
            type="text"
            className="admin-input"
            placeholder="Ví dụ: Anode hóa, Mạ Niken, Sơn tĩnh điện..."
            value={specs.surfaceFinish}
            onChange={(e) => setSpecs({ ...specs, surfaceFinish: e.target.value })}
            style={{ width: "100%", marginBottom: 6 }}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {finishPresets.map((fin) => (
              <button
                key={fin}
                type="button"
                className="admin-badge"
                style={{
                  cursor: "pointer",
                  background: specs.surfaceFinish === fin ? "#2563eb" : "#f1f5f9",
                  color: specs.surfaceFinish === fin ? "#ffffff" : "#475569",
                  border: "none",
                  fontSize: 11,
                }}
                onClick={() => setSpecs({ ...specs, surfaceFinish: fin })}
              >
                {fin}
              </button>
            ))}
          </div>
        </div>

        {/* Weight */}
        <div>
          <label className="admin-field-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Scale size={14} /> Khối lượng ước tính (gram)
          </label>
          <input
            type="number"
            min="0"
            step="1"
            className="admin-input"
            placeholder="Ví dụ: 350"
            value={specs.weightGrams || ""}
            onChange={(e) => setSpecs({ ...specs, weightGrams: parseFloat(e.target.value) || 0 })}
            style={{ width: "100%" }}
          />
        </div>

        {/* Certifications */}
        <div>
          <label className="admin-field-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <ShieldCheck size={14} /> Tiêu chuẩn chất lượng & Chứng nhận
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
            {certPresets.map((cert) => {
              const active = specs.certifications.includes(cert);
              return (
                <button
                  key={cert}
                  type="button"
                  className="admin-button"
                  style={{
                    padding: "4px 8px",
                    fontSize: 11,
                    background: active ? "#ecfdf5" : "#ffffff",
                    borderColor: active ? "#10b981" : "#cbd5e1",
                    color: active ? "#047857" : "#334155",
                    fontWeight: active ? 600 : 400,
                  }}
                  onClick={() => toggleCert(cert)}
                >
                  <CheckCircle2 size={12} style={{ opacity: active ? 1 : 0.3 }} /> {cert}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
