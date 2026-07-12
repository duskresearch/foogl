-- In-app settings. A simple key/value store so the dashboard can manage
-- config that used to require the Cloudflare dashboard (root URL, API token,
-- default redirect, password). A row here wins over the matching env var.
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
