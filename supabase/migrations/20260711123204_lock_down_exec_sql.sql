-- Restrict the unrestricted SECURITY DEFINER SQL executor to service_role only.
-- Repository audit found no application, Edge Function, script, or migration caller.

revoke all on function public.exec_sql(text) from public;
revoke all on function public.exec_sql(text) from anon;
revoke all on function public.exec_sql(text) from authenticated;

grant execute on function public.exec_sql(text) to service_role;

comment on function public.exec_sql(text) is
  'Privileged SQL executor restricted to service_role. Never expose to anon or authenticated clients.';;
