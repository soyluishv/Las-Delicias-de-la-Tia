-- Guarda las tres fotografías seleccionadas manualmente para la portada.
-- Una lista vacía mantiene la selección automática existente.
ALTER TABLE site_settings
  ADD COLUMN homepage_featured_images_json TEXT NOT NULL DEFAULT '[]';
