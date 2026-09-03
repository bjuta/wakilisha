-- WAKILISHA Artist Studio Registry Entry Convergence verifier.
-- Read-only proof of the accepted public discovery, Artist Claim, MIZIZI,
-- representation, and Registry boundaries.

do $verify_artist_studio_registry_entry_convergence$
declare
  v_definition text;
  v_nullable text;
  v_claim_kind_default text;
begin
  if to_regclass(
       'public.artist_claim_proposed_identities'
     ) is null
  then
    raise exception
      'FAIL: proposed Artist identity claim table is missing';
  end if;

  select column_default
  into v_claim_kind_default
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'artist_claim_requests'
    and column_name = 'claim_kind';

  if v_claim_kind_default is null then
    raise exception
      'FAIL: Artist claims do not declare claim_kind';
  end if;

  select is_nullable
  into v_nullable
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'artist_claim_requests'
    and column_name = 'artist_id';

  if v_nullable <> 'YES' then
    raise exception
      'FAIL: proposed Artist claims cannot exist before canonical Registry identity';
  end if;

  if not exists (
       select 1
       from pg_constraint constraint_row
       where constraint_row.conrelid =
             'public.artist_claim_requests'::regclass
         and constraint_row.conname =
             'artist_claim_requests_claim_kind_check'
     )
  then
    raise exception
      'FAIL: Artist claim kind constraint is missing';
  end if;

  if not exists (
       select 1
       from pg_constraint constraint_row
       where constraint_row.conrelid =
             'public.artist_claim_requests'::regclass
         and constraint_row.conname =
             'artist_claim_requests_identity_shape_check'
     )
  then
    raise exception
      'FAIL: Artist claim identity-shape constraint is missing';
  end if;

  if not exists (
       select 1
       from pg_class class
       where class.oid =
             'public.artist_claim_proposed_identities'::regclass
         and class.relrowsecurity
     )
  then
    raise exception
      'FAIL: proposed Artist identity claims do not have RLS enabled';
  end if;

  if to_regclass(
       'public.artist_claim_proposed_identities_accepted_artist_id_idx'
     ) is null
  then
    raise exception
      'FAIL: proposed Artist accepted identity foreign key is not indexed';
  end if;

  if has_table_privilege(
       'anon',
       'public.artist_claim_proposed_identities',
       'SELECT'
     )
     or has_table_privilege(
       'authenticated',
       'public.artist_claim_proposed_identities',
       'SELECT'
     )
     or has_table_privilege(
       'authenticated',
       'public.artist_claim_proposed_identities',
       'INSERT'
     )
     or has_table_privilege(
       'authenticated',
       'public.artist_claim_proposed_identities',
       'UPDATE'
     )
     or has_table_privilege(
       'authenticated',
       'public.artist_claim_proposed_identities',
       'DELETE'
     )
  then
    raise exception
      'FAIL: proposed Artist identity table leaked direct application privileges';
  end if;

  if to_regprocedure(
       'platform_private.mizizi_resolve_artist_identity_candidates(text,text,text,integer)'
     ) is null
     or to_regprocedure(
       'public.get_artist_studio_registry_candidates(text,integer)'
     ) is null
     or to_regprocedure(
       'public.community_submit_new_artist_claim(text,text,text,text[],text,text,jsonb)'
     ) is null
     or to_regprocedure(
       'public.community_get_artist_management_workspace(text)'
     ) is null
     or to_regprocedure(
       'public.community_admin_resolve_artist_claim_existing(uuid,uuid,text,boolean,boolean,boolean,boolean)'
     ) is null
  then
    raise exception
      'FAIL: Artist Studio Registry convergence RPC authority is incomplete';
  end if;

  if has_function_privilege(
       'anon',
       'platform_private.mizizi_resolve_artist_identity_candidates(text,text,text,integer)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.mizizi_resolve_artist_identity_candidates(text,text,text,integer)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: MIZIZI Artist identity resolver leaked through the API role boundary';
  end if;

  if not has_function_privilege(
       'anon',
       'public.get_artist_studio_registry_candidates(text,integer)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.get_artist_studio_registry_candidates(text,integer)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: bounded Artist Studio Registry discovery is not available before authentication';
  end if;

  if has_function_privilege(
       'anon',
       'public.community_submit_new_artist_claim(text,text,text,text[],text,text,jsonb)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.community_submit_new_artist_claim(text,text,text,text[],text,text,jsonb)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: new Artist claim commit boundary is wrong';
  end if;

  if has_function_privilege(
       'anon',
       'public.community_get_artist_management_workspace(text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.community_get_artist_management_workspace(text)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: Artist management workspace authority is not authenticated-only';
  end if;

  select pg_get_functiondef(
    'public.get_artist_studio_registry_candidates(text,integer)'::regprocedure
  )
  into v_definition;

  if position(
       'platform_private.mizizi_resolve_artist_identity_candidates'
       in v_definition
     ) = 0
     or v_definition !~*
        '''active''[[:space:]]*,[[:space:]]*''draft''[[:space:]]*,[[:space:]]*''needs_review'''
  then
    raise exception
      'FAIL: public Artist Studio search does not delegate to bounded MIZIZI Registry identity resolution';
  end if;

  if v_definition !~*
     'case[[:space:]]+when[[:space:]]+candidate\.registry_state[[:space:]]*=[[:space:]]*''active''[[:space:]]+then[[:space:]]+candidate\.image_url'
  then
    raise exception
      'FAIL: non-public Artist imagery is not bounded from the public candidate projection';
  end if;

  select pg_get_functiondef(
    'public.community_submit_new_artist_claim(text,text,text,text[],text,text,jsonb)'::regprocedure
  )
  into v_definition;

  if v_definition ~*
     'insert[[:space:]]+into[[:space:]]+public\.registry_artists'
     or v_definition ~*
        'insert[[:space:]]+into[[:space:]]+public\.registry_review_items'
     or position(
          'artist_registry_match_found'
          in v_definition
        ) = 0
     or position(
          'artist_claim_proposed_identities'
          in v_definition
        ) = 0
  then
    raise exception
      'FAIL: new Artist submission bypasses Artist Claim authority or mutates canonical Registry truth';
  end if;

  select pg_get_functiondef(
    'public.community_admin_decide_artist_claim(uuid,text,text,boolean,boolean,boolean,boolean)'::regprocedure
  )
  into v_definition;

  if position(
       'artist_identity_resolution_required'
       in v_definition
     ) = 0
     or v_definition !~*
        'insert[[:space:]]+into[[:space:]]+public\.registry_artists'
     or position(
          '''active'''
          in v_definition
        ) = 0
     or position(
          'else 1.0 end'
          in v_definition
        ) = 0
     or position(
          'else 100 end'
          in v_definition
        ) > 0
  then
    raise exception
      'FAIL: reviewed new Artist acceptance is not the only canonical Registry creation boundary';
  end if;

  select pg_get_functiondef(
    'public.community_get_artist_management_workspace(text)'::regprocedure
  )
  into v_definition;

  if position(
       'artist_representations'
       in v_definition
     ) = 0
     or position(
          'can_manage_profile'
          in v_definition
        ) = 0
     or position(
          'can_submit_releases'
          in v_definition
        ) = 0
     or position(
          'can_post_updates'
          in v_definition
        ) = 0
     or position(
          'can_manage_team'
          in v_definition
        ) = 0
     or v_definition !~*
        '''active''[[:space:]]*,[[:space:]]*''draft''[[:space:]]*,[[:space:]]*''needs_review'''
  then
    raise exception
      'FAIL: Artist Studio management does not derive from scoped representation authority';
  end if;

  select pg_get_functiondef(
    'public.community_get_artist_representation_state(uuid)'::regprocedure
  )
  into v_definition;

  if position(
       '''active'', ''draft'', ''needs_review'''
       in v_definition
     ) = 0
     or position(
          'can_claim'
          in v_definition
        ) = 0
  then
    raise exception
      'FAIL: claim state does not support bounded non-public Registry identities';
  end if;

  if has_function_privilege(
       'anon',
       'public.find_similar_artists(text,text,real,integer)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.find_similar_artists(text,text,real,integer)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.find_similar_artists(text,text,numeric,integer)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.find_similar_artists(text,text,numeric,integer)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: legacy broad Artist similarity RPC remains publicly executable';
  end if;

  if exists (
       select 1
       from information_schema.tables
       where table_schema = 'public'
         and (
           table_name like 'artist_registration%'
           or table_name like 'artist_intake%'
         )
     )
  then
    raise exception
      'FAIL: a second Artist registration or intake queue was introduced';
  end if;

  raise notice
    'ARTIST_STUDIO_REGISTRY_ENTRY_CONVERGENCE_PASS';
end;
$verify_artist_studio_registry_entry_convergence$;
