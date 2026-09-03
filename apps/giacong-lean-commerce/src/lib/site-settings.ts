import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1DatabaseLike, D1PreparedStatementLike } from "./admin-data";

export const siteSettingDefinitions = [
  { key: "brand_name", group: "brand", label: "Tên thương hiệu", description: "Tên hiển thị ở logo, tiêu đề và các điểm nhận diện.", type: "text" },
  { key: "brand_tagline", group: "brand", label: "Khẩu hiệu thương hiệu", description: "Dòng mô tả ngắn đi cùng logo.", type: "text" },
  { key: "logo_url", group: "brand", label: "Logo sáng", description: "URL ảnh logo PNG/SVG an toàn.", type: "image" },
  { key: "favicon_url", group: "brand", label: "Favicon", description: "URL favicon của website.", type: "image" },
  { key: "primary_color", group: "brand", label: "Màu chủ đạo", description: "Màu hex dùng cho các điểm nhấn chính.", type: "color" },
  { key: "accent_color", group: "brand", label: "Màu nhấn", description: "Màu hex dùng cho nền sáng, hover và nút phụ.", type: "color" },
  { key: "site_title", group: "seo", label: "SEO title", description: "Tiêu đề mặc định của website.", type: "text" },
  { key: "site_description", group: "seo", label: "SEO description", description: "Mô tả mặc định cho công cụ tìm kiếm và chia sẻ.", type: "multiline" },
  { key: "contact_phone", group: "contact", label: "Hotline", description: "Số điện thoại hiển thị ở các điểm liên hệ.", type: "text" },
  { key: "contact_email", group: "contact", label: "Email tư vấn", description: "Email hiển thị ở footer và form liên hệ.", type: "text" },
  { key: "contact_zalo_url", group: "contact", label: "Link Zalo", description: "Đường dẫn Zalo đầy đủ.", type: "url" },
  { key: "contact_messenger_url", group: "contact", label: "Link Messenger", description: "Đường dẫn Messenger đầy đủ.", type: "url" },
  { key: "contact_address", group: "contact", label: "Địa chỉ", description: "Địa chỉ văn phòng hiển thị ở footer.", type: "multiline" },
  { key: "hero_eyebrow", group: "home", label: "Hero eyebrow", description: "Dòng nhỏ phía trên tiêu đề trang chủ.", type: "text" },
  { key: "hero_title", group: "home", label: "Hero title", description: "Tiêu đề lớn nhất ở trang chủ.", type: "text" },
  { key: "hero_description", group: "home", label: "Hero description", description: "Đoạn giới thiệu chính ở trang chủ.", type: "multiline" },
  { key: "hero_primary_cta_label", group: "home", label: "Nhãn nút chính", description: "Nhãn nút kêu gọi hành động đầu tiên.", type: "text" },
  { key: "hero_primary_cta_url", group: "home", label: "Link nút chính", description: "URL nút kêu gọi hành động đầu tiên.", type: "url" },
  { key: "hero_secondary_cta_label", group: "home", label: "Nhãn nút phụ", description: "Nhãn nút kêu gọi hành động thứ hai.", type: "text" },
  { key: "hero_secondary_cta_url", group: "home", label: "Link nút phụ", description: "URL nút kêu gọi hành động thứ hai.", type: "url" },
  { key: "hero_image_url", group: "home", label: "Ảnh hero", description: "URL ảnh hero.", type: "image" },
  { key: "about_title", group: "home", label: "Tiêu đề giới thiệu", description: "Tiêu đề phần giới thiệu trên trang chủ.", type: "text" },
  { key: "about_description", group: "home", label: "Mô tả giới thiệu", description: "Đoạn mô tả phần giới thiệu trên trang chủ.", type: "multiline" },
  { key: "footer_description", group: "footer", label: "Mô tả footer", description: "Đoạn giới thiệu ngắn ở footer.", type: "multiline" },
  { key: "footer_copyright", group: "footer", label: "Bản quyền footer", description: "Dòng bản quyền cuối trang.", type: "text" },
] as const;

