-- Keep Person provisioning integrity checks inside the privileged
-- provisioning context when Supabase Auth creates a new account.
--
-- The Person identity foundation uses several DEFERRABLE INITIALLY
-- DEFERRED constraint triggers. If provisioning returns before they fire,
-- they execute later at transaction commit under supabase_auth_admin,
-- which intentionally has no direct editorial table privileges.
--
-- Force only the Person-path integrity constraints to run before this
-- postgres-owned SECURITY DEFINER function returns, then restore their
-- normal deferred timing for the surrounding transaction.

create or replace function
  editorial.provision_person_for_user_profile_insert()
returns trigger
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_username text;
  v_email text;
  v_display_name text;
begin
  select
    profile.username_normalized,
    profile.email,
    profile.display_name
  into
    v_username,
    v_email,
    v_display_name
  from public.user_profiles profile
  where profile.user_id = new.user_id;

  if not found then
    return null;
  end if;

  if v_username is null then
    v_username :=
      public.community_generate_username(
        new.user_id,
        v_email,
        v_display_name
      );

    update public.user_profiles profile
    set
      username = v_username,
      username_normalized = v_username,
      username_updated_at =
        coalesce(
          profile.username_updated_at,
          now()
        ),
      updated_at = now()
    where profile.user_id = new.user_id;
  end if;

  perform editorial.ensure_person_for_user(
    new.user_id
  );

  perform editorial.sync_account_person_handle(
    new.user_id
  );

  set constraints
    editorial.resources_article_version_pointer_integrity,
    editorial.resources_binding_integrity,
    editorial.people_binding_integrity,
    editorial.people_identity_integrity,
    editorial.people_merge_cycle_integrity,
    editorial.person_identity_links_preferred_integrity
  immediate;

  set constraints
    editorial.resources_article_version_pointer_integrity,
    editorial.resources_binding_integrity,
    editorial.people_binding_integrity,
    editorial.people_identity_integrity,
    editorial.people_merge_cycle_integrity,
    editorial.person_identity_links_preferred_integrity
  deferred;

  return null;
end;
$function$;

do $auth_signup_person_deferred_integrity_repair$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'editorial.provision_person_for_user_profile_insert()'::regprocedure
  )
  into v_definition;

  if position(
       'editorial.resources_binding_integrity'
       in v_definition
     ) = 0
     or position(
          'editorial.people_identity_integrity'
          in v_definition
        ) = 0
     or position(
          'set constraints'
          in lower(v_definition)
        ) = 0
     or position(
          'immediate'
          in lower(v_definition)
        ) = 0
     or position(
          'deferred'
          in lower(v_definition)
        ) = 0
  then
    raise exception
      'Provisioning function does not flush Person integrity constraints';
  end if;

  if has_table_privilege(
       'supabase_auth_admin',
       'editorial.resources',
       'SELECT'
     )
     or has_table_privilege(
          'supabase_auth_admin',
          'editorial.people',
          'SELECT'
        )
     or has_table_privilege(
          'supabase_auth_admin',
          'editorial.person_identity_links',
          'SELECT'
        )
  then
    raise exception
      'Auth service unexpectedly gained direct Person editorial table access';
  end if;
end;
$auth_signup_person_deferred_integrity_repair$;
