-- Restore the minimum privilege required for Supabase Auth to execute
-- WAKILISHA's deferred Person provisioning trigger at transaction commit.
--
-- The trigger function remains SECURITY DEFINER, owned by postgres.
-- The Auth service receives only schema name resolution plus EXECUTE on
-- this trigger function. No table privileges are granted.

grant usage
on schema editorial
to supabase_auth_admin;

grant execute
on function editorial.provision_person_for_user_profile_insert()
to supabase_auth_admin;

do $auth_signup_deferred_person_provisioning_repair$
begin
  if not has_schema_privilege(
       'supabase_auth_admin',
       'editorial',
       'USAGE'
     )
  then
    raise exception
      'supabase_auth_admin still lacks USAGE on editorial';
  end if;

  if not has_function_privilege(
       'supabase_auth_admin',
       'editorial.provision_person_for_user_profile_insert()',
       'EXECUTE'
     )
  then
    raise exception
      'supabase_auth_admin still lacks deferred provisioning EXECUTE';
  end if;

  if has_function_privilege(
       'anon',
       'editorial.provision_person_for_user_profile_insert()',
       'EXECUTE'
     )
     or has_function_privilege(
          'authenticated',
          'editorial.provision_person_for_user_profile_insert()',
          'EXECUTE'
        )
  then
    raise exception
      'Public application roles unexpectedly gained provisioning EXECUTE';
  end if;
end;
$auth_signup_deferred_person_provisioning_repair$;