export type SiteSettingKey = (typeof siteSettingDefinitions)[number]["key"];
export type SiteSettingGroup = (typeof siteSettingDefinitions)[number]["group"];
export type SiteSettingType = (typeof siteSettingDefinitions)[number]["type"];

export interface AdminSiteSetting {
  key: SiteSettingKey;
  group: SiteSettingGroup;
  label: string;
  description: string;
  type: SiteSettingType;
  draftValue: string;
  publishedValue: string;
  version: number;
  updatedBy: string | null;
  updatedAt: string;
  publishedBy: string | null;
  publishedAt: string | null;
  dirty: boolean;
}

export type PublishedSiteSettings = Record<SiteSettingKey, string>;

export const siteSettingDefaults: PublishedSiteSettings = {
  brand_name: "Giacong.vn",
  brand_tagline: "Giải pháp gia công toàn diện",
  logo_url: "",
  favicon_url: "",
  primary_color: "#6cbe45",
  accent_color: "#bde875",
  site_title: "Giacong.vn - Giải pháp gia công toàn diện",
  site_description: "Giao diện giới thiệu dịch vụ gia công toàn diện.",
  contact_phone: "0947142999",
  contact_email: "info@giacong.vn",
  contact_zalo_url: "https://zalo.me/0947142999",
  contact_messenger_url: "https://m.me/qtudepdai",
  contact_address: "VP Hà Nội: 108 Trần Hưng Đạo - Hoàn Kiếm - Hà Nội",
  hero_eyebrow: "Giacong.vn cung cấp",
  hero_title: "Giải pháp gia công toàn diện chuyên nghiệp",
  hero_description: "Chúng tôi cung cấp dịch vụ gia công (OEM) nông sản, thực phẩm và dược liệu toàn diện từ sản xuất đến thiết kế thương hiệu và đóng gói. Với đội ngũ chuyên gia giàu kinh nghiệm, chúng tôi cam kết mang đến cho bạn những sản phẩm chất lượng cao.",
  hero_primary_cta_label: "Về chúng tôi",
  hero_primary_cta_url: "/gioi-thieu-ve-gia-cong/",
  hero_secondary_cta_label: "Liên hệ ngay",
  hero_secondary_cta_url: "/lien-he/",
  hero_image_url: "",
  about_title: "Đồng hành cùng doanh nghiệp trong thời đại mới",
  about_description: "Với đội ngũ chuyên gia giàu kinh nghiệm, hệ thống nhà xưởng hiện đại và quy trình sản xuất tối ưu, chúng tôi mang đến giải pháp gia công phù hợp cho doanh nghiệp.",
  footer_description: "Giacong.vn là nền tảng kết nối khách hàng và các đơn vị sản xuất, cung cấp giải pháp gia công toàn diện.",
  footer_copyright: "Copyright 2026 © Giacong.vn | Một sản phẩm của Netmedia",
};

export class SiteSettingValidationError extends Error {}
export class SiteSettingConflictError extends Error {}
export class SiteSettingIdempotencyConflictError extends Error {}
export class SiteSettingNotFoundError extends Error {}
export class SiteSettingStorageError extends Error {}

export async function listAdminSiteSettings(database: D1DatabaseLike): Promise<AdminSiteSetting[]> {
  const rows = await database.prepare(`
    SELECT setting_key, group_name, label, description, value_type,
      draft_value, published_value, version, updated_by, updated_at, published_by, published_at
    FROM site_settings
    ORDER BY CASE group_name
      WHEN 'brand' THEN 1 WHEN 'seo' THEN 2 WHEN 'home' THEN 3
      WHEN 'contact' THEN 4 ELSE 5 END, setting_key
    LIMIT 100
  `).all<SiteSettingRow>();

  return rows.results.map(toAdminSiteSetting);
}

