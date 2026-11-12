-- Tarifas de transporte para eventos, separadas de los domicilios de productos.
-- No se precargan municipios, barrios ni valores: la propietaria define su cobertura.
CREATE TABLE IF NOT EXISTS event_delivery_zones (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  neighborhoods_json TEXT NOT NULL DEFAULT '[]',
  fee_cop INTEGER NOT NULL DEFAULT 0 CHECK (fee_cop >= 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_event_delivery_zones_city_active
  ON event_delivery_zones(city, is_active);
