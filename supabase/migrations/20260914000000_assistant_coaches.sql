-- ─────────────────────────────────────────────────────────────
-- Assistant coaches — sharing a team with a second (or third) coach
--
-- Access to a team was "teams.user_id = auth.uid()", asked separately by every
-- child table's policies. This adds membership as a second way in and funnels
-- every policy through one function, can_access_team(), so the rule lives in
-- one place.
--
-- Seats ride on the OWNER's plan, computed live rather than stored:
--   any active plan → 1 assistant,  premium → 3,  lapsed/expired → 0.
-- So a lapsed subscription suspends assistants and re-subscribing restores
-- them, with nothing deleted and no background job.
-- ─────────────────────────────────────────────────────────────

-- ── Invite codes ──────────────────────────────────────────────
create table if not exists public.team_invites (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  code       text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  revoked_at timestamptz
);

create index if not exists team_invites_team_idx on public.team_invites (team_id);
create index if not exists team_invites_code_idx on public.team_invites (code);

-- ── Membership ────────────────────────────────────────────────
create table if not exists public.team_members (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'assistant',
  -- Which code they came in on, so rotating a leaked code can remove exactly
  -- the people who used it.
  invite_id  uuid references public.team_invites(id) on delete set null,
  -- Lowest rank holds a seat first. Lets the owner choose who stays active
  -- when the seat count drops.
  seat_rank  integer not null default 0,
  user_email text,
  joined_at  timestamptz not null default now(),
  unique (team_id, user_id)
);

create index if not exists team_members_team_idx on public.team_members (team_id);
create index if not exists team_members_user_idx on public.team_members (user_id);

-- ── How many assistants this team's owner is entitled to ──────
create or replace function public.team_seat_limit(tid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case
      when s.plan_override = 'unlimited'                   then 99
      when s.plan = 'expired'                              then 0
      when s.plan = 'premium'                              then 3
      when s.plan = 'solo'                                 then 1
      -- A lapsed trial keeps plan = 'trial', so check the date, not the label.
      when s.plan = 'trial' and s.trial_end > now()        then 1
      else 0
    end
    from public.teams t
    join public.subscriptions s on s.user_id = t.user_id
    where t.id = tid
    limit 1
  ), 0);
$$;

-- ── Is this user currently holding one of those seats? ────────
-- Over-limit members stay in the table but stop counting as active, which is
-- what makes a downgrade suspend rather than delete.
create or replace function public.is_active_team_member(tid uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from (
      select m.user_id,
             row_number() over (order by m.seat_rank, m.joined_at, m.id) as rn
      from public.team_members m
      where m.team_id = tid
    ) ranked
    where ranked.user_id = uid
      and ranked.rn <= public.team_seat_limit(tid)
  );
$$;

-- ── The one access rule every policy asks ─────────────────────
-- SECURITY DEFINER matters: the membership lookup must not be filtered by the
-- very policies that call this, which would recurse.
create or replace function public.can_access_team(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
      select 1 from public.teams t
      where t.id = tid and t.user_id = auth.uid()
    )
    or public.is_active_team_member(tid, auth.uid());
$$;

create or replace function public.owns_team(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.teams t where t.id = tid and t.user_id = auth.uid()
  );
$$;

-- ── Re-point every team-scoped policy at can_access_team() ────
-- Drop by lookup rather than by name: these policies were created by hand over
-- time and the names in supabase_schema.sql are already out of date.
do $$
declare r record;
begin
  for r in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'teams', 'players', 'saved_game_plans', 'practice_plans',
        'practice_plan_drills', 'standings', 'standings_sources',
        'strategy_sketches', 'lineups', 'drill_links'
      )
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Policies do nothing on a table whose RLS was never switched on, so be
-- explicit rather than assume. These are no-ops where it is already enabled.
alter table public.teams                enable row level security;
alter table public.players              enable row level security;
alter table public.saved_game_plans     enable row level security;
alter table public.practice_plans       enable row level security;
alter table public.practice_plan_drills enable row level security;
alter table public.standings            enable row level security;
alter table public.standings_sources    enable row level security;
alter table public.strategy_sketches    enable row level security;
alter table public.lineups              enable row level security;
alter table public.drill_links          enable row level security;

