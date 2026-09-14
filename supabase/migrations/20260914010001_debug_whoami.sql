-- Temporary diagnostic: what the database sees for the caller, evaluated as
-- the caller (security invoker) exactly like a policy expression is.
create or replace function public.debug_whoami()
returns json
language sql
stable
as $$
  select json_build_object(
    'auth_uid',     auth.uid(),
    'current_user', current_user,
    'session_user', session_user,
    'role_claim',   current_setting('request.jwt.claims', true)::jsonb ->> 'role'
  );
$$;
grant execute on function public.debug_whoami() to authenticated, service_role;
