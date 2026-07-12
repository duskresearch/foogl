-- Targeting rules + referrer hiding.
ALTER TABLE links ADD COLUMN rules         TEXT;                       -- JSON array of {type,match,url}; null = none
ALTER TABLE links ADD COLUMN hide_referrer INTEGER NOT NULL DEFAULT 0; -- 1 = redirect through a no-referrer interstitial
