-- Archived accounts: filed away, not deleted.
--
-- Dead trials pile up on the admin board and drown the accounts that matter.
-- Archiving takes a row off the board and keeps everything about it — there is
-- no delete, so an archive is always reversible and nothing is lost.
--
-- Archiving a non-paying account also expires it (that is the "kill" half of
-- the button). A paying account keeps its plan: we are still billing them, so
-- cutting entitlement would be taking money for nothing. Restoring puts the row
-- back on the board and leaves the plan wherever it ended up.
--
-- Idempotent so it is safe to re-apply.

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

COMMENT ON COLUMN subscriptions.archived_at IS
  'When this account was archived from the admin board. NULL = live. Filing only — entitlement is carried by plan, not by this column.';

-- Refresh PostgREST schema cache so the column becomes visible immediately
-- without waiting for the periodic reload.
NOTIFY pgrst, 'reload schema';
