-- Fix: creating a team failed with "new row violates row-level security policy".
--
-- The SELECT policy was `can_access_team(id)`, which looks the team up *in
-- teams*. That is fine for an ordinary read, but the app creates a team with
-- INSERT ... RETURNING (supabase-js .insert().select()), and the returning
-- clause evaluates the SELECT policy against the new row inside the same
-- statement. can_access_team is STABLE, so its lookup runs on the statement's
-- snapshot — which does not contain the row being inserted. The lookup found
-- nothing, the policy said no, and the whole insert was rejected.
--
-- The owner test has to read the row in front of it rather than go looking for
-- it. Membership still needs a lookup, but that hits team_members, a different
-- table, so it is unaffected.
--
-- Every other table keeps can_access_team(team_id): they look up teams while
-- inserting into something else, so the team row already exists.

drop policy if exists "View teams you own or assist" on public.teams;

create policy "View teams you own or assist"
  on public.teams for select
  using (
    user_id = auth.uid()
    or public.is_active_team_member(id, auth.uid())
  );

-- Diagnostics from tracking the above down; not part of the feature.
drop function if exists public.debug_policies(text);
drop function if exists public.debug_whoami();
