-- Prevent concurrent queued/running sync jobs for the same integration.
-- The API check alone is race-prone when multiple requests arrive simultaneously.
CREATE UNIQUE INDEX IF NOT EXISTS sync_runs_active_connection_unique
  ON sync_runs(connection_id)
  WHERE status IN ('QUEUED', 'RUNNING');
