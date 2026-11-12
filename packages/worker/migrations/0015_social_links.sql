-- Social profiles and external links managed from the admin panel.
CREATE TABLE IF NOT EXISTS social_links (
  id TEXT PRIMARY KEY CHECK (id IN ('facebook', 'instagram', 'tiktok', 'website', 'custom_1', 'custom_2')),
  label TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  is_enabled INTEGER NOT NULL DEFAULT 0 CHECK (is_enabled IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO social_links (id, label, url, is_enabled, sort_order) VALUES
  ('facebook', 'Facebook', '', 0, 1),
  ('instagram', 'Instagram', '', 0, 2),
  ('tiktok', 'TikTok', '', 0, 3),
  ('website', 'Página web', '', 0, 4),
  ('custom_1', 'Enlace adicional 1', '', 0, 5),
  ('custom_2', 'Enlace adicional 2', '', 0, 6);
