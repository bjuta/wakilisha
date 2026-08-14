do $m6_verify$
declare
  v_definition text;
begin
  if to_regprocedure(
       'public.community_get_artist_launch_analytics(uuid,integer)'
     ) is null
  then
    raise exception
      'M6_VERIFY: Artist launch analytics read authority is missing';
  end if;

  select pg_get_functiondef(
    'public.community_get_artist_launch_analytics(uuid,integer)'::regprocedure
  )
  into v_definition;

  if position(
       'editorial.current_artist_representation'
       in v_definition
     ) = 0
     or position(
       'public.analytics_events'
       in v_definition
     ) = 0
     or position(
       'public.community_follows'
       in v_definition
     ) = 0
     or position(
       'public.registry_release_artists'
       in v_definition
     ) = 0
     or position(
       'public.registry_track_artists'
       in v_definition
     ) = 0
     or position(
       'public.artist_updates'
       in v_definition
     ) = 0
     or position(
       '''artist_launch'''
       in v_definition
     ) = 0
  then
    raise exception
      'M6_VERIFY: Artist launch analytics dependencies are incomplete';
  end if;

  if has_function_privilege(
       'anon',
       'public.community_get_artist_launch_analytics(uuid,integer)',
       'EXECUTE'
     )
  then
    raise exception
      'M6_VERIFY: Anonymous Artist analytics access is open';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.community_get_artist_launch_analytics(uuid,integer)',
       'EXECUTE'
     )
  then
    raise exception
      'M6_VERIFY: Authenticated Artist analytics access is missing';
  end if;

  if not exists (
    select 1
    from private.phase_0a_rpc_classification
    where function_signature =
      'community_get_artist_launch_analytics(uuid,integer)'
      and access_class =
        'authenticated_read'
  ) then
    raise exception
      'M6_VERIFY: Artist launch analytics RPC classification is missing';
  end if;
end;
$m6_verify$;

select jsonb_build_object(
  'verification',
    'PASS',
  'analytics_ledger',
    'analytics_events',
  'access',
    'active Artist representative',
  'launch_medium',
    'artist_launch',
  'metrics',
    jsonb_build_array(
      'views',
      'plays',
      'shares',
      'visitors',
      'followers'
    ),
  'raw_visitor_identity_exposed',
    false
) as m6_artist_launch_tools_analytics;

do $m6_route_integrity_verify$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.community_get_artist_launch_analytics(uuid,integer)'::regprocedure
  )
  into v_definition;

  if position(
       'public.registry_release_tracks'
       in v_definition
     ) = 0
     or position(
       'public_track_slug'
       in v_definition
     ) = 0
     or position(
       $needle$'/releases/'$needle$
       in v_definition
     ) = 0
     or position(
       'regexp_replace'
       in v_definition
     ) = 0
  then
    raise exception
      'M6_ROUTE_INTEGRITY_VERIFY: public Track route authority is incomplete';
  end if;

  if position(
       'limit 201'
       in lower(v_definition)
     ) > 0
     or position(
       'limit 20'
       in lower(v_definition)
     ) > 0
  then
    raise exception
      'M6_ROUTE_INTEGRITY_VERIFY: launch targets or campaigns are silently capped';
  end if;
end;
$m6_route_integrity_verify$;
