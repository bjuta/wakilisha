begin;

do $$
begin
  if to_regprocedure('public.admin_patch_registry_artist_profile_v1(uuid,jsonb,timestamp with time zone)') is not null
     or to_regprocedure('public.admin_patch_registry_track_profile_v1(uuid,jsonb,timestamp with time zone)') is not null
     or to_regprocedure('public.admin_patch_registry_release_profile_v1(uuid,jsonb,timestamp with time zone)') is not null
     or to_regprocedure('public.admin_patch_registry_label_profile_v1(uuid,jsonb,timestamp with time zone)') is not null
     or to_regprocedure('public.admin_patch_registry_genre_profile_v1(uuid,jsonb,timestamp with time zone)') is not null
     or to_regprocedure('public.admin_delete_registry_draft_artist_v1(uuid,timestamp with time zone)') is not null
  then
    raise exception 'STOP: Admin Registry profile authority V1 already exists';
  end if;
end
$$;

create function public.admin_patch_registry_artist_profile_v1(
  p_entity_id uuid,
  p_patch jsonb,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_before public.registry_artists%rowtype;
  v_after public.registry_artists%rowtype;
  v_before_payload jsonb := '{}'::jsonb;
  v_after_payload jsonb := '{}'::jsonb;
  v_next_display_name text;
  v_next_slug text;
  v_living_memory_touched boolean := false;
  v_lm_status text;
  v_lm_opener text;
  v_lm_prompt text;
  v_lm_label text;
begin
  if v_user_id is null
     or not coalesce(public.current_user_has_capability('manage_registry'), false)
  then
    raise exception using errcode='42501', message='manage_registry is required.';
  end if;

  if p_entity_id is null
     or p_expected_updated_at is null
     or p_patch is null
     or jsonb_typeof(p_patch) <> 'object'
     or p_patch = '{}'::jsonb
  then
    raise exception using errcode='22023',
      message='Artist id, non-empty patch, and expected updated_at are required.';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_patch) as keys(key)
    where key <> all (array['display_name', 'slug', 'sort_name', 'origin_iso2', 'bio', 'artist_type', 'gender', 'public_image_url', 'living_memory_editorial_opener', 'living_memory_public_prompt', 'living_memory_editorial_label', 'living_memory_status', 'status']::text[])
  ) then
    raise exception using errcode='22023',
      message='Artist profile patch contains fields outside the V1 authority.';
  end if;

  select entity.* into v_before
  from public.registry_artists entity
  where entity.id = p_entity_id
  for update;

  if not found then
    raise exception using errcode='P0002', message='Registry Artist not found.';
  end if;

  if v_before.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode='40001',
      message='Registry Artist changed after this editor loaded it.';
  end if;

  v_next_display_name := case when p_patch ? 'display_name' then nullif(btrim(p_patch->>'display_name'), '') else v_before.display_name end;
  v_next_slug := case when p_patch ? 'slug' then nullif(btrim(p_patch->>'slug'), '') else v_before.slug end;
  if nullif(btrim(coalesce(v_next_display_name,'')), '') is null or nullif(btrim(coalesce(v_next_slug,'')), '') is null then
    raise exception using errcode='22023',
      message='Artist required identity fields may not be blank.';
  end if;

  v_living_memory_touched := p_patch ?| array[
    'living_memory_editorial_opener',
    'living_memory_public_prompt',
    'living_memory_editorial_label',
    'living_memory_status'
  ];

  if v_living_memory_touched then
    v_lm_status := case when p_patch ? 'living_memory_status'
      then nullif(btrim(p_patch->>'living_memory_status'), '')
      else v_before.living_memory_status end;
    v_lm_opener := case when p_patch ? 'living_memory_editorial_opener'
      then nullif(btrim(p_patch->>'living_memory_editorial_opener'), '')
      else v_before.living_memory_editorial_opener end;
    v_lm_prompt := case when p_patch ? 'living_memory_public_prompt'
      then nullif(btrim(p_patch->>'living_memory_public_prompt'), '')
      else v_before.living_memory_public_prompt end;
    v_lm_label := case when p_patch ? 'living_memory_editorial_label'
      then nullif(btrim(p_patch->>'living_memory_editorial_label'), '')
      else v_before.living_memory_editorial_label end;

    if v_lm_status = 'published'
       and (v_lm_opener is null or v_lm_prompt is null or v_lm_label is null)
    then
      raise exception using errcode='22023',
        message='Published Living Memory requires an editorial opener, public prompt, and editorial disclosure.';
    end if;
  end if;

  select coalesce(jsonb_object_agg(key, to_jsonb(v_before)->key), '{}'::jsonb)
  into v_before_payload
  from jsonb_object_keys(p_patch) as keys(key);

  update public.registry_artists
  set
    display_name = case when p_patch ? 'display_name' then nullif(btrim(p_patch->>'display_name'), '') else v_before.display_name end,
    slug = case when p_patch ? 'slug' then nullif(btrim(p_patch->>'slug'), '') else v_before.slug end,
    sort_name = case when p_patch ? 'sort_name' then nullif(btrim(p_patch->>'sort_name'), '') else v_before.sort_name end,
    origin_iso2 = case when p_patch ? 'origin_iso2' then nullif(btrim(p_patch->>'origin_iso2'), '') else v_before.origin_iso2 end,
    bio = case when p_patch ? 'bio' then nullif(btrim(p_patch->>'bio'), '') else v_before.bio end,
    artist_type = case when p_patch ? 'artist_type' then nullif(btrim(p_patch->>'artist_type'), '') else v_before.artist_type end,
    gender = case when p_patch ? 'gender' then nullif(btrim(p_patch->>'gender'), '') else v_before.gender end,
    public_image_url = case when p_patch ? 'public_image_url' then nullif(btrim(p_patch->>'public_image_url'), '') else v_before.public_image_url end,
    living_memory_editorial_opener = case when p_patch ? 'living_memory_editorial_opener' then nullif(btrim(p_patch->>'living_memory_editorial_opener'), '') else v_before.living_memory_editorial_opener end,
    living_memory_public_prompt = case when p_patch ? 'living_memory_public_prompt' then nullif(btrim(p_patch->>'living_memory_public_prompt'), '') else v_before.living_memory_public_prompt end,
    living_memory_editorial_label = case when p_patch ? 'living_memory_editorial_label' then nullif(btrim(p_patch->>'living_memory_editorial_label'), '') else v_before.living_memory_editorial_label end,
    living_memory_status = case when p_patch ? 'living_memory_status' then nullif(btrim(p_patch->>'living_memory_status'), '') else v_before.living_memory_status end,
    status = case when p_patch ? 'status' then nullif(btrim(p_patch->>'status'), '') else v_before.status end,
    living_memory_updated_at = case when v_living_memory_touched then now() else v_before.living_memory_updated_at end,
    updated_at = now()
  where id = p_entity_id
  returning * into v_after;

  select coalesce(jsonb_object_agg(key, to_jsonb(v_after)->key), '{}'::jsonb)
  into v_after_payload
  from jsonb_object_keys(p_patch) as keys(key);

  insert into public.registry_audit_log (
    actor_id, actor_label, action, entity_type, entity_id,
    before_value, after_value, metadata
  ) values (
    v_user_id, 'registry_admin', 'update', 'artist', p_entity_id,
    v_before_payload, v_after_payload,
    jsonb_build_object(
      'authority', 'admin_patch_registry_artist_profile_v1',
      'expected_updated_at', p_expected_updated_at,
      'changed_fields', (select jsonb_agg(key order by key) from jsonb_object_keys(p_patch) as keys(key))
    )
  );

  insert into public.registry_canonical_write_events (
    registry_entity_type, registry_entity_id, source_suggestion_id, source_table,
    field_name, target_path, before_value, after_value, action, status, actor
  ) values (
    'artist', p_entity_id::text, null,
    'public.admin_patch_registry_artist_profile_v1',
    'profile_fields', 'public.registry_artists',
    jsonb_build_object('value', v_before_payload),
    jsonb_build_object('value', v_after_payload),
    'admin_patch_artist_profile', 'succeeded',
    'user:' || v_user_id::text
  );

  return to_jsonb(v_after);
