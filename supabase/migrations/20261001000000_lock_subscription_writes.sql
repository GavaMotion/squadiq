-- Users could write any column of their own subscriptions row: the RLS policies
-- check only user_id = auth.uid(), so one update({ plan: 'premium' }) from the
-- browser console was a free upgrade. Anonymous assistants are 'authenticated'
-- too, so that included anyone holding an invite code.
--
-- The app itself makes exactly two writes with a user's token
-- (src/contexts/AppContext.jsx): it opens a 30-day trial when there is no row,
-- and marks a lapsed trial expired. This trigger allows those two and nothing
-- else. Edge functions, the admin server and the dashboard run as service_role
-- or postgres and pass straight through.
--
-- SECURITY INVOKER on purpose: under SECURITY DEFINER, current_user would be
-- the owner and every caller would look trusted.

create or replace function public.guard_subscription_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  lapsed boolean;
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Whatever was sent, a user-created row is a fresh trial and nothing more.
    new.plan                          := 'trial';
    new.trial_start                   := now();
    new.trial_end                     := now() + interval '30 days';
    new.plan_override                 := null;
    new.status                        := 'active';
    new.platform                      := 'stripe';
    new.current_period_end            := null;
    new.stripe_customer_id            := null;
    new.stripe_subscription_id        := null;
    new.apple_original_transaction_id := null;
    new.apple_product_id              := null;
    new.apple_environment             := null;
    new.gifted                        := false;
    new.archived_at                   := null;
    new.created_at                    := now();
    new.updated_at                    := now();
    return new;
  end if;

  -- UPDATE: the only change a user may make is expiring their own lapsed trial.
  -- Every other column is put back as it was.
  lapsed := old.plan = 'trial' and old.trial_end < now() and new.plan = 'expired';
  new := old;
  if lapsed then
    new.plan       := 'expired';
    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke all on function public.guard_subscription_write() from public, anon, authenticated;

drop trigger if exists guard_subscription_write on public.subscriptions;
create trigger guard_subscription_write
  before insert or update on public.subscriptions
  for each row execute function public.guard_subscription_write();
