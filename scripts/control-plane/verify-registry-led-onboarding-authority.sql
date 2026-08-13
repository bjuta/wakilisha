\set ON_ERROR_STOP on

begin;

do $registry_onboarding_verify$
declare
  v_opening jsonb;
  v_admin_config jsonb;
  v_state jsonb;
  v_admin_user uuid;
  v_slugs text[];
  v_first_slug text;
  v_existing_user_count bigint;
  v_grandfathered_count bigint;
begin
  if to_regclass(
       'private.registry_onboarding_config'
     ) is null
     or to_regclass(
       'private.registry_onboarding_editorial_artists'
     ) is null
     or to_regclass(
       'private.registry_onboarding_user_state'
     ) is null
  then
    raise exception
      'FAIL: Registry onboarding private authority is missing';
  end if;

  if to_regprocedure(
       'public.community_get_registry_onboarding_artists(integer)'
     ) is null
     or to_regprocedure(
       'public.community_admin_get_registry_onboarding_artists()'
     ) is null
     or to_regprocedure(
       'public.community_admin_set_registry_onboarding_artists(text[],boolean)'
     ) is null
     or to_regprocedure(
       'public.community_get_registry_onboarding_state()'
     ) is null
     or to_regprocedure(
       'public.community_set_registry_onboarding_state(text)'
     ) is null
  then
    raise exception
      'FAIL: Registry onboarding RPC authority is missing';
  end if;

  if not has_function_privilege(
       'anon',
       'public.community_get_registry_onboarding_artists(integer)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.community_get_registry_onboarding_artists(integer)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.community_get_registry_onboarding_artists(integer)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: Public opening-field execute grants are incorrect';
  end if;

  if has_function_privilege(
       'anon',
       'public.community_admin_get_registry_onboarding_artists()',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.community_admin_set_registry_onboarding_artists(text[],boolean)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.community_get_registry_onboarding_state()',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.community_set_registry_onboarding_state(text)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: Anonymous role crossed an onboarding admin/self boundary';
  end if;

  if not exists (
    select 1
    from private.phase_0a_rpc_classification
    where function_signature =
          'community_get_registry_onboarding_artists(integer)'
      and access_class =
          'public_read'
  )
  or not exists (
    select 1
    from private.phase_0a_rpc_classification
    where function_signature =
          'community_admin_get_registry_onboarding_artists()'
      and access_class =
          'authenticated_read'
  )
  or not exists (
    select 1
    from private.phase_0a_rpc_classification
    where function_signature =
          'community_admin_set_registry_onboarding_artists(text[],boolean)'
      and access_class =
          'authenticated_command'
  )
  or not exists (
    select 1
    from private.phase_0a_rpc_classification
    where function_signature =
          'community_get_registry_onboarding_state()'
      and access_class =
          'authenticated_read'
  )
  or not exists (
    select 1
    from private.phase_0a_rpc_classification
    where function_signature =
          'community_set_registry_onboarding_state(text)'
      and access_class =
          'authenticated_self_service'
  )
  then
    raise exception
      'FAIL: Registry onboarding RPC classifications are incorrect';
  end if;

  select
    count(*)
  into
    v_existing_user_count
  from auth.users;

  select
    count(*)
  into
    v_grandfathered_count
  from private.registry_onboarding_user_state
    state
  where state.status =
        'skipped'
    and state.skipped_at is not null
    and state.completed_at is null;

  if v_grandfathered_count <>
       v_existing_user_count
  then
    raise exception
      'FAIL: Existing users were not grandfathered out of first-entry onboarding';
  end if;

  delete from
    private.registry_onboarding_editorial_artists;

  update private.registry_onboarding_config
  set
    fallback_enabled = true,
    updated_at = now()
  where config_key =
        'default';

  v_opening :=
    public.community_get_registry_onboarding_artists(
      16
    );

  if v_opening ->> 'mode' <>
       'registry_onboarding'
     or jsonb_typeof(
          v_opening -> 'artists'
        ) <>
        'array'
     or v_opening ->> 'fallback_enabled' <>
        'true'
  then
    raise exception
      'FAIL: Registry onboarding public response envelope is invalid';
  end if;

  if jsonb_array_length(
       v_opening -> 'artists'
     ) = 0
  then
    raise exception
      'FAIL: Empty editorial configuration did not produce a safe fallback';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(
      v_opening -> 'artists'
    ) artist
    where artist ->> 'target_type' <>
          'artist'
       or nullif(
            btrim(
              coalesce(
                artist ->> 'target_id',
                ''
              )
            ),
            ''
          ) is null
       or nullif(
            btrim(
              coalesce(
                artist ->> 'target_slug',
                ''
              )
            ),
            ''
          ) is null
       or nullif(
            btrim(
              coalesce(
                artist ->> 'display_name',
                ''
              )
            ),
            ''
          ) is null
       or nullif(
            btrim(
              coalesce(
                artist ->> 'image_url',
                ''
              )
            ),
            ''
          ) is null
  ) then
    raise exception
      'FAIL: Opening-field Artist presentation is invalid';
  end if;

  select
    array_agg(
      chosen.slug
      order by
        chosen.slug
    )
  into
    v_slugs
  from (
    select
      artist.slug
    from public.registry_artists
      artist
    where artist.status =
          'active'
      and nullif(
            btrim(
              artist.slug
            ),
            ''
          ) is not null
      and nullif(
            btrim(
              artist.display_name
            ),
            ''
          ) is not null
      and nullif(
            btrim(
              coalesce(
                artist.public_image_url,
                ''
              )
            ),
            ''
          ) is not null
    order by
      artist.slug
    limit 2
  ) chosen;

  if cardinality(
       v_slugs
     ) < 2
  then
    raise exception
      'FAIL: Not enough active Registry Artists for onboarding verification';
  end if;

  select
    ura.user_id
  into
    v_admin_user
  from public.user_role_assignments
    ura
  where ura.role_key =
        'administrator'
    and ura.status =
        'active'
    and (
      ura.expires_at is null
      or ura.expires_at >
         now()
    )
  order by
    ura.user_id
  limit 1;

  if v_admin_user is null
  then
    raise exception
      'FAIL: No active administrator is available for command verification';
  end if;

  perform set_config(
    'request.jwt.claim.sub',
    v_admin_user::text,
    true
  );

  perform
    public.community_admin_set_registry_onboarding_artists(
      v_slugs,
      false
    );

  v_admin_config :=
    public.community_admin_get_registry_onboarding_artists();

  if v_admin_config ->> 'fallback_enabled' <>
       'false'
     or jsonb_array_length(
          v_admin_config -> 'artists'
        ) <>
        2
  then
    raise exception
      'FAIL: Administrator onboarding configuration did not round-trip';
  end if;

  v_first_slug :=
    v_admin_config
      -> 'artists'
      -> 0
      ->> 'artist_slug';

  if v_first_slug <>
       v_slugs[1]
  then
    raise exception
      'FAIL: Administrator onboarding order was not preserved';
  end if;

  v_opening :=
    public.community_get_registry_onboarding_artists(
      16
    );

  if v_opening ->> 'fallback_enabled' <>
       'false'
     or v_opening ->> 'fallback_used' <>
        'false'
     or jsonb_array_length(
          v_opening -> 'artists'
        ) <>
        2
     or exists (
       select 1
       from jsonb_array_elements(
         v_opening -> 'artists'
       ) artist
       where artist ->> 'source' <>
             'editorial'
     )
  then
    raise exception
      'FAIL: Full editorial override did not suppress system fallback';
  end if;

  v_state :=
    public.community_get_registry_onboarding_state();

  if v_state ->> 'status' not in (
       'not_started',
       'completed',
       'skipped'
     )
  then
    raise exception
      'FAIL: Self onboarding state read returned an invalid status';
  end if;

  v_state :=
    public.community_set_registry_onboarding_state(
      'skipped'
    );

  if v_state ->> 'status' <>
       'skipped'
     or v_state -> 'skipped_at' =
        'null'::jsonb
     or v_state -> 'completed_at' <>
        'null'::jsonb
  then
    raise exception
      'FAIL: Skip state did not persist correctly';
  end if;

  v_state :=
    public.community_set_registry_onboarding_state(
      'completed'
    );

  if v_state ->> 'status' <>
       'completed'
     or v_state -> 'completed_at' =
        'null'::jsonb
     or v_state -> 'skipped_at' <>
        'null'::jsonb
  then
    raise exception
      'FAIL: Completed state did not replace skipped state correctly';
  end if;

  if position(
       'community_follows'
       in pg_get_functiondef(
            'public.community_admin_set_registry_onboarding_artists(text[],boolean)'::regprocedure
          )
     ) > 0
     or position(
          'community_follows'
          in pg_get_functiondef(
               'public.community_set_registry_onboarding_state(text)'::regprocedure
             )
        ) > 0
  then
    raise exception
      'FAIL: Onboarding config/state created a parallel Follow writer';
  end if;

  if to_regprocedure(
       'public.community_set_follow_state(text,text,text,boolean)'
     ) is null
  then
    raise exception
      'FAIL: Canonical Follow writer is missing';
  end if;

  if to_regprocedure(
       'public.get_public_artist_relationships(uuid)'
     ) is null
  then
    raise exception
      'FAIL: Registry relationship expansion authority is missing';
  end if;
end;
$registry_onboarding_verify$;

rollback;

select jsonb_build_object(
  'verification',
    'PASS',
  'opening_promise',
    'Your people are here',
  'opening_authority',
    'admin_editorial_then_governed_fallback',
  'admin_override',
    true,
  'artist_search_source',
    'registry_artists',
  'selection_persistence',
    'community_set_follow_state',
  'related_expansion',
    'get_public_artist_relationships',
  'onboarding_state',
    'completed_or_skipped_only',
  'existing_users_grandfathered',
    true,
  'parallel_preference_store',
    false,
  'parallel_follow_writer',
    false
) as registry_led_onboarding_authority_acceptance;
