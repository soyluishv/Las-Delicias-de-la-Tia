-- Allow up to three image URLs/paths for every category and product.
-- Existing image_url/image_key columns remain intact for backward compatibility.
ALTER TABLE categories ADD COLUMN image_gallery_json TEXT;
ALTER TABLE products ADD COLUMN image_gallery_json TEXT;
