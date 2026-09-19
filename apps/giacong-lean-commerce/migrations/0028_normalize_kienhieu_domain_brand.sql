-- Normalize the partially migrated domain-as-brand values seen in the existing
-- production database. Exact-value guards preserve any operator-owned custom copy.

UPDATE site_settings
SET draft_value = CASE
      WHEN lower(trim(draft_value)) IN ('kienhieu.id.vn', 'www.kienhieu.id.vn') THEN 'Kienhieu'
      ELSE draft_value
    END,
    published_value = CASE
      WHEN lower(trim(published_value)) IN ('kienhieu.id.vn', 'www.kienhieu.id.vn') THEN 'Kienhieu'
      ELSE published_value
    END,
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE setting_key = 'brand_name'
  AND (
    lower(trim(draft_value)) IN ('kienhieu.id.vn', 'www.kienhieu.id.vn')
    OR lower(trim(published_value)) IN ('kienhieu.id.vn', 'www.kienhieu.id.vn')
  );

UPDATE site_settings
SET draft_value = CASE
      WHEN lower(trim(draft_value)) = 'kienhieu.id.vn - giải pháp gia công toàn diện'
        THEN 'Kienhieu - Giải pháp gia công toàn diện'
      ELSE draft_value
    END,
    published_value = CASE
      WHEN lower(trim(published_value)) = 'kienhieu.id.vn - giải pháp gia công toàn diện'
        THEN 'Kienhieu - Giải pháp gia công toàn diện'
      ELSE published_value
    END,
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE setting_key = 'site_title'
  AND (
    lower(trim(draft_value)) = 'kienhieu.id.vn - giải pháp gia công toàn diện'
    OR lower(trim(published_value)) = 'kienhieu.id.vn - giải pháp gia công toàn diện'
  );

UPDATE site_settings
SET draft_value = CASE
      WHEN lower(trim(draft_value)) = 'kienhieu.id.vn cung cấp' THEN 'Kienhieu cung cấp'
      ELSE draft_value
    END,
    published_value = CASE
      WHEN lower(trim(published_value)) = 'kienhieu.id.vn cung cấp' THEN 'Kienhieu cung cấp'
      ELSE published_value
    END,
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE setting_key = 'hero_eyebrow'
  AND (
    lower(trim(draft_value)) = 'kienhieu.id.vn cung cấp'
    OR lower(trim(published_value)) = 'kienhieu.id.vn cung cấp'
  );
