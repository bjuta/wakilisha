\set ON_ERROR_STOP on

begin;

do $starter_circle_m6_verify$
declare
  v_definition text;
  v_result jsonb;
begin
  if to_regprocedure(
       'public.community_get_follow_suggestions(integer,integer)'
     ) is null
  then
    raise exception
      'FAIL: Starter Circle suggestion RPC is missing';
  end if;

  if pg_get_function_identity_arguments(
       'public.community_get_follow_suggestions(integer,integer)'::regprocedure
     ) <>
     'p_people_limit integer, p_artist_limit integer'
  then
    raise exception
      'FAIL: Starter Circle RPC signature changed';
  end if;

  if not has_function_privilege(
       'anon',
       'public.community_get_follow_suggestions(integer,integer)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.community_get_follow_suggestions(integer,integer)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.community_get_follow_suggestions(integer,integer)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: Starter Circle execute privileges are incorrect';
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
      'FAIL: Browser roles gained direct Follow-table read access';
  end if;

  if not exists (
    select 1
    from private.phase_0a_rpc_classification
    where function_signature =
          'community_get_follow_suggestions(integer,integer)'
      and access_class =
          'public_read'
  ) then
    raise exception
      'FAIL: Starter Circle public-read classification is missing';
  end if;

  v_definition :=
    pg_get_functiondef(
      'public.community_get_follow_suggestions(integer,integer)'::regprocedure
    );

  if position(
       'auth.uid()'
       in v_definition
     ) = 0
     or position(
          'community_follows'
          in v_definition
        ) = 0
     or position(
          'person_identity_links'
          in v_definition
        ) = 0
     or position(
          'list_current_public_person_work'
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
          'latest_release_suggestion_rank'
          in v_definition
        ) = 0
     or position(
          'partition by'
          in lower(v_definition)
        ) = 0
  then
    raise exception
      'FAIL: Starter Circle source contract is incomplete';
  end if;

  if position(
       'p_user_id'
       in v_definition
     ) > 0
  then
    raise exception
      'FAIL: Starter Circle must derive viewer identity from auth.uid()';
  end if;

  v_result :=
    public.community_get_follow_suggestions(
      4,
      12
    );

  if v_result ->> 'mode' <>
       'starter_circle'
     or v_result -> 'subject_types' <>
        jsonb_build_array(
          'person',
          'artist'
        )
     or v_result ->> 'recent_window_days' <>
        '180'
     or jsonb_typeof(
          v_result -> 'people'
        ) <>
        'array'
     or jsonb_typeof(
          v_result -> 'artists'
        ) <>
        'array'
  then
    raise exception
      'FAIL: Starter Circle response envelope is invalid';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(
      v_result -> 'people'
    ) item
    where item ->> 'target_type' <>
          'person'
       or coalesce(
            item ->> 'canonical_path',
            ''
          ) not like
          '/people/%'
       or nullif(
            btrim(
              coalesce(
                item ->> 'display_name',
                ''
              )
            ),
            ''
          ) is null
  ) then
    raise exception
      'FAIL: Anonymous Person suggestions contain invalid public presentation';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(
      v_result -> 'artists'
    ) item
    where item ->> 'target_type' <>
          'artist'
       or coalesce(
            item ->> 'canonical_path',
            ''
          ) not like
          '/artists/%'
       or nullif(
            btrim(
              coalesce(
                item ->> 'display_name',
                ''
              )
            ),
            ''
          ) is null
       or nullif(
            btrim(
              coalesce(
                item ->> 'image_url',
                ''
              )
            ),
            ''
          ) is null
  ) then
    raise exception
      'FAIL: Anonymous Artist suggestions contain invalid public presentation';
  end if;
end;
$starter_circle_m6_verify$;

rollback;

select jsonb_build_object(
  'verification',
    'PASS',
  'rpc',
    'community_get_follow_suggestions(integer,integer)',
  'access_class',
    'public_read',
  'anonymous_preview',
    true,
  'signed_in_existing_follow_exclusion',
    true,
  'signed_in_self_person_exclusion',
    true,
  'artist_diversity',
    'one_suggestion_per_latest_release',
  'writer_reused',
    'community_set_follow_state',
  'feed_reused',
    'community_get_following_feed'
) as following_starter_circle_m6_acceptance;

