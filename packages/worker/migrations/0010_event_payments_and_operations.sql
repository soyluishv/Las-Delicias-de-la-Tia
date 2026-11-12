-- Historial detallado de pagos y seguimiento operativo de eventos.
-- Conserva el acumulado previo de abonos como un movimiento inicial consolidado.
ALTER TABLE event_requests
  ADD COLUMN operational_status TEXT NOT NULL DEFAULT 'PENDING'
  CHECK (operational_status IN ('PENDING','CONFIRMED','PREPARING','READY','DISPATCHED','DELIVERED','COMPLETED','CANCELLED'));

ALTER TABLE event_requests ADD COLUMN planned_delivery_at TEXT;
ALTER TABLE event_requests ADD COLUMN delivery_responsible TEXT;
ALTER TABLE event_requests ADD COLUMN delivery_notes TEXT;

CREATE TABLE IF NOT EXISTS event_payments (
  id TEXT PRIMARY KEY,
  event_request_id TEXT NOT NULL,
  amount_cop INTEGER NOT NULL CHECK (amount_cop > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('CASH','TRANSFER','NEQUI','BRE_B','OTHER')),
  paid_at TEXT NOT NULL,
  reference TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_request_id) REFERENCES event_requests(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_event_payments_event_paid
  ON event_payments(event_request_id, paid_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_requests_operational_status
  ON event_requests(operational_status, event_date);

-- Los abonos previos se conservan como un registro histórico consolidado.
-- La versión anterior solo guardaba el total recibido, no cada transacción.
INSERT OR IGNORE INTO event_payments (
  id, event_request_id, amount_cop, payment_method, paid_at, reference, notes, created_by, created_at
)
SELECT
  'MIGRATED-' || id,
  id,
  deposit_paid_cop,
  'OTHER',
  'NO_REGISTRADA',
  'REGISTRO-HISTORICO-CONSOLIDADO',
  'Saldo recibido acumulado antes de habilitar el historial detallado. El sistema anterior no conservaba cada movimiento individual.',
  'MIGRATION',
  COALESCE(updated_at, CURRENT_TIMESTAMP)
FROM event_requests
WHERE deposit_paid_cop > 0;


CREATE TABLE IF NOT EXISTS event_status_history (
  id TEXT PRIMARY KEY,
  event_request_id TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_request_id) REFERENCES event_requests(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_event_status_history_event_created
  ON event_status_history(event_request_id, created_at DESC);

INSERT OR IGNORE INTO event_status_history (id, event_request_id, from_status, to_status, changed_by, notes, created_at)
SELECT
  'INITIAL-' || id,
  id,
  NULL,
  operational_status,
  'MIGRATION',
  'Estado inicial registrado al habilitar el seguimiento operativo.',
  COALESCE(created_at, CURRENT_TIMESTAMP)
FROM event_requests;
