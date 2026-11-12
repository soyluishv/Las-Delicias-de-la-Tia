-- Valores financieros propios para las cotizaciones de eventos.
-- El domicilio se registra separado de los productos y servicios.
ALTER TABLE event_requests
  ADD COLUMN delivery_fee_cop INTEGER NOT NULL DEFAULT 0
  CHECK (delivery_fee_cop >= 0);

ALTER TABLE event_requests
  ADD COLUMN deposit_required_cop INTEGER NOT NULL DEFAULT 0
  CHECK (deposit_required_cop >= 0);

ALTER TABLE event_requests
  ADD COLUMN deposit_paid_cop INTEGER NOT NULL DEFAULT 0
  CHECK (deposit_paid_cop >= 0);
