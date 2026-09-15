-- Make the public service-group presentation editable through the existing
-- service_admin_meta row. NULL keeps the captured taxonomy as the fallback for
-- records that have not been reviewed in the admin editor yet.

ALTER TABLE service_admin_meta
  ADD COLUMN offerings_json TEXT;

ALTER TABLE service_admin_meta
  ADD COLUMN cta_label TEXT;

ALTER TABLE service_admin_meta
  ADD COLUMN cta_href TEXT;

ALTER TABLE service_admin_meta
  ADD COLUMN sort_order INTEGER CHECK (sort_order IS NULL OR sort_order >= 0);
