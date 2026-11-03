-- Earlier versions of each game plan, so nothing two coaches do to the same
-- plan is ever unrecoverable. The app merges each coach's edits spot by spot
-- (src/lib/planMerge.js), but a merge can still keep the "wrong" choice for a
-- spot both coaches changed — this is the way back.
--
-- A version is the row's content *before* an update. Saving on every sub would
-- flood the table, so a new version is only kept when:
--   • the plan has no version yet, or
--   • a different coach is now writing than the one who wrote the last
--     version (the moment worth keeping), or
--   • the last version is more than 5 minutes older than the content being
--     replaced.
-- The newest 40 versions per plan are kept.

create table if not exists public.saved_game_plan_versions (
  id             bigint generated always as identity primary key,
  plan_id        uuid not null references public.saved_game_plans(id) on delete cascade,
  team_id        uuid not null references public.teams(id) on delete cascade,
  quarter_data   jsonb,
  absent_players jsonb,
  formation_id   text,
  saved_at       timestamptz not null,           -- when this content was written
  replaced_by    uuid,                           -- who overwrote it
  created_at     timestamptz not null default now()
);

create index if not exists saved_game_plan_versions_plan_idx
  on public.saved_game_plan_versions (plan_id, saved_at desc);

alter table public.saved_game_plan_versions enable row level security;

drop policy if exists "Read game plan versions" on public.saved_game_plan_versions;
create policy "Read game plan versions" on public.saved_game_plan_versions
  for select using (public.can_access_team(team_id));

-- Clients only read versions. Rows are written by the trigger below.
revoke insert, update, delete on public.saved_game_plan_versions from anon, authenticated;
grant select on public.saved_game_plan_versions to authenticated;

create or replace function public.keep_game_plan_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  last_v public.saved_game_plan_versions%rowtype;
begin
  if new.quarter_data is not distinct from old.quarter_data
     and new.absent_players is not distinct from old.absent_players
     and new.formation_id is not distinct from old.formation_id then
    return new;
  end if;

  select * into last_v
    from public.saved_game_plan_versions
   where plan_id = old.id
   order by saved_at desc, id desc
   limit 1;

  if last_v.id is null
     or last_v.replaced_by is distinct from auth.uid()
     or last_v.saved_at < coalesce(old.updated_at, now()) - interval '5 minutes' then
    insert into public.saved_game_plan_versions
      (plan_id, team_id, quarter_data, absent_players, formation_id, saved_at, replaced_by)
    values
      (old.id, old.team_id, old.quarter_data, old.absent_players, old.formation_id,
       coalesce(old.updated_at, old.created_at, now()), auth.uid());

    delete from public.saved_game_plan_versions
     where plan_id = old.id
       and id not in (
         select id from public.saved_game_plan_versions
          where plan_id = old.id
          order by saved_at desc, id desc
          limit 40);
  end if;

  return new;
end;
$$;

revoke all on function public.keep_game_plan_version() from public;

drop trigger if exists keep_game_plan_version on public.saved_game_plans;
create trigger keep_game_plan_version
  before update on public.saved_game_plans
  for each row execute function public.keep_game_plan_version();