end
$$;

revoke all on function public.admin_patch_registry_artist_profile_v1(uuid,jsonb,timestamptz)
from public, anon, service_role;
grant execute on function public.admin_patch_registry_artist_profile_v1(uuid,jsonb,timestamptz)
to authenticated;

create function public.admin_patch_registry_track_profile_v1(
  p_entity_id uuid,
  p_patch jsonb,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_before public.registry_tracks%rowtype;
  v_after public.registry_tracks%rowtype;
  v_before_payload jsonb := '{}'::jsonb;
  v_after_payload jsonb := '{}'::jsonb;
  v_next_title text;
  v_next_slug text;
  v_living_memory_touched boolean := false;
  v_lm_status text;
  v_lm_opener text;
  v_lm_prompt text;
  v_lm_label text;
begin
  if v_user_id is null
     or not coalesce(public.current_user_has_capability('manage_registry'), false)
  then
    raise exception using errcode='42501', message='manage_registry is required.';
  end if;

  if p_entity_id is null
     or p_expected_updated_at is null
     or p_patch is null
     or jsonb_typeof(p_patch) <> 'object'
     or p_patch = '{}'::jsonb
  then
    raise exception using errcode='22023',
      message='Track id, non-empty patch, and expected updated_at are required.';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_patch) as keys(key)
    where key <> all (array['title', 'slug', 'isrc', 'duration_ms', 'artwork_url', 'preview_url', 'explicit', 'track_number', 'disc_number', 'living_memory_editorial_opener', 'living_memory_public_prompt', 'living_memory_editorial_label', 'living_memory_status', 'status']::text[])
  ) then
    raise exception using errcode='22023',
      message='Track profile patch contains fields outside the V1 authority.';
  end if;

  select entity.* into v_before
  from public.registry_tracks entity
  where entity.id = p_entity_id
  for update;

  if not found then
    raise exception using errcode='P0002', message='Registry Track not found.';
  end if;

  if v_before.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode='40001',
      message='Registry Track changed after this editor loaded it.';
  end if;

  v_next_title := case when p_patch ? 'title' then nullif(btrim(p_patch->>'title'), '') else v_before.title end;
  v_next_slug := case when p_patch ? 'slug' then nullif(btrim(p_patch->>'slug'), '') else v_before.slug end;
  if nullif(btrim(coalesce(v_next_title,'')), '') is null or nullif(btrim(coalesce(v_next_slug,'')), '') is null then
    raise exception using errcode='22023',
      message='Track required identity fields may not be blank.';
  end if;

  v_living_memory_touched := p_patch ?| array[
    'living_memory_editorial_opener',
    'living_memory_public_prompt',
    'living_memory_editorial_label',
    'living_memory_status'
  ];

  if v_living_memory_touched then
    v_lm_status := case when p_patch ? 'living_memory_status'
      then nullif(btrim(p_patch->>'living_memory_status'), '')
      else v_before.living_memory_status end;
    v_lm_opener := case when p_patch ? 'living_memory_editorial_opener'
      then nullif(btrim(p_patch->>'living_memory_editorial_opener'), '')
      else v_before.living_memory_editorial_opener end;
    v_lm_prompt := case when p_patch ? 'living_memory_public_prompt'
      then nullif(btrim(p_patch->>'living_memory_public_prompt'), '')
      else v_before.living_memory_public_prompt end;
    v_lm_label := case when p_patch ? 'living_memory_editorial_label'
      then nullif(btrim(p_patch->>'living_memory_editorial_label'), '')
      else v_before.living_memory_editorial_label end;

    if v_lm_status = 'published'
       and (v_lm_opener is null or v_lm_prompt is null or v_lm_label is null)
    then
      raise exception using errcode='22023',
        message='Published Living Memory requires an editorial opener, public prompt, and editorial disclosure.';
    end if;
  end if;

  select coalesce(jsonb_object_agg(key, to_jsonb(v_before)->key), '{}'::jsonb)
  into v_before_payload
  from jsonb_object_keys(p_patch) as keys(key);

  update public.registry_tracks
  set
    title = case when p_patch ? 'title' then nullif(btrim(p_patch->>'title'), '') else v_before.title end,
    slug = case when p_patch ? 'slug' then nullif(btrim(p_patch->>'slug'), '') else v_before.slug end,
    isrc = case when p_patch ? 'isrc' then nullif(btrim(p_patch->>'isrc'), '') else v_before.isrc end,
    duration_ms = case when p_patch ? 'duration_ms' then nullif(p_patch->>'duration_ms','')::integer else v_before.duration_ms end,
    artwork_url = case when p_patch ? 'artwork_url' then nullif(btrim(p_patch->>'artwork_url'), '') else v_before.artwork_url end,
    preview_url = case when p_patch ? 'preview_url' then nullif(btrim(p_patch->>'preview_url'), '') else v_before.preview_url end,
    explicit = case when p_patch ? 'explicit' then nullif(p_patch->>'explicit','')::boolean else v_before.explicit end,
    track_number = case when p_patch ? 'track_number' then nullif(p_patch->>'track_number','')::integer else v_before.track_number end,
    disc_number = case when p_patch ? 'disc_number' then nullif(p_patch->>'disc_number','')::integer else v_before.disc_number end,
    living_memory_editorial_opener = case when p_patch ? 'living_memory_editorial_opener' then nullif(btrim(p_patch->>'living_memory_editorial_opener'), '') else v_before.living_memory_editorial_opener end,
    living_memory_public_prompt = case when p_patch ? 'living_memory_public_prompt' then nullif(btrim(p_patch->>'living_memory_public_prompt'), '') else v_before.living_memory_public_prompt end,
    living_memory_editorial_label = case when p_patch ? 'living_memory_editorial_label' then nullif(btrim(p_patch->>'living_memory_editorial_label'), '') else v_before.living_memory_editorial_label end,
    living_memory_status = case when p_patch ? 'living_memory_status' then nullif(btrim(p_patch->>'living_memory_status'), '') else v_before.living_memory_status end,
    status = case when p_patch ? 'status' then nullif(btrim(p_patch->>'status'), '') else v_before.status end,
    living_memory_updated_at = case when v_living_memory_touched then now() else v_before.living_memory_updated_at end,
    updated_at = now()
  where id = p_entity_id
  returning * into v_after;

  select coalesce(jsonb_object_agg(key, to_jsonb(v_after)->key), '{}'::jsonb)
  into v_after_payload
  from jsonb_object_keys(p_patch) as keys(key);

  insert into public.registry_audit_log (
    actor_id, actor_label, action, entity_type, entity_id,
    before_value, after_value, metadata
  ) values (
    v_user_id, 'registry_admin', 'update', 'track', p_entity_id,
    v_before_payload, v_after_payload,
    jsonb_build_object(
      'authority', 'admin_patch_registry_track_profile_v1',
      'expected_updated_at', p_expected_updated_at,
      'changed_fields', (select jsonb_agg(key order by key) from jsonb_object_keys(p_patch) as keys(key))
    )
  );

  insert into public.registry_canonical_write_events (
    registry_entity_type, registry_entity_id, source_suggestion_id, source_table,
    field_name, target_path, before_value, after_value, action, status, actor
  ) values (
    'track', p_entity_id::text, null,
    'public.admin_patch_registry_track_profile_v1',
    'profile_fields', 'public.registry_tracks',
    jsonb_build_object('value', v_before_payload),
    jsonb_build_object('value', v_after_payload),
    'admin_patch_track_profile', 'succeeded',
    'user:' || v_user_id::text
  );

  return to_jsonb(v_after);
