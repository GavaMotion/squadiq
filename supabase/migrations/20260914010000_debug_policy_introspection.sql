-- Temporary diagnostic: report the policies on a table so a failing INSERT can
-- be explained rather than guessed at. Service-role only, and dropped again in
-- the next migration.
create or replace function public.debug_policies(tbl text)
returns table (
  policyname text,
  cmd        text,
  permissive text,
  roles      text,
  qual       text,
  with_check text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.policyname::text, p.cmd::text, p.permissive::text,
         array_to_string(p.roles, ',')::text, p.qual::text, p.with_check::text
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = tbl;
$$;

revoke all on function public.debug_policies(text) from public, anon, authenticated;
grant execute on function public.debug_policies(text) to service_role;
