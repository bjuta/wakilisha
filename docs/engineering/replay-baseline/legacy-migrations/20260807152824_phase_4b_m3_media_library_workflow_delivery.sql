begin;

do $phase_4b_m3_preflight$
declare
  v_m1_definition text;
  v_admin_definition text;
begin
  select pg_get_functiondef(
    'public.create_media_upload_session_v1(text,text,text,bigint,text,integer,uuid)'::regprocedure
  )
  into v_m1_definition;

  if position(
       'Audio master filename with extension is required'
       in v_m1_definition
     ) = 0
     or position(
       'p_expected_byte_size <= 26214400'
       in v_m1_definition
     ) = 0
  then
    raise exception
      'STOP: M1 v1 upload-session authority changed before M3';
  end if;

  if to_regprocedure(
       'public.create_media_upload_session_v2(text,text,text,bigint,text,integer,uuid)'
     ) is not null
  then
    raise exception
      'STOP: M3 upload-session v2 already exists';
  end if;

  if to_regprocedure(
       'public.adopt_verified_media_upload_session_v1(uuid,text,text,uuid,uuid)'
     ) is not null
  then
    raise exception
      'STOP: M3 verified-session adoption command already exists';
  end if;

  select pg_get_functiondef(
    'public.read_media_assets_admin_v2(jsonb)'::regprocedure
  )
  into v_admin_definition;

  if v_admin_definition ~*
     'processing_job_status|selected_derivatives|upload_session_state'
  then
    raise exception
      'STOP: Admin Media read already contains M3 workflow projection';
  end if;
end;
$phase_4b_m3_preflight$;


do $phase_4b_m3_event_contract_preflight$
declare
  v_definition text;
begin
  select pg_get_constraintdef(
    constraint_row.oid
  )
  into v_definition
  from pg_constraint constraint_row
  join pg_class table_row
    on table_row.oid =
      constraint_row.conrelid
  join pg_namespace schema_row
    on schema_row.oid =
      table_row.relnamespace
  where schema_row.nspname =
      'media'
    and table_row.relname =
      'events'
    and constraint_row.conname =
      'events_event_type_check';

  if v_definition is null then
    raise exception
      'STOP: media.events event-type constraint is missing';
  end if;

  if position(
       'resumable_master_adopted'
       in v_definition
     ) > 0
  then
    raise exception
      'STOP: resumable_master_adopted is already accepted before M3';
  end if;

  if position(
       'physical_purge_completed'
       in v_definition
     ) = 0
     or position(
       'compatibility_projection_created'
       in v_definition
     ) = 0
  then
    raise exception
      'STOP: media.events event-type authority changed before M3';
  end if;
end;
$phase_4b_m3_event_contract_preflight$;


alter table media.events
  drop constraint events_event_type_check;

alter table media.events
  add constraint events_event_type_check
  check (
    event_type = any (
      array[
        'asset_created'::text,
        'legacy_asset_mapped'::text,
        'file_object_registered'::text,
        'file_object_verified'::text,
        'file_object_verification_failed'::text,
        'file_object_unreachable'::text,
        'asset_revision_created'::text,
        'asset_revision_activated'::text,
        'variant_registered'::text,
        'variant_activated'::text,
        'usage_attached'::text,
        'usage_detached'::text,
        'usage_archived'::text,
        'governance_version_created'::text,
        'asset_archived'::text,
        'asset_restored'::text,
        'asset_metadata_updated'::text,
        'compatibility_projection_created'::text,
        'compatibility_projection_updated'::text,
        'retention_requested'::text,
        'retention_approved'::text,
        'physical_purge_completed'::text,
        'resumable_master_adopted'::text
      ]
    )
  );