-- Teams: an assistant can see the team but not rename, rebrand or delete it.
create policy "View teams you own or assist"
  on public.teams for select using (public.can_access_team(id));
create policy "Owner inserts teams"
  on public.teams for insert with check (auth.uid() = user_id);
create policy "Owner updates teams"
  on public.teams for update using (auth.uid() = user_id);
create policy "Owner deletes teams"
  on public.teams for delete using (auth.uid() = user_id);

-- Everything a coach actually works with, for owner and assistant alike.
create policy "Access players"          on public.players            for all using (public.can_access_team(team_id)) with check (public.can_access_team(team_id));
create policy "Access game plans"       on public.saved_game_plans   for all using (public.can_access_team(team_id)) with check (public.can_access_team(team_id));
create policy "Access practice plans"   on public.practice_plans     for all using (public.can_access_team(team_id)) with check (public.can_access_team(team_id));
create policy "Access standings"        on public.standings          for all using (public.can_access_team(team_id)) with check (public.can_access_team(team_id));
create policy "Access standings srcs"   on public.standings_sources  for all using (public.can_access_team(team_id)) with check (public.can_access_team(team_id));
create policy "Access sketches"         on public.strategy_sketches  for all using (public.can_access_team(team_id)) with check (public.can_access_team(team_id));
create policy "Access lineups"          on public.lineups            for all using (public.can_access_team(team_id)) with check (public.can_access_team(team_id));
create policy "Access drill links"      on public.drill_links        for all using (public.can_access_team(team_id)) with check (public.can_access_team(team_id));

-- Practice drills hang off a plan, not a team.
create policy "Access practice drills"
  on public.practice_plan_drills for all
  using (exists (
    select 1 from public.practice_plans p
    where p.id = practice_plan_drills.plan_id and public.can_access_team(p.team_id)
  ))
  with check (exists (
    select 1 from public.practice_plans p
    where p.id = practice_plan_drills.plan_id and public.can_access_team(p.team_id)
  ));

-- ── Membership + invite policies ──────────────────────────────
alter table public.team_members enable row level security;
alter table public.team_invites enable row level security;

-- An owner sees their assistants; an assistant sees only their own row.
create policy "View team members"
  on public.team_members for select
  using (public.owns_team(team_id) or user_id = auth.uid());

-- Joining goes through accept_team_invite(); there is no direct insert.
create policy "Owner removes members"
  on public.team_members for delete
  using (public.owns_team(team_id) or user_id = auth.uid());

create policy "Owner reorders seats"
  on public.team_members for update
  using (public.owns_team(team_id))
  with check (public.owns_team(team_id));

-- Only the owner ever sees or manages the code — assistants cannot invite.
create policy "Owner manages invites"
  on public.team_invites for all
  using (public.owns_team(team_id))
  with check (public.owns_team(team_id));

-- ── Code generation ───────────────────────────────────────────
-- No O/0/I/1 — these get read off a screen and typed by hand.
create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  i integer;
begin
  loop
    candidate := '';
    for i in 1..8 loop
      candidate := candidate || substr(alphabet, floor(random() * length(alphabet))::int + 1, 1);
    end loop;
    exit when not exists (select 1 from public.team_invites where code = candidate);
  end loop;
  return candidate;
end $$;

-- ── Create or rotate a team's invite code ─────────────────────
-- kick_existing = true is the "this code got out" button: the old code stops
-- working AND everyone who joined on it loses access.
create or replace function public.rotate_team_invite(tid uuid, kick_existing boolean default false)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_id   uuid;
  v_removed integer := 0;
begin
  if not public.owns_team(tid) then
    return json_build_object('ok', false, 'error', 'not_owner');
  end if;

  if kick_existing then
    delete from public.team_members m
    where m.team_id = tid
      and m.invite_id in (select i.id from public.team_invites i where i.team_id = tid);
    get diagnostics v_removed = row_count;
  end if;

  update public.team_invites
     set revoked_at = now()
   where team_id = tid and revoked_at is null;

  v_code := public.generate_invite_code();
  insert into public.team_invites (team_id, code, created_by)
  values (tid, v_code, auth.uid())
  returning id into v_id;

  return json_build_object('ok', true, 'code', v_code, 'invite_id', v_id, 'removed', v_removed);
