-- Phase 0A: remove anonymous and ordinary authenticated access to
-- privileged user-access administration RPCs while preserving service-role use.

revoke execute on function public.assign_user_role_admin(uuid, text, text, text, text)
  from public, anon, authenticated;
revoke execute on function public.record_admin_audit(text, text, text, uuid, text, jsonb)
  from public, anon, authenticated;
revoke execute on function public.record_password_reset_admin(uuid, text, text, text, text)
  from public, anon, authenticated;
revoke execute on function public.revoke_user_role_admin(uuid, text)
  from public, anon, authenticated;
revoke execute on function public.revoke_user_scope_admin(uuid)
  from public, anon, authenticated;
revoke execute on function public.suspend_user_access_admin(uuid, text)
  from public, anon, authenticated;
revoke execute on function public.upsert_user_scope_admin(uuid, text, text, text, boolean, boolean, boolean)
  from public, anon, authenticated;

grant execute on function public.assign_user_role_admin(uuid, text, text, text, text)
  to service_role;
grant execute on function public.record_admin_audit(text, text, text, uuid, text, jsonb)
  to service_role;
grant execute on function public.record_password_reset_admin(uuid, text, text, text, text)
  to service_role;
grant execute on function public.revoke_user_role_admin(uuid, text)
  to service_role;
grant execute on function public.revoke_user_scope_admin(uuid)
  to service_role;
grant execute on function public.suspend_user_access_admin(uuid, text)
  to service_role;
grant execute on function public.upsert_user_scope_admin(uuid, text, text, text, boolean, boolean, boolean)
  to service_role;
