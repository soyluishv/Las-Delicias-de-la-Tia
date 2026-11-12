ALTER TABLE event_requests
ADD COLUMN whatsapp_consent INTEGER NOT NULL DEFAULT 0
CHECK (whatsapp_consent IN (0, 1));

ALTER TABLE event_requests
ADD COLUMN whatsapp_consent_at TEXT;