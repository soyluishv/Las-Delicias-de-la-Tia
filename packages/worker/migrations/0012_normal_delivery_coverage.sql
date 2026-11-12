-- Domicilios normales para seis municipios del sur del Valle de Aburrá.
-- Tarifas iniciales sugeridas; Erika puede cambiarlas desde Configuración > Domicilios.
-- Las tarifas de transporte de eventos especiales no se tocan en esta migración.

UPDATE delivery_zones
SET neighborhoods_json = REPLACE(REPLACE(neighborhoods_json, 'La Playica', 'La Playita'), 'La playica', 'La Playita'), updated_at = CURRENT_TIMESTAMP
WHERE lower(COALESCE(city, '')) LIKE 'caldas%' AND lower(neighborhoods_json) LIKE '%la playica%';

WITH candidates(name) AS (
  VALUES ("La Chuscala"),
         ("Villa Capri"),
         ("Barrios Unidos"),
         ("Bellavista"),
         ("Buena Esperanza"),
         ("Centenario"),
         ("Cristo Rey"),
         ("Mandalay"),
         ("Andalucía"),
         ("La Acuarela"),
         ("La Docena"),
         ("Juan XXIII"),
         ("La Inmaculada"),
         ("La Goretti"),
         ("La Planta"),
         ("La Playita"),
         ("El Socorro"),
         ("Felipe Echevarría I"),
         ("Los Cerezos"),
         ("Olaya Herrera"),
         ("Las Margaritas"),
         ("Fundadores"),
         ("Felipe Echevarría II"),
         ("Zona centro"),
         ("Otro barrio o sector")
), target_zone(id) AS (
  SELECT id FROM delivery_zones WHERE lower(trim(COALESCE(city, ''))) LIKE 'caldas%' ORDER BY is_active DESC, created_at ASC, id ASC LIMIT 1
), new_names(name) AS (
  SELECT candidates.name FROM candidates WHERE NOT EXISTS (SELECT 1 FROM delivery_zones AS z, json_each(z.neighborhoods_json) AS n WHERE lower(trim(COALESCE(z.city, ''))) LIKE 'caldas%' AND z.is_active = 1 AND lower(trim(CAST(n.value AS TEXT))) = lower(trim(candidates.name)))
), existing_names(name) AS (
  SELECT CAST(n.value AS TEXT) FROM delivery_zones AS z, json_each(z.neighborhoods_json) AS n WHERE z.id = (SELECT id FROM target_zone)
), merged(names_json) AS (
  SELECT json_group_array(name) FROM (SELECT name FROM existing_names UNION SELECT name FROM new_names)
)
UPDATE delivery_zones SET neighborhoods_json = COALESCE((SELECT names_json FROM merged), '[]'), updated_at = CURRENT_TIMESTAMP WHERE id = (SELECT id FROM target_zone);

INSERT INTO delivery_zones (id, name, city, neighborhoods_json, fee_cop, minimum_order_cop, is_active)
SELECT 'seed-delivery-caldas-20261106', 'Domicilios - Caldas', 'Caldas, Antioquia', '["La Chuscala","Villa Capri","Barrios Unidos","Bellavista","Buena Esperanza","Centenario","Cristo Rey","Mandalay","Andalucía","La Acuarela","La Docena","Juan XXIII","La Inmaculada","La Goretti","La Planta","La Playita","El Socorro","Felipe Echevarría I","Los Cerezos","Olaya Herrera","Las Margaritas","Fundadores","Felipe Echevarría II","Zona centro","Otro barrio o sector"]', 4000, 0, 1
WHERE NOT EXISTS (SELECT 1 FROM delivery_zones WHERE lower(trim(COALESCE(city, ''))) LIKE 'caldas%' AND is_active = 1);

INSERT INTO delivery_zones (id, name, city, neighborhoods_json, fee_cop, minimum_order_cop, is_active)
SELECT 'seed-delivery-la-estrella-20261106', 'Domicilios - La Estrella', 'La Estrella, Antioquia', '["Alto de Los Ospina","Ancón San Martín","Ancón Sur","Bellavista","Bellos Aires","Calle Vieja","Camilo Torres","Campoalegre","Caquetá","Centro","Centro-Pueblo Viejo","Chile","El Dorado","El Pedrero","Escobar","Horizontes","Industrial","Juan XXIII","La Bermejala","La Chinca","La Ferrería","La Inmaculada 1","La Inmaculada 2","La Ospina","La Raya","Las Brisas","Los Chanos","Monterrey","Pan de Azúcar","Peñas Blancas","Primavera","Quebrada Grande","Sagrada Familia","San Agustín","San Agustín-Industrial","San Agustín-Suramérica","San Andrés","San Cayetano","San Isidro","San José Meleguindo","San Miguel","San Vicente","Sierra Morena","Barrios Unidos","Bavaria","Tablacita","Otro barrio o sector"]', 5000, 0, 1
WHERE NOT EXISTS (SELECT 1 FROM delivery_zones WHERE lower(trim(COALESCE(city, ''))) LIKE 'la estrella%' AND is_active = 1);

INSERT INTO delivery_zones (id, name, city, neighborhoods_json, fee_cop, minimum_order_cop, is_active)
SELECT 'seed-delivery-sabaneta-20261106', 'Domicilios - Sabaneta', 'Sabaneta, Antioquia', '["Aliadas del Sur","Ancón Sur","Betania","Calle del Banco","Calle Larga","El Carmelo II","Entreamigos","Holanda","La Barquereña","La Florida","Lagos de La Doctora","Las Casitas","Los Alcázares","Los Arias","Manuel Restrepo","María Auxiliadora","Nuestra Señora de Los Dolores","Paso Ancho","Playas de María","Prados de Sabaneta","Promisión","Restrepo Naranjo","Sabaneta Real","San Joaquín","San Rafael","Santa Ana","Tres Esquinas","Vegas de La Doctora","Vegas de San José","Villas del Carmen","Virgen del Carmen","Otro barrio o sector"]', 6000, 0, 1
WHERE NOT EXISTS (SELECT 1 FROM delivery_zones WHERE lower(trim(COALESCE(city, ''))) LIKE 'sabaneta%' AND is_active = 1);

