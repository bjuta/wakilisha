do $verify$
declare
  v_oid oid;
  v_definition text;
  v_search_path text;
  v_access_class text;
begin
  v_oid :=
    to_regprocedure(
      'public.community_get_reaction_state_for_public_targets(jsonb)'
    );

  if v_oid is null then
    raise exception
      'STOP: M5 reaction-state RPC is missing.';
  end if;

  select
    pg_get_functiondef(
      v_oid
    ),
    coalesce(
      (
        select config
        from unnest(
          procedure.proconfig
        ) as config
        where config like
          'search_path=%'
        limit 1
      ),
      ''
    )
  into
    v_definition,
    v_search_path
  from pg_proc procedure
  where procedure.oid =
    v_oid
    and procedure.prosecdef
    and procedure.provolatile =
      's';

  if not found then
    raise exception
      'STOP: M5 reaction-state RPC must be stable SECURITY DEFINER.';
  end if;

  if v_search_path <>
    'search_path=pg_catalog, public, editorial'
  then
    raise exception
      'STOP: M5 reaction-state RPC search_path is not exact: %',
      v_search_path;
  end if;

  if position(
       'auth.uid()'
       in v_definition
     ) = 0
  then
    raise exception
      'STOP: M5 reaction-state RPC does not derive the viewer from auth.uid().';
  end if;

  if position(
       'p_user_id'
       in v_definition
     ) > 0
  then
    raise exception
      'STOP: M5 reaction-state RPC accepts or references a user-id authority.';
  end if;

  if position(
       '''article'''
       in v_definition
     ) = 0
     or position(
       '''playlist'''
       in v_definition
     ) = 0
     or position(
       '''release'''
       in v_definition
     ) = 0
  then
    raise exception
      'STOP: M5 public reaction target types are incomplete.';
  end if;

  if position(
       'jsonb_array_length'
       in v_definition
     ) = 0
     or position(
       '> 100'
       in v_definition
     ) = 0
  then
    raise exception
      'STOP: M5 target-list bound is missing.';
  end if;

  if position(
       'editorial.resources'
       in v_definition
     ) = 0
     or position(
       'editorial.playlist_resources'
       in v_definition
     ) = 0
     or position(
       'public.registry_releases'
       in v_definition
     ) = 0
  then
    raise exception
      'STOP: M5 current-public target validation is incomplete.';
  end if;

  if position(
       'public.community_reactions'
       in v_definition
     ) = 0
     or position(
       '''reaction_count'''
       in v_definition
     ) = 0
     or position(
       '''viewer_reacted'''
       in v_definition
     ) = 0
  then
    raise exception
      'STOP: M5 reaction aggregate/viewer-state output is incomplete.';
  end if;

  if position(
       '''user_id'','
       in v_definition
     ) > 0
  then
    raise exception
      'STOP: M5 reaction-state output may expose reacting user identity.';
  end if;

  if has_function_privilege(
       'anon',
       v_oid,
       'EXECUTE'
     )
  then
    raise exception
      'STOP: anon can execute M5 reaction-state RPC.';
  end if;

  if not has_function_privilege(
       'authenticated',
       v_oid,
       'EXECUTE'
     )
  then
    raise exception
      'STOP: authenticated cannot execute M5 reaction-state RPC.';
  end if;

  if not has_function_privilege(
       'service_role',
       v_oid,
       'EXECUTE'
     )
  then
    raise exception
      'STOP: service_role cannot execute M5 reaction-state RPC.';
  end if;

  if has_table_privilege(
       'authenticated',
       'public.community_reactions',
       'SELECT'
     )
     or has_table_privilege(
       'anon',
       'public.community_reactions',
       'SELECT'
     )
  then
    raise exception
      'STOP: Browser roles have direct SELECT on community_reactions.';
  end if;

  if has_function_privilege(
       'authenticated',
       'public.community_get_user_reactions(uuid,uuid[])',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: Legacy service-role reaction reader became browser executable.';
  end if;

  if not has_function_privilege(
       'service_role',
       'public.community_get_user_reactions(uuid,uuid[])',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: Legacy service-role reaction reader lost service-role execution.';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.community_react_to_target(text,uuid,text)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: Existing authenticated reaction writer is no longer executable.';
  end if;

  select classification.access_class
  into v_access_class
  from private.phase_0a_rpc_classification classification
  where classification.function_signature =
    'community_get_reaction_state_for_public_targets(jsonb)';

  if v_access_class is distinct from
    'authenticated_read'
  then
    raise exception
      'STOP: M5 reaction-state classification is not authenticated_read.';
  end if;
end;
$verify$;

select jsonb_build_object(
  'verification',
    'PASS',
  'rpc',
    'community_get_reaction_state_for_public_targets(jsonb)',
  'privacy',
    'self_only_viewer_state',
  'aggregate_identity_exposure',
    false,
  'target_types',
    jsonb_build_array(
      'article',
      'playlist',
      'release'
    ),
  'target_validation',
    'current_public_only',
  'max_targets',
    100,
  'legacy_service_reader_preserved',
    true,
  'existing_reaction_writer_preserved',
    true
) as following_feed_reaction_state_m5_verification;