export async function updateAdminSiteSetting(
  database: D1DatabaseLike,
  input: { actorSubject: string; expectedVersion: number; key: string; requestId?: string; value: unknown },
): Promise<AdminSiteSetting> {
  const definition = getDefinition(input.key);
  const value = normalizeValue(definition, input.value);
  const expectedVersion = normalizeExpectedVersion(input.expectedVersion);
  const requestId = normalizeRequestId(input.requestId);
  const payloadSha256 = await fingerprintSiteSettingMutation({
    expectedVersion,
    key: definition.key,
    operation: "draft",
    value,
  });
  const existingMutation = await findSiteSettingMutation(database, requestId);
  if (existingMutation) {
    assertMatchingMutation(existingMutation, "draft", payloadSha256);
    return getSettingRowOrThrow(database, definition.key).then(toAdminSiteSetting);
  }

  const current = await getSettingRow(database, definition.key);
  if (!current) throw new SiteSettingNotFoundError("Không tìm thấy setting cần cập nhật.");
  if (current.version !== expectedVersion) {
    throw new SiteSettingConflictError("Setting đã thay đổi ở phiên khác. Hãy tải lại trước khi lưu.");
  }

  const applied = await applyAtomicSiteSettingMutation(database, {
    actorSubject: input.actorSubject,
    expectedVersion,
    key: definition.key,
    operation: "draft",
    payloadSha256,
    requestId,
    value,
  });
  if (!applied) {
    const racedMutation = await findSiteSettingMutation(database, requestId);
    if (racedMutation) {
      assertMatchingMutation(racedMutation, "draft", payloadSha256);
      return getSettingRowOrThrow(database, definition.key).then(toAdminSiteSetting);
    }
    throw new SiteSettingConflictError("Setting đã thay đổi ở phiên khác. Hãy tải lại trước khi lưu.");
  }
  return toAdminSiteSetting(await getSettingRowOrThrow(database, definition.key));
}

export async function publishAdminSiteSetting(
  database: D1DatabaseLike,
  input: { actorSubject: string; expectedVersion: number; key: string; requestId?: string },
): Promise<AdminSiteSetting> {
  const definition = getDefinition(input.key);
  const expectedVersion = normalizeExpectedVersion(input.expectedVersion);
  const requestId = normalizeRequestId(input.requestId);
  const payloadSha256 = await fingerprintSiteSettingMutation({
    expectedVersion,
    key: definition.key,
    operation: "publish",
  });
  const existingMutation = await findSiteSettingMutation(database, requestId);
  if (existingMutation) {
    assertMatchingMutation(existingMutation, "publish", payloadSha256);
    return getSettingRowOrThrow(database, definition.key).then(toAdminSiteSetting);
  }

  const current = await getSettingRow(database, definition.key);
  if (!current) throw new SiteSettingNotFoundError("Không tìm thấy setting cần phát hành.");
  if (current.version !== expectedVersion) {
    throw new SiteSettingConflictError("Setting đã thay đổi ở phiên khác. Hãy tải lại trước khi phát hành.");
  }

  const applied = await applyAtomicSiteSettingMutation(database, {
    actorSubject: input.actorSubject,
    expectedVersion,
    key: definition.key,
    operation: "publish",
    payloadSha256,
    requestId,
  });
  if (!applied) {
    const racedMutation = await findSiteSettingMutation(database, requestId);
    if (racedMutation) {
      assertMatchingMutation(racedMutation, "publish", payloadSha256);
      return getSettingRowOrThrow(database, definition.key).then(toAdminSiteSetting);
    }
    throw new SiteSettingConflictError("Setting đã thay đổi ở phiên khác. Hãy tải lại trước khi phát hành.");
  }
  return toAdminSiteSetting(await getSettingRowOrThrow(database, definition.key));
}

