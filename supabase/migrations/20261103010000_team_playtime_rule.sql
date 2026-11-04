-- Minimum playing time a team plans for. 'half' (default) is the AYSO
-- national minimum: half the game. 'three' asks for three quarters, but only
-- as far as the roster allows. Regions differ, so the coach picks.
alter table public.teams
  add column if not exists playtime_rule text not null default 'half'
  check (playtime_rule in ('half', 'three'));
