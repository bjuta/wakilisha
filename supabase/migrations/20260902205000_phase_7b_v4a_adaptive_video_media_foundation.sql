-- Phase 7B V4A: adaptive Video Media processing foundation.
--
-- Adds an additive Video publication processing profile without changing
-- the accepted Phase 4 video-v1 processing contract or public Video delivery.
-- Reuses existing Media command receipts, durable jobs, leases, retries,
-- file objects, variants, selections, events, and the Media CDN.

begin;

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'phase-7b-video-authority',
    0
  )
);

do $phase_7b_v4a_preflight$
declare
  v_video_v1_submit text;
  v_video_v1_register text;
begin
  if to_regclass('media.assets') is null
     or to_regclass('media.asset_revisions') is null
     or to_regclass('media.file_objects') is null
     or to_regclass('media.variants') is null
     or to_regclass('media.variant_selections') is null
     or to_regclass('media.variant_roles') is null
     or to_regclass('media.usage_links') is null
     or to_regclass('media.events') is null
     or to_regclass('editorial.resources') is null
     or to_regclass('editorial.media_asset_resources') is null
     or to_regclass('platform_private.command_types') is null
     or to_regclass('platform_private.command_receipts') is null
     or to_regclass('platform_private.jobs') is null
     or to_regclass('platform_private.outbox_events') is null
  then
    raise exception
      'STOP: accepted Media processing authority is incomplete';
  end if;

  if to_regprocedure(
       'public.submit_media_processing_command_v1(uuid,uuid,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.register_media_processing_outputs_v1(uuid,text,jsonb)'
     ) is null
     or to_regprocedure(
       'public.complete_media_processing_job_v1(uuid,text,jsonb)'
     ) is null
     or to_regprocedure(
       'media.insert_verified_file_object_v2(jsonb,uuid,uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.command_actor_context()'
     ) is null
     or to_regprocedure(
       'platform_private.command_request_fingerprint(text,uuid,jsonb)'
     ) is null
  then
    raise exception
      'STOP: required Media command or registration helper is missing';
  end if;

  if exists (
    select 1
    from media.variant_roles
    where variant_role in (
      'video_hls_master',
      'video_hls_360p_playlist',
      'video_hls_360p_media',
      'video_hls_720p_playlist',
      'video_hls_720p_media'
    )
  ) then
    raise exception
      'STOP: one or more V4A adaptive Video variant roles already exist';
  end if;

  if to_regprocedure(
       'public.submit_video_adaptive_processing_v1(uuid,uuid,text,uuid)'
     ) is not null
     or to_regprocedure(
       'public.register_video_adaptive_processing_outputs_v1(uuid,text,jsonb)'
     ) is not null
  then
    raise exception
      'STOP: one or more V4A adaptive Video processing adapters already exist';
  end if;

  v_video_v1_submit := pg_get_functiondef(
    'public.submit_media_processing_command_v1(uuid,uuid,text,text,uuid)'::regprocedure
  );
  v_video_v1_register := pg_get_functiondef(
    'public.register_media_processing_outputs_v1(uuid,text,jsonb)'::regprocedure
  );

  if position(
       'video-adaptive-v1'
       in v_video_v1_submit
     ) > 0
     or position(
       'video-adaptive-v1'
       in v_video_v1_register
     ) > 0
  then
    raise exception
      'STOP: accepted Phase 4 video-v1 processing functions already changed semantics';
  end if;
end;
$phase_7b_v4a_preflight$;

insert into media.variant_roles (
  variant_role,
  label,
  description,
  enabled,
  sort_order
)
values
  (
    'video_hls_master',
    'Video HLS master',
    'Immutable HLS master playlist for adaptive Video publication delivery.',
    true,
    81
  ),
  (
    'video_hls_360p_playlist',
    'Video HLS 360p playlist',
    'Immutable HLS media playlist for the bounded 360p rendition.',
    true,
    82
  ),
  (
    'video_hls_360p_media',
    'Video HLS 360p media',
    'Immutable single-file MPEG-TS byte-range media for the bounded 360p rendition.',
    true,
    83
  ),
  (
    'video_hls_720p_playlist',
    'Video HLS 720p playlist',
    'Immutable HLS media playlist for the bounded 720p rendition.',
    true,
    84
  ),
  (
    'video_hls_720p_media',
    'Video HLS 720p media',
    'Immutable single-file MPEG-TS byte-range media for the bounded 720p rendition.',
    true,
    85
  );

