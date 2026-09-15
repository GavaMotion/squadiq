-- Tell the head coach when someone joins.
alter table public.team_members
  add column if not exists owner_notified_at timestamptz;

-- Seat limit: pick the most generous row rather than an arbitrary one.
--
-- The old body ended in `limit 1` over a join with no ordering. Production has
-- exactly one subscription per user today, so it has never mattered — but if a
-- second row ever appears (a trial created alongside a paid plan, say),
-- Postgres would be free to return the trial and quietly downgrade a premium
-- coach's seats. Taking the maximum makes the answer stable no matter how many
-- rows exist.
create or replace function public.team_seat_limit(tid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select max(
      case
        when s.plan_override = 'unlimited'            then 99
        when s.plan = 'expired'                       then 0
        when s.plan = 'premium'                       then 3
        when s.plan = 'solo'                          then 1
        -- A lapsed trial keeps plan = 'trial', so check the date, not the label.
        when s.plan = 'trial' and s.trial_end > now() then 1
        else 0
      end
    )
    from public.teams t
    join public.subscriptions s on s.user_id = t.user_id
    where t.id = tid
  ), 0);
$$;

revoke all on function public.team_seat_limit(uuid) from public, anon;
grant execute on function public.team_seat_limit(uuid) to authenticated;