export async function publishAllAdminSiteSettings(
  database: D1DatabaseLike,
  input: { actorSubject: string; requestId?: string },
): Promise<{ published: AdminSiteSetting[]; skipped: number }> {
  const rows = await database.prepare(`
    SELECT setting_key, group_name, label, description, value_type,
      draft_value, published_value, version, updated_by, updated_at, published_by, published_at
    FROM site_settings
    WHERE draft_value <> published_value
    ORDER BY setting_key
  `).all<SiteSettingRow>();

  const requestId = normalizeRequestId(input.requestId);
  const payloadSha256 = await fingerprintSiteSettingBulkPublish();
  const existingMutation = await findSiteSettingBulkMutation(database, requestId);
  if (existingMutation) {
    assertMatchingBulkMutation(existingMutation, payloadSha256);
    return readBulkSiteSettingResult(database, requestId, existingMutation);
  }

  const statements: D1PreparedStatementLike[] = [database.prepare(`
    INSERT INTO admin_site_setting_bulk_audit (
      request_id, actor_subject, action, operation, payload_sha256,
      selected_count, published_count
    ) VALUES (?, ?, 'update', 'publish_all', ?, ?, 0)
  `).bind(requestId, input.actorSubject, payloadSha256, rows.results.length)];

  for (const row of rows.results) {
    const settingRequestId = crypto.randomUUID();
    statements.push(database.prepare(`
      UPDATE site_settings
      SET published_value = draft_value, version = version + 1,
        published_by = ?, published_at = CURRENT_TIMESTAMP,
        updated_by = ?, updated_at = CURRENT_TIMESTAMP, last_request_id = ?
      WHERE setting_key = ? AND version = ?
    `).bind(input.actorSubject, input.actorSubject, settingRequestId, row.setting_key, row.version));
    statements.push(database.prepare(`
      INSERT INTO admin_site_setting_audit (
        request_id, actor_subject, action, operation, entity_type, entity_key,
        previous_revision, resulting_revision, payload_sha256, bulk_request_id
      )
      SELECT ?, ?, 'update', 'publish', 'site_setting', setting_key,
        ?, version, ?, ?
      FROM site_settings
      WHERE setting_key = ? AND version = ? AND last_request_id = ?
    `).bind(
      settingRequestId,
      input.actorSubject,
      row.version,
      await fingerprintSiteSettingMutation({
        expectedVersion: row.version,
        key: row.setting_key,
        operation: "publish",
      }),
      requestId,
      row.setting_key,
      row.version + 1,
      settingRequestId,
    ));
  }

  statements.push(database.prepare(`
    UPDATE admin_site_setting_bulk_audit
    SET published_count = (
      SELECT COUNT(*) FROM admin_site_setting_audit WHERE bulk_request_id = ?
    )
    WHERE request_id = ?
  `).bind(requestId, requestId));

  const databaseWithBatch = database as D1DatabaseWithBatch;
  if (typeof databaseWithBatch.batch !== "function") {
    throw new SiteSettingStorageError("D1 atomic batch chưa sẵn sàng cho bulk publish settings.");
  }
  try {
    const results = await databaseWithBatch.batch(statements);
    if (results.length !== statements.length) {
      throw new SiteSettingStorageError("D1 bulk batch trả về kết quả không hợp lệ.");
    }
    if (!hasChanged(results[0]) || !hasChanged(results.at(-1))) {
      throw new SiteSettingStorageError("Bulk publish chưa ghi được audit envelope.");
    }
    for (let index = 1; index < results.length - 1; index += 2) {
      const updateChanged = hasChanged(results[index]);
      const auditChanged = hasChanged(results[index + 1]);
      if (updateChanged !== auditChanged) {
        throw new SiteSettingStorageError("Bulk publish có setting thiếu audit đồng bộ.");
      }
    }
  } catch (error) {
    const racedMutation = await findSiteSettingBulkMutation(database, requestId);
    if (racedMutation) {
      assertMatchingBulkMutation(racedMutation, payloadSha256);
      return readBulkSiteSettingResult(database, requestId, racedMutation);
    }
    throw error;
  }

  const mutation = await findSiteSettingBulkMutation(database, requestId);
  if (!mutation) throw new SiteSettingStorageError("Không đọc được audit bulk publish vừa ghi.");
  return readBulkSiteSettingResult(database, requestId, mutation);
}