end
$$;

revoke all on function public.admin_patch_registry_track_profile_v1(uuid,jsonb,timestamptz)
from public, anon, service_role;
grant execute on function public.admin_patch_registry_track_profile_v1(uuid,jsonb,timestamptz)
to authenticated;

create function public.admin_patch_registry_release_profile_v1(
  p_entity_id uuid,
  p_patch jsonb,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_before public.registry_releases%rowtype;
  v_after public.registry_releases%rowtype;
  v_before_payload jsonb := '{}'::jsonb;
  v_after_payload jsonb := '{}'::jsonb;
  v_next_title text;
  v_next_slug text;
  v_living_memory_touched boolean := false;
  v_lm_status text;
  v_lm_opener text;
  v_lm_prompt text;
  v_lm_label text;
begin
  if v_user_id is null
     or not coalesce(public.current_user_has_capability('manage_registry'), false)
  then
    raise exception using errcode='42501', message='manage_registry is required.';
  end if;

  if p_entity_id is null
     or p_expected_updated_at is null
     or p_patch is null
     or jsonb_typeof(p_patch) <> 'object'
     or p_patch = '{}'::jsonb
  then
    raise exception using errcode='22023',
      message='Release id, non-empty patch, and expected updated_at are required.';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_patch) as keys(key)
    where key <> all (array['title', 'slug', 'release_type', 'release_date', 'upc', 'artwork_url', 'description', 'living_memory_editorial_opener', 'living_memory_public_prompt', 'living_memory_editorial_label', 'living_memory_status', 'status']::text[])
  ) then
    raise exception using errcode='22023',
      message='Release profile patch contains fields outside the V1 authority.';
  end if;

  select entity.* into v_before
  from public.registry_releases entity
  where entity.id = p_entity_id
  for update;

  if not found then
    raise exception using errcode='P0002', message='Registry Release not found.';
  end if;

  if v_before.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode='40001',
      message='Registry Release changed after this editor loaded it.';
  end if;

  v_next_title := case when p_patch ? 'title' then nullif(btrim(p_patch->>'title'), '') else v_before.title end;
  v_next_slug := case when p_patch ? 'slug' then nullif(btrim(p_patch->>'slug'), '') else v_before.slug end;
  if nullif(btrim(coalesce(v_next_title,'')), '') is null or nullif(btrim(coalesce(v_next_slug,'')), '') is null then
    raise exception using errcode='22023',
      message='Release required identity fields may not be blank.';
  end if;

  v_living_memory_touched := p_patch ?| array[
    'living_memory_editorial_opener',
    'living_memory_public_prompt',
    'living_memory_editorial_label',
    'living_memory_status'
  ];

  if v_living_memory_touched then
    v_lm_status := case when p_patch ? 'living_memory_status'
      then nullif(btrim(p_patch->>'living_memory_status'), '')
      else v_before.living_memory_status end;
    v_lm_opener := case when p_patch ? 'living_memory_editorial_opener'
      then nullif(btrim(p_patch->>'living_memory_editorial_opener'), '')
      else v_before.living_memory_editorial_opener end;
    v_lm_prompt := case when p_patch ? 'living_memory_public_prompt'
      then nullif(btrim(p_patch->>'living_memory_public_prompt'), '')
      else v_before.living_memory_public_prompt end;
    v_lm_label := case when p_patch ? 'living_memory_editorial_label'
      then nullif(btrim(p_patch->>'living_memory_editorial_label'), '')
      else v_before.living_memory_editorial_label end;

    if v_lm_status = 'published'
       and (v_lm_opener is null or v_lm_prompt is null or v_lm_label is null)
    then
      raise exception using errcode='22023',
        message='Published Living Memory requires an editorial opener, public prompt, and editorial disclosure.';
    end if;
  end if;

  select coalesce(jsonb_object_agg(key, to_jsonb(v_before)->key), '{}'::jsonb)
  into v_before_payload
  from jsonb_object_keys(p_patch) as keys(key);

  update public.registry_releases
  set
    title = case when p_patch ? 'title' then nullif(btrim(p_patch->>'title'), '') else v_before.title end,
    slug = case when p_patch ? 'slug' then nullif(btrim(p_patch->>'slug'), '') else v_before.slug end,
    release_type = case when p_patch ? 'release_type' then nullif(btrim(p_patch->>'release_type'), '') else v_before.release_type end,
    release_date = case when p_patch ? 'release_date' then nullif(p_patch->>'release_date','')::date else v_before.release_date end,
    upc = case when p_patch ? 'upc' then nullif(btrim(p_patch->>'upc'), '') else v_before.upc end,
    artwork_url = case when p_patch ? 'artwork_url' then nullif(btrim(p_patch->>'artwork_url'), '') else v_before.artwork_url end,
    description = case when p_patch ? 'description' then nullif(btrim(p_patch->>'description'), '') else v_before.description end,
    living_memory_editorial_opener = case when p_patch ? 'living_memory_editorial_opener' then nullif(btrim(p_patch->>'living_memory_editorial_opener'), '') else v_before.living_memory_editorial_opener end,
    living_memory_public_prompt = case when p_patch ? 'living_memory_public_prompt' then nullif(btrim(p_patch->>'living_memory_public_prompt'), '') else v_before.living_memory_public_prompt end,
    living_memory_editorial_label = case when p_patch ? 'living_memory_editorial_label' then nullif(btrim(p_patch->>'living_memory_editorial_label'), '') else v_before.living_memory_editorial_label end,
    living_memory_status = case when p_patch ? 'living_memory_status' then nullif(btrim(p_patch->>'living_memory_status'), '') else v_before.living_memory_status end,
    status = case when p_patch ? 'status' then nullif(btrim(p_patch->>'status'), '') else v_before.status end,
    living_memory_updated_at = case when v_living_memory_touched then now() else v_before.living_memory_updated_at end,
    updated_at = now()
  where id = p_entity_id
  returning * into v_after;

  select coalesce(jsonb_object_agg(key, to_jsonb(v_after)->key), '{}'::jsonb)
  into v_after_payload
  from jsonb_object_keys(p_patch) as keys(key);

  insert into public.registry_audit_log (
    actor_id, actor_label, action, entity_type, entity_id,
    before_value, after_value, metadata
  ) values (
    v_user_id, 'registry_admin', 'update', 'release', p_entity_id,
    v_before_payload, v_after_payload,
    jsonb_build_object(
      'authority', 'admin_patch_registry_release_profile_v1',
      'expected_updated_at', p_expected_updated_at,
      'changed_fields', (select jsonb_agg(key order by key) from jsonb_object_keys(p_patch) as keys(key))
    )
  );

  insert into public.registry_canonical_write_events (
    registry_entity_type, registry_entity_id, source_suggestion_id, source_table,
    field_name, target_path, before_value, after_value, action, status, actor
  ) values (
    'release', p_entity_id::text, null,
    'public.admin_patch_registry_release_profile_v1',
    'profile_fields', 'public.registry_releases',
    jsonb_build_object('value', v_before_payload),
    jsonb_build_object('value', v_after_payload),
    'admin_patch_release_profile', 'succeeded',
    'user:' || v_user_id::text
  );

  return to_jsonb(v_after);
