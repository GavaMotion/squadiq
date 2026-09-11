-- Comped accounts: full paid access, but not revenue.
--
-- Solo/premium plans handed out by hand (testers, friends, AYSO contacts) are
-- indistinguishable from real subscribers once the plan is set, so the admin's
-- "Paying" count has been counting gifts as sales. This flag separates the two
-- without touching entitlement: a comped user keeps everything their plan gives
-- them, and only the reporting changes.
--
-- Idempotent so it is safe to re-apply.

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS comped BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN subscriptions.comped IS
  'True when the plan was granted by hand rather than paid for. Entitlement is unchanged; paying counts exclude these rows.';

-- One-time backfill: every paid plan that has no payment reference behind it
-- (no Stripe subscription, no Apple original transaction) was granted by hand.
-- Rows already marked comped are left alone, and a row that later gains a real
-- subscription is un-comped with one click in the admin.
UPDATE subscriptions
   SET comped = TRUE
 WHERE plan IN ('solo', 'premium', 'multi')
   AND comped IS NOT TRUE
   AND stripe_subscription_id IS NULL
   AND apple_original_transaction_id IS NULL;

-- Refresh PostgREST schema cache so the column becomes visible immediately
-- without waiting for the periodic reload.
NOTIFY pgrst, 'reload schema';
