-- Add status / current_period_end / updated_at columns the subscription
-- webhook functions write. Idempotent so it can be safely re-run.

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS status              TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS current_period_end  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at          TIMESTAMPTZ DEFAULT NOW();

-- Refresh PostgREST schema cache so the columns become visible immediately
-- without waiting for the periodic reload.
NOTIFY pgrst, 'reload schema';
