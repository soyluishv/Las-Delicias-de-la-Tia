-- Configuración operativa del negocio, horarios y dirección privada.
-- Esta migración solo cambia la base D1 local al aplicarse con --local.

ALTER TABLE site_settings ADD COLUMN accept_orders INTEGER NOT NULL DEFAULT 1 CHECK (accept_orders IN (0, 1));
ALTER TABLE site_settings ADD COLUMN allow_scheduled_orders INTEGER NOT NULL DEFAULT 1 CHECK (allow_scheduled_orders IN (0, 1));
ALTER TABLE site_settings ADD COLUMN allow_cash_payment INTEGER NOT NULL DEFAULT 1 CHECK (allow_cash_payment IN (0, 1));
ALTER TABLE site_settings ADD COLUMN minimum_delivery_order_cop INTEGER NOT NULL DEFAULT 0 CHECK (minimum_delivery_order_cop >= 0);
ALTER TABLE site_settings ADD COLUMN minimum_pickup_order_cop INTEGER NOT NULL DEFAULT 0 CHECK (minimum_pickup_order_cop >= 0);
ALTER TABLE site_settings ADD COLUMN delivery_prep_minutes INTEGER NOT NULL DEFAULT 0 CHECK (delivery_prep_minutes >= 0 AND delivery_prep_minutes <= 1440);
ALTER TABLE site_settings ADD COLUMN pickup_prep_minutes INTEGER NOT NULL DEFAULT 0 CHECK (pickup_prep_minutes >= 0 AND pickup_prep_minutes <= 1440);

ALTER TABLE private_business_settings ADD COLUMN internal_notes TEXT;

CREATE TABLE IF NOT EXISTS business_hours (
  day_of_week INTEGER PRIMARY KEY CHECK (day_of_week BETWEEN 1 AND 7),
  is_open INTEGER NOT NULL DEFAULT 0 CHECK (is_open IN (0, 1)),
  opens_at TEXT,
  closes_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (is_open = 0) OR
    (opens_at IS NOT NULL AND closes_at IS NOT NULL)
  )
);

INSERT OR IGNORE INTO business_hours (day_of_week, is_open) VALUES
  (1, 0), (2, 0), (3, 0), (4, 0), (5, 0), (6, 0), (7, 0);

CREATE TABLE IF NOT EXISTS business_hours_settings (
  id TEXT PRIMARY KEY CHECK (id = 'default'),
  special_notes TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO business_hours_settings (id) VALUES ('default');
