-- Assistants join in one tap.
--
-- An assistant coach standing on a field cannot realistically create an
-- account: signups here require email confirmation, so joining meant leaving
-- the app for an inbox. They now sign in anonymously — a real, distinct,
-- removable user with no email — so the identity survives while the paperwork
-- goes away.
--
-- An anonymous user has no email to show the head coach, and "Assistant coach"
-- four times over would make the remove button unusable. So the join asks for
-- a name and stores it.

alter table public.team_members
  add column if not exists display_name text;

-- An anonymous assistant who reinstalls comes back as a different user and
-- takes a second seat, leaving a dead row behind holding the first. The head
-- coach then sees two rows with the same name and no way to tell which to
-- remove. Recording when each was last used makes that obvious.
alter table public.team_members
  add column if not exists last_seen_at timestamptz;

-- Replacing rather than overloading: a second definition with a defaulted
-- argument would leave two candidates and make one-argument calls ambiguous.
drop function if exists public.accept_team_invite(text);

create or replace function public.accept_team_invite(invite_code text, joiner_name text default null)
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
  v_name  text := nullif(btrim(coalesce(joiner_name, '')), '');
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

  -- Rejoining should update the name rather than fail.
  if exists (select 1 from public.team_members where team_id = v_inv.team_id and user_id = v_uid) then
    update public.team_members
       set display_name = coalesce(v_name, display_name),
           last_seen_at = now()
     where team_id = v_inv.team_id and user_id = v_uid;
    return json_build_object('ok', true, 'already', true, 'team_id', v_team.id, 'team_name', v_team.name);
  end if;

  -- The seat check lives here, server side, so a forwarded code still cannot
  -- put more people on the team than the owner's plan allows.
  v_limit := public.team_seat_limit(v_inv.team_id);
  select count(*) into v_used from public.team_members where team_id = v_inv.team_id;
  if v_used >= v_limit then
    return json_build_object('ok', false, 'error', 'full', 'seat_limit', v_limit);
  end if;

  insert into public.team_members (team_id, user_id, invite_id, user_email, display_name, last_seen_at, seat_rank)
  values (
    v_inv.team_id, v_uid, v_inv.id, v_email, v_name, now(),
    coalesce((select max(seat_rank) from public.team_members where team_id = v_inv.team_id), 0) + 1
  );

  return json_build_object('ok', true, 'team_id', v_team.id, 'team_name', v_team.name);
end $$;

-- Mark a membership as still in use. Its own function rather than an UPDATE
-- policy: letting members write their own row would also let a dormant one
-- rewrite seat_rank and promote itself into an active seat.
create or replace function public.touch_team_membership(tid uuid)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.team_members
     set last_seen_at = now()
   where team_id = tid and user_id = auth.uid();
$$;

revoke all on function public.touch_team_membership(uuid) from public, anon;
grant execute on function public.touch_team_membership(uuid) to authenticated;

-- ── Lock the functions down ───────────────────────────────────
-- CREATE FUNCTION grants EXECUTE to PUBLIC by default, so the previous
-- migration's grants to `authenticated` left every one of these callable by
-- anyone holding the publishable key — which ships in the client bundle.
-- Anything that writes, or that answers a question about someone else's
-- account, is closed to signed-out callers.
revoke all on function public.accept_team_invite(text, text)     from public, anon;
revoke all on function public.rotate_team_invite(uuid, boolean)  from public, anon;
revoke all on function public.promote_team_member(uuid)          from public, anon;
-- Leaked the owner's plan tier (0/1/3/99) to anyone holding a team id.
revoke all on function public.team_seat_limit(uuid)              from public, anon;
-- An unauthenticated loop over team_invites; only rotate_team_invite needs it,
-- and that is SECURITY DEFINER so it still runs.
revoke all on function public.generate_invite_code()             from public, anon, authenticated;

grant execute on function public.accept_team_invite(text, text)    to authenticated;
grant execute on function public.rotate_team_invite(uuid, boolean) to authenticated;
grant execute on function public.promote_team_member(uuid)         to authenticated;
grant execute on function public.team_seat_limit(uuid)             to authenticated;

-- can_access_team, owns_team and is_active_team_member stay executable by
-- `anon` deliberately. The SELECT policies call them, and a signed-out read is
-- evaluated as `anon` — revoking would turn a clean empty result into a
-- permission error on every signed-out request. They disclose nothing: with no
-- auth.uid() they simply return false.
grant execute on function public.can_access_team(uuid)             to anon, authenticated;
grant execute on function public.owns_team(uuid)                   to anon, authenticated;
grant execute on function public.is_active_team_member(uuid, uuid) to anon, authenticated;

-- peek_team_invite stays reachable while signed out, on purpose: someone who
-- scans the QR has to be told which team they are joining *before* they are
-- asked to become a user. It needs a valid code to say anything, and it
-- returns only the team name, division and seat counts — never the roster.
revoke all on function public.peek_team_invite(text) from public;
grant execute on function public.peek_team_invite(text) to anon, authenticated;