create or replace function
  public.submit_video_adaptive_processing_v1(
    p_asset_id uuid,
    p_asset_revision_id uuid,
    p_idempotency_key text,
    p_correlation_id uuid default null
  )
returns table(
  command_receipt_id uuid,
  job_id uuid,
  accepted_event_id uuid,
  receipt_status text,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'auth',
  'editorial',
  'media',
  'platform_private',
  'extensions'
as $function$
declare
  v_command_type constant text := 'media.process_revision';
  v_profile_version constant text := 'video-adaptive-v1';
  v_actor record;
  v_asset media.assets%rowtype;
  v_revision media.asset_revisions%rowtype;
  v_source media.file_objects%rowtype;
  v_request_payload jsonb;
  v_request_fingerprint text;
  v_receipt_id uuid;
  v_existing_fingerprint text;
  v_receipt_status text;
  v_job_id uuid;
  v_event_id uuid;
  v_created boolean;
  v_resource_kind text;
  v_correlation_id uuid := coalesce(
    p_correlation_id,
    extensions.gen_random_uuid()
  );
begin
  if auth.role() <> 'authenticated'
     or auth.uid() is null
  then
    raise exception
      using
        errcode = '42501',
        message = 'Authenticated Media processing actor is required.';
  end if;

  if not (
    public.current_user_has_capability('manage_media_assets')
    or public.current_user_is_administrator()
  ) then
    raise exception
      using
        errcode = '42501',
        message = 'manage_media_assets capability is required.';
  end if;

  if p_asset_id is null
     or p_asset_revision_id is null
     or p_idempotency_key is null
     or p_idempotency_key !~
       '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
  then
    raise exception
      using
        errcode = '22023',
        message = 'Adaptive Video processing request is invalid.';
  end if;

  select *
  into v_asset
  from media.assets
  where id = p_asset_id;

  if not found
     or v_asset.lifecycle_state <> 'active'
     or v_asset.asset_kind <> 'video'
  then
    raise exception
      using
        errcode = '55000',
        message = 'Adaptive Video processing requires an active Video Media asset.';
  end if;

  select *
  into v_revision
  from media.asset_revisions
  where id = p_asset_revision_id
    and asset_id = p_asset_id;

  if not found then
    raise exception
      using
        errcode = 'P0002',
        message = 'Media revision does not belong to the requested Video asset.';
  end if;

  select *
  into v_source
  from media.file_objects
  where id = v_revision.original_file_object_id;

  if not found
     or v_source.verification_state <> 'verified'
     or v_source.storage_provider <> 'lightsail_media'
     or v_source.storage_path is null
     or v_source.storage_path !~ '^masters/video/'
     or v_source.sha256 is null
     or v_source.byte_size is null
     or v_source.mime_type not like 'video/%'
  then
    raise exception
      using
        errcode = '55000',
        message = 'Adaptive Video processing requires a verified protected Video master.';
  end if;

  if not exists (
    select 1
    from media.usage_links usage
    where usage.asset_id = p_asset_id
      and usage.asset_revision_id = p_asset_revision_id
      and usage.resolution_mode = 'exact_revision'
      and usage.target_authority = 'video'
      and usage.target_kind = 'video_publication'
      and usage.target_version_kind = 'video_publication_version'
      and usage.target_version_id is not null
      and usage.usage_role = 'video_master'
      and usage.usage_state = 'active'
  ) then
    raise exception
      using
        errcode = '55000',
        message =
          'Adaptive Video processing requires an active version-bound Video master attachment.';
  end if;

  select resource_kind
  into v_resource_kind
  from editorial.resources
  where id = p_asset_id;

  if not found then
    insert into editorial.resources (
      id,
      resource_kind,
      owner_id,
      visibility,
      lifecycle_state,
      created_by
    )
    values (
      p_asset_id,
      'media_asset',
      auth.uid(),
      'internal',
      'active',
      auth.uid()
    );

    insert into editorial.media_asset_resources (
      resource_id,
      asset_id
    )
    values (
      p_asset_id,
      p_asset_id
    );
  else
    if v_resource_kind <> 'media_asset'
       or not exists (
         select 1
         from editorial.media_asset_resources binding
         where binding.resource_id = p_asset_id
           and binding.asset_id = p_asset_id
       )
    then
      raise exception
        'Video Media Resource binding is invalid.';
    end if;
  end if;

  select *
  into v_actor
  from platform_private.command_actor_context();

  v_request_payload := jsonb_build_object(
    'asset_id', p_asset_id,
    'asset_revision_id', p_asset_revision_id,
    'source_file_object_id', v_source.id,
    'source_storage_path', v_source.storage_path,
    'source_sha256', v_source.sha256,
    'source_byte_size', v_source.byte_size,
    'source_mime_type', v_source.mime_type,
    'asset_kind', v_asset.asset_kind,
    'profile_version', v_profile_version,
    'correlation_id', v_correlation_id
  );

  v_request_fingerprint :=
    platform_private.command_request_fingerprint(
      v_command_type,
      p_asset_id,
      v_request_payload - 'correlation_id'
    );

  insert into platform_private.command_receipts (
    command_type,
    resource_id,
    principal_key,
    actor_user_id,
    idempotency_key,
    request_fingerprint,
    request_payload
  )
  values (
    v_command_type,
    p_asset_id,
    v_actor.principal_key,
    v_actor.actor_user_id,
    p_idempotency_key,
    v_request_fingerprint,
    v_request_payload
  )
  on conflict (
    principal_key,
    command_type,
    idempotency_key
  )
  do nothing
  returning id, status
  into v_receipt_id, v_receipt_status;

  v_created := found;

  if not v_created then
    select
      receipt.id,
      receipt.request_fingerprint,
      receipt.status
    into
      v_receipt_id,
      v_existing_fingerprint,
      v_receipt_status
    from platform_private.command_receipts receipt
    where receipt.principal_key = v_actor.principal_key
      and receipt.command_type = v_command_type
      and receipt.idempotency_key = p_idempotency_key
    for update;

    if not found then
      raise exception
        'Adaptive Video processing idempotency receipt disappeared.';
    end if;

    if v_existing_fingerprint <> v_request_fingerprint then
      raise exception
        using
          errcode = '23505',
          message =
            'The idempotency key was already used for a different processing request.';
    end if;

    select job.id
    into v_job_id
    from platform_private.jobs job
    where job.command_receipt_id = v_receipt_id
      and job.job_key = 'primary';

    select event.id
    into v_event_id
    from platform_private.outbox_events event
    where event.event_key =
      'command:' || v_receipt_id::text || ':accepted';

    if v_job_id is null
       or v_event_id is null
    then
      raise exception
        'Accepted adaptive Video processing command is missing its durable job or event.';
    end if;

    return query
    select
      v_receipt_id,
      v_job_id,
      v_event_id,
      v_receipt_status,
      true;
    return;
  end if;

  insert into platform_private.jobs (
    command_receipt_id,
    resource_id,
    command_type,
    job_key,
    job_type,
    max_attempts,
    input_payload
  )
  values (
    v_receipt_id,
    p_asset_id,
    v_command_type,
    'primary',
    'media.process_revision',
    4,
    v_request_payload
  )
  returning id
  into v_job_id;

  insert into platform_private.outbox_events (
    event_key,
    command_receipt_id,
    job_id,
    command_type,
    aggregate_id,
    event_type,
    payload
  )
  values (
    'command:' || v_receipt_id::text || ':accepted',
    v_receipt_id,
    v_job_id,
    v_command_type,
    p_asset_id,
    'media.processing.accepted',
    jsonb_build_object(
      'command_receipt_id', v_receipt_id,
      'job_id', v_job_id,
      'resource_id', p_asset_id,
      'asset_id', p_asset_id,
      'asset_revision_id', p_asset_revision_id,
      'source_file_object_id', v_source.id,
      'profile_version', v_profile_version,
      'principal_key', v_actor.principal_key,
      'correlation_id', v_correlation_id,
      'accepted_at', now()
    )
  )
  returning id
  into v_event_id;

  return query
  select
    v_receipt_id,
    v_job_id,
    v_event_id,
    'accepted'::text,
    false;
end;
$function$;

revoke all
  on function public.submit_video_adaptive_processing_v1(
    uuid,
    uuid,
    text,
    uuid
  )
  from public, anon, service_role;

grant execute
  on function public.submit_video_adaptive_processing_v1(
    uuid,
    uuid,
    text,
    uuid
  )
  to authenticated;

create or replace function
  public.register_video_adaptive_processing_outputs_v1(
    p_job_id uuid,
    p_worker_id text,
    p_outputs jsonb
  )
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'auth',
  'media',
  'platform_private',
  'extensions'
as $function$
declare
  v_job platform_private.jobs%rowtype;
  v_receipt platform_private.command_receipts%rowtype;
  v_actor_id uuid;
  v_asset_id uuid;
  v_revision_id uuid;
  v_source_file_id uuid;
  v_correlation_id uuid;
  v_output jsonb;
  v_file jsonb;
  v_role text;
  v_seen_roles text[] := array[]::text[];
  v_expected_filename text;
  v_expected_mime text;
  v_storage_path text;
  v_delivery_url text;
  v_expected_storage_path text;
  v_expected_delivery_url text;
  v_sha256 text;
  v_byte_size bigint;
  v_file_object_id uuid;
  v_existing_file media.file_objects%rowtype;
  v_variant_id uuid;
  v_selection_variant_id uuid;
  v_selection_revision bigint;
  v_new_variant boolean;
  v_results jsonb := '[]'::jsonb;
  v_spec jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception
      using
        errcode = '42501',
        message = 'Service-role access is required.';
  end if;

  if p_job_id is null
     or p_worker_id is null
     or p_worker_id !~
       '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$'
     or p_outputs is null
     or jsonb_typeof(p_outputs) <> 'array'
     or jsonb_array_length(p_outputs) <> 5
  then
    raise exception
      using
        errcode = '22023',
        message =
          'Adaptive Video registration requires one leased job and exactly five outputs.';
  end if;

  select job.*
  into v_job
  from platform_private.jobs job
  where job.id = p_job_id
  for update;

  if not found
     or v_job.command_type <> 'media.process_revision'
     or v_job.job_type <> 'media.process_revision'
     or v_job.status <> 'running'
     or v_job.locked_by is distinct from p_worker_id
     or v_job.lease_expires_at is null
     or v_job.lease_expires_at <= now()
     or v_job.input_payload ->> 'profile_version'
          <> 'video-adaptive-v1'
  then
    raise exception
      using
        errcode = '55000',
        message =
          'The adaptive Video processing job is not actively leased to this worker.';
  end if;

  select receipt.*
  into v_receipt
  from platform_private.command_receipts receipt
  where receipt.id = v_job.command_receipt_id;

  if not found
     or v_receipt.actor_user_id is null
     or v_receipt.status <> 'accepted'
  then
    raise exception
      using
        errcode = '55000',
        message =
          'Adaptive Video processing receipt actor or state is invalid.';
  end if;

  v_actor_id := v_receipt.actor_user_id;
  v_asset_id := nullif(
    v_job.input_payload ->> 'asset_id',
    ''
  )::uuid;
  v_revision_id := nullif(
    v_job.input_payload ->> 'asset_revision_id',
    ''
  )::uuid;
  v_source_file_id := nullif(
    v_job.input_payload ->> 'source_file_object_id',
    ''
  )::uuid;
  v_correlation_id := nullif(
    v_job.input_payload ->> 'correlation_id',
    ''
  )::uuid;

  if v_asset_id is null
     or v_revision_id is null
     or v_source_file_id is null
     or v_correlation_id is null
     or not exists (
       select 1
       from media.asset_revisions revision
       join media.assets asset
         on asset.id = revision.asset_id
       join media.file_objects source_file
         on source_file.id = revision.original_file_object_id
       where revision.id = v_revision_id
         and revision.asset_id = v_asset_id
         and revision.original_file_object_id = v_source_file_id
         and asset.asset_kind = 'video'
         and source_file.verification_state = 'verified'
         and source_file.storage_provider = 'lightsail_media'
         and source_file.storage_path ~ '^masters/video/'
     )
  then
    raise exception
      'Adaptive Video processing source authority changed or is invalid.';
  end if;

  for v_output in
    select value
    from jsonb_array_elements(p_outputs)
  loop
    if jsonb_typeof(v_output) <> 'object'
       or jsonb_typeof(v_output -> 'file') <> 'object'
       or jsonb_typeof(v_output -> 'transformation_spec') <> 'object'
       or jsonb_typeof(v_output -> 'technical_metadata') <> 'object'
    then
      raise exception
        'Every adaptive Video output must contain file, transformation, and technical metadata objects.';
    end if;

    v_role := nullif(
      btrim(v_output ->> 'variant_role'),
      ''
    );

    if v_role is null
       or v_role = any(v_seen_roles)
    then
      raise exception
        'Adaptive Video variant roles must be present and unique.';
    end if;

    v_seen_roles := array_append(
      v_seen_roles,
      v_role
    );

    case v_role
      when 'video_hls_master' then
        v_expected_filename := 'video_hls_master.m3u8';
        v_expected_mime := 'application/vnd.apple.mpegurl';
      when 'video_hls_360p_playlist' then
        v_expected_filename := 'video_hls_360p_playlist.m3u8';
        v_expected_mime := 'application/vnd.apple.mpegurl';
      when 'video_hls_360p_media' then
        v_expected_filename := 'video_hls_360p_media.ts';
        v_expected_mime := 'video/mp2t';
      when 'video_hls_720p_playlist' then
        v_expected_filename := 'video_hls_720p_playlist.m3u8';
        v_expected_mime := 'application/vnd.apple.mpegurl';
      when 'video_hls_720p_media' then
        v_expected_filename := 'video_hls_720p_media.ts';
        v_expected_mime := 'video/mp2t';
      else
        raise exception
          'Variant role % is not permitted for video-adaptive-v1.',
          v_role;
    end case;

    v_spec := v_output -> 'transformation_spec';

    if v_spec ->> 'profile' <> 'video-adaptive-v1'
       or nullif(v_spec ->> 'hls_version', '')::integer <> 6
       or nullif(v_spec ->> 'segment_seconds', '')::integer <> 4
       or v_spec ->> 'segment_mode' <> 'single_file_byte_range'
       or v_output ->> 'generator_name'
            <> 'wakilisha-media-processor'
       or v_output ->> 'generator_version'
            <> 'phase7b-v4a-v1'
    then
      raise exception
        'Adaptive Video processing profile metadata is invalid for role %.',
        v_role;
    end if;

    if (
      v_role = 'video_hls_master'
      and (
        v_spec ->> 'kind' <> 'master_playlist'
        or nullif(v_spec ->> 'rendition_count', '')::integer <> 2
      )
    ) or (
      v_role in (
        'video_hls_360p_playlist',
        'video_hls_360p_media'
      )
      and (
        v_spec ->> 'kind' not in ('media_playlist', 'media')
        or nullif(v_spec ->> 'max_width', '')::integer <> 640
        or nullif(v_spec ->> 'max_height', '')::integer <> 360
        or nullif(v_spec ->> 'video_bitrate_kbps', '')::integer <> 800
        or nullif(v_spec ->> 'audio_bitrate_kbps', '')::integer <> 96
      )
    ) or (
      v_role in (
        'video_hls_720p_playlist',
        'video_hls_720p_media'
      )
      and (
        v_spec ->> 'kind' not in ('media_playlist', 'media')
        or nullif(v_spec ->> 'max_width', '')::integer <> 1280
        or nullif(v_spec ->> 'max_height', '')::integer <> 720
        or nullif(v_spec ->> 'video_bitrate_kbps', '')::integer <> 2500
        or nullif(v_spec ->> 'audio_bitrate_kbps', '')::integer <> 128
      )
    ) or (
      v_role in (
        'video_hls_360p_media',
        'video_hls_720p_media'
      )
      and (
        v_spec ->> 'container' <> 'mpegts'
        or v_spec ->> 'video_codec' <> 'h264'
        or v_spec ->> 'audio_codec' <> 'aac'
      )
    ) then
      raise exception
        'Adaptive Video transformation contract is invalid for role %.',
        v_role;
    end if;

    v_file := v_output -> 'file';

    if v_file ->> 'storage_provider'
         <> 'lightsail_media'
       or coalesce(
            v_file ->> 'storage_namespace',
            ''
          ) <> 'lightsail-media'
       or v_file ->> 'mime_type'
            <> v_expected_mime
    then
      raise exception
        'Adaptive Video output file authority is invalid for role %.',
        v_role;
    end if;

    v_storage_path := nullif(
      btrim(v_file ->> 'storage_path'),
      ''
    );
    v_delivery_url := nullif(
      btrim(v_file ->> 'delivery_url'),
      ''
    );
    v_sha256 := lower(
      nullif(
        btrim(v_file ->> 'sha256'),
        ''
      )
    );
    v_byte_size := nullif(
      v_file ->> 'byte_size',
      ''
    )::bigint;

    v_expected_storage_path :=
      'derived-objects/' ||
      v_asset_id::text || '/' ||
      v_revision_id::text || '/' ||
      'video-adaptive-v1/' ||
      v_source_file_id::text || '/' ||
      v_expected_filename;

    v_expected_delivery_url :=
      'https://media.wakilisha.africa/derivatives/' ||
      v_asset_id::text || '/' ||
      v_revision_id::text || '/' ||
      'video-adaptive-v1/' ||
      v_source_file_id::text || '/' ||
      v_expected_filename;

    if v_storage_path is distinct from
         v_expected_storage_path
       or v_delivery_url is distinct from
            v_expected_delivery_url
       or v_sha256 is null
       or v_sha256 !~ '^[0-9a-f]{64}$'
       or v_byte_size is null
       or v_byte_size < 1
    then
      raise exception
        'Adaptive Video immutable file identity is invalid for role %.',
        v_role;
    end if;

    select file_object.*
    into v_existing_file
    from media.file_objects file_object
    where file_object.storage_provider = 'lightsail_media'
      and coalesce(file_object.storage_namespace, '') =
        'lightsail-media'
      and file_object.storage_path = v_storage_path;

    if found then
      if v_existing_file.verification_state <> 'verified'
         or v_existing_file.sha256 <> v_sha256
         or v_existing_file.byte_size <> v_byte_size
         or v_existing_file.mime_type <> v_expected_mime
         or v_existing_file.delivery_url <> v_delivery_url
      then
        raise exception
          'Immutable adaptive Video storage collision does not match registered bytes.';
      end if;

      v_file_object_id := v_existing_file.id;
    else
      v_file_object_id :=
        media.insert_verified_file_object_v2(
          v_file,
          v_actor_id,
          v_correlation_id
        );
    end if;

    select variant.id
    into v_variant_id
    from media.variants variant
    where variant.asset_revision_id = v_revision_id
      and variant.source_file_object_id = v_source_file_id
      and variant.derived_file_object_id = v_file_object_id
      and variant.variant_role = v_role;

    v_new_variant := not found;

    if v_new_variant then
      v_variant_id := extensions.gen_random_uuid();

      insert into media.variants (
        id,
        asset_id,
        asset_revision_id,
        source_file_object_id,
        derived_file_object_id,
        variant_role,
        transformation_spec,
        technical_metadata,
        generator_name,
        generator_version,
        created_by
      )
      values (
        v_variant_id,
        v_asset_id,
        v_revision_id,
        v_source_file_id,
        v_file_object_id,
        v_role,
        v_output -> 'transformation_spec',
        v_output -> 'technical_metadata',
        'wakilisha-media-processor',
        'phase7b-v4a-v1',
        v_actor_id
      );

      insert into media.events (
        asset_id,
        asset_revision_id,
        variant_id,
        file_object_id,
        event_type,
        actor_id,
        reason,
        resulting_state,
        correlation_id
      )
      values (
        v_asset_id,
        v_revision_id,
        v_variant_id,
        v_file_object_id,
        'variant_registered',
        v_actor_id,
        'Immutable adaptive Video derivative registered',
        jsonb_build_object(
          'variant_role', v_role,
          'source_file_object_id', v_source_file_id,
          'derived_file_object_id', v_file_object_id,
          'processing_profile', 'video-adaptive-v1'
        ),
        v_correlation_id
      );
    end if;

    select
      selection.variant_id,
      selection.selection_revision
    into
      v_selection_variant_id,
      v_selection_revision
    from media.variant_selections selection
    where selection.asset_revision_id = v_revision_id
      and selection.variant_role = v_role
    for update;

    if not found then
      v_selection_revision := 1;

      insert into media.variant_selections (
        asset_revision_id,
        variant_role,
        variant_id,
        selection_revision,
        selected_by
      )
      values (
        v_revision_id,
        v_role,
        v_variant_id,
        v_selection_revision,
        v_actor_id
      );

      insert into media.events (
        asset_id,
        asset_revision_id,
        variant_id,
        file_object_id,
        event_type,
        actor_id,
        reason,
        resulting_state,
        correlation_id
      )
      values (
        v_asset_id,
        v_revision_id,
        v_variant_id,
        v_file_object_id,
        'variant_activated',
        v_actor_id,
        'Adaptive Video derivative activated',
        jsonb_build_object(
          'variant_role', v_role,
          'selection_revision', v_selection_revision
        ),
        v_correlation_id
      );
    elsif v_selection_variant_id <> v_variant_id then
      v_selection_revision :=
        v_selection_revision + 1;

      update media.variant_selections
      set
        variant_id = v_variant_id,
        selection_revision = v_selection_revision,
        selected_by = v_actor_id,
        selected_at = now(),
        updated_at = now()
      where asset_revision_id = v_revision_id
        and variant_role = v_role;

      insert into media.events (
        asset_id,
        asset_revision_id,
        variant_id,
        file_object_id,
        event_type,
        actor_id,
        reason,
        resulting_state,
        correlation_id
      )
      values (
        v_asset_id,
        v_revision_id,
        v_variant_id,
        v_file_object_id,
        'variant_activated',
        v_actor_id,
        'Adaptive Video derivative activation advanced',
        jsonb_build_object(
          'variant_role', v_role,
          'selection_revision', v_selection_revision
        ),
        v_correlation_id
      );
    end if;

    v_results :=
      v_results ||
      jsonb_build_array(
        jsonb_build_object(
          'variant_role', v_role,
          'file_object_id', v_file_object_id,
          'variant_id', v_variant_id,
          'selection_revision', v_selection_revision,
          'storage_path', v_storage_path,
          'delivery_url', v_delivery_url
        )
      );
  end loop;

  if cardinality(v_seen_roles) <> 5
     or not ('video_hls_master' = any(v_seen_roles))
     or not ('video_hls_360p_playlist' = any(v_seen_roles))
     or not ('video_hls_360p_media' = any(v_seen_roles))
     or not ('video_hls_720p_playlist' = any(v_seen_roles))
     or not ('video_hls_720p_media' = any(v_seen_roles))
  then
    raise exception
      'Adaptive Video processing output set is incomplete.';
  end if;

  return jsonb_build_object(
    'job_id', p_job_id,
    'asset_id', v_asset_id,
    'asset_revision_id', v_revision_id,
    'source_file_object_id', v_source_file_id,
    'profile_version', 'video-adaptive-v1',
    'correlation_id', v_correlation_id,
    'outputs', v_results
  );
end;
$function$;

revoke all
  on function public.register_video_adaptive_processing_outputs_v1(
    uuid,
    text,
    jsonb
  )
  from public, anon, authenticated;

grant execute
  on function public.register_video_adaptive_processing_outputs_v1(
    uuid,
    text,
    jsonb
  )
  to service_role;

commit;
