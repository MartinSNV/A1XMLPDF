-- DDL pre lokálnu RPO cache databázu
-- Spusti raz pred prvým synchem:
--   psql $LOCAL_RPO_DB_URL -f scripts/setup-rpo-db.sql

CREATE TABLE IF NOT EXISTS rpo_fo (
  ico         TEXT        NOT NULL,
  is_inactive BOOLEAN     NOT NULL DEFAULT FALSE,
  data        JSONB,
  synced_at   TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT rpo_fo_pkey PRIMARY KEY (ico)
);

CREATE INDEX IF NOT EXISTS rpo_fo_ico_idx       ON rpo_fo (ico);
CREATE INDEX IF NOT EXISTS rpo_fo_inactive_idx  ON rpo_fo (ico) WHERE is_inactive = FALSE;
CREATE INDEX IF NOT EXISTS rpo_fo_data_gin_idx  ON rpo_fo USING gin (data jsonb_path_ops);

-- Tabuľka pre ukladanie stavu syncu (čas posledného syncu)
CREATE TABLE IF NOT EXISTS rpo_sync_state (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
