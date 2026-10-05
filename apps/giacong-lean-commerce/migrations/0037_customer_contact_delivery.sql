PRAGMA foreign_keys = ON;
CREATE TABLE customer_contact_delivery (
  customer_id TEXT PRIMARY KEY REFERENCES customer_contact_profiles(customer_id) ON DELETE CASCADE,
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision >= 1),
  sheet_revision INTEGER NOT NULL DEFAULT 0 CHECK(sheet_revision >= 0),
  email_status TEXT NOT NULL DEFAULT 'pending' CHECK(email_status IN ('pending','delivered','not_required')),
  email_payload_json TEXT NOT NULL CHECK(json_valid(email_payload_json)),
  email_started_at INTEGER,
  lease_token TEXT,
  lease_until INTEGER,
  last_error TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER customer_contact_delivery_created AFTER INSERT ON customer_contact_profiles BEGIN
  INSERT INTO customer_contact_delivery(customer_id, email_payload_json)
  VALUES (NEW.customer_id, json_object('name',NEW.full_name,'phone',NEW.phone,'companyName',NEW.company_name,
    'email',(SELECT email FROM "user" WHERE id = NEW.customer_id)));
END;
CREATE TRIGGER customer_contact_delivery_updated AFTER UPDATE ON customer_contact_profiles
WHEN NEW.full_name <> OLD.full_name OR NEW.phone <> OLD.phone OR NEW.company_name <> OLD.company_name BEGIN
  INSERT INTO customer_contact_delivery(customer_id,email_status,email_payload_json)
  VALUES (NEW.customer_id,'not_required',json_object('name',NEW.full_name,'phone',NEW.phone,'companyName',NEW.company_name,
    'email',(SELECT email FROM "user" WHERE id = NEW.customer_id)))
  ON CONFLICT(customer_id) DO UPDATE SET revision = revision + 1,
    email_payload_json = CASE WHEN email_status = 'pending' AND email_started_at IS NULL
      THEN excluded.email_payload_json ELSE email_payload_json END,
    updated_at = CURRENT_TIMESTAMP;
END;