end $$;

-- ── What a code points at, before you commit to joining ───────
create or replace function public.peek_team_invite(invite_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv  public.team_invites;
  v_team public.teams;
  v_used integer;
begin
  select * into v_inv from public.team_invites
   where code = upper(btrim(invite_code)) limit 1;
  if not found then return json_build_object('ok', false, 'error', 'invalid'); end if;
  if v_inv.revoked_at is not null then return json_build_object('ok', false, 'error', 'revoked'); end if;
  if v_inv.expires_at < now() then return json_build_object('ok', false, 'error', 'expired'); end if;

  select * into v_team from public.teams where id = v_inv.team_id;
  select count(*) into v_used from public.team_members where team_id = v_inv.team_id;

  return json_build_object(
    'ok', true,
    'team_id', v_team.id,
    'team_name', v_team.name,
    'division', v_team.division,
    'seats_used', v_used,
    'seat_limit', public.team_seat_limit(v_inv.team_id)
  );
end $$;

-- ── Join a team with a code ───────────────────────────────────
create or replace function public.accept_team_invite(invite_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv   public.team_invites;
  v_team  public.teams;
  v_uid   uuid := auth.uid();
  v_email text := coalesce(auth.jwt() ->> 'email', '');
  v_used  integer;
  v_limit integer;
begin
  if v_uid is null then return json_build_object('ok', false, 'error', 'not_signed_in'); end if;

  select * into v_inv from public.team_invites
   where code = upper(btrim(invite_code)) limit 1;
  if not found then return json_build_object('ok', false, 'error', 'invalid'); end if;
  if v_inv.revoked_at is not null then return json_build_object('ok', false, 'error', 'revoked'); end if;
  if v_inv.expires_at < now() then return json_build_object('ok', false, 'error', 'expired'); end if;

  select * into v_team from public.teams where id = v_inv.team_id;
  if v_team.user_id = v_uid then
    return json_build_object('ok', false, 'error', 'own_team');
  end if;

  if exists (select 1 from public.team_members where team_id = v_inv.team_id and user_id = v_uid) then
    return json_build_object('ok', true, 'already', true, 'team_id', v_team.id, 'team_name', v_team.name);
  end if;

  -- The seat check lives here, server side, so a forwarded code still cannot
  -- put more people on the team than the owner's plan allows.
  v_limit := public.team_seat_limit(v_inv.team_id);
  select count(*) into v_used from public.team_members where team_id = v_inv.team_id;
  if v_used >= v_limit then
    return json_build_object('ok', false, 'error', 'full', 'seat_limit', v_limit);
  end if;

  insert into public.team_members (team_id, user_id, invite_id, user_email, seat_rank)
  values (
    v_inv.team_id, v_uid, v_inv.id, v_email,
    coalesce((select max(seat_rank) from public.team_members where team_id = v_inv.team_id), 0) + 1
  );

  return json_build_object('ok', true, 'team_id', v_team.id, 'team_name', v_team.name);
end $$;

-- ── Promote a dormant assistant into an active seat ───────────
create or replace function public.promote_team_member(member_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.team_members;
  v_min    integer;
begin
  select * into v_member from public.team_members where id = member_id;
  if not found then return json_build_object('ok', false, 'error', 'not_found'); end if;
  if not public.owns_team(v_member.team_id) then
    return json_build_object('ok', false, 'error', 'not_owner');
  end if;

  select min(seat_rank) into v_min from public.team_members where team_id = v_member.team_id;
  update public.team_members set seat_rank = coalesce(v_min, 0) - 1 where id = member_id;

  return json_build_object('ok', true);
end $$;

grant execute on function public.accept_team_invite(text)          to authenticated;
grant execute on function public.peek_team_invite(text)            to authenticated;
grant execute on function public.rotate_team_invite(uuid, boolean) to authenticated;
grant execute on function public.promote_team_member(uuid)         to authenticated;
grant execute on function public.team_seat_limit(uuid)             to authenticated;
grant execute on function public.can_access_team(uuid)             to authenticated;
grant execute on function public.owns_team(uuid)                   to authenticated;
