-- Backfill: existing Stripe premium subscribers were stored as plan='multi'
-- because the old stripe-webhook returned 'multi'. AppContext.maxTeams only
-- recognises 'premium' (4 teams), so those users were silently capped at 1.
-- Normalise to 'premium' so they regain their entitlement.

UPDATE subscriptions
SET    plan = 'premium',
       updated_at = NOW()
WHERE  plan = 'multi';
