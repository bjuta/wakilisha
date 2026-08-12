-- Durable verification for account username ↔ Person route convergence.

do $verify_people_account_handle_route_convergence$
declare
  v_profile_count integer;
  v_account_link_count integer;
  v_mismatch_count integer;
  v_conflict_count integer;
  v_historical_alias_count integer;
  v_phase4b_person_id uuid;
  v_phase4b_canonical_path text;
  v_phase4b_old_alias record;
  v_old_route_result jsonb;
  v_definition text;
begin
  if to_regprocedure('editorial.sync_account_person_handle(uuid)') is null
     or to_regprocedure('editorial.sync_person_handle_from_user_profile()') is null
  then
    raise exception
      'VERIFY FAIL: Account ↔ Person handle synchronization functions are missing';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger
    where trigger.tgrelid = 'public.user_profiles'::regclass
      and trigger.tgname = 'user_profiles_person_handle_sync'
      and not trigger.tgisinternal
  )
  then
    raise exception
      'VERIFY FAIL: user_profiles_person_handle_sync trigger is missing';
  end if;

  select count(*)
  into v_profile_count
  from public.user_profiles;

  select count(*)
  into v_account_link_count
  from editorial.person_identity_links
  where link_state = 'active'
    and user_id is not null;

  select count(*)
  into v_mismatch_count
  from public.user_profiles profile
  join editorial.person_identity_links link
    on link.user_id = profile.user_id
   and link.link_state = 'active'
  left join editorial.resource_aliases alias
    on alias.resource_id = link.person_resource_id
   and alias.is_canonical
   and alias.retired_at is null
  where profile.username_normalized is null
     or not public.community_username_is_valid(
       profile.username_normalized
     )
     or alias.path is distinct from
        '/people/' || profile.username_normalized;

  select count(*)
  into v_conflict_count
  from public.user_profiles profile
  join editorial.person_identity_links link
    on link.user_id = profile.user_id
   and link.link_state = 'active'
  join editorial.resource_aliases alias
    on alias.path =
       '/people/' || profile.username_normalized
   and alias.resource_id <> link.person_resource_id;

  if v_profile_count < 11
     or v_account_link_count <> v_profile_count
     or v_mismatch_count <> 0
     or v_conflict_count <> 0
  then
    raise exception
      'VERIFY FAIL: profiles %, links %, mismatches %, conflicts %',
      v_profile_count,
      v_account_link_count,
      v_mismatch_count,
      v_conflict_count;
  end if;

  if exists (
    select 1
    from public.user_profiles profile
    join editorial.person_identity_links link
      on link.user_id = profile.user_id
     and link.link_state = 'active'
    where profile.status = 'active'
      and profile.is_public
      and (
        public.get_public_person(
          profile.username_normalized
        ) ->> 'person_id'
          is distinct from link.person_resource_id::text
        or public.get_public_person(
          profile.username_normalized
        ) ->> 'canonical_path'
          is distinct from
          '/people/' || profile.username_normalized
        or public.get_public_person(
          profile.username_normalized
        ) ->> 'username'
          is distinct from profile.username_normalized
      )
  )
  then
    raise exception
      'VERIFY FAIL: A public /people/:username route disagrees with its linked account Person';
  end if;

  select count(*)
  into v_historical_alias_count
  from public.user_profiles profile
  join editorial.person_identity_links link
    on link.user_id = profile.user_id
   and link.link_state = 'active'
  join editorial.resource_aliases alias
    on alias.resource_id = link.person_resource_id
   and not alias.is_canonical
   and alias.retired_at is not null;

  if v_historical_alias_count < 1 then
    raise exception
      'VERIFY FAIL: Expected at least one retired historical account Person alias after reviewed backfill';
  end if;

  select
    link.person_resource_id,
    canonical.path
  into
    v_phase4b_person_id,
    v_phase4b_canonical_path
  from public.user_profiles profile
  join editorial.person_identity_links link
    on link.user_id = profile.user_id
   and link.link_state = 'active'
  join editorial.resource_aliases canonical
    on canonical.resource_id = link.person_resource_id
   and canonical.is_canonical
   and canonical.retired_at is null
  where profile.display_name =
        'phase4b-m1-acceptance-35d52b5b5a47';

  if not found then
    raise exception
      'VERIFY FAIL: Reviewed phase4b acceptance account Person is missing';
  end if;

  if v_phase4b_canonical_path <>
     '/people/phase4b_m1_acceptance_35'
  then
    raise exception
      'VERIFY FAIL: Reviewed phase4b account canonical path is %, expected /people/phase4b_m1_acceptance_35',
      v_phase4b_canonical_path;
  end if;

  select
    alias.id,
    alias.resource_id,
    alias.retired_at,
    alias.replacement_alias_id
  into v_phase4b_old_alias
  from editorial.resource_aliases alias
  where alias.path =
        '/people/phase4b-m1-acceptance-35d52b5b5a47';

  if not found
     or v_phase4b_old_alias.resource_id <>
        v_phase4b_person_id
     or v_phase4b_old_alias.retired_at is null
     or v_phase4b_old_alias.replacement_alias_id is null
  then
    raise exception
      'VERIFY FAIL: Reviewed historical phase4b Person route was not retained as a retired alias';
  end if;

  v_old_route_result :=
    public.get_public_person(
      '/people/phase4b-m1-acceptance-35d52b5b5a47'
    );

  if v_old_route_result ->> 'person_id'
       is distinct from v_phase4b_person_id::text
     or v_old_route_result ->> 'redirect_to'
       is distinct from v_phase4b_canonical_path
  then
    raise exception
      'VERIFY FAIL: Historical phase4b Person route does not resolve to the same Person and redirect to canonical';
  end if;

  v_definition := pg_get_functiondef(
    'public.community_generate_username(uuid,text,text)'::regprocedure
  );

  if position('editorial.resource_aliases' in v_definition) = 0
     or position('resolve_person_follow_target' in v_definition) = 0
  then
    raise exception
      'VERIFY FAIL: Username generation does not reserve Person route ownership';
  end if;

  v_definition := pg_get_functiondef(
    'public.community_username_available(text)'::regprocedure
  );

  if position('person_path_reserved' in v_definition) = 0
     or position('editorial.resource_aliases' in v_definition) = 0
  then
    raise exception
      'VERIFY FAIL: Username availability does not enforce Person route ownership';
  end if;

  v_definition := pg_get_functiondef(
    'public.get_public_person(text)'::regprocedure
  );

  if position('v_path' in v_definition) = 0
     or position('is distinct from v_canonical_path' in v_definition) = 0
  then
    raise exception
      'VERIFY FAIL: Public Person read does not redirect historical aliases to canonical';
  end if;

  if has_function_privilege(
       'anon',
       'editorial.sync_account_person_handle(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'editorial.sync_account_person_handle(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'editorial.sync_person_handle_from_user_profile()',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'editorial.sync_person_handle_from_user_profile()',
       'EXECUTE'
     )
  then
    raise exception
      'VERIFY FAIL: Browser role can execute internal Person handle synchronization authority';
  end if;

  if has_table_privilege(
       'anon',
       'editorial.resource_aliases',
       'INSERT'
     )
     or has_table_privilege(
       'anon',
       'editorial.resource_aliases',
       'UPDATE'
     )
     or has_table_privilege(
       'anon',
       'editorial.resource_aliases',
       'DELETE'
     )
     or has_table_privilege(
       'authenticated',
       'editorial.resource_aliases',
       'INSERT'
     )
     or has_table_privilege(
       'authenticated',
       'editorial.resource_aliases',
       'UPDATE'
     )
     or has_table_privilege(
       'authenticated',
       'editorial.resource_aliases',
       'DELETE'
     )
  then
    raise exception
      'VERIFY FAIL: Browser role gained direct Resource alias write access';
  end if;
end;
$verify_people_account_handle_route_convergence$;

select jsonb_build_object(
  'verification', 'PASS',
  'account_profiles',
    (select count(*) from public.user_profiles),
  'active_account_person_links',
    (
      select count(*)
      from editorial.person_identity_links
      where link_state = 'active'
        and user_id is not null
    ),
  'aligned_account_person_routes',
    (
      select count(*)
      from public.user_profiles profile
      join editorial.person_identity_links link
        on link.user_id = profile.user_id
       and link.link_state = 'active'
      join editorial.resource_aliases alias
        on alias.resource_id = link.person_resource_id
       and alias.is_canonical
       and alias.retired_at is null
      where alias.path =
            '/people/' || profile.username_normalized
    ),
  'historical_account_person_aliases',
    (
      select count(*)
      from public.user_profiles profile
      join editorial.person_identity_links link
        on link.user_id = profile.user_id
       and link.link_state = 'active'
      join editorial.resource_aliases alias
        on alias.resource_id = link.person_resource_id
       and not alias.is_canonical
       and alias.retired_at is not null
    )
) as people_account_handle_route_convergence;
