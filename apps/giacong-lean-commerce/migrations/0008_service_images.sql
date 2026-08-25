-- Service main image, mirroring products.imageUrl.
--
-- Additive by design: NULL keeps every existing service family on its icon/solid
-- fallback, so this migration never makes a service page depend on new data.
ALTER TABLE services
  ADD COLUMN image_url TEXT;
