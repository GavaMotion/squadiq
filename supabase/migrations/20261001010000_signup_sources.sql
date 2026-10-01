-- Where each coach came from: campaign tags and referring site, captured on
-- arrival and written once at signup (src/lib/attribution.js). Until now a
-- marketing test could only be read as a weekly trial total, so a $30 boost
-- and a Sheffield club passing the app around looked identical.
--
-- A user may insert their own row once and do nothing else: no read-back, no
-- update, no delete. The admin dashboard and the HQ sync read it as service_role.
-- Nothing here is trusted for anything but marketing counts, so a coach writing
-- junk into their own row costs nothing but a miscounted trial.

create table if not exists public.signup_sources (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  source     text check (char_length(source)   <= 200),
  medium     text check (char_length(medium)   <= 200),
  campaign   text check (char_length(campaign) <= 200),
  content    text check (char_length(content)  <= 200),
  referrer   text check (char_length(referrer) <= 200),
  landing    text check (char_length(landing)  <= 200),
  first_seen timestamptz,
  created_at timestamptz not null default now()
);

alter table public.signup_sources enable row level security;

drop policy if exists "insert own signup source" on public.signup_sources;
create policy "insert own signup source" on public.signup_sources
  for insert to authenticated
  with check (user_id = auth.uid());

revoke all on public.signup_sources from anon;
revoke select, update, delete, truncate on public.signup_sources from authenticated;
grant insert on public.signup_sources to authenticated;

notify pgrst, 'reload schema';
