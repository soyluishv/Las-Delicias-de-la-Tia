-- Security controls for the single owner account.
-- auth_version invalidates previously issued JWTs after password changes.
ALTER TABLE admin_users ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE admin_users ADD COLUMN recovery_code_hash TEXT;
ALTER TABLE admin_users ADD COLUMN recovery_code_failures INTEGER NOT NULL DEFAULT 0;
ALTER TABLE admin_users ADD COLUMN recovery_locked_until TEXT;
