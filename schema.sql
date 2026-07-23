-- DivergenceDesk v2 schema
-- Run once in the Neon SQL editor.

-- One row per market, per venue, per poll.
CREATE TABLE IF NOT EXISTS snapshots (
  id          BIGSERIAL PRIMARY KEY,
  venue       TEXT        NOT NULL,          -- 'kalshi' | 'polymarket'
  market_id   TEXT        NOT NULL,
  category    TEXT        NOT NULL,
  title       TEXT        NOT NULL,
  prob        DOUBLE PRECISION NOT NULL,     -- implied probability, 0..1
  volume      DOUBLE PRECISION NOT NULL DEFAULT 0,
  close_date  TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS snapshots_lookup
  ON snapshots (venue, market_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS snapshots_recent
  ON snapshots (captured_at DESC);

-- Cached AI pairings so matching doesn't re-run on every page load.
CREATE TABLE IF NOT EXISTS matches (
  id         BIGSERIAL PRIMARY KEY,
  category   TEXT NOT NULL,
  kalshi_id  TEXT NOT NULL,
  poly_id    TEXT NOT NULL,
  confidence TEXT,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (kalshi_id, poly_id)
);

CREATE INDEX IF NOT EXISTS matches_category
  ON matches (category, created_at DESC);
