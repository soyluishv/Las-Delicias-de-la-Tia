-- Las Delicias de la Tía - Cloudflare D1 / SQLite initial schema
-- Home-based family food business. Single operating base; no public storefront address.
-- All money values are integer Colombian pesos (COP).
-- Create the first owner account later through a protected bootstrap flow; never seed a password here.

PRAGMA foreign_keys = ON;

-- -----------------------------------------------------------------------------
-- Private administrator accounts. Public staff registration is not provided.
-- The initial deployment should create one owner account through a one-time,
-- protected bootstrap operation.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'SUPER_ADMIN'
    CHECK (role IN ('SUPER_ADMIN', 'MANAGER', 'STAFF')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- One home-based family business. PRIVATE address fields must never be returned
-- by public API endpoints. Only the owner/admin may read or update them.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS site_settings (
  id TEXT PRIMARY KEY CHECK (id = 'default'),
  business_name TEXT NOT NULL DEFAULT 'Las Delicias de la Tía',
  owner_contact_name TEXT NOT NULL DEFAULT 'Erika Zapata',
  site_title TEXT NOT NULL DEFAULT 'Las Delicias de la Tía | Comidas para toda ocasión',
  tagline_primary TEXT NOT NULL DEFAULT 'Comidas para toda ocasión',
  tagline_secondary TEXT NOT NULL DEFAULT 'Para cada antojo, una experiencia',
  logo_key TEXT NOT NULL DEFAULT 'brand/las-delicias-de-la-tia-logo.png',
  logo_url TEXT NOT NULL DEFAULT '/brand/las-delicias-de-la-tia-logo.png',
  favicon_key TEXT,
  favicon_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#C51E43',
  secondary_color TEXT NOT NULL DEFAULT '#FFF3E7',
  text_color TEXT NOT NULL DEFAULT '#261C20',
  currency_code TEXT NOT NULL DEFAULT 'COP',
  timezone TEXT NOT NULL DEFAULT 'America/Bogota',
  business_model TEXT NOT NULL DEFAULT 'HOME_BASED'
    CHECK (business_model IN ('HOME_BASED')),
  contact_phone TEXT NOT NULL DEFAULT '3014684302',
  contact_whatsapp TEXT NOT NULL DEFAULT '3014684302',
  private_base_address TEXT NOT NULL DEFAULT 'Calle 132 A Sur 47-09',
  private_base_neighborhood TEXT NOT NULL DEFAULT 'La Playita',
  private_base_city TEXT,
  private_base_department TEXT,
  show_base_address_publicly INTEGER NOT NULL DEFAULT 0
    CHECK (show_base_address_publicly IN (0, 1)),
  allow_guest_checkout INTEGER NOT NULL DEFAULT 1
    CHECK (allow_guest_checkout IN (0, 1)),
  allow_delivery INTEGER NOT NULL DEFAULT 1
    CHECK (allow_delivery IN (0, 1)),
  allow_pickup INTEGER NOT NULL DEFAULT 0
    CHECK (allow_pickup IN (0, 1)),
  delivery_vehicle TEXT NOT NULL DEFAULT 'MOTORCYCLE'
    CHECK (delivery_vehicle IN ('MOTORCYCLE', 'OTHER')),
  free_delivery_enabled INTEGER NOT NULL DEFAULT 1
    CHECK (free_delivery_enabled IN (0, 1)),
  -- The owner said delivery is free for orders with MORE than 10 food units.
  -- 11 means quantity >= 11. The API must total product quantities server-side.
  free_delivery_min_units INTEGER NOT NULL DEFAULT 11
    CHECK (free_delivery_min_units >= 1),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO site_settings (id) VALUES ('default');

-- -----------------------------------------------------------------------------
-- Categories and product catalogue. Suitable for prepared food, fiambres,
-- desserts, special meals and event food. Categories are not hard-coded.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  image_key TEXT,
  image_url TEXT,
  parent_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  price_cop INTEGER NOT NULL CHECK (price_cop >= 0),
  image_key TEXT,
  image_url TEXT,
  is_available INTEGER NOT NULL DEFAULT 1 CHECK (is_available IN (0, 1)),
  track_stock INTEGER NOT NULL DEFAULT 0 CHECK (track_stock IN (0, 1)),
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS product_options (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  selection_type TEXT NOT NULL DEFAULT 'SINGLE'
    CHECK (selection_type IN ('SINGLE', 'MULTIPLE')),
  is_required INTEGER NOT NULL DEFAULT 0 CHECK (is_required IN (0, 1)),
  min_select INTEGER NOT NULL DEFAULT 0 CHECK (min_select >= 0),
  max_select INTEGER NOT NULL DEFAULT 1 CHECK (max_select >= 1),
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_option_values (
  id TEXT PRIMARY KEY,
  option_id TEXT NOT NULL,
  name TEXT NOT NULL,
  price_delta_cop INTEGER NOT NULL DEFAULT 0,
  is_available INTEGER NOT NULL DEFAULT 1 CHECK (is_available IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (option_id) REFERENCES product_options(id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- Delivery fees by service area. Keep this empty until the owner supplies
-- exact delivery prices and covered neighborhoods; no fees are guessed.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS delivery_zones (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT,
  neighborhoods_json TEXT NOT NULL DEFAULT '[]',
  fee_cop INTEGER NOT NULL DEFAULT 0 CHECK (fee_cop >= 0),
  minimum_order_cop INTEGER NOT NULL DEFAULT 0 CHECK (minimum_order_cop >= 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- Orders. Guest checkout requires name and phone; email is optional.
-- Delivery address is a snapshot on each order. The home base is not public.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  order_type TEXT NOT NULL CHECK (order_type IN ('DELIVERY', 'PICKUP')),
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'PICKED_UP', 'CANCELLED')),
  address_line TEXT,
  neighborhood TEXT,
  city TEXT,
  address_reference TEXT,
  delivery_zone_id TEXT,
  delivery_zone_name_snapshot TEXT,
  item_quantity_total INTEGER NOT NULL CHECK (item_quantity_total >= 1),
  subtotal_cop INTEGER NOT NULL CHECK (subtotal_cop >= 0),
  delivery_fee_cop INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee_cop >= 0),
  discount_cop INTEGER NOT NULL DEFAULT 0 CHECK (discount_cop >= 0),
  total_cop INTEGER NOT NULL CHECK (total_cop >= 0),
  payment_method TEXT NOT NULL DEFAULT 'CASH'
    CHECK (payment_method IN ('CASH', 'TRANSFER')),
  payment_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')),
  scheduled_for TEXT,
  customer_notes TEXT,
  admin_notes TEXT,
  delivery_person_name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (delivery_zone_id) REFERENCES delivery_zones(id) ON DELETE SET NULL,
  CHECK (
    (order_type = 'PICKUP') OR
    (order_type = 'DELIVERY' AND address_line IS NOT NULL AND neighborhood IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  product_id TEXT,
  product_name_snapshot TEXT NOT NULL,
  unit_price_cop INTEGER NOT NULL CHECK (unit_price_cop >= 0),
  quantity INTEGER NOT NULL CHECK (quantity >= 1),
  line_total_cop INTEGER NOT NULL CHECK (line_total_cop >= 0),
  options_snapshot_json TEXT NOT NULL DEFAULT '[]',
  item_notes TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

-- -----------------------------------------------------------------------------
-- Event requests are separate from restaurant table reservations.
-- A visitor may request a quote without creating an account.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_requests (
  id TEXT PRIMARY KEY,
  request_number TEXT NOT NULL UNIQUE,
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_email TEXT,
  event_type TEXT NOT NULL,
  event_date TEXT,
  guest_count INTEGER CHECK (guest_count IS NULL OR guest_count >= 1),
  city TEXT,
  neighborhood TEXT,
  venue_address TEXT,
  budget_cop INTEGER CHECK (budget_cop IS NULL OR budget_cop >= 0),
  requested_food TEXT,
  event_details TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'IN_REVIEW', 'QUOTED', 'ACCEPTED', 'REJECTED', 'CANCELLED')),
  quoted_total_cop INTEGER CHECK (quoted_total_cop IS NULL OR quoted_total_cop >= 0),
  quote_details TEXT,
  admin_notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- Gallery for food and events. The supplied logo is a brand asset, not a gallery
-- entry; it is stored separately in site_settings.logo_url/logo_key.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gallery_images (
  id TEXT PRIMARY KEY,
  image_key TEXT,
  image_url TEXT NOT NULL,
  alt_text TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'FOOD'
    CHECK (category IN ('FOOD', 'EVENTS')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- Audit log for important admin actions.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL
);

-- Indexes for common storefront and admin queries.
CREATE INDEX IF NOT EXISTS idx_categories_active_sort
  ON categories(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_products_category_available_sort
  ON products(category_id, is_available, sort_order);
CREATE INDEX IF NOT EXISTS idx_product_options_product
  ON product_options(product_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_option_values_option
  ON product_option_values(option_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_city_active
  ON delivery_zones(city, is_active);
CREATE INDEX IF NOT EXISTS idx_orders_status_created
  ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_phone_created
  ON orders(customer_phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order
  ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_event_requests_status_created
  ON event_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gallery_active_category_sort
  ON gallery_images(is_active, category, sort_order);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created
  ON audit_logs(created_at DESC);
