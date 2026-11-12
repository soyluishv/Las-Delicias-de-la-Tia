INSERT INTO categories (id, name, slug, description, sort_order, is_active)
VALUES
('cat-hamburguesas', 'Hamburguesas', 'hamburguesas', 'Hamburguesas y especialidades de la casa.', 1, 1),
('cat-perros', 'Perros calientes', 'perros-calientes', 'Perros calientes y sus variedades.', 2, 1),
('cat-salchipapas', 'Salchipapas', 'salchipapas', 'Salchipapas y combinaciones.', 3, 1),
('cat-pizzas', 'Pizzas', 'pizzas', 'Pizzas y preparaciones especiales.', 4, 1),
('cat-papitas', 'Papitas y acompañamientos', 'papitas-acompanamientos', 'Porciones y acompañamientos.', 5, 1),
('cat-fiambres', 'Fiambres', 'fiambres', 'Fiambres y preparaciones tradicionales.', 6, 1),
('cat-postres', 'Postres y dulces', 'postres-dulces', 'Arroz con leche y otros postres.', 7, 1),
('cat-eventos', 'Comidas para eventos', 'comidas-eventos', 'Preparaciones para celebraciones y ocasiones especiales.', 8, 1)
ON CONFLICT(slug) DO NOTHING;
