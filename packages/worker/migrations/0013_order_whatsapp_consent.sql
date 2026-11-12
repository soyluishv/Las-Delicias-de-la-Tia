-- Consentimiento opcional para recibir por WhatsApp un aviso transaccional
-- cuando el pedido quede listo. Los pedidos existentes quedan en 0 (sin autorización).
ALTER TABLE orders
  ADD COLUMN whatsapp_updates_consent INTEGER NOT NULL DEFAULT 0
  CHECK (whatsapp_updates_consent IN (0, 1));

ALTER TABLE orders
  ADD COLUMN whatsapp_updates_consent_at TEXT;
