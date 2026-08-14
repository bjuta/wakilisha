-- WAKILISHA M1 verifier: Registry Artist username protection.

do $verify_registry_artist_username_protection$
declare
  v_mapping_count integer;
  v_handle_count integer;
  v_ambiguous_count integer;
  v_user_collision_count integer;
  v_expected_missing integer;
  v_unexpected_extra integer;
  v_definition text;
  v_trigger_count integer;
  v_rls_enabled boolean;
begin
  if to_regclass(
       'public.community_artist_username_reservations'
     ) is null
  then
    raise exception
      'FAIL: Artist username reservation table is missing';
  end if;

  if to_regprocedure(
       'editorial.username_is_registry_artist_reserved(text)'
     ) is null
     or to_regprocedure(
       'editorial.refresh_registry_artist_username_reservations()'
     ) is null
     or to_regprocedure(
       'editorial.guard_user_profile_reserved_username()'
     ) is null
     or to_regprocedure(
       'editorial.refresh_artist_username_reservations_trigger()'
     ) is null
  then
    raise exception
      'FAIL: Artist username reservation function authority is incomplete';
  end if;

  select class.relrowsecurity
  into v_rls_enabled
  from pg_class class
  where class.oid =
        'public.community_artist_username_reservations'::regclass;

  if not coalesce(v_rls_enabled, false) then
    raise exception
      'FAIL: Artist username reservation table does not have RLS enabled';
  end if;

  if has_table_privilege(
       'anon',
       'public.community_artist_username_reservations',
       'SELECT'
     )
     or has_table_privilege(
       'authenticated',
       'public.community_artist_username_reservations',
       'SELECT'
     )
  then
    raise exception
      'FAIL: Artist username reservation table is directly readable by public application roles';
  end if;

  if has_function_privilege(
       'anon',
       'editorial.refresh_registry_artist_username_reservations()',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'editorial.refresh_registry_artist_username_reservations()',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: Reservation refresh command is exposed to public application roles';
  end if;

  v_definition :=
    pg_get_functiondef(
      'public.community_username_is_reserved(text)'::regprocedure
    );

  if position(
       'community_reserved_usernames'
       in v_definition
     ) = 0
     or position(
       'username_is_registry_artist_reserved'
       in v_definition
     ) = 0
  then
    raise exception
      'FAIL: Central reserved-handle authority does not preserve platform + Registry Artist protection';
  end if;

  if position(
       'community_username_is_reserved'
       in pg_get_functiondef(
         'public.community_generate_username(uuid,text,text)'::regprocedure
       )
     ) = 0
     or position(
       'community_username_is_reserved'
       in pg_get_functiondef(
         'public.community_username_available(text)'::regprocedure
       )
     ) = 0
     or position(
       'community_username_is_reserved'
       in pg_get_functiondef(
         'public.community_update_username(text)'::regprocedure
       )
     ) = 0
     or position(
       'community_username_is_reserved'
       in pg_get_functiondef(
         'public.community_create_profile(uuid,text,text)'::regprocedure
       )
     ) = 0
  then
    raise exception
      'FAIL: A username writer bypasses the central reserved-handle authority';
  end if;

  select count(*)::integer
  into v_trigger_count
  from pg_trigger trigger
  where trigger.tgname in (
    'user_profiles_reserved_username_guard',
    'registry_artists_username_reservation_refresh_insert_delete',
    'registry_artists_username_reservation_refresh_update',
    'user_profiles_username_reservation_refresh_insert_delete',
    'user_profiles_username_reservation_refresh_update'
  )
    and not trigger.tgisinternal;

  if v_trigger_count <> 5 then
    raise exception
      'FAIL: Expected five Artist username protection triggers, found %',
      v_trigger_count;
  end if;

  with raw_candidates as (
    select
      artist.id as artist_id,
      candidate.source,
      candidate.priority,
      candidate.username
    from public.registry_artists artist
    cross join lateral (
      values
        (
          'slug_exact'::text,
          1,
          case
            when public.community_username_is_valid(
              public.community_normalize_username(
                artist.slug
              )
            )
            then public.community_normalize_username(
              artist.slug
            )
            else null
          end
        ),
        (
          'slug_seed'::text,
          2,
          case
            when public.community_username_is_valid(
              public.community_username_seed(
                artist.slug
              )
            )
            then public.community_username_seed(
              artist.slug
            )
            else null
          end
        ),
        (
          'name_seed'::text,
          3,
          case
            when public.community_username_is_valid(
              public.community_username_seed(
                artist.display_name
              )
            )
            then public.community_username_seed(
              artist.display_name
            )
            else null
          end
        )
    ) candidate(
      source,
      priority,
      username
    )
    where artist.status = 'active'
      and candidate.username is not null
  ),

  expected as (
    select
      ranked.username,
      ranked.artist_id,
      ranked.source
    from (
      select
        raw.artist_id,
        raw.username,
        raw.source,
        row_number() over (
          partition by
            raw.artist_id,
            raw.username
          order by
            raw.priority,
            raw.source
        ) as row_number
      from raw_candidates raw
    ) ranked
    where ranked.row_number = 1
      and not exists (
        select 1
        from public.user_profiles profile
        where profile.username_normalized =
              ranked.username
      )
  )

  select count(*)::integer
  into v_expected_missing
  from (
    select
      expected.username,
      expected.artist_id,
      expected.source
    from expected

    except

    select
      reservation.username,
      reservation.artist_id,
      reservation.source
    from public.community_artist_username_reservations reservation
  ) missing;

  with raw_candidates as (
    select
      artist.id as artist_id,
      candidate.source,
      candidate.priority,
      candidate.username
    from public.registry_artists artist
    cross join lateral (
      values
        (
          'slug_exact'::text,
          1,
          case
            when public.community_username_is_valid(
              public.community_normalize_username(
                artist.slug
              )
            )
            then public.community_normalize_username(
              artist.slug
            )
            else null
          end
        ),
        (
          'slug_seed'::text,
          2,
          case
            when public.community_username_is_valid(
              public.community_username_seed(
                artist.slug
              )
            )
            then public.community_username_seed(
              artist.slug
            )
            else null
          end
        ),
        (
          'name_seed'::text,
          3,
          case
            when public.community_username_is_valid(
              public.community_username_seed(
                artist.display_name
              )
            )
            then public.community_username_seed(
              artist.display_name
            )
            else null
          end
        )
    ) candidate(
      source,
      priority,
      username
    )
    where artist.status = 'active'
      and candidate.username is not null
  ),

  expected as (
    select
      ranked.username,
      ranked.artist_id,
      ranked.source
    from (
      select
        raw.artist_id,
        raw.username,
        raw.source,
        row_number() over (
          partition by
            raw.artist_id,
            raw.username
          order by
            raw.priority,
            raw.source
        ) as row_number
      from raw_candidates raw
    ) ranked
    where ranked.row_number = 1
      and not exists (
        select 1
        from public.user_profiles profile
        where profile.username_normalized =
              ranked.username
      )
  )

  select count(*)::integer
  into v_unexpected_extra
  from (
    select
      reservation.username,
      reservation.artist_id,
      reservation.source
    from public.community_artist_username_reservations reservation

    except

    select
      expected.username,
      expected.artist_id,
      expected.source
    from expected
  ) extra;

  if v_expected_missing <> 0
     or v_unexpected_extra <> 0
  then
    raise exception
      'FAIL: Artist reservation materialization differs from active Registry authority: missing %, extra %',
      v_expected_missing,
      v_unexpected_extra;
  end if;

  select count(*)::integer
  into v_mapping_count
  from public.community_artist_username_reservations;

  select count(distinct username)::integer
  into v_handle_count
  from public.community_artist_username_reservations;

  select count(*)::integer
  into v_ambiguous_count
  from (
    select username
    from public.community_artist_username_reservations
    group by username
    having count(distinct artist_id) > 1
  ) ambiguous;

  select count(*)::integer
  into v_user_collision_count
  from public.community_artist_username_reservations reservation
  join public.user_profiles profile
    on profile.username_normalized =
       reservation.username;

  if v_mapping_count <> 649
     or v_handle_count <> 640
     or v_ambiguous_count <> 8
     or v_user_collision_count <> 0
  then
    raise exception
      'FAIL: Accepted M1 production population changed: mappings %, handles %, ambiguous %, current user collisions %',
      v_mapping_count,
      v_handle_count,
      v_ambiguous_count,
      v_user_collision_count;
  end if;

  if not public.community_username_is_reserved(
       'dylan_s'
     )
  then
    raise exception
      'FAIL: Ambiguous Artist handle dylan_s is not protected';
  end if;

  if not public.community_username_is_reserved(
       'user'
     )
  then
    raise exception
      'FAIL: Existing platform handle reservation was lost';
  end if;

  raise notice
    'PASS: Registry Artist username protection verified: % mappings, % protected handles, % ambiguous handles, zero current-user dispossession.',
    v_mapping_count,
    v_handle_count,
    v_ambiguous_count;
end;
$verify_registry_artist_username_protection$;
