-- The core table: one link per row.
CREATE TABLE IF NOT EXISTS links (
  slug        TEXT PRIMARY KEY,                       -- the short part: go.you.com/<slug>
  url         TEXT NOT NULL,                          -- where it redirects to
  clicks      INTEGER NOT NULL DEFAULT 0,             -- fast running total for the list view
  created_at  TEXT NOT NULL DEFAULT (datetime('now')) -- when it was made (UTC)
);
