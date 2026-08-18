-- Keep internal News thumbnail references aligned with active article-owned media.
-- New articles cannot point at News R2 assets before they have a stable article ID.
CREATE TRIGGER IF NOT EXISTS trg_articles_news_media_thumbnail_insert
BEFORE INSERT ON articles
WHEN NEW.thumbnail_url IS NOT NULL
  AND NEW.thumbnail_url LIKE '/media/news/articles/%'
BEGIN
  SELECT RAISE(ABORT, 'INVALID_NEWS_MEDIA_REFERENCE');
END;

-- Existing articles may use an internal News media URL only when the referenced
-- asset is active and belongs to that exact article. This closes the race where
-- an old editor tab attempts to re-select an asset after it was deleted.
CREATE TRIGGER IF NOT EXISTS trg_articles_news_media_thumbnail_update
BEFORE UPDATE OF thumbnail_url ON articles
WHEN NEW.thumbnail_url IS NOT NULL
  AND NEW.thumbnail_url LIKE '/media/news/articles/%'
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM news_media_assets m
      WHERE m.article_id = NEW.id
        AND m.status = 'active'
        AND '/media/' || m.storage_key = NEW.thumbnail_url
    )
    THEN RAISE(ABORT, 'INVALID_NEWS_MEDIA_REFERENCE')
  END;
END;