create or replace function public.create_media_upload_session_v2(
  p_idempotency_key text,
  p_original_filename text,
  p_mime_type text,
  p_expected_byte_size bigint,
  p_expected_sha256 text,
  p_ttl_seconds integer default 86400,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, media, auth
as $function$
declare
  v_actor_id uuid;
  v_session_id uuid := gen_random_uuid();
  v_correlation_id uuid := coalesce(
    p_correlation_id,
    gen_random_uuid()
  );
  v_filename text := btrim(
    coalesce(p_original_filename, '')
  );
  v_mime_type text := lower(
    btrim(coalesce(p_mime_type, ''))
  );
  v_sha256 text := lower(
    btrim(coalesce(p_expected_sha256, ''))
  );
  v_extension text;
  v_master_kind text;
  v_part_size integer := 8388608;
  v_total_parts integer;
  v_storage_path text;
  v_existing media.upload_sessions%rowtype;
begin
  v_actor_id :=
    media.require_command_actor('manage_media_assets');

  if p_idempotency_key is null
     or p_idempotency_key !~
       '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
  then
    raise exception
      'Upload idempotency key is invalid';
  end if;

  if v_filename = ''
     or strpos(v_filename, '.') = 0
  then
    raise exception
      'Media master filename with extension is required';
  end if;

  v_extension :=
    lower(
      reverse(
        split_part(
          reverse(v_filename),
          '.',
          1
        )
      )
    );

  if v_mime_type like 'audio/%' then
    v_master_kind := 'audio';

    if v_extension not in (
      'mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg', 'oga'
    ) then
      raise exception
        'Unsupported audio master extension';
    end if;
  elsif v_mime_type like 'video/%' then
    v_master_kind := 'video';

    if v_extension not in (
      'mp4', 'mov', 'm4v', 'webm', 'mkv'
    ) then
      raise exception
        'Unsupported video master extension';
    end if;
  else
    raise exception
      'Media master MIME type must be audio or video';
  end if;

  if p_expected_byte_size is null
     or p_expected_byte_size <= 0
     or p_expected_byte_size > 2147483648
  then
    raise exception
      'Resumable Media master must be larger than zero and no larger than 2 GiB';
  end if;

  if v_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception
      'Expected Media master SHA-256 is invalid';
  end if;

  if p_ttl_seconds not between 300 and 86400 then
    raise exception
      'Upload session TTL must be between 300 and 86400 seconds';
  end if;

  select session_row.*
  into v_existing
  from media.upload_sessions session_row
  where session_row.actor_id = v_actor_id
    and session_row.idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_existing.original_filename is distinct from v_filename
       or v_existing.mime_type is distinct from v_mime_type
       or v_existing.expected_byte_size is distinct from p_expected_byte_size
       or v_existing.expected_sha256 is distinct from v_sha256
    then
      raise exception
        'Upload idempotency key is already bound to different file metadata';
    end if;

    return jsonb_build_object(
      'session_id', v_existing.id,
      'state', v_existing.state,
      'master_kind', v_master_kind,
      'storage_path', v_existing.storage_path,
      'storage_provider', v_existing.storage_provider,
      'storage_namespace', v_existing.storage_namespace,
      'original_filename', v_existing.original_filename,
      'mime_type', v_existing.mime_type,
      'expected_byte_size', v_existing.expected_byte_size,
      'expected_sha256', v_existing.expected_sha256,
      'part_size_bytes', v_existing.part_size_bytes,
      'total_parts', v_existing.total_parts,
      'expires_at', v_existing.expires_at,
      'file_object_id', v_existing.file_object_id,
      'correlation_id', v_existing.correlation_id
    );
  end if;

  v_total_parts := greatest(
    1,
    ceil(
      p_expected_byte_size::numeric /
      v_part_size::numeric
    )::integer
  );

  v_storage_path :=
    'masters/' ||
    v_master_kind ||
    '/' ||
    to_char(now(), 'YYYY/MM') ||
    '/' ||
    v_session_id::text ||
    '.' ||
    v_extension;

  insert into media.upload_sessions (
    id,
    actor_id,
    idempotency_key,
    state,
    storage_path,
    original_filename,
    file_extension,
    mime_type,
    expected_byte_size,
    expected_sha256,
    part_size_bytes,
    total_parts,
    expires_at,
    correlation_id
  )
  values (
    v_session_id,
    v_actor_id,
    p_idempotency_key,
    'created',
    v_storage_path,
    v_filename,
    v_extension,
    v_mime_type,
    p_expected_byte_size,
    v_sha256,
    v_part_size,
    v_total_parts,
    now() + make_interval(secs => p_ttl_seconds),
    v_correlation_id
  );

  return jsonb_build_object(
    'session_id', v_session_id,
    'state', 'created',
    'master_kind', v_master_kind,
    'storage_path', v_storage_path,
    'storage_provider', 'lightsail_media',
    'storage_namespace', 'lightsail-media',
    'original_filename', v_filename,
    'mime_type', v_mime_type,
    'expected_byte_size', p_expected_byte_size,
    'expected_sha256', v_sha256,
    'part_size_bytes', v_part_size,
    'total_parts', v_total_parts,
    'expires_at', now() + make_interval(secs => p_ttl_seconds),
    'file_object_id', null,
    'correlation_id', v_correlation_id
  );
end;
$function$;

revoke all
  on function public.create_media_upload_session_v2(
    text, text, text, bigint, text, integer, uuid
  )
  from public, anon, service_role;

grant execute
  on function public.create_media_upload_session_v2(
    text, text, text, bigint, text, integer, uuid
  )
  to authenticated;


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
    null,
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

revoke all
  on function public.adopt_verified_media_upload_session_v1(
    uuid, text, text, uuid, uuid
  )
  from public, anon, service_role;

grant execute
  on function public.adopt_verified_media_upload_session_v1(
    uuid, text, text, uuid, uuid
  )
  to authenticated;


create or replace function media.read_media_assets_admin_phase4a_v2(
  p_query jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, media, auth
as $function$
declare
  v_query jsonb := coalesce(
    p_query,
    '{}'::jsonb
  );
  v_limit integer;
  v_offset integer;
  v_order_by text;
  v_ascending boolean;
  v_include_references boolean;
  v_result jsonb;
begin
  perform media.require_media_read_actor();

  if jsonb_typeof(v_query) <> 'object' then
    raise exception
      'Administrative Media query must be a JSON object';
  end if;

  if v_query ? 'asset_ids'
     and jsonb_typeof(v_query -> 'asset_ids') <> 'array'
  then
    raise exception
      'Administrative Media asset_ids must be an array';
  end if;

  if v_query ? 'urls'
     and jsonb_typeof(v_query -> 'urls') <> 'array'
  then
    raise exception
      'Administrative Media urls must be an array';
  end if;

  if v_query ? 'source_keys'
     and jsonb_typeof(v_query -> 'source_keys') <> 'array'
  then
    raise exception
      'Administrative Media source_keys must be an array';
  end if;

  v_limit := coalesce(
    nullif(v_query ->> 'limit', '')::integer,
    50
  );
  v_offset := coalesce(
    nullif(v_query ->> 'offset', '')::integer,
    0
  );
  v_order_by := coalesce(
    nullif(btrim(v_query ->> 'order_by'), ''),
    'created_at'
  );
  v_ascending := coalesce(
    nullif(v_query ->> 'ascending', '')::boolean,
    false
  );
  v_include_references := coalesce(
    nullif(
      v_query ->> 'include_references',
      ''
    )::boolean,
    false
  );

  if v_limit < 1 or v_limit > 200 then
    raise exception
      'Administrative Media limit must be between 1 and 200';
  end if;

  if v_offset < 0 then
    raise exception
      'Administrative Media offset cannot be negative';
  end if;

  if v_order_by not in (
    'created_at',
    'updated_at',
    'title',
    'content_date'
  ) then
    raise exception
      'Unsupported administrative Media order';
  end if;

  with asset_ids as (
    select value::uuid as asset_id
    from jsonb_array_elements_text(
      coalesce(
        v_query -> 'asset_ids',
        '[]'::jsonb
      )
    )
  ),
  urls as (
    select value as asset_url
    from jsonb_array_elements_text(
      coalesce(
        v_query -> 'urls',
        '[]'::jsonb
      )
    )
  ),
  source_keys as (
    select value as source_key
    from jsonb_array_elements_text(
      coalesce(
        v_query -> 'source_keys',
        '[]'::jsonb
      )
    )
  ),
  filtered as (
    select
      compatibility.id,
      compatibility.slug,
      compatibility.title,
      compatibility.url,
      compatibility.mime_type,
      compatibility.media_kind,
      compatibility.status,
      compatibility.source_kind,
      compatibility.source_entity,
      compatibility.source_record_id,
      compatibility.source_staging_record_id,
      compatibility.storage_bucket,
      compatibility.storage_path,
      compatibility.folder_id,
      compatibility.file_kind,
      compatibility.asset_purpose,
      compatibility.display_filename,
      compatibility.original_filename,
      compatibility.file_extension,
      compatibility.file_size_bytes,
      compatibility.content_date,
      compatibility.rights_status,
      compatibility.credit_text,
      compatibility.country_code,
      compatibility.language_code,
      compatibility.tags,
      compatibility.internal_notes,
      compatibility.metadata,
      compatibility.created_at,
      compatibility.updated_at,
      bridge.asset_id as canonical_asset_id,
      asset.lifecycle_state as canonical_lifecycle_state,
      asset.authority_revision,
      asset.current_revision_id,
      asset.current_governance_version_id,
      governance.consent_status,
      governance.sensitivity,
      governance.public_safety_state,
      coalesce(
        usage_count.active_usage_count,
        0
      ) as active_usage_count
    from public.registry_media_assets compatibility
    left join media.legacy_asset_links bridge
      on bridge.legacy_asset_id = compatibility.id
    left join media.assets asset
      on asset.id = bridge.asset_id
    left join media.asset_governance_versions governance
      on governance.id =
        asset.current_governance_version_id
    left join lateral (
      select count(*)::bigint as active_usage_count
      from media.usage_links usage
      where usage.asset_id = bridge.asset_id
        and usage.usage_state = 'active'
    ) usage_count
      on true
    where (
      not (v_query ? 'asset_ids')
      or compatibility.id in (
        select asset_id
        from asset_ids
      )
    )
    and (
      not (v_query ? 'urls')
      or compatibility.url in (
        select asset_url
        from urls
      )
    )
    and (
      not (v_query ? 'source_keys')
      or compatibility.source_entity in (
        select source_key
        from source_keys
      )
      or compatibility.source_record_id::text in (
        select source_key
        from source_keys
      )
    )
    and (
      nullif(
        btrim(v_query ->> 'search'),
        ''
      ) is null
      or compatibility.title ilike
        '%' || btrim(v_query ->> 'search') || '%'
      or compatibility.slug ilike
        '%' || btrim(v_query ->> 'search') || '%'
      or compatibility.url ilike
        '%' || btrim(v_query ->> 'search') || '%'
      or compatibility.source_record_id::text ilike
        '%' || btrim(v_query ->> 'search') || '%'
      or compatibility.display_filename ilike
        '%' || btrim(v_query ->> 'search') || '%'
      or compatibility.original_filename ilike
        '%' || btrim(v_query ->> 'search') || '%'
      or compatibility.file_extension ilike
        '%' || btrim(v_query ->> 'search') || '%'
    )
    and (
      nullif(
        btrim(v_query ->> 'media_kind'),
        ''
      ) is null
      or compatibility.media_kind =
        v_query ->> 'media_kind'
    )
    and (
      nullif(
        btrim(v_query ->> 'file_kind'),
        ''
      ) is null
      or compatibility.file_kind =
        v_query ->> 'file_kind'
    )
    and (
      nullif(
        btrim(v_query ->> 'asset_purpose'),
        ''
      ) is null
      or compatibility.asset_purpose =
        v_query ->> 'asset_purpose'
    )
    and (
      nullif(
        btrim(v_query ->> 'folder_id'),
        ''
      ) is null
      or case
        when v_query ->> 'folder_id' = 'none'
          then compatibility.folder_id is null
        when v_query ->> 'folder_id' ~
          '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
          then compatibility.folder_id =
            (v_query ->> 'folder_id')::uuid
        else false
      end
    )
    and (
      nullif(
        btrim(v_query ->> 'rights_status'),
        ''
      ) is null
      or compatibility.rights_status =
        v_query ->> 'rights_status'
    )
    and (
      nullif(
        btrim(v_query ->> 'source_kind'),
        ''
      ) is null
      or compatibility.source_kind =
        v_query ->> 'source_kind'
    )
    and (
      nullif(
        btrim(v_query ->> 'status'),
        ''
      ) is null
      or compatibility.status =
        v_query ->> 'status'
    )
    and (
      not coalesce(
        nullif(
          v_query ->> 'missing_alt_only',
          ''
        )::boolean,
        false
      )
      or nullif(
        btrim(
          compatibility.metadata ->> 'alt_text'
        ),
        ''
      ) is null
    )
    and (
      nullif(
        v_query ->> 'uploaded_from',
        ''
      ) is null
      or compatibility.created_at >=
        (v_query ->> 'uploaded_from')::timestamptz
    )
    and (
      nullif(
        v_query ->> 'uploaded_to',
        ''
      ) is null
      or compatibility.created_at <=
        (v_query ->> 'uploaded_to')::timestamptz
    )
    and (
      nullif(
        v_query ->> 'content_from',
        ''
      ) is null
      or compatibility.content_date >=
        (v_query ->> 'content_from')::date
    )
    and (
      nullif(
        v_query ->> 'content_to',
        ''
      ) is null
      or compatibility.content_date <=
        (v_query ->> 'content_to')::date
    )
  ),
  ordered as (
    select
      filtered.*,
      row_number() over (
        order by
          case
            when v_order_by = 'created_at'
             and v_ascending
              then filtered.created_at
          end asc nulls last,
          case
            when v_order_by = 'created_at'
             and not v_ascending
              then filtered.created_at
          end desc nulls last,
          case
            when v_order_by = 'updated_at'
             and v_ascending
              then filtered.updated_at
          end asc nulls last,
          case
            when v_order_by = 'updated_at'
             and not v_ascending
              then filtered.updated_at
          end desc nulls last,
          case
            when v_order_by = 'title'
             and v_ascending
              then lower(
                coalesce(filtered.title, '')
              )
          end asc nulls last,
          case
            when v_order_by = 'title'
             and not v_ascending
              then lower(
                coalesce(filtered.title, '')
              )
          end desc nulls last,
          case
            when v_order_by = 'content_date'
             and v_ascending
              then filtered.content_date
          end asc nulls last,
          case
            when v_order_by = 'content_date'
             and not v_ascending
              then filtered.content_date
          end desc nulls last,
          filtered.id
      ) as page_order
    from filtered
  ),
  paged as (
    select *
    from ordered
    order by page_order
    limit v_limit
    offset v_offset
  )
  select jsonb_build_object(
    'items',
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', page_row.id,
          'slug', page_row.slug,
          'title', page_row.title,
          'url', page_row.url,
          'mime_type', page_row.mime_type,
          'media_kind', page_row.media_kind,
          'status', page_row.status,
          'source_kind', page_row.source_kind,
          'source_entity', page_row.source_entity,
          'source_record_id',
            page_row.source_record_id,
          'source_staging_record_id',
            page_row.source_staging_record_id,
          'storage_bucket',
            page_row.storage_bucket,
          'storage_path', page_row.storage_path,
          'folder_id', page_row.folder_id,
          'file_kind', page_row.file_kind,
          'asset_purpose',
            page_row.asset_purpose,
          'display_filename',
            page_row.display_filename,
          'original_filename',
            page_row.original_filename,
          'file_extension',
            page_row.file_extension,
          'file_size_bytes',
            page_row.file_size_bytes,
          'content_date', page_row.content_date,
          'rights_status',
            page_row.rights_status,
          'credit_text', page_row.credit_text,
          'country_code', page_row.country_code,
          'language_code',
            page_row.language_code,
          'tags', page_row.tags,
          'internal_notes',
            page_row.internal_notes,
          'metadata', page_row.metadata,
          'created_at', page_row.created_at,
          'updated_at', page_row.updated_at,
          'canonical_asset_id',
            page_row.canonical_asset_id,
          'canonical_lifecycle_state',
            page_row.canonical_lifecycle_state,
          'authority_revision',
            page_row.authority_revision,
          'current_revision_id',
            page_row.current_revision_id,
          'current_governance_version_id',
            page_row.current_governance_version_id,
          'consent_status',
            page_row.consent_status,
          'sensitivity', page_row.sensitivity,
          'public_safety_state',
            page_row.public_safety_state,
          'active_usage_count',
            page_row.active_usage_count,
          'references',
            case
              when v_include_references
                then (
                  select coalesce(
                    jsonb_agg(
                      jsonb_build_object(
                        'table',
                          reference_row.table_name,
                        'column',
                          reference_row.column_name,
                        'entity_id',
                          reference_row.entity_id,
                        'label',
                          reference_row.label
                      )
                      order by
                        reference_row.table_name,
                        reference_row.entity_id
                    ),
                    '[]'::jsonb
                  )
                  from (
                    select
                      'wk_articles'::text as table_name,
                      'hero_image_id'::text as column_name,
                      article_row.id::text as entity_id,
                      coalesce(
                        nullif(
                          btrim(
                            to_jsonb(article_row)
                              ->> 'title'
                          ),
                          ''
                        ),
                        article_row.id::text
                      ) as label
                    from public.wk_articles article_row
                    where article_row.hero_image_id =
                      page_row.id

                    union all

                    select
                      'registry_artists',
                      'public_image_id',
                      artist_row.id::text,
                      coalesce(
                        nullif(
                          btrim(
                            to_jsonb(artist_row)
                              ->> 'display_name'
                          ),
                          ''
                        ),
                        artist_row.id::text
                      )
                    from public.registry_artists artist_row
                    where artist_row.public_image_id =
                      page_row.id

                    union all

                    select
                      'registry_releases',
                      'artwork_image_id',
                      release_row.id::text,
                      coalesce(
                        nullif(
                          btrim(
                            to_jsonb(release_row)
                              ->> 'title'
                          ),
                          ''
                        ),
                        release_row.id::text
                      )
                    from public.registry_releases release_row
                    where release_row.artwork_image_id =
                      page_row.id

                    union all

                    select
                      'registry_tracks',
                      'artwork_image_id',
                      track_row.id::text,
                      coalesce(
                        nullif(
                          btrim(
                            to_jsonb(track_row)
                              ->> 'title'
                          ),
                          ''
                        ),
                        track_row.id::text
                      )
                    from public.registry_tracks track_row
                    where track_row.artwork_image_id =
                      page_row.id

                    union all

                    select
                      'registry_authors',
                      'cover_image_id',
                      author_row.id::text,
                      coalesce(
                        nullif(
                          btrim(
                            to_jsonb(author_row)
                              ->> 'name'
                          ),
                          ''
                        ),
                        author_row.id::text
                      )
                    from public.registry_authors author_row
                    where author_row.cover_image_id =
                      page_row.id

                    union all

                    select
                      'registry_authors',
                      'avatar_image_id',
                      author_row.id::text,
                      coalesce(
                        nullif(
                          btrim(
                            to_jsonb(author_row)
                              ->> 'name'
                          ),
                          ''
                        ),
                        author_row.id::text
                      )
                    from public.registry_authors author_row
                    where author_row.avatar_image_id =
                      page_row.id

                    union all

                    select
                      'guide_pages',
                      'hero_image_id',
                      guide_page_row.id::text,
                      coalesce(
                        nullif(
                          btrim(
                            to_jsonb(guide_page_row)
                              ->> 'title'
                          ),
                          ''
                        ),
                        guide_page_row.id::text
                      )
                    from public.guide_pages guide_page_row
                    where guide_page_row.hero_image_id =
                      page_row.id

                    union all

                    select
                      'guides',
                      'hero_image_id',
                      guide_row.id::text,
                      coalesce(
                        nullif(
                          btrim(
                            to_jsonb(guide_row)
                              ->> 'title'
                          ),
                          ''
                        ),
                        guide_row.id::text
                      )
                    from public.guides guide_row
                    where guide_row.hero_image_id =
                      page_row.id

                    union all

                    select
                      'registry_artist_highlights',
                      'artwork_image_id',
                      highlight_row.id::text,
                      coalesce(
                        nullif(
                          btrim(
                            to_jsonb(highlight_row)
                              ->> 'title'
                          ),
                          ''
                        ),
                        highlight_row.id::text
                      )
                    from public.registry_artist_highlights
                      highlight_row
                    where highlight_row.artwork_image_id =
                      page_row.id

                    union all

                    select
                      'chart_entries',
                      'artwork_image_id',
                      chart_row.id::text,
                      coalesce(
                        nullif(
                          btrim(
                            to_jsonb(chart_row)
                              ->> 'track_title'
                          ),
                          ''
                        ),
                        chart_row.id::text
                      )
                    from public.chart_entries chart_row
                    where chart_row.artwork_image_id =
                      page_row.id

                    union all

                    select
                      'wk_chart_entries_v2',
                      'artwork_image_id',
                      chart_v2_row.id::text,
                      coalesce(
                        nullif(
                          btrim(
                            to_jsonb(chart_v2_row)
                              ->> 'track_title'
                          ),
                          ''
                        ),
                        chart_v2_row.id::text
                      )
                    from public.wk_chart_entries_v2
                      chart_v2_row
                    where chart_v2_row.artwork_image_id =
                      page_row.id
                  ) reference_row
                )
              else '[]'::jsonb
            end
        )
        order by page_row.page_order
      ),
      '[]'::jsonb
    ),
    'total',
      (select count(*) from filtered)
  )
  into v_result
  from paged page_row;

  return coalesce(
    v_result,
    jsonb_build_object(
      'items',
      '[]'::jsonb,
      'total',
      0
    )
  );