end
$$;

revoke all on function public.admin_patch_registry_release_profile_v1(uuid,jsonb,timestamptz)
from public, anon, service_role;
grant execute on function public.admin_patch_registry_release_profile_v1(uuid,jsonb,timestamptz)
to authenticated;

create function public.admin_patch_registry_label_profile_v1(
  p_entity_id uuid,
  p_patch jsonb,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_before public.registry_labels%rowtype;
  v_after public.registry_labels%rowtype;
  v_before_payload jsonb := '{}'::jsonb;
  v_after_payload jsonb := '{}'::jsonb;
  v_next_name text;
  v_next_slug text;
begin
  if v_user_id is null
     or not coalesce(public.current_user_has_capability('manage_registry'), false)
  then
    raise exception using errcode='42501', message='manage_registry is required.';
  end if;

  if p_entity_id is null
     or p_expected_updated_at is null
     or p_patch is null
     or jsonb_typeof(p_patch) <> 'object'
     or p_patch = '{}'::jsonb
  then
    raise exception using errcode='22023',
      message='Label id, non-empty patch, and expected updated_at are required.';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_patch) as keys(key)
    where key <> all (array['name', 'slug', 'country_code', 'description', 'status']::text[])
  ) then
    raise exception using errcode='22023',
      message='Label profile patch contains fields outside the V1 authority.';
  end if;

  select entity.* into v_before
  from public.registry_labels entity
  where entity.id = p_entity_id
  for update;

  if not found then
    raise exception using errcode='P0002', message='Registry Label not found.';
  end if;

  if v_before.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode='40001',
      message='Registry Label changed after this editor loaded it.';
  end if;

  v_next_name := case when p_patch ? 'name' then nullif(btrim(p_patch->>'name'), '') else v_before.name end;
  v_next_slug := case when p_patch ? 'slug' then nullif(btrim(p_patch->>'slug'), '') else v_before.slug end;
  if nullif(btrim(coalesce(v_next_name,'')), '') is null or nullif(btrim(coalesce(v_next_slug,'')), '') is null then
    raise exception using errcode='22023',
      message='Label required identity fields may not be blank.';
  end if;

  select coalesce(jsonb_object_agg(key, to_jsonb(v_before)->key), '{}'::jsonb)
  into v_before_payload
  from jsonb_object_keys(p_patch) as keys(key);

  update public.registry_labels
  set
    name = case when p_patch ? 'name' then nullif(btrim(p_patch->>'name'), '') else v_before.name end,
    slug = case when p_patch ? 'slug' then nullif(btrim(p_patch->>'slug'), '') else v_before.slug end,
    country_code = case when p_patch ? 'country_code' then nullif(btrim(p_patch->>'country_code'), '') else v_before.country_code end,
    description = case when p_patch ? 'description' then nullif(btrim(p_patch->>'description'), '') else v_before.description end,
    status = case when p_patch ? 'status' then nullif(btrim(p_patch->>'status'), '') else v_before.status end,
    updated_at = now()
  where id = p_entity_id
  returning * into v_after;

  select coalesce(jsonb_object_agg(key, to_jsonb(v_after)->key), '{}'::jsonb)
  into v_after_payload
  from jsonb_object_keys(p_patch) as keys(key);

  insert into public.registry_audit_log (
    actor_id, actor_label, action, entity_type, entity_id,
    before_value, after_value, metadata
  ) values (
    v_user_id, 'registry_admin', 'update', 'label', p_entity_id,
    v_before_payload, v_after_payload,
    jsonb_build_object(
      'authority', 'admin_patch_registry_label_profile_v1',
      'expected_updated_at', p_expected_updated_at,
      'changed_fields', (select jsonb_agg(key order by key) from jsonb_object_keys(p_patch) as keys(key))
    )
  );

  insert into public.registry_canonical_write_events (
    registry_entity_type, registry_entity_id, source_suggestion_id, source_table,
    field_name, target_path, before_value, after_value, action, status, actor
  ) values (
    'label', p_entity_id::text, null,
    'public.admin_patch_registry_label_profile_v1',
    'profile_fields', 'public.registry_labels',
    jsonb_build_object('value', v_before_payload),
    jsonb_build_object('value', v_after_payload),
    'admin_patch_label_profile', 'succeeded',
    'user:' || v_user_id::text
  );

  return to_jsonb(v_after);