INSERT INTO delivery_zones (id, name, city, neighborhoods_json, fee_cop, minimum_order_cop, is_active)
SELECT 'seed-delivery-itagui-20261106', 'Domicilios - Itagüí', 'Itagüí, Antioquia', '["Zona Industrial Nº 1","Zona Industrial Nº 2","Los Naranjos","Asturias","San José","La Independencia","San Juan Bautista","La Gloria","Las Mercedes","San Isidro","Satexco","Playa Rica","Centro","Villa Paula - Artex","La Santa Cruz","Araucaria","Santa Catalina","Samaria","La Finca","Yarumito","El Palmar","Santa Ana","Samaria Robles del Sur Nº 1","Las Margaritas","Malta","Monte Verde","Camparola","San Pío X","La Palma","Jardines Montesacro","Zona Industrial Nº 3 - Estación del Sur","Las Brisas","Pilsen","San Javier","Villa Lía","19 de Abril","San Gabriel","San Antonio","Triana","Ditaires","San Francisco","Glorieta Pilsen","Villas de San Antonio","Reserva Campestre","San Agustín","Bariloche","Santa María Nº 1","Santa María Nº 2","Santa María Nº 3","San Pablo","La Hortensia","Colinas del Sur","San Fernando","Simón Bolívar","La Mayorista","El Carmelo","El Guayabo","Viviendas del Sur","Villaventura","Las Acacias","Las Américas","El Tablazo","Calatrava","Loma Linda","Terranova Nº 1","Terranova Nº 2","La Aldea","Ferrara","Balcones de Sevilla","Fátima","El Rosario","La Unión","Santa María la Nueva","Loma de los Zuleta","Los Olivares","El Progreso","Otro barrio o sector"]', 8000, 0, 1
WHERE NOT EXISTS (SELECT 1 FROM delivery_zones WHERE lower(trim(COALESCE(city, ''))) LIKE 'itag%' AND is_active = 1);

INSERT INTO delivery_zones (id, name, city, neighborhoods_json, fee_cop, minimum_order_cop, is_active)
SELECT 'seed-delivery-envigado-20261106', 'Domicilios - Envigado', 'Envigado, Antioquia', '["Las Vegas","El Portal","San Marcos","Jardines","Villagrande","Pontevedra","Bosques de Zúñiga","Las Orquídeas","Alto de Misael","Las Flores","Uribe Ángel","La Sebastiana","Zúñiga","El Esmeraldal","Loma El Atravesado","El Chocho","La Inmaculada","La Pradera","Loma de las Brujas","El Chingui","El Salado","La Mina","San Rafael","San José","Las Antillas","El Trianón","Loma del Barro","El Dorado","La Paz","Las Casitas","Primavera","Milán-Vallejuelos","Alcalá","Mesa","Centro","Los Naranjos","Obrero","Bucarest","La Magnolia","Otro barrio o sector"]', 10000, 0, 1
WHERE NOT EXISTS (SELECT 1 FROM delivery_zones WHERE lower(trim(COALESCE(city, ''))) LIKE 'envigado%' AND is_active = 1);

INSERT INTO delivery_zones (id, name, city, neighborhoods_json, fee_cop, minimum_order_cop, is_active)
SELECT 'seed-delivery-medellin-20261106', 'Domicilios - Medellín', 'Medellín, Antioquia', '["Santo Domingo Savio Nº 1","Santo Domingo Savio Nº 2","Popular","Granizal","Villa Guadalupe","San Pablo","Carpinelo","La Isla","El Playón de Los Comuneros","La Frontera","La Francia","Andalucía","Villa del Socorro","Santa Cruz","La Rosa","La Salle","Las Granjas","Campo Valdés Nº 2","Santa Inés","El Raizal","Manrique Central Nº 2","Manrique Oriental","Versalles Nº 1","Versalles Nº 2","La Cruz","Berlín","San Isidro","Palermo","Moravia","Sevilla","San Pedro","Aranjuez","Campo Valdés Nº 1","Florencia","Boyacá","Tricentenario","Castilla","Francisco Antonio Zea","Alfonso López","Prado","Jesús Nazareno","El Chagualo","San Benito","Guayaquil","Boston","La Candelaria","San Diego","Naranjal","San Joaquín","Los Conquistadores","Laureles","Las Acacias","Lorena","El Velódromo","Estadio","Florida Nueva","Calasanz","La América","La Floresta","Santa Mónica","Santa Teresita","San Javier Nº 1","San Javier Nº 2","Veinte de Julio","Belencito","El Salado","Las Independencias","El Poblado","Manila","Astorga","Patio Bonito","El Tesoro","Los Balsos Nº 1","San Lucas","La Aguacatala","Santa María de Los Ángeles","Guayabal","Cristo Rey","Santa Fé","Campo Amor","Belén","Rosales","La Mota","La Hondonada","El Rincón","La Loma de Los Bernal","Los Alpes","La Palma","Otro barrio o sector"]', 12000, 0, 1
WHERE NOT EXISTS (SELECT 1 FROM delivery_zones WHERE lower(trim(COALESCE(city, ''))) LIKE 'medell%' AND is_active = 1);