end;
$function$;

revoke all
  on function media.read_media_assets_admin_phase4a_v2(jsonb)
  from public, anon, authenticated, service_role;


create or replace function public.read_media_assets_admin_v2(
  p_query jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, media, auth
as $function$
declare
  v_base jsonb;
  v_items jsonb;
begin
  perform media.require_media_read_actor();

  v_base := media.read_media_assets_admin_phase4a_v2(p_query);

  select coalesce(
    jsonb_agg(enriched.item order by enriched.ordinality),
    '[]'::jsonb
  )
  into v_items
  from (
    select
      source.ordinality,
      source.item ||
      jsonb_build_object(
        'current_file_object_id', revision.original_file_object_id,
        'upload_session_id', upload_session.id,
        'upload_session_state', upload_session.state,
        'processing_job_id', processing_job.id,
        'processing_job_status', processing_job.status,
        'processing_attempt_count', processing_job.attempt_count,
        'processing_max_attempts', processing_job.max_attempts,
        'processing_last_error', processing_job.last_error,
        'processing_profile_version',
          processing_job.input_payload ->> 'profile_version',
        'selected_derivatives',
          coalesce(derivative_selection.items, '{}'::jsonb),
        'primary_delivery_url',
          case
            when coalesce(
              source.item ->> 'file_kind',
              source.item ->> 'media_kind'
            ) = 'audio'
            then derivative_selection.items -> 'audio_preview' ->> 'url'
            when coalesce(
              source.item ->> 'file_kind',
              source.item ->> 'media_kind'
            ) = 'video'
            then derivative_selection.items -> 'video_transcode' ->> 'url'
            else source.item ->> 'url'
          end,
        'delivery_ready',
          case
            when coalesce(
              source.item ->> 'file_kind',
              source.item ->> 'media_kind'
            ) = 'audio'
            then
              coalesce(derivative_selection.items, '{}'::jsonb) ? 'audio_preview'
              and coalesce(derivative_selection.items, '{}'::jsonb) ? 'waveform_data'
            when coalesce(
              source.item ->> 'file_kind',
              source.item ->> 'media_kind'
            ) = 'video'
            then
              coalesce(derivative_selection.items, '{}'::jsonb) ? 'video_transcode'
              and coalesce(derivative_selection.items, '{}'::jsonb) ? 'poster_frame'
              and coalesce(derivative_selection.items, '{}'::jsonb) ? 'thumbnail'
            else nullif(source.item ->> 'url', '') is not null
          end
      ) as item
    from jsonb_array_elements(
      coalesce(v_base -> 'items', '[]'::jsonb)
    )
    with ordinality as source(item, ordinality)
    left join media.assets asset
      on asset.id = nullif(source.item ->> 'canonical_asset_id', '')::uuid
    left join media.asset_revisions revision
      on revision.id = asset.current_revision_id
    left join lateral (
      select session_row.*
      from media.upload_sessions session_row
      where session_row.file_object_id = revision.original_file_object_id
      order by session_row.created_at desc
      limit 1
    ) upload_session on true
    left join lateral (
      select job_row.*
      from platform_private.jobs job_row
      where job_row.command_type = 'media.process_revision'
        and job_row.resource_id = asset.id
        and job_row.input_payload ->> 'asset_revision_id' = asset.current_revision_id::text
      order by job_row.created_at desc
      limit 1
    ) processing_job on true
    left join lateral (
      select coalesce(
        jsonb_object_agg(
          selection.variant_role,
          jsonb_build_object(
            'variant_id', variant.id,
            'file_object_id', file_object.id,
            'url', file_object.delivery_url,
            'mime_type', file_object.mime_type,
            'byte_size', file_object.byte_size,
            'variant_role', selection.variant_role,
            'selection_revision', selection.selection_revision,
            'generator_name', variant.generator_name,
            'generator_version', variant.generator_version,
            'technical_metadata', variant.technical_metadata
          )
        ),
        '{}'::jsonb
      ) as items
      from media.variant_selections selection
      join media.variants variant
        on variant.id = selection.variant_id
      join media.file_objects file_object
        on file_object.id = variant.derived_file_object_id
      where selection.asset_revision_id = asset.current_revision_id
        and file_object.verification_state = 'verified'
        and file_object.delivery_url like
          'https://media.wakilisha.africa/derivatives/%'
    ) derivative_selection on true
  ) enriched;

  return jsonb_set(v_base, '{items}', v_items, true);
end;
$function$;

revoke all
  on function public.read_media_assets_admin_v2(jsonb)
  from public, anon, service_role;

grant execute
  on function public.read_media_assets_admin_v2(jsonb)
  to authenticated;

commit;