export async function getPublishedSiteSettings(): Promise<PublishedSiteSettings> {
  try {
    const database = await getSiteDatabase();
    const rows = await database.prepare(`
      SELECT setting_key, published_value
      FROM site_settings
    `).all<{ setting_key: string; published_value: string }>();
    return selectPublishedSiteSettings(rows.results);
  } catch (error) {
    console.warn("Published site settings unavailable; using committed defaults.", error);
    return { ...siteSettingDefaults };
  }
}

export function selectPublishedSiteSettings(
  rows: Array<{ setting_key: string; published_value: string }>,
): PublishedSiteSettings {
  const result = { ...siteSettingDefaults };
  for (const row of rows) {
    if (isSiteSettingKey(row.setting_key)) result[row.setting_key] = row.published_value;
  }
  return sanitizePublishedSettings(result);
}

async function getSiteDatabase(): Promise<D1DatabaseLike> {
  const { env } = await getCloudflareContext({ async: true });
  const database = (env as unknown as { GIACONG_VN_CATALOG?: D1DatabaseLike }).GIACONG_VN_CATALOG;
  if (!database) throw new Error("Missing GIACONG_VN_CATALOG binding.");
  return database;
}

type SiteSettingMutationOperation = "draft" | "publish";

interface SiteSettingMutationRow {
  operation: SiteSettingMutationOperation;
  payload_sha256: string;
}

interface SiteSettingBulkMutationRow {
  operation: "publish_all";
  payload_sha256: string;
  selected_count: number;
  published_count: number;
}

interface AtomicSiteSettingMutation {
  actorSubject: string;
  expectedVersion: number;
  key: SiteSettingKey;
  operation: SiteSettingMutationOperation;
  payloadSha256: string;
  requestId: string;
  value?: string;
}

interface D1DatabaseWithBatch extends D1DatabaseLike {
  batch(statements: D1PreparedStatementLike[]): Promise<unknown[]>;
}

async function findSiteSettingMutation(
  database: D1DatabaseLike,
  requestId: string,
): Promise<SiteSettingMutationRow | null> {
  return database.prepare(`
    SELECT operation, payload_sha256
    FROM admin_site_setting_audit
    WHERE request_id = ?
    LIMIT 1
  `).bind(requestId).first<SiteSettingMutationRow>();
}

async function findSiteSettingBulkMutation(
  database: D1DatabaseLike,
  requestId: string,
): Promise<SiteSettingBulkMutationRow | null> {
  return database.prepare(`
    SELECT operation, payload_sha256, selected_count, published_count
    FROM admin_site_setting_bulk_audit
    WHERE request_id = ?
    LIMIT 1
  `).bind(requestId).first<SiteSettingBulkMutationRow>();
}

function assertMatchingMutation(
  mutation: SiteSettingMutationRow,
  operation: SiteSettingMutationOperation,
  payloadSha256: string,
): void {
  if (mutation.operation !== operation || mutation.payload_sha256 !== payloadSha256) {
    throw new SiteSettingIdempotencyConflictError("requestId đã được dùng cho một payload khác.");
  }
}

function assertMatchingBulkMutation(
  mutation: SiteSettingBulkMutationRow,
  payloadSha256: string,
): void {
  if (mutation.operation !== "publish_all" || mutation.payload_sha256 !== payloadSha256) {
    throw new SiteSettingIdempotencyConflictError("requestId đã được dùng cho một payload khác.");
  }
}

