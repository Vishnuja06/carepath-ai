-- =====================================================================
-- Planner Workspace persistence (Lakebase / Postgres).
-- Stores a planner's shortlisted facilities, free-text notes, and manual
-- rank overrides so decisions survive across sessions. Keyed by the app
-- user's identity so each planner sees only their own work.
--
-- Run once against the Lakebase database before first request, e.g.:
--   psql "$PGHOST" -f config/migrations/001_planner.sql
-- (PGHOST/PGDATABASE/etc. are injected by the platform at runtime.)
-- =====================================================================

CREATE TABLE IF NOT EXISTS planner_shortlist (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_by    TEXT        NOT NULL,        -- app user email (from request identity)
  facility_id   TEXT        NOT NULL,
  specialty     TEXT,                        -- the need this was shortlisted for
  pincode       INTEGER,                     -- patient location at time of shortlisting
  note          TEXT,                        -- planner's free-text note
  override_rank INTEGER,                     -- manual re-rank (NULL = keep engine order)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- one row per (planner, facility, need) — re-saving updates the note/override
  UNIQUE (created_by, facility_id, specialty)
);

CREATE INDEX IF NOT EXISTS idx_shortlist_user
  ON planner_shortlist (created_by, created_at DESC);
