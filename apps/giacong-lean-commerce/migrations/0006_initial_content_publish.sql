-- Record the formal first-publish of all brand content seeded in migration 0004.
-- Sets published_by/published_at on every setting that was seeded but never formally
-- published through the CMS, and writes one audit_log entry per setting so the
-- audit trail reflects the approved initial state.

UPDATE site_settings
SET
  published_by  = 'system:initial_seed',
  published_at  = datetime('now'),
  updated_by    = 'system:initial_seed',
  updated_at    = datetime('now')
WHERE published_at IS NULL;

-- Audit log entries — one per setting. D1 supports lower(hex(randomblob(N))) for UUIDs.
INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
SELECT
  lower(
    substr(hex(randomblob(4)),1,8) || '-' ||
    substr(hex(randomblob(2)),1,4) || '-4' ||
    substr(hex(randomblob(2)),1,3) || '-' ||
    substr(hex(randomblob(2)),1,4) || '-' ||
    substr(hex(randomblob(6)),1,12)
  ),
  'system:initial_seed',
  'site_setting.published',
  'site_setting',
  setting_key,
  json_object('note', 'initial_seed_publish', 'publishedValue', published_value)
FROM site_settings
WHERE published_by = 'system:initial_seed';