async function readBulkSiteSettingResult(
  database: D1DatabaseLike,
  requestId: string,
  mutation: SiteSettingBulkMutationRow,
): Promise<{ published: AdminSiteSetting[]; skipped: number }> {
  const auditRows = await database.prepare(`
    SELECT entity_key
    FROM admin_site_setting_audit
    WHERE bulk_request_id = ?
    ORDER BY id ASC
  `).bind(requestId).all<{ entity_key: string }>();
  if (auditRows.results.length !== mutation.published_count) {
    throw new SiteSettingStorageError("Bulk audit không khớp số setting đã phát hành.");
  }

  const settings = await listAdminSiteSettings(database);
  const settingsByKey = new Map(settings.map((setting) => [setting.key, setting]));
  const published = auditRows.results
    .map((row) => isSiteSettingKey(row.entity_key) ? settingsByKey.get(row.entity_key) : undefined)
    .filter((setting): setting is AdminSiteSetting => Boolean(setting));
  if (published.length !== mutation.published_count) {
    throw new SiteSettingStorageError("Không đọc được setting vừa phát hành trong bulk.");
  }
  return { published, skipped: mutation.selected_count - mutation.published_count };
}

async function applyAtomicSiteSettingMutation(
  database: D1DatabaseLike,
  input: AtomicSiteSettingMutation,
): Promise<boolean> {
  const databaseWithBatch = database as D1DatabaseWithBatch;
  if (typeof databaseWithBatch.batch !== "function") {
    throw new SiteSettingStorageError("D1 atomic batch chưa sẵn sàng cho settings write.");
  }

  const update = input.operation === "draft"
    ? database.prepare(`
      UPDATE site_settings
      SET draft_value = ?, version = version + 1, updated_by = ?,
        updated_at = CURRENT_TIMESTAMP, last_request_id = ?
      WHERE setting_key = ? AND version = ?
    `).bind(input.value ?? "", input.actorSubject, input.requestId, input.key, input.expectedVersion)
    : database.prepare(`
      UPDATE site_settings
      SET published_value = draft_value, version = version + 1,
        published_by = ?, published_at = CURRENT_TIMESTAMP,
        updated_by = ?, updated_at = CURRENT_TIMESTAMP, last_request_id = ?
      WHERE setting_key = ? AND version = ?
    `).bind(
      input.actorSubject,
      input.actorSubject,
      input.requestId,
      input.key,
      input.expectedVersion,
    );

  const audit = database.prepare(`
    INSERT INTO admin_site_setting_audit (
      request_id, actor_subject, action, operation, entity_type, entity_key,
      previous_revision, resulting_revision, payload_sha256
    )
    SELECT ?, ?, 'update', ?, 'site_setting', setting_key, ?, version, ?
    FROM site_settings
    WHERE setting_key = ? AND version = ? AND last_request_id = ?
  `).bind(
    input.requestId,
    input.actorSubject,
    input.operation,
    input.expectedVersion,
    input.payloadSha256,
    input.key,
    input.expectedVersion + 1,
    input.requestId,
  );

  const results = await databaseWithBatch.batch([update, audit]);
  if (results.length < 2) throw new SiteSettingStorageError("D1 atomic batch trả về kết quả không hợp lệ.");
  if (!hasChanged(results[0])) return false;
  if (!hasChanged(results[1])) throw new SiteSettingStorageError("Settings write chưa ghi được audit đồng bộ.");
  return true;
}

function normalizeExpectedVersion(value: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new SiteSettingValidationError("expectedVersion phải là số nguyên dương.");
  }
  return value;
}

function normalizeRequestId(value: string | undefined): string {
  const requestId = value?.trim().toLowerCase() ?? "";
  if (!requestId) return crypto.randomUUID();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(requestId)) {
    throw new SiteSettingValidationError("requestId phải là UUID hợp lệ.");
  }
  return requestId;
}

async function fingerprintSiteSettingMutation(input: {
  expectedVersion: number;
  key: SiteSettingKey;
  operation: SiteSettingMutationOperation;
  value?: string;
}): Promise<string> {
  const payload = input.operation === "draft"
    ? {
        expectedVersion: input.expectedVersion,
        key: input.key,
        operation: input.operation,
        value: input.value ?? "",
      }
    : {
        expectedVersion: input.expectedVersion,
        key: input.key,
        operation: input.operation,
      };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function fingerprintSiteSettingBulkPublish(): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify({ operation: "publish_all" }));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getDefinition(key: string) {
  const definition = siteSettingDefinitions.find((item) => item.key === key);
  if (!definition) throw new SiteSettingValidationError("Setting không được phép chỉnh sửa.");
  return definition;
}

