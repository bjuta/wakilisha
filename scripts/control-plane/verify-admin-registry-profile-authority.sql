do $$
declare
  v_signature text;
  v_definition text;
begin
  foreach v_signature in array array[
    'public.admin_patch_registry_artist_profile_v1(uuid,jsonb,timestamp with time zone)',
    'public.admin_patch_registry_track_profile_v1(uuid,jsonb,timestamp with time zone)',
    'public.admin_patch_registry_release_profile_v1(uuid,jsonb,timestamp with time zone)',
    'public.admin_patch_registry_label_profile_v1(uuid,jsonb,timestamp with time zone)',
    'public.admin_patch_registry_genre_profile_v1(uuid,jsonb,timestamp with time zone)'
  ]
  loop
    if to_regprocedure(v_signature) is null then
      raise exception 'FAIL: missing Admin Registry authority %', v_signature;
    end if;

    if not has_function_privilege('authenticated', v_signature, 'EXECUTE') then
      raise exception 'FAIL: authenticated cannot execute %', v_signature;
    end if;

    if has_function_privilege('anon', v_signature, 'EXECUTE')
       or has_function_privilege('service_role', v_signature, 'EXECUTE')
    then
      raise exception 'FAIL: non-caller execution privilege drifted for %', v_signature;
    end if;

    select pg_get_functiondef(to_regprocedure(v_signature))
    into v_definition;

    if position('auth.uid()' in v_definition) = 0
       or position('current_user_has_capability(''manage_registry'')' in v_definition) = 0
       or position('p_expected_updated_at' in v_definition) = 0
       or position('registry_audit_log' in v_definition) = 0
       or position('registry_canonical_write_events' in v_definition) = 0
    then
      raise exception 'FAIL: bounded Admin Registry authority contract drifted for %', v_signature;
    end if;
  end loop;

  foreach v_signature in array array[
    'public.admin_patch_registry_artist_profile_v1(uuid,jsonb,timestamp with time zone)',
    'public.admin_patch_registry_track_profile_v1(uuid,jsonb,timestamp with time zone)',
    'public.admin_patch_registry_release_profile_v1(uuid,jsonb,timestamp with time zone)',
    'public.admin_patch_registry_label_profile_v1(uuid,jsonb,timestamp with time zone)',
    'public.admin_patch_registry_genre_profile_v1(uuid,jsonb,timestamp with time zone)',
    'public.admin_patch_registry_release_detail_v1(uuid,text,text,text,date,text,uuid,text,text,text,timestamp with time zone)',
    'public.admin_archive_registry_music_entity_v1(text,uuid,timestamp with time zone)'
  ]
  loop
    select pg_get_functiondef(to_regprocedure(v_signature))
    into v_definition;

    if position('40001' in v_definition) <> 0
       or position('WK_STALE_UPDATE' in v_definition) = 0
    then
      raise exception 'FAIL: Registry admin stale-conflict transport contract drifted for %', v_signature;
    end if;
  end loop;

  select pg_get_functiondef(
    'public.admin_patch_registry_artist_profile_v1(uuid,jsonb,timestamp with time zone)'::regprocedure
  ) into v_definition;
  if position('update public.registry_artists' in lower(v_definition)) = 0
     or position('display_name' in v_definition) = 0
     or position('living_memory_status' in v_definition) = 0
  then
    raise exception 'FAIL: Artist profile authority lost its exact target or field family';
  end if;

  select pg_get_functiondef(
    'public.admin_patch_registry_track_profile_v1(uuid,jsonb,timestamp with time zone)'::regprocedure
  ) into v_definition;
  if position('update public.registry_tracks' in lower(v_definition)) = 0
     or position('isrc' in v_definition) = 0
     or position('duration_ms' in v_definition) = 0
  then
    raise exception 'FAIL: Track profile authority lost its exact target or field family';
  end if;

  select pg_get_functiondef(
    'public.admin_patch_registry_release_profile_v1(uuid,jsonb,timestamp with time zone)'::regprocedure
  ) into v_definition;
  if position('update public.registry_releases' in lower(v_definition)) = 0
     or position('release_type' in v_definition) = 0
     or position('living_memory_status' in v_definition) = 0
  then
    raise exception 'FAIL: Release profile authority lost its exact target or drawer field family';
  end if;

  select pg_get_functiondef(
    'public.admin_patch_registry_label_profile_v1(uuid,jsonb,timestamp with time zone)'::regprocedure
  ) into v_definition;
  if position('update public.registry_labels' in lower(v_definition)) = 0
     or position('country_code' in v_definition) = 0
  then
    raise exception 'FAIL: Label profile authority lost its exact target or field family';
  end if;

  select pg_get_functiondef(
    'public.admin_patch_registry_genre_profile_v1(uuid,jsonb,timestamp with time zone)'::regprocedure
  ) into v_definition;
  if position('update public.registry_genres' in lower(v_definition)) = 0
     or position('description' in v_definition) = 0
  then
    raise exception 'FAIL: Genre profile authority lost its exact target or field family';
  end if;

  if has_table_privilege('authenticated','public.registry_labels','INSERT')
     or has_table_privilege('authenticated','public.registry_labels','UPDATE')
     or has_table_privilege('authenticated','public.registry_labels','DELETE')
     or has_table_privilege('authenticated','public.registry_genres','INSERT')
     or has_table_privilege('authenticated','public.registry_genres','UPDATE')
     or has_table_privilege('authenticated','public.registry_genres','DELETE')
  then
    raise exception
      'FAIL: Label/Genre browser canonical DML road reopened outside bounded profile commands';
  end if;

  if to_regprocedure(
    'public.admin_delete_registry_draft_artist_v1(uuid,timestamp with time zone)'
  ) is not null then
    raise exception 'FAIL: draft Artist hard-delete authority must remain retired';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid='public.registry_artists'::regclass
      and tgname='registry_artists_resource_identity_sync'
      and not tgisinternal
  ) then
    raise exception 'FAIL: Registry Artist Resource lifecycle synchronization trigger is missing';
  end if;
end
$$;

select 'ADMIN_REGISTRY_PROFILE_AUTHORITY_PASS' as result;
