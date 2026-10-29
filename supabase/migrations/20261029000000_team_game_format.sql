-- Players-per-side override. Null means the team plays its division's
-- standard format (8U 4v4, 10U 7v7, 12U 9v9, 14U+ 11v11); some leagues
-- run 12U as 11v11 or 10U as 9v9, so coaches can pick it per team.
alter table public.teams
  add column if not exists format text
  check (format is null or format in ('4v4', '7v7', '9v9', '11v11'));
