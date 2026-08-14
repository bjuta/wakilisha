-- WAKILISHA M2 verifier: Artist claims and representation authority.

do $verify_artist_claims_representation_authority$
declare
  v_table text;
  v_rls boolean;
  v_function text;
  v_definition text;
  v_public_function_count integer;
begin
  foreach v_table in array array[
    'artist_claim_requests',
    'artist_claim_evidence',
    'artist_representations',
    'artist_representation_events'
  ]
  loop
    if to_regclass(
         'public.' || v_table
       ) is null
    then
      raise exception
        'FAIL: Missing M2 table %',
        v_table;
    end if;

    select class.relrowsecurity
    into v_rls
    from pg_class class
    where class.oid =
          to_regclass(
            'public.' || v_table
          );

    if not coalesce(
         v_rls,
         false
       )
    then
      raise exception
        'FAIL: RLS disabled on %',
        v_table;
    end if;

    if has_table_privilege(
         'anon',
         'public.' || v_table,
         'SELECT'
       )
       or has_table_privilege(
         'authenticated',
         'public.' || v_table,
         'SELECT'
       )
       or has_table_privilege(
         'authenticated',
         'public.' || v_table,
         'INSERT'
       )
       or has_table_privilege(
         'authenticated',
         'public.' || v_table,
         'UPDATE'
       )
       or has_table_privilege(
         'authenticated',
         'public.' || v_table,
         'DELETE'
       )
    then
      raise exception
        'FAIL: Direct public application table privilege leaked on %',
        v_table;
    end if;
  end loop;

  if not exists (
       select 1
       from public.role_definitions
       where role_key = 'artist_claimant'
     )
     or not exists (
       select 1
       from public.role_definitions
       where role_key = 'artist_manager'
     )
  then
    raise exception
      'FAIL: Existing Artist portal role vocabulary was lost';
  end if;

  if not exists (
       select 1
       from public.capability_definitions
       where capability_key = 'submit_artist_claim'
     )
     or not exists (
       select 1
       from public.capability_definitions
       where capability_key = 'manage_claimed_artist_profile'
     )
     or not exists (
       select 1
       from public.capability_definitions
       where capability_key = 'submit_artist_media'
     )
  then
    raise exception
      'FAIL: Existing Artist portal capability vocabulary was lost';
  end if;

  if to_regprocedure(
       'editorial.current_user_can_review_artist_claims()'
     ) is null
     or to_regprocedure(
       'editorial.artist_representation_defaults(text)'
     ) is null
     or to_regprocedure(
       'editorial.record_artist_representation_event(uuid,text,uuid,uuid,uuid,jsonb)'
     ) is null
     or to_regprocedure(
       'editorial.sync_artist_portal_roles(uuid)'
     ) is null
  then
    raise exception
      'FAIL: Private M2 authority functions are incomplete';
  end if;

  select count(*)::integer
  into v_public_function_count
  from pg_proc proc
  join pg_namespace namespace
    on namespace.oid =
       proc.pronamespace
  where namespace.nspname =
        'public'
    and proc.proname in (
      'community_submit_artist_claim',
      'community_withdraw_artist_claim',
      'community_get_artist_representation_state',
      'community_admin_get_artist_claims',
      'community_admin_decide_artist_claim',
      'community_artist_get_team',
      'community_artist_invite_representative',
      'community_artist_accept_representation',
      'community_artist_update_representative',
      'community_artist_revoke_representation',
      'community_admin_revoke_artist_representation'
    );

  if v_public_function_count <> 11 then
    raise exception
      'FAIL: Expected eleven M2 public RPCs, found %',
      v_public_function_count;
  end if;

  foreach v_function in array array[
    'community_submit_artist_claim',
    'community_withdraw_artist_claim',
    'community_get_artist_representation_state',
    'community_admin_get_artist_claims',
    'community_admin_decide_artist_claim',
    'community_artist_get_team',
    'community_artist_invite_representative',
    'community_artist_accept_representation',
    'community_artist_update_representative',
    'community_artist_revoke_representation',
    'community_admin_revoke_artist_representation'
  ]
  loop
    select pg_get_functiondef(
      proc.oid
    )
    into v_definition
    from pg_proc proc
    join pg_namespace namespace
      on namespace.oid =
         proc.pronamespace
    where namespace.nspname =
          'public'
      and proc.proname =
          v_function
    limit 1;

    if v_definition is null then
      raise exception
        'FAIL: Missing function definition for %',
        v_function;
    end if;

    if v_definition ~* '\m(insert[[:space:]]+into|update|delete[[:space:]]+from)[[:space:]]+(public\.)?registry_artists\M'
    then
      raise exception
        'FAIL: % attempts to write canonical registry_artists',
        v_function;
    end if;
  end loop;

  if not has_function_privilege(
       'authenticated',
       'public.community_submit_artist_claim(uuid,text,text,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.community_submit_artist_claim(uuid,text,text,jsonb)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: Claim submission execution boundary is wrong';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.community_admin_decide_artist_claim(uuid,text,text,boolean,boolean,boolean,boolean)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.community_admin_decide_artist_claim(uuid,text,text,boolean,boolean,boolean,boolean)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: Claim review execution boundary is wrong';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname =
          'artist_claim_requests_one_pending_per_account_artist'
  ) then
    raise exception
      'FAIL: One-pending-claim uniqueness guard is missing';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname =
          'artist_representations_one_current_per_account_artist'
  ) then
    raise exception
      'FAIL: One-current-representation uniqueness guard is missing';
  end if;

  if position(
       'manage_users'
       in pg_get_functiondef(
         'editorial.current_user_can_review_artist_claims()'::regprocedure
       )
     ) = 0
     or position(
       'manage_review_queue'
       in pg_get_functiondef(
         'editorial.current_user_can_review_artist_claims()'::regprocedure
       )
     ) = 0
     or position(
       'manage_registry'
       in pg_get_functiondef(
         'editorial.current_user_can_review_artist_claims()'::regprocedure
       )
     ) = 0
  then
    raise exception
      'FAIL: Claim review does not reuse existing admin/review capability authority';
  end if;

  raise notice
    'PASS: M2 Artist claim + representation authority verified.';
end;
$verify_artist_claims_representation_authority$;
