-- Verify Following Experience M1:
-- Follow / Save capability authority.

do $verify_follow_save_capability_authority$
declare
  v_follow_constraint_valid boolean;
  v_save_constraint_valid boolean;
  v_follow_definition text;
  v_toggle_definition text;
  v_save_definition text;
  v_save_toggle_definition text;
  v_save_resolver_definition text;
  v_follow_trigger_count integer;
  v_save_trigger_count integer;
begin
  if to_regprocedure(
       'private.community_resolve_follow_target(text,text,text)'
     ) is null
     or to_regprocedure(
       'private.community_resolve_save_target(text,text,text,text)'
     ) is null
  then
    raise exception
      'FAIL: Follow/Save canonical resolver authority is missing';
  end if;

  select constraint_row.convalidated
  into v_follow_constraint_valid
  from pg_constraint constraint_row
  join pg_class relation
    on relation.oid =
       constraint_row.conrelid
  join pg_namespace namespace
    on namespace.oid =
       relation.relnamespace
  where namespace.nspname =
        'public'
    and relation.relname =
        'community_follows'
    and constraint_row.conname =
        'community_follows_target_type_capability_check';

  select constraint_row.convalidated
  into v_save_constraint_valid
  from pg_constraint constraint_row
  join pg_class relation
    on relation.oid =
       constraint_row.conrelid
  join pg_namespace namespace
    on namespace.oid =
       relation.relnamespace
  where namespace.nspname =
        'public'
    and relation.relname =
        'community_saves'
    and constraint_row.conname =
        'community_saves_entity_type_capability_check';

  if v_follow_constraint_valid is not true
     or v_save_constraint_valid is not true
  then
    raise exception
      'FAIL: Follow/Save capability constraints are missing or unvalidated';
  end if;

  if exists (
    select 1
    from public.community_follows
    where target_type not in (
      'person',
      'artist',
      'genre',
      'label',
      'chart_program'
    )
  ) then
    raise exception
      'FAIL: Unsupported Follow target exists';
  end if;

  if exists (
    select 1
    from public.community_saves
    where entity_type not in (
      'article',
      'playlist',
      'track',
      'release',
      'chart_edition'
    )
  ) then
    raise exception
      'FAIL: Unsupported Save entity exists';
  end if;

  if position(
       'field_guide'
       in pg_get_functiondef(
         'private.community_resolve_save_target(text,text,text,text)'::regprocedure
       )
     ) > 0
  then
    raise exception
      'FAIL: Guide Save execution is present before canonical Guide authority exists';
  end if;

  if exists (
    select 1
    from public.community_follows
    where target_type =
          'article'
  ) then
    raise exception
      'FAIL: Article remains a Follow target';
  end if;

  if (
    select count(*)
    from public.community_saves
    where entity_type =
          'article'
  ) < 1 then
    raise exception
      'FAIL: Reviewed existing Article Save is missing';
  end if;

  if exists (
    select 1
    from public.community_activity
    where activity_type =
          'follow'
      and entity_type =
          'article'
  ) then
    raise exception
      'FAIL: Redundant Article Follow activity survived M1 reconciliation';
  end if;

  if not exists (
    select 1
    from public.community_activity
    where activity_type =
          'save'
      and entity_type =
          'article'
  ) then
    raise exception
      'FAIL: Existing Article Save activity was lost during M1 reconciliation';
  end if;

  if exists (
    select 1
    from public.community_saves
    where id =
      '0172f8cc-7d6f-4578-ac9c-cbe14d1ab3f9'::uuid
  ) then
    raise exception
      'FAIL: Reviewed draft Playlist preview Save survived M1';
  end if;

  if exists (
    select 1
    from public.community_saves
    where id =
      '64ee2a95-6833-4f4e-8425-f8eb70c49b98'::uuid
  ) then
    raise exception
      'FAIL: Reviewed provider/player lab Track Save survived M1';
  end if;

  if not exists (
    select 1
    from public.community_saves
    where id =
      '9fe2f56a-4cff-45e8-a41f-e723b16677bb'::uuid
      and entity_type = 'playlist'
      and entity_id =
          '574c2f20-d4c3-4fb1-a6b3-6ff7d85ea297'
      and entity_slug =
          'top-50-kenyan-songs-of-2025'
      and created_at =
          '2026-08-11T16:54:15.388428+00:00'::timestamptz
  ) then
    raise exception
      'FAIL: Published Top 50 Save was not preserved';
  end if;

  if exists (
    select 1
    from public.community_saves saved
    where saved.entity_type = 'track'
      and saved.entity_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ) then
    raise exception
      'FAIL: Legacy non-UUID Track Save identity survived M1';
  end if;

  if (
    select count(*)
    from public.community_saves saved
    join public.community_activity activity
      on activity.user_id = saved.user_id
     and activity.activity_type = 'save'
     and activity.entity_type = 'track'
     and activity.entity_id = saved.entity_id
     and activity.entity_slug
         is not distinct from
         saved.entity_slug
     and activity.created_at = saved.created_at
    where saved.id in (
      'ff79f9ed-1e81-46da-b719-655357b3e95b'::uuid,
      'f0fcd77d-1311-42b1-a1bd-ec7e874d5b58'::uuid,
      '0d5048ad-1707-4b6a-8ca7-338c18534674'::uuid,
      '80004316-2b56-4a48-bbe9-65c2a0c33970'::uuid,
      'd35f5faf-6ff7-4ade-bc33-3cfe4d8ac750'::uuid,
      'f1f6c5b3-7d71-4a5d-8d12-e90e0774aa50'::uuid,
      '71dbf1da-9f66-4d47-b5b2-bd5091fa82a0'::uuid,
      '886f67eb-c766-4c98-9f61-681844b0b75b'::uuid,
      '29dbf502-ed32-45a2-a14c-e84b51bea1dd'::uuid,
      '35738864-7cc4-4ed0-bc6f-a70d12a9673c'::uuid
    )
  ) <> 10 then
    raise exception
      'FAIL: Reviewed legacy Track Save/activity pairs did not canonicalize in place';
  end if;

  if exists (
    select 1
    from public.community_saves saved
    left join public.registry_tracks track
      on track.id::text = saved.entity_id
    left join lateral (
      select
        count(*)::integer as routable_primary_count,
        min(link.artist_slug) as artist_slug
      from public.registry_track_artists link
      where link.track_id = track.id
        and link.status in (
          'active',
          'needs_review',
          'draft'
        )
        and link.is_primary is true
        and nullif(btrim(coalesce(link.artist_slug, '')), '') is not null
    ) primary_artist on true
    where saved.entity_type = 'track'
      and (
        track.id is null
        or track.status not in (
             'active',
             'needs_review',
             'draft'
           )
        or primary_artist.routable_primary_count <> 1
        or primary_artist.artist_slug is null
        or saved.entity_slug is distinct from track.slug
        or saved.entity_url is distinct from
           '/tracks/' || primary_artist.artist_slug || '/' || track.slug
      )
  ) then
    raise exception
      'FAIL: Surviving Track Save is not canonical or publicly routable';
  end if;

  if (
    select count(*)
    from public.community_saves
    where entity_type = 'track'
  ) <> 13 then
    raise exception
      'FAIL: Reviewed Track Save reconciliation did not converge to 13 canonical rows';
  end if;

  if not exists (
    select 1
    from public.community_saves saved
    where saved.id =
          'd35f5faf-6ff7-4ade-bc33-3cfe4d8ac750'::uuid
      and saved.entity_id =
          'b99137ed-bfa1-4256-995c-cca36ac6c3a1'
      and saved.entity_slug =
          'baddies-need-love'
      and saved.entity_url =
          '/tracks/maandy/baddies-need-love'
  ) then
    raise exception
      'FAIL: Baddies Need Love Save did not converge to reviewed Registry identity';
  end if;

  if not exists (
    select 1
    from public.community_saves saved
    where saved.id =
          'f1f6c5b3-7d71-4a5d-8d12-e90e0774aa50'::uuid
      and saved.entity_id =
          'cc3f0cf0-0f3d-4c79-ba34-7453065e5822'
      and saved.entity_slug = 'aje'
      and saved.entity_url =
          '/tracks/kethan/aje'
  ) then
    raise exception
      'FAIL: Aje Save did not converge to reviewed Kethan Registry identity';
  end if;

  if not exists (
    select 1
    from public.community_saves saved
    where saved.id =
          '886f67eb-c766-4c98-9f61-681844b0b75b'::uuid
      and saved.entity_id =
          '208e0284-93b8-43fd-991e-b17ffa624c4b'
      and saved.entity_slug = 'siaka'
      and saved.entity_url =
          '/tracks/mejja/siaka'
      and saved.created_at =
          '2026-07-03T12:38:51.309431+00:00'::timestamptz
  ) then
    raise exception
      'FAIL: Older Siaka Save intent was not preserved canonically';
  end if;

  if exists (
    select 1
    from public.community_saves
    where id =
      '12d1eda5-dcb1-42e2-8665-e9998d370903'::uuid
  ) then
    raise exception
      'FAIL: Later duplicate Siaka Save survived reconciliation';
  end if;

  if not exists (
    select 1
    from public.community_activity
    where id =
      'e6b02a3c-a11d-4c23-8a01-3539538e8494'::uuid
      and activity_type = 'save'
      and entity_type = 'track'
      and entity_id =
          '208e0284-93b8-43fd-991e-b17ffa624c4b'
      and entity_slug = 'siaka'
      and created_at =
          '2026-07-03T12:38:51.309431+00:00'::timestamptz
  ) then
    raise exception
      'FAIL: Older Siaka Save activity was not canonicalized in place';
  end if;

  if exists (
    select 1
    from public.community_activity
    where id =
      '55fc27af-6464-4bce-90d2-1f930d911158'::uuid
  ) then
    raise exception
      'FAIL: Later duplicate Siaka Save activity survived reconciliation';
  end if;

  if not exists (
    select 1
    from public.community_activity
    where id =
      '9fdd8e56-f8a4-45e7-a426-3baa9e207ab4'::uuid
      and activity_type = 'save'
      and entity_type = 'track'
      and entity_id =
          '208e0284-93b8-43fd-991e-b17ffa624c4b'
      and entity_slug = 'siaka'
      and created_at =
          '2026-08-09T15:29:04.783231+00:00'::timestamptz
  ) then
    raise exception
      'FAIL: Historical canonical Siaka Save activity was not preserved';
  end if;

  v_follow_definition :=
    pg_get_functiondef(
      'public.community_set_follow_state(text,text,text,boolean)'::regprocedure
    );

  v_toggle_definition :=
    pg_get_functiondef(
      'public.community_follow_target(text,text,text)'::regprocedure
    );

  v_save_definition :=
    pg_get_functiondef(
      'public.community_set_saved_state(text,text,text,text,text,text,text,boolean)'::regprocedure
    );

  v_save_toggle_definition :=
    pg_get_functiondef(
      'public.community_save_entity(text,text,text,text,text,text,text)'::regprocedure
    );

  v_save_resolver_definition :=
    pg_get_functiondef(
      'private.community_resolve_save_target(text,text,text,text)'::regprocedure
    );

  if position(
       'private.community_resolve_follow_target'
       in v_follow_definition
     ) = 0
     or position(
       'A user cannot follow their own Person'
       in v_follow_definition
     ) = 0
     or position(
       'private.community_resolve_follow_target'
       in v_toggle_definition
     ) = 0
  then
    raise exception
      'FAIL: Follow commands do not use canonical target authority or lost Person self-follow protection';
  end if;

  if position(
       'private.community_resolve_save_target'
       in v_save_definition
     ) = 0
     or position(
       'private.community_resolve_save_target'
       in v_save_toggle_definition
     ) = 0
  then
    raise exception
      'FAIL: Save commands do not use canonical target authority';
  end if;

  if v_save_resolver_definition !~* 'registry_track_artists'
     or v_save_resolver_definition !~* 'registry_release_artists'
     or v_save_resolver_definition !~* '/tracks/'
     or v_save_resolver_definition !~* '/releases/'
     or v_save_resolver_definition !~* 'needs_review'
     or v_save_resolver_definition !~* 'draft'
     or v_save_resolver_definition ~* 'lower[[:space:]]*\([[:space:]]*track\.slug'
     or v_save_resolver_definition ~* 'lower[[:space:]]*\([[:space:]]*release\.slug'
  then
    raise exception
      'FAIL: Track/Release Save authority is not stable-ID, public-routability, artist-scoped authority';
  end if;

  if v_save_toggle_definition !~* 'canonical_type[[:space:]]+not[[:space:]]+in[[:space:]]*\([[:space:]]*''track''[[:space:]]*,[[:space:]]*''release'''
  then
    raise exception
      'FAIL: Track/Release Save toggle still permits unsafe bare-slug existing-row matching';
  end if;

  if pg_get_functiondef(
       'public.community_get_user_follows(uuid)'::regprocedure
     ) !~* 'auth\.uid\(\)'
     or pg_get_functiondef(
          'public.community_get_user_follows(uuid)'::regprocedure
        ) !~* 'p_user_id[[:space:]]+is[[:space:]]+distinct[[:space:]]+from[[:space:]]+v_user_id'
     or pg_get_functiondef(
          'public.community_get_user_saves(uuid)'::regprocedure
        ) !~* 'auth\.uid\(\)'
     or pg_get_functiondef(
          'public.community_get_user_saves(uuid)'::regprocedure
        ) !~* 'p_user_id[[:space:]]+is[[:space:]]+distinct[[:space:]]+from[[:space:]]+v_user_id'
  then
    raise exception
      'FAIL: Private Follow/Save readers lost self-only authority';
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
     or has_table_privilege(
       'anon',
       'public.community_saves',
       'SELECT'
     )
     or has_table_privilege(
       'authenticated',
       'public.community_saves',
       'SELECT'
     )
  then
    raise exception
      'FAIL: Private Follow/Save table reads are browser-visible';
  end if;

  if has_function_privilege(
       'anon',
       'public.community_set_follow_state(text,text,text,boolean)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.community_follow_target(text,text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.community_set_saved_state(text,text,text,text,text,text,text,boolean)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.community_save_entity(text,text,text,text,text,text,text)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: Anonymous Follow/Save command execution is open';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.community_set_follow_state(text,text,text,boolean)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.community_follow_target(text,text,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.community_set_saved_state(text,text,text,text,text,text,text,boolean)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.community_save_entity(text,text,text,text,text,text,text)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: Authenticated Follow/Save command execution is missing';
  end if;

  if has_function_privilege(
       'anon',
       'private.community_resolve_follow_target(text,text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'private.community_resolve_follow_target(text,text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'private.community_resolve_save_target(text,text,text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'private.community_resolve_save_target(text,text,text,text)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: Internal target resolvers are browser-executable';
  end if;

  select count(*)::integer
  into v_follow_trigger_count
  from pg_trigger trigger_row
  join pg_proc procedure
    on procedure.oid =
       trigger_row.tgfoid
  join pg_class relation
    on relation.oid =
       trigger_row.tgrelid
  join pg_namespace namespace
    on namespace.oid =
       relation.relnamespace
  where not trigger_row.tgisinternal
    and namespace.nspname =
        'public'
    and relation.relname =
        'community_follows'
    and procedure.proname =
        'community_activity_on_follow'
    and trigger_row.tgenabled =
        'O';

  select count(*)::integer
  into v_save_trigger_count
  from pg_trigger trigger_row
  join pg_proc procedure
    on procedure.oid =
       trigger_row.tgfoid
  join pg_class relation
    on relation.oid =
       trigger_row.tgrelid
  join pg_namespace namespace
    on namespace.oid =
       relation.relnamespace
  where not trigger_row.tgisinternal
    and namespace.nspname =
        'public'
    and relation.relname =
        'community_saves'
    and procedure.proname =
        'community_activity_on_save'
    and trigger_row.tgenabled =
        'O';

  if v_follow_trigger_count <> 1
     or v_save_trigger_count <> 1
  then
    raise exception
      'FAIL: Follow/Save activity trigger authority is not restored';
  end if;
end;
$verify_follow_save_capability_authority$;


select jsonb_pretty(
  jsonb_build_object(
    'verification',
      'PASS',
    'follow_contract',
      jsonb_build_array(
        'person',
        'artist',
        'genre',
        'label',
        'chart_program'
      ),
    'save_contract_m1',
      jsonb_build_array(
        'article',
        'playlist',
        'track',
        'release',
        'chart_edition'
      ),
    'guide_save_product_capability',
      'approved_but_deferred_pending_canonical_guide_identity_authority',
    'music_save_routability',
      jsonb_build_object(
        'track_statuses',
          jsonb_build_array(
            'active',
            'needs_review',
            'draft'
          ),
        'release_statuses',
          jsonb_build_array(
            'active',
            'draft'
          ),
        'identity',
          'stable_registry_uuid',
        'route',
          'artist_scoped'
      ),
    'track_save_count',
      (
        select count(*)
        from public.community_saves
        where entity_type = 'track'
      ),
    'article_follow_count',
      (
        select count(*)
        from public.community_follows
        where target_type =
              'article'
      ),
    'article_save_count',
      (
        select count(*)
        from public.community_saves
        where entity_type =
              'article'
      ),
    'following_reader',
      'self_only',
    'saves_reader',
      'self_only',
    'public_following_identities',
      false,
    'feed_ranking_added',
      false
  )
) as follow_save_capability_authority_acceptance;
