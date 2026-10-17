-- Game-day reminders: the second visit.
--
-- Of the coaches who signed up since September, one came back after day one.
-- Nothing in the app ever brought anyone back: no email, no push, and no idea
-- when the next game is. So each team gets a weekly game slot, and an hourly
-- job (supabase/functions/game-reminders) emails and pushes the evening before
-- and pushes again two hours before kickoff.
--
-- Idempotent so it is safe to re-apply.

-- One weekly game slot per team. Only the team's owner may set it; assistants
-- coach the game but the reminders go to the person who runs the team.
create table if not exists public.game_reminders (
  team_id       uuid primary key references public.teams(id) on delete cascade,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  weekday       smallint not null check (weekday between 0 and 6),   -- 0 = Sunday
  kickoff       time not null,
  tz            text not null check (char_length(tz) <= 64),
  email_on      boolean not null default true,
  push_on       boolean not null default false,
  last_eve_sent date,   -- local date of the evening-before reminder
  last_pre_sent date,   -- local date of the two-hours-before push
  updated_at    timestamptz not null default now()
);

alter table public.game_reminders enable row level security;

drop policy if exists "owner manages game reminder" on public.game_reminders;
create policy "owner manages game reminder" on public.game_reminders
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.teams t where t.id = team_id and t.user_id = auth.uid())
  );

revoke all on public.game_reminders from anon;
grant select, insert, update, delete on public.game_reminders to authenticated;

-- Web Push subscriptions (browser, home-screen PWA, and the Android app, which
-- delegates the site's notifications to the app). One row per device.
create table if not exists public.push_subscriptions (
  endpoint   text primary key check (char_length(endpoint) <= 1000),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  p256dh     text not null check (char_length(p256dh) <= 200),
  auth       text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "own push subscriptions" on public.push_subscriptions;
create policy "own push subscriptions" on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on public.push_subscriptions from anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- One-off lifecycle emails already sent (e.g. "trial ends in 3 days"), so the
-- hourly job never sends the same one twice. Service role only.
create table if not exists public.email_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind    text not null check (char_length(kind) <= 40),
  sent_at timestamptz not null default now(),
  primary key (user_id, kind)
);

alter table public.email_log enable row level security;
revoke all on public.email_log from anon, authenticated;

-- Coaches who turned email off from an unsubscribe link. Service role only.
create table if not exists public.email_optouts (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.email_optouts enable row level security;
revoke all on public.email_optouts from anon, authenticated;

-- Hourly trigger. The function takes no input and only sends what is due and
-- not yet recorded as sent, so an extra call is a no-op — which is why it can
-- run without a key in this file.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('game-reminders')
where exists (select 1 from cron.job where jobname = 'game-reminders');

select cron.schedule(
  'game-reminders',
  '0 * * * *',
  $$select net.http_post(
      url     := 'https://slrcstzhlnfcighvstmf.supabase.co/functions/v1/game-reminders',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body    := '{}'::jsonb
    )$$
);

notify pgrst, 'reload schema';
