-- Social preview (Open Graph) fields. All optional — a link without them
-- just redirects as before.
ALTER TABLE links ADD COLUMN og_title TEXT;
ALTER TABLE links ADD COLUMN og_description TEXT;
ALTER TABLE links ADD COLUMN og_image TEXT;

-- One row per click. This is what powers the per-link stats view.
-- Geo (country/city) comes free from Cloudflare's edge on every request —
-- no MaxMind, no API token. Device/browser/os are parsed from the user agent.
CREATE TABLE IF NOT EXISTS clicks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  country     TEXT,   -- ISO country code, e.g. "US"
  city        TEXT,
  device      TEXT,   -- mobile | tablet | desktop
  browser     TEXT,
  os          TEXT,
  referer     TEXT    -- host the click came from, e.g. "twitter.com"
);

-- Makes "all clicks for this slug, newest first" fast.
CREATE INDEX IF NOT EXISTS idx_clicks_slug_time ON clicks(slug, created_at);
