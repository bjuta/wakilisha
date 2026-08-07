begin;

do $phase_4b_m3_adoption_url_preflight$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.adopt_verified_media_upload_session_v1(uuid,text,text,uuid,uuid)'::regprocedure
  )
  into v_definition;

  if v_definition is null then
    raise exception
      'STOP: M3 adoption function is missing before migration 205';
  end if;

  if position(
       E'v_title,\n    null,\n    v_session.mime_type'
       in v_definition
     ) = 0
  then
    raise exception
      'STOP: M3 adoption compatibility URL defect no longer matches migration 205 preflight';
  end if;

  if position(
       '__private/media-asset/'
       in v_definition
     ) > 0
  then
    raise exception
      'STOP: M3 adoption compatibility identity URL is already live';
  end if;

  if (
    select is_nullable
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'registry_media_assets'
      and column_name = 'url'
  ) <> 'NO'
  then
    raise exception
      'STOP: registry_media_assets.url nullability changed before migration 205';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'registry_media_assets'
      and indexname = 'registry_media_assets_url_unique_idx'
  ) then
    raise exception
      'STOP: registry_media_assets URL uniqueness authority is missing';
  end if;
end;
$phase_4b_m3_adoption_url_preflight$;


create or replace function public.adopt_verified_media_upload_session_v1(
  p_session_id uuid,
  p_title text default null,
  p_asset_purpose text default 'general',
  p_folder_id uuid default null,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, media, auth
as $function$
declare
  v_actor_id uuid;
  v_session media.upload_sessions%rowtype;
  v_file media.file_objects%rowtype;
  v_asset record;
  v_revision record;
  v_existing_asset media.assets%rowtype;
  v_existing_revision media.asset_revisions%rowtype;
  v_asset_kind text;
  v_title text;
  v_slug text;
  v_extension text;
  v_correlation_id uuid := coalesce(
    p_correlation_id,
    gen_random_uuid()
  );
  v_compatibility jsonb;
begin
  v_actor_id :=
    media.require_command_actor('manage_media_assets');

  select session_row.*
  into v_session
  from media.upload_sessions session_row
  where session_row.id = p_session_id
  for update;

  if not found then
    raise exception 'Upload session does not exist';
  end if;

  if v_session.actor_id <> v_actor_id then
    raise exception 'Upload session belongs to another actor';
  end if;

  if v_session.state <> 'verified'
     or v_session.file_object_id is null
  then
    raise exception 'Only a verified upload session may be adopted';
  end if;

  select file_row.*
  into v_file
  from media.file_objects file_row
  where file_row.id = v_session.file_object_id;

  if not found
     or v_file.verification_state <> 'verified'
     or v_file.storage_provider <> 'lightsail_media'
  then
    raise exception
      'Verified upload session is missing its canonical file object';
  end if;

  if v_session.mime_type like 'audio/%'
     and v_session.storage_path like 'masters/audio/%'
  then
    v_asset_kind := 'audio';
  elsif v_session.mime_type like 'video/%'
        and v_session.storage_path like 'masters/video/%'
  then
    v_asset_kind := 'video';
  else
    raise exception
      'Verified upload session is not an M3 audio or video master';
  end if;

  select canonical_asset.*
  into v_existing_asset
  from public.registry_media_assets compatibility
  join media.legacy_asset_links bridge
    on bridge.legacy_asset_id = compatibility.id
  join media.assets canonical_asset
    on canonical_asset.id = bridge.asset_id
  where compatibility.source_entity = 'media_upload_session'
    and compatibility.source_staging_record_id = p_session_id
  limit 1;

  if found then
    select revision_row.*
    into v_existing_revision
    from media.asset_revisions revision_row
    where revision_row.id = v_existing_asset.current_revision_id;

    if not found
       or v_existing_revision.original_file_object_id <> v_session.file_object_id
    then
      raise exception
        'Existing upload-session adoption does not match the verified master';
    end if;

    return jsonb_build_object(
      'asset_id', v_existing_asset.id,
      'asset_revision_id', v_existing_revision.id,
      'revision_number', v_existing_revision.revision_number,
      'file_object_id', v_session.file_object_id,
      'authority_revision', v_existing_asset.authority_revision,
      'idempotent_replay', true,
      'correlation_id', v_session.correlation_id
    );
  end if;

  v_title := coalesce(
    nullif(btrim(p_title), ''),
    nullif(
      regexp_replace(v_session.original_filename, '\.[^.]+$', ''),
      ''
    ),
    v_session.original_filename
  );

  select *
  into v_asset
  from public.create_media_asset(
    v_asset_kind,
    coalesce(nullif(btrim(p_asset_purpose), ''), 'general'),
    v_title,
    p_folder_id,
    v_correlation_id
  );

  select *
  into v_revision
  from public.create_media_asset_revision(
    v_asset.asset_id,
    1,
    v_session.file_object_id,
    'Adopt verified resumable Media master',
    v_correlation_id
  );

  v_extension := lower(
    reverse(
      split_part(reverse(v_session.original_filename), '.', 1)
    )
  );

  v_slug :=
    'media-' || replace(v_asset.asset_id::text, '-', '');

  insert into public.registry_media_assets (
    id,
    slug,
    title,
    url,
    mime_type,
    media_kind,
    status,
    source_kind,
    source_entity,
    source_record_id,
    source_staging_record_id,
    storage_bucket,
    storage_path,
    folder_id,
    file_kind,
    asset_purpose,
    display_filename,
    original_filename,
    file_extension,
    file_size_bytes,
    rights_status,
    tags,
    metadata,
    created_at,
    updated_at
  )
  values (
    v_asset.asset_id,
    v_slug,
    v_title,
    'https://media.wakilisha.africa/__private/media-asset/' ||
      v_asset.asset_id::text,
    v_session.mime_type,
    v_asset_kind,
    'active',
    'editor_upload',
    'media_upload_session',
    p_session_id::text,
    p_session_id,
    v_session.storage_namespace,
    v_session.storage_path,
    p_folder_id,
    v_asset_kind,
    coalesce(nullif(btrim(p_asset_purpose), ''), 'general'),
    v_title,
    v_session.original_filename,
    v_extension,
    v_session.expected_byte_size,
    'unknown',
    '{}'::text[],
    jsonb_build_object(
      'file_name', v_session.original_filename,
      'file_size', v_session.expected_byte_size,
      'upload_session_id', p_session_id,
      'protected_original', true,
      'transfer_kind', 'resumable_parts',
      'master_kind', v_asset_kind
    ),
    now(),
    now()
  )
  returning to_jsonb(registry_media_assets)
  into v_compatibility;

  insert into media.legacy_asset_links (
    legacy_asset_id,
    asset_id,
    mapping_reason,
    legacy_snapshot,
    created_by
  )
  values (
    v_asset.asset_id,
    v_asset.asset_id,
    'Phase 4B M3 verified resumable master compatibility bridge',
    v_compatibility,
    v_actor_id
  );

  insert into media.events (
    asset_id,
    asset_revision_id,
    file_object_id,
    event_type,
    actor_id,
    reason,
    resulting_state,
    correlation_id
  )
  values (
    v_asset.asset_id,
    v_revision.asset_revision_id,
    v_session.file_object_id,
    'resumable_master_adopted',
    v_actor_id,
    'Adopt verified resumable Media master',
    jsonb_build_object(
      'upload_session_id', p_session_id,
      'asset_kind', v_asset_kind,
      'revision_number', v_revision.revision_number,
      'authority_revision', v_revision.authority_revision
    ),
    v_correlation_id
  );

  return jsonb_build_object(
    'asset_id', v_asset.asset_id,
    'asset_revision_id', v_revision.asset_revision_id,
    'revision_number', v_revision.revision_number,
    'file_object_id', v_session.file_object_id,
    'authority_revision', v_revision.authority_revision,
    'idempotent_replay', false,
    'correlation_id', v_correlation_id
  );
end;
$function$;


do $phase_4b_m3_adoption_url_postcheck$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.adopt_verified_media_upload_session_v1(uuid,text,text,uuid,uuid)'::regprocedure
  )
  into v_definition;

  if position(
       '__private/media-asset/'
       in v_definition
     ) = 0
     or position(
       '__private/media-master/'
       in v_definition
     ) > 0
  then
    raise exception
      'STOP: M3 adoption compatibility identity URL contract is incomplete';
  end if;
end;
$phase_4b_m3_adoption_url_postcheck$;


commit;
