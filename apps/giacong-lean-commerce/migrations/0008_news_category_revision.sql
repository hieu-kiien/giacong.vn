ALTER TABLE article_categories
  ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1);
