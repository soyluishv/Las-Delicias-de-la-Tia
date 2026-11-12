-- Configuración editable de textos y visibilidad de la tienda pública.
-- Cambio aditivo: no modifica productos, categorías, fotos, pedidos ni pagos.
ALTER TABLE site_settings ADD COLUMN storefront_content_json TEXT NOT NULL DEFAULT '{}';