function isSiteSettingKey(value: string): value is SiteSettingKey {
  return siteSettingDefinitions.some((item) => item.key === value);
}

function normalizeValue(definition: (typeof siteSettingDefinitions)[number], value: unknown): string {
  if (typeof value !== "string") throw new SiteSettingValidationError("Giá trị setting phải là chuỗi.");
  const normalized = value.trim();
  if (normalized.length > (definition.type === "multiline" ? 8000 : 1000)) {
    throw new SiteSettingValidationError("Nội dung setting vượt quá giới hạn cho phép.");
  }
  if (definition.type === "color" && !/^#[0-9a-f]{6}$/i.test(normalized)) {
    throw new SiteSettingValidationError("Màu phải ở định dạng hex, ví dụ #6cbe45.");
  }
  if ((definition.type === "url" || definition.type === "image") && normalized && !isSafeUrl(normalized)) {
    throw new SiteSettingValidationError("URL chỉ được dùng http(s), mailto, tel hoặc đường dẫn nội bộ.");
  }
  return normalized;
}

function isSafeUrl(value: string): boolean {
  if (value.startsWith("/") || value.startsWith("#")) return true;
  try {
    const url = new URL(value);
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function sanitizePublishedSettings(values: PublishedSiteSettings): PublishedSiteSettings {
  const result = { ...siteSettingDefaults };
  for (const definition of siteSettingDefinitions) {
    try {
      result[definition.key] = normalizeValue(definition, values[definition.key]);
    } catch {
      result[definition.key] = siteSettingDefaults[definition.key];
    }
  }
  return result;
}

interface SiteSettingRow {
  setting_key: SiteSettingKey;
  group_name: SiteSettingGroup;
  label: string;
  description: string;
  value_type: SiteSettingType;
  draft_value: string;
  published_value: string;
  version: number;
  updated_by: string | null;
  updated_at: string;
  published_by: string | null;
  published_at: string | null;
}

function toAdminSiteSetting(row: SiteSettingRow): AdminSiteSetting {
  return {
    key: row.setting_key,
    group: row.group_name,
    label: row.label,
    description: row.description,
    type: row.value_type,
    draftValue: row.draft_value,
    publishedValue: row.published_value,
    version: row.version,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
    publishedBy: row.published_by,
    publishedAt: row.published_at,
    dirty: row.draft_value !== row.published_value,
  };
}

async function getSettingRow(database: D1DatabaseLike, key: SiteSettingKey): Promise<SiteSettingRow | null> {
  return database.prepare(`
    SELECT setting_key, group_name, label, description, value_type,
      draft_value, published_value, version, updated_by, updated_at, published_by, published_at
    FROM site_settings WHERE setting_key = ? LIMIT 1
  `).bind(key).first<SiteSettingRow>();
}

async function getSettingRowOrThrow(database: D1DatabaseLike, key: SiteSettingKey): Promise<SiteSettingRow> {
  const row = await getSettingRow(database, key);
  if (!row) throw new SiteSettingNotFoundError("Không tìm thấy setting.");
  return row;
}

async function writeSiteAudit(database: D1DatabaseLike, actorSubject: string, action: string, entityId: string, metadata: unknown): Promise<void> {
  await database.prepare(`
    INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
    VALUES (?, ?, ?, 'site_setting', ?, ?)
  `).bind(crypto.randomUUID(), actorSubject, action, entityId, JSON.stringify(metadata)).run();
}

function hasChanged(result: unknown): boolean {
  if (typeof result !== "object" || result === null) return false;
  const record = result as { meta?: { changes?: unknown }; results?: unknown[] };
  if (Array.isArray(record.results)) return record.results.length > 0;
  const changes = record.meta?.changes;
  return changes !== undefined && Number(changes) > 0;
}
