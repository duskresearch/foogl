-- Table-stakes shortener features.
ALTER TABLE links ADD COLUMN expires_at  TEXT;                      -- "YYYY-MM-DD", null = never
ALTER TABLE links ADD COLUMN passthrough INTEGER NOT NULL DEFAULT 0; -- forward ?query to the destination
ALTER TABLE links ADD COLUMN permanent   INTEGER NOT NULL DEFAULT 0; -- 1 = 301 (permanent), 0 = 302
