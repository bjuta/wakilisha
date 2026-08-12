\set ON_ERROR_STOP on

do $verify_following_person_artist_feed_m3$
declare
  v_definition text;
  v_search_path text;
  v_prosecdef boolean;
  v_provolatile "char";
begin
  if to_regprocedure(
       'public.community_get_following_feed(integer,timestamp with time zone,text)'
     ) is null
  then
    raise exception
      'FAIL: community_get_following_feed is missing';
  end if;

  select
    procedure.prosecdef,
    procedure.provolatile,
    array_to_string(
      procedure.proconfig,
      ','
    )
  into
    v_prosecdef,
    v_provolatile,
    v_search_path
  from pg_proc procedure
  join pg_namespace namespace
    on namespace.oid =
       procedure.pronamespace
  where namespace.nspname =
        'public'
    and procedure.oid =
        'public.community_get_following_feed(integer,timestamp with time zone,text)'::regprocedure;

  if v_prosecdef is not true
     or v_provolatile <> 's'
     or coalesce(
          v_search_path,
          ''
        ) <>
        'search_path=pg_catalog, public, editorial'
  then
    raise exception
      'FAIL: Following feed security/stability/search_path contract changed: definer %, volatile %, config %',
      v_prosecdef,
      v_provolatile,
      v_search_path;
  end if;

  if has_function_privilege(
       'anon',
       'public.community_get_following_feed(integer,timestamp with time zone,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.community_get_following_feed(integer,timestamp with time zone,text)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: Following feed RPC privileges changed';
  end if;

  if has_table_privilege(
       'anon',
       'public.community_follows',
       'SELECT'
     )
     or has_table_privilege(
       'authenticated',
       'public.community_follows',
       'SELECT'
     )
  then
    raise exception
      'FAIL: Following feed weakened direct Follow-table privacy';
  end if;

  if not exists (
    select 1
    from private.phase_0a_rpc_classification
    where function_signature =
          'community_get_following_feed(integer,timestamp with time zone,text)'
      and access_class =
          'authenticated_read'
  ) then
    raise exception
      'FAIL: Following feed RPC control-plane classification is missing';
  end if;

  v_definition :=
    pg_get_functiondef(
      'public.community_get_following_feed(integer,timestamp with time zone,text)'::regprocedure
    );

  if position(
       'auth.uid()'
       in v_definition
     ) = 0
     or position(
          'person'
          in v_definition
        ) = 0
     or position(
          'artist'
          in v_definition
        ) = 0
  then
    raise exception
      'FAIL: Following feed is not self-bound to mature Person/Artist subjects';
  end if;

  if position(
       'list_current_public_person_work'
       in v_definition
     ) = 0
  then
    raise exception
      'FAIL: Person Following consequence is not governed current-public work';
  end if;

  if position(
       'public.list_public_person_work'
       in v_definition
     ) > 0
  then
    raise exception
      'FAIL: Person Following feed bypassed direct current-public work authority';
  end if;

  if position(
       'registry_artists'
       in v_definition
     ) = 0
     or position(
          'registry_releases'
          in v_definition
        ) = 0
     or position(
          'registry_release_artists'
          in v_definition
        ) = 0
     or position(
          'is_primary'
          in v_definition
        ) = 0
  then
    raise exception
      'FAIL: Artist Following consequence is not active primary Release output';
  end if;

  if position(
       '180 days'
       in v_definition
     ) = 0
     or position(
          'output_rank <= 3'
          in v_definition
        ) = 0
     or position(
          'recent_count = 0'
          in v_definition
        ) = 0
     or position(
          'output_rank = 1'
          in v_definition
        ) = 0
  then
    raise exception
      'FAIL: Current-interest freshness / latest fallback contract changed';
  end if;

  if position(
       'followed_at'
       in v_definition
     ) = 0
     or position(
          'matched_follows'
          in v_definition
        ) = 0
  then
    raise exception
      'FAIL: Feed lost Follow-reason provenance';
  end if;

  if position(
       'registry_genres'
       in v_definition
     ) > 0
     or position(
          'registry_labels'
          in v_definition
        ) > 0
     or position(
          'wk_chart_'
          in v_definition
        ) > 0
  then
    raise exception
      'FAIL: Deferred Genre, Label, or Chart Program semantics entered M3';
  end if;

  if position(
       'community_activity'
       in v_definition
     ) > 0
     or position(
          'community_get_digest'
          in v_definition
        ) > 0
  then
    raise exception
      'FAIL: Following feed incorrectly reuses global Community activity';
  end if;

  if position(
       'record_label'
       in v_definition
     ) > 0
     or position(
          'metadata->>'
          in v_definition
        ) > 0
  then
    raise exception
      'FAIL: Following feed imported heuristic metadata identity';
  end if;

  if position(
       'published_at desc'
       in lower(
            v_definition
          )
     ) = 0
     or position(
          'item_key desc'
          in lower(
               v_definition
             )
        ) = 0
  then
    raise exception
      'FAIL: Following feed lost deterministic chronological ordering';
  end if;
end;
$verify_following_person_artist_feed_m3$;


select jsonb_build_object(
  'verification',
    'PASS',
  'rpc',
    'community_get_following_feed(integer,timestamptz,text)',
  'privacy',
    'self_only',
  'mode',
    'current_interest',
  'subject_types',
    jsonb_build_array(
      'person',
      'artist'
    ),
  'recent_window_days',
    180,
  'per_subject_recent_limit',
    3,
  'empty_recent_fallback',
    'one_latest_item',
  'person_output',
    'current_public_article_playlist_work',
  'artist_output',
    'active_primary_releases',
  'genre_feed_consequence',
    false,
  'label_feed_consequence',
    false,
  'chart_program_feed_consequence',
    false,
  'global_activity_reused',
    false,
  'recommendation_ranking',
    false
) as following_person_artist_feed_m3_verification;