end
$$;

revoke all on function public.admin_patch_registry_label_profile_v1(uuid,jsonb,timestamptz)
from public, anon, service_role;
grant execute on function public.admin_patch_registry_label_profile_v1(uuid,jsonb,timestamptz)
to authenticated;

create function public.admin_patch_registry_genre_profile_v1(
  p_entity_id uuid,
  p_patch jsonb,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_before public.registry_genres%rowtype;
  v_after public.registry_genres%rowtype;
  v_before_payload jsonb := '{}'::jsonb;
  v_after_payload jsonb := '{}'::jsonb;
  v_next_name text;
  v_next_slug text;
begin
  if v_user_id is null
     or not coalesce(public.current_user_has_capability('manage_registry'), false)
  then
    raise exception using errcode='42501', message='manage_registry is required.';
  end if;

  if p_entity_id is null
     or p_expected_updated_at is null
     or p_patch is null
     or jsonb_typeof(p_patch) <> 'object'
     or p_patch = '{}'::jsonb
  then
    raise exception using errcode='22023',
      message='Genre id, non-empty patch, and expected updated_at are required.';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_patch) as keys(key)
    where key <> all (array['name', 'slug', 'description', 'status']::text[])
  ) then
    raise exception using errcode='22023',
      message='Genre profile patch contains fields outside the V1 authority.';
  end if;

  select entity.* into v_before
  from public.registry_genres entity
  where entity.id = p_entity_id
  for update;

  if not found then
    raise exception using errcode='P0002', message='Registry Genre not found.';
  end if;

  if v_before.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode='40001',
      message='Registry Genre changed after this editor loaded it.';
  end if;

  v_next_name := case when p_patch ? 'name' then nullif(btrim(p_patch->>'name'), '') else v_before.name end;
  v_next_slug := case when p_patch ? 'slug' then nullif(btrim(p_patch->>'slug'), '') else v_before.slug end;
  if nullif(btrim(coalesce(v_next_name,'')), '') is null or nullif(btrim(coalesce(v_next_slug,'')), '') is null then
    raise exception using errcode='22023',
      message='Genre required identity fields may not be blank.';
  end if;

  select coalesce(jsonb_object_agg(key, to_jsonb(v_before)->key), '{}'::jsonb)
  into v_before_payload
  from jsonb_object_keys(p_patch) as keys(key);

  update public.registry_genres
  set
    name = case when p_patch ? 'name' then nullif(btrim(p_patch->>'name'), '') else v_before.name end,
    slug = case when p_patch ? 'slug' then nullif(btrim(p_patch->>'slug'), '') else v_before.slug end,
    description = case when p_patch ? 'description' then nullif(btrim(p_patch->>'description'), '') else v_before.description end,
    status = case when p_patch ? 'status' then nullif(btrim(p_patch->>'status'), '') else v_before.status end,
    updated_at = now()
  where id = p_entity_id
  returning * into v_after;

  select coalesce(jsonb_object_agg(key, to_jsonb(v_after)->key), '{}'::jsonb)
  into v_after_payload
  from jsonb_object_keys(p_patch) as keys(key);

  insert into public.registry_audit_log (
    actor_id, actor_label, action, entity_type, entity_id,
    before_value, after_value, metadata
  ) values (
    v_user_id, 'registry_admin', 'update', 'genre', p_entity_id,
    v_before_payload, v_after_payload,
    jsonb_build_object(
      'authority', 'admin_patch_registry_genre_profile_v1',
      'expected_updated_at', p_expected_updated_at,
      'changed_fields', (select jsonb_agg(key order by key) from jsonb_object_keys(p_patch) as keys(key))
    )
  );

  insert into public.registry_canonical_write_events (
    registry_entity_type, registry_entity_id, source_suggestion_id, source_table,
    field_name, target_path, before_value, after_value, action, status, actor
  ) values (
    'genre', p_entity_id::text, null,
    'public.admin_patch_registry_genre_profile_v1',
    'profile_fields', 'public.registry_genres',
    jsonb_build_object('value', v_before_payload),
    jsonb_build_object('value', v_after_payload),
    'admin_patch_genre_profile', 'succeeded',
    'user:' || v_user_id::text
  );

  return to_jsonb(v_after);
