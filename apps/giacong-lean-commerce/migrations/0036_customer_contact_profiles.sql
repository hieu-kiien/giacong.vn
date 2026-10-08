-- Contact details volunteered by the verified website account, separate from auth credentials.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS customer_contact_profiles (
  customer_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL CHECK(length(trim(full_name)) BETWEEN 1 AND 120),
  phone TEXT NOT NULL CHECK(length(phone) BETWEEN 8 AND 24),
  company_name TEXT NOT NULL DEFAULT '',
  contact_consent_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
