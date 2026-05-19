-- Apple In-App Purchase support: extend subscriptions table.
-- Idempotent so it is safe to re-apply.

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS platform                       TEXT DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS apple_original_transaction_id  TEXT,
  ADD COLUMN IF NOT EXISTS apple_product_id               TEXT,
  ADD COLUMN IF NOT EXISTS apple_environment              TEXT;

-- One Apple original_transaction_id maps to exactly one user, so we can
-- look up the user from an Apple Server-to-Server notification.
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_apple_original_tx
  ON subscriptions(apple_original_transaction_id)
  WHERE apple_original_transaction_id IS NOT NULL;
