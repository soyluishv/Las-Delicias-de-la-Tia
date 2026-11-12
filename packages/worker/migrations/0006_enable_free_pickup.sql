-- Enable free customer pickup at the business location.
UPDATE site_settings
SET allow_pickup = 1,
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'default';
