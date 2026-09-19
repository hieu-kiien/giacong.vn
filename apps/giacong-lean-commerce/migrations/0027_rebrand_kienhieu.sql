-- Move persisted public-facing settings from the legacy Giacong.vn identity to Kienhieu.
-- The guards intentionally touch only known legacy/default values; operator-owned custom
-- settings and custom media are preserved. Apply this migration in the controlled publish flow.

UPDATE site_settings
SET draft_value = CASE
      WHEN lower(trim(draft_value)) IN ('giacong.vn', 'giacong') THEN 'Kienhieu'
      ELSE draft_value
    END,
    published_value = CASE
      WHEN lower(trim(published_value)) IN ('giacong.vn', 'giacong') THEN 'Kienhieu'
      ELSE published_value
    END,
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE setting_key = 'brand_name'
  AND (
    lower(trim(draft_value)) IN ('giacong.vn', 'giacong')
    OR lower(trim(published_value)) IN ('giacong.vn', 'giacong')
  );

UPDATE site_settings
SET draft_value = CASE
      WHEN draft_value = 'Giacong.vn - Giải pháp gia công toàn diện' THEN 'Kienhieu - Giải pháp gia công toàn diện'
      ELSE draft_value
    END,
    published_value = CASE
      WHEN published_value = 'Giacong.vn - Giải pháp gia công toàn diện' THEN 'Kienhieu - Giải pháp gia công toàn diện'
      ELSE published_value
    END,
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE setting_key = 'site_title'
  AND (
    draft_value = 'Giacong.vn - Giải pháp gia công toàn diện'
    OR published_value = 'Giacong.vn - Giải pháp gia công toàn diện'
  );

UPDATE site_settings
SET draft_value = CASE
      WHEN lower(trim(draft_value)) IN ('info@giacong.vn', 'qtu1053@gmail.com') THEN 'contact@kienhieu.id.vn'
      ELSE draft_value
    END,
    published_value = CASE
      WHEN lower(trim(published_value)) IN ('info@giacong.vn', 'qtu1053@gmail.com') THEN 'contact@kienhieu.id.vn'
      ELSE published_value
    END,
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE setting_key = 'contact_email'
  AND (
    lower(trim(draft_value)) IN ('info@giacong.vn', 'qtu1053@gmail.com')
    OR lower(trim(published_value)) IN ('info@giacong.vn', 'qtu1053@gmail.com')
  );

UPDATE site_settings
SET draft_value = CASE
      WHEN draft_value = 'Giacong.vn cung cấp' THEN 'Kienhieu cung cấp'
      ELSE draft_value
    END,
    published_value = CASE
      WHEN published_value = 'Giacong.vn cung cấp' THEN 'Kienhieu cung cấp'
      ELSE published_value
    END,
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE setting_key = 'hero_eyebrow'
  AND (draft_value = 'Giacong.vn cung cấp' OR published_value = 'Giacong.vn cung cấp');

UPDATE site_settings
SET draft_value = CASE
      WHEN draft_value = 'Giacong.vn là nền tảng kết nối khách hàng và các đơn vị sản xuất, cung cấp giải pháp gia công toàn diện.'
        THEN 'Kienhieu là nền tảng kết nối khách hàng và các đơn vị sản xuất, cung cấp giải pháp gia công toàn diện.'
      ELSE draft_value
    END,
    published_value = CASE
      WHEN published_value = 'Giacong.vn là nền tảng kết nối khách hàng và các đơn vị sản xuất, cung cấp giải pháp gia công toàn diện.'
        THEN 'Kienhieu là nền tảng kết nối khách hàng và các đơn vị sản xuất, cung cấp giải pháp gia công toàn diện.'
      ELSE published_value
    END,
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE setting_key = 'footer_description'
  AND (
    draft_value = 'Giacong.vn là nền tảng kết nối khách hàng và các đơn vị sản xuất, cung cấp giải pháp gia công toàn diện.'
    OR published_value = 'Giacong.vn là nền tảng kết nối khách hàng và các đơn vị sản xuất, cung cấp giải pháp gia công toàn diện.'
  );

UPDATE site_settings
SET draft_value = CASE
      WHEN draft_value = 'Copyright 2026 © Giacong.vn | Một sản phẩm của Netmedia' THEN 'Copyright 2026 © Kienhieu'
      ELSE draft_value
    END,
    published_value = CASE
      WHEN published_value = 'Copyright 2026 © Giacong.vn | Một sản phẩm của Netmedia' THEN 'Copyright 2026 © Kienhieu'
      ELSE published_value
    END,
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE setting_key = 'footer_copyright'
  AND (
    draft_value = 'Copyright 2026 © Giacong.vn | Một sản phẩm của Netmedia'
    OR published_value = 'Copyright 2026 © Giacong.vn | Một sản phẩm của Netmedia'
  );

UPDATE site_settings
SET draft_value = CASE WHEN trim(draft_value) = '' THEN '/images/brand/kienhieu-logo.svg' ELSE draft_value END,
    published_value = CASE WHEN trim(published_value) = '' THEN '/images/brand/kienhieu-logo.svg' ELSE published_value END,
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE setting_key = 'logo_url'
  AND (trim(draft_value) = '' OR trim(published_value) = '');

UPDATE site_settings
SET draft_value = CASE WHEN trim(draft_value) = '' THEN '/images/brand/kienhieu-logo-dark.svg' ELSE draft_value END,
    published_value = CASE WHEN trim(published_value) = '' THEN '/images/brand/kienhieu-logo-dark.svg' ELSE published_value END,
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE setting_key = 'logo_dark_url'
  AND (trim(draft_value) = '' OR trim(published_value) = '');

UPDATE site_settings
SET draft_value = CASE WHEN trim(draft_value) = '' THEN '/images/brand/kienhieu-favicon.svg' ELSE draft_value END,
    published_value = CASE WHEN trim(published_value) = '' THEN '/images/brand/kienhieu-favicon.svg' ELSE published_value END,
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE setting_key = 'favicon_url'
  AND (trim(draft_value) = '' OR trim(published_value) = '');

UPDATE site_navigation_items
SET draft_label = CASE WHEN draft_label = 'Về Giacong.vn' THEN 'Về Kienhieu' ELSE draft_label END,
    published_label = CASE WHEN published_label = 'Về Giacong.vn' THEN 'Về Kienhieu' ELSE published_label END,
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE menu_key = 'primary'
  AND (
    draft_label = 'Về Giacong.vn'
    OR published_label = 'Về Giacong.vn'
  );
