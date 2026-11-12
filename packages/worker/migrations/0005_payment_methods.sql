CREATE TABLE IF NOT EXISTS payment_methods (
  method_code TEXT PRIMARY KEY
    CHECK (method_code IN ('BANCOLOMBIA', 'NEQUI', 'BREB')),
  display_name TEXT NOT NULL,
  account_holder TEXT NOT NULL DEFAULT '',
  account_type TEXT,
  account_number TEXT,
  bank_name TEXT,
  payment_key TEXT,
  is_enabled INTEGER NOT NULL DEFAULT 0 CHECK (is_enabled IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE orders ADD COLUMN payment_method_detail TEXT;

INSERT OR IGNORE INTO payment_methods
  (method_code, display_name, account_holder, is_enabled, sort_order)
VALUES
  ('BANCOLOMBIA', 'Bancolombia', '', 0, 1),
  ('NEQUI', 'Nequi', '', 0, 2);

INSERT OR IGNORE INTO payment_methods
  (method_code, display_name, account_holder, payment_key, is_enabled, sort_order)
VALUES
  ('BREB', 'Llave Bre-B', 'Erika Zapata', '3014684302', 1, 3);