end
$$;

revoke all on function public.admin_patch_registry_genre_profile_v1(uuid,jsonb,timestamptz)
from public, anon, service_role;
grant execute on function public.admin_patch_registry_genre_profile_v1(uuid,jsonb,timestamptz)
to authenticated;

create function public.admin_delete_registry_draft_artist_v1(
  p_artist_id uuid,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_before public.registry_artists%rowtype;
  v_before_payload jsonb;
begin
  if v_user_id is null
     or not coalesce(public.current_user_has_capability('manage_registry'), false)
  then
    raise exception using errcode='42501', message='manage_registry is required.';
  end if;

  if p_artist_id is null or p_expected_updated_at is null then
    raise exception using errcode='22023',
      message='Artist id and expected updated_at are required.';
  end if;

  select artist.* into v_before
  from public.registry_artists artist
  where artist.id = p_artist_id
  for update;

  if not found then
    raise exception using errcode='P0002', message='Registry Artist not found.';
  end if;

  if v_before.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode='40001',
      message='Registry Artist changed after this editor loaded it.';
  end if;

  if v_before.status <> 'draft' then
    raise exception using errcode='22023',
      message='Only draft Registry Artists can be deleted.';
  end if;

  v_before_payload := jsonb_build_object(
    'id', v_before.id,
    'display_name', v_before.display_name,
    'slug', v_before.slug,
    'status', v_before.status
  );

  delete from public.registry_artists where id = p_artist_id;

  insert into public.registry_audit_log (
    actor_id, actor_label, action, entity_type, entity_id,
    before_value, after_value, metadata
  ) values (
    v_user_id, 'registry_admin', 'delete', 'artist', p_artist_id,
    v_before_payload, jsonb_build_object('deleted', true),
    jsonb_build_object(
      'authority', 'admin_delete_registry_draft_artist_v1',
      'expected_updated_at', p_expected_updated_at
    )
  );

  insert into public.registry_canonical_write_events (
    registry_entity_type, registry_entity_id, source_suggestion_id, source_table,
    field_name, target_path, before_value, after_value, action, status, actor
  ) values (
    'artist', p_artist_id::text, null,
    'public.admin_delete_registry_draft_artist_v1',
    'entity', 'public.registry_artists',
    jsonb_build_object('value', v_before_payload),
    jsonb_build_object('value', jsonb_build_object('deleted', true)),
    'admin_delete_draft_artist', 'succeeded',
    'user:' || v_user_id::text
  );

  return jsonb_build_object(
    'entity_type', 'artist',
    'entity_id', p_artist_id,
    'deleted', true
  );
end
$$;

revoke all on function public.admin_delete_registry_draft_artist_v1(uuid,timestamptz)
from public, anon, service_role;
grant execute on function public.admin_delete_registry_draft_artist_v1(uuid,timestamptz)
to authenticated;

commit;
