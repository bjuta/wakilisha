-- Phase 7B V4A: Media processing-profile convergence + adaptive Video.
--
-- Primitive rule:
-- Audio supplied the first real additive publication-processing profile.
-- Video is the second domain proving the same Media concept.
-- V4A therefore promotes one canonical Media processing-profile authority
-- rather than adding Video-specific submission or registration adapters.
--
-- The accepted Phase 4 audio-v1/video-v1 RPC contracts remain untouched.

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
     or to_regclass('media.asset_kinds') is null
     or to_regclass('media.asset_revisions') is null
     or to_regclass('media.file_objects') is null
     or to_regclass('media.variants') is null
     or to_regclass('media.variant_selections') is null
     or to_regclass('media.variant_roles') is null
     or to_regclass('media.usage_links') is null
     or to_regclass('media.usage_roles') is null
     or to_regclass('media.events') is null
     or to_regclass('editorial.resources') is null
     or to_regclass('editorial.media_asset_resources') is null
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
       'public.submit_audio_delivery_processing_v1(uuid,uuid,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.register_audio_delivery_processing_outputs_v1(uuid,text,jsonb)'
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

  if to_regclass('media.processing_profiles') is not null
     or to_regclass('media.processing_profile_outputs') is not null
     or to_regprocedure(
       'public.submit_media_processing_profile_v1(uuid,uuid,text,text,uuid)'
     ) is not null
     or to_regprocedure(
       'public.register_media_processing_profile_outputs_v1(uuid,text,jsonb)'
     ) is not null
  then
    raise exception
      'STOP: canonical Media processing-profile authority already exists';
  end if;

  if to_regprocedure(
       'public.submit_video_adaptive_processing_v1(uuid,uuid,text,uuid)'
     ) is not null
     or to_regprocedure(
       'public.register_video_adaptive_processing_outputs_v1(uuid,text,jsonb)'
     ) is not null
  then
    raise exception
      'STOP: competing Video-specific processing adapters already exist';
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

  v_video_v1_submit := pg_get_functiondef(
    'public.submit_media_processing_command_v1(uuid,uuid,text,text,uuid)'::regprocedure
  );
  v_video_v1_register := pg_get_functiondef(
    'public.register_media_processing_outputs_v1(uuid,text,jsonb)'::regprocedure
  );

  if position(
       'audio-publication-v1'
       in v_video_v1_submit
     ) > 0
     or position(
       'video-adaptive-v1'
       in v_video_v1_submit
     ) > 0
     or position(
       'audio-publication-v1'
       in v_video_v1_register
     ) > 0
     or position(
       'video-adaptive-v1'
       in v_video_v1_register
     ) > 0
  then
    raise exception
      'STOP: accepted Phase 4 v1 processing functions were broadened';
  end if;
end;
$phase_7b_v4a_preflight$;

-- ---------------------------------------------------------------------------
-- Canonical Media processing-profile authority.
-- ---------------------------------------------------------------------------

create table media.processing_profiles (
  profile_version text primary key,
  label text not null,
  description text not null,
  asset_kind text not null
    references media.asset_kinds(asset_kind)
    on update cascade
    on delete restrict,
  generator_name text not null,
  generator_version text not null,
  required_usage_authority text not null,
  required_usage_target_kind text not null,
  required_usage_role text not null
    references media.usage_roles(usage_role)
    on update cascade
    on delete restrict,
  required_usage_target_version_kind text,
  require_usage_target_version boolean not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  check (
    profile_version ~ '^[a-z][a-z0-9-]{2,79}$'
  ),
  check (
    nullif(btrim(label), '') is not null
    and nullif(btrim(description), '') is not null
  ),
  check (
    nullif(btrim(generator_name), '') is not null
    and nullif(btrim(generator_version), '') is not null
  ),
  check (
    nullif(btrim(required_usage_authority), '') is not null
    and nullif(btrim(required_usage_target_kind), '') is not null
  ),
  check (
    require_usage_target_version
      =
    (required_usage_target_version_kind is not null)
  )
);

alter table media.processing_profiles
  enable row level security;

revoke all on media.processing_profiles
  from public, anon, authenticated, service_role;

create table media.processing_profile_outputs (
  profile_version text not null
    references media.processing_profiles(profile_version)
    on update cascade
    on delete restrict,
  output_order integer not null
    check (output_order >= 1),
  variant_role text not null
    references media.variant_roles(variant_role)
    on update cascade
    on delete restrict,
  filename text not null,
  mime_type text not null,
  transformation_spec jsonb not null,
  primary key (
    profile_version,
    variant_role
  ),
  unique (
    profile_version,
    output_order
  ),
  unique (
    profile_version,
    filename
  ),
  check (
    filename ~ '^[a-z0-9][a-z0-9_.-]{1,199}$'
    and filename !~ '[.][.]'
  ),
  check (
    nullif(btrim(mime_type), '') is not null
  ),
  check (
    jsonb_typeof(transformation_spec) = 'object'
  )
);

alter table media.processing_profile_outputs
  enable row level security;

revoke all on media.processing_profile_outputs
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Adaptive Video vocabulary.
-- ---------------------------------------------------------------------------

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

-- Audio is the first real consumer of the additive processing-profile concept.
-- Video is the second. Register both in the promoted shared authority.

insert into media.processing_profiles (
  profile_version,
  label,
  description,
  asset_kind,
  generator_name,
  generator_version,
  required_usage_authority,
  required_usage_target_kind,
  required_usage_role,
  required_usage_target_version_kind,
  require_usage_target_version
)
values
  (
    'audio-publication-v1',
    'Audio publication delivery v1',
    'Full-length Audio publication derivative over an exact active Audio master.',
    'audio',
    'wakilisha-media-processor',
    'phase6a-m2-v1',
    'editorial',
    'audio_publication',
    'audio_master',
    null,
    false
  ),
  (
    'video-adaptive-v1',
    'Adaptive Video publication v1',
    'Bounded two-rendition HLS package over an exact version-bound Video master.',
    'video',
    'wakilisha-media-processor',
    'phase7b-v4a-v1',
    'video',
    'video_publication',
    'video_master',
    'video_publication_version',
    true
  );

insert into media.processing_profile_outputs (
  profile_version,
  output_order,
  variant_role,
  filename,
  mime_type,
  transformation_spec
)
values
  (
    'audio-publication-v1',
    1,
    'audio_delivery',
    'audio_delivery.mp3',
    'audio/mpeg',
    jsonb_build_object(
      'profile', 'audio-publication-v1',
      'full_length', true,
      'codec', 'mp3',
      'bitrate_kbps', 128,
      'channels', 2
    )
  ),
  (
    'video-adaptive-v1',
    1,
    'video_hls_master',
    'video_hls_master.m3u8',
    'application/vnd.apple.mpegurl',
    jsonb_build_object(
      'profile', 'video-adaptive-v1',
      'kind', 'master_playlist',
      'hls_version', 6,
      'rendition_count', 2,
      'segment_seconds', 4,
      'segment_mode', 'single_file_byte_range'
    )
  ),
  (
    'video-adaptive-v1',
    2,
    'video_hls_360p_playlist',
    'video_hls_360p_playlist.m3u8',
    'application/vnd.apple.mpegurl',
    jsonb_build_object(
      'profile', 'video-adaptive-v1',
      'kind', 'media_playlist',
      'hls_version', 6,
      'segment_seconds', 4,
      'segment_mode', 'single_file_byte_range',
      'max_width', 640,
      'max_height', 360,
      'video_bitrate_kbps', 800,
      'audio_bitrate_kbps', 96
    )
  ),
  (
    'video-adaptive-v1',
    3,
    'video_hls_360p_media',
    'video_hls_360p_media.ts',
    'video/mp2t',
    jsonb_build_object(
      'profile', 'video-adaptive-v1',
      'kind', 'media',
      'container', 'mpegts',
      'hls_version', 6,
      'segment_seconds', 4,
      'segment_mode', 'single_file_byte_range',
      'max_width', 640,
      'max_height', 360,
      'video_codec', 'h264',
      'audio_codec', 'aac',
      'video_bitrate_kbps', 800,
      'audio_bitrate_kbps', 96
    )
  ),
  (
    'video-adaptive-v1',
    4,
    'video_hls_720p_playlist',
    'video_hls_720p_playlist.m3u8',
    'application/vnd.apple.mpegurl',
    jsonb_build_object(
      'profile', 'video-adaptive-v1',
      'kind', 'media_playlist',
      'hls_version', 6,
      'segment_seconds', 4,
      'segment_mode', 'single_file_byte_range',
      'max_width', 1280,
      'max_height', 720,
      'video_bitrate_kbps', 2500,
      'audio_bitrate_kbps', 128
    )
  ),
  (
    'video-adaptive-v1',
    5,
    'video_hls_720p_media',
    'video_hls_720p_media.ts',
    'video/mp2t',
    jsonb_build_object(
      'profile', 'video-adaptive-v1',
      'kind', 'media',
      'container', 'mpegts',
      'hls_version', 6,
      'segment_seconds', 4,
      'segment_mode', 'single_file_byte_range',
      'max_width', 1280,
      'max_height', 720,
      'video_codec', 'h264',
      'audio_codec', 'aac',
      'video_bitrate_kbps', 2500,
      'audio_bitrate_kbps', 128
    )
  );

-- ---------------------------------------------------------------------------
-- Canonical additive processing-profile submission.
-- ---------------------------------------------------------------------------

create or replace function
  public.submit_media_processing_profile_v1(
    p_asset_id uuid,
    p_asset_revision_id uuid,
    p_profile_version text,
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
  v_profile media.processing_profiles%rowtype;
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
     or nullif(btrim(p_profile_version), '') is null
     or p_idempotency_key is null
     or p_idempotency_key !~
       '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
  then
    raise exception
      using
        errcode = '22023',
        message = 'Media processing-profile request is invalid.';
  end if;

  select profile.*
  into v_profile
  from media.processing_profiles profile
  where profile.profile_version = btrim(p_profile_version)
    and profile.enabled;

  if not found then
    raise exception
      using
        errcode = '22023',
        message = 'Media processing profile is unavailable.';
  end if;

  select *
  into v_asset
  from media.assets
  where id = p_asset_id;

  if not found
     or v_asset.lifecycle_state <> 'active'
     or v_asset.asset_kind <> v_profile.asset_kind
  then
    raise exception
      using
        errcode = '55000',
        message =
          'Media processing profile does not match an active Media asset.';
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
        message =
          'Media revision does not belong to the requested asset.';
  end if;

  select *
  into v_source
  from media.file_objects
  where id = v_revision.original_file_object_id;

  if not found
     or v_source.verification_state <> 'verified'
     or v_source.storage_provider <> 'lightsail_media'
     or v_source.storage_path is null
     or v_source.storage_path !~
          ('^masters/' || v_profile.asset_kind || '/')
     or v_source.sha256 is null
     or v_source.byte_size is null
     or v_source.mime_type not like
          (v_profile.asset_kind || '/%')
  then
    raise exception
      using
        errcode = '55000',
        message =
          'Media processing profile requires a verified protected matching master.';
  end if;

  if not exists (
    select 1
    from media.usage_links usage
    where usage.asset_id = p_asset_id
      and usage.asset_revision_id = p_asset_revision_id
      and usage.resolution_mode = 'exact_revision'
      and usage.target_authority =
            v_profile.required_usage_authority
      and usage.target_kind =
            v_profile.required_usage_target_kind
      and usage.usage_role =
            v_profile.required_usage_role
      and usage.usage_state = 'active'
      and (
        (
          not v_profile.require_usage_target_version
          and usage.target_version_kind is null
          and usage.target_version_id is null
        )
        or (
          v_profile.require_usage_target_version
          and usage.target_version_kind =
                v_profile.required_usage_target_version_kind
          and usage.target_version_id is not null
        )
      )
  ) then
    raise exception
      using
        errcode = '55000',
        message =
          'Media processing profile requires its governed exact-revision usage binding.';
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
        'Media Resource binding is invalid.';
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
    'profile_version', v_profile.profile_version,
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
        'Media processing-profile idempotency receipt disappeared.';
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
        'Accepted Media processing-profile command is missing its durable job or event.';
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
      'profile_version', v_profile.profile_version,
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
  on function public.submit_media_processing_profile_v1(
    uuid,
    uuid,
    text,
    text,
    uuid
  )
  from public, anon, service_role;

grant execute
  on function public.submit_media_processing_profile_v1(
    uuid,
    uuid,
    text,
    text,
    uuid
  )
  to authenticated;

-- ---------------------------------------------------------------------------
-- Canonical processing-profile output registration.
-- ---------------------------------------------------------------------------

create or replace function
  public.register_media_processing_profile_outputs_v1(
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
  v_profile media.processing_profiles%rowtype;
  v_expected_count integer;
  v_actor_id uuid;
  v_asset_id uuid;
  v_revision_id uuid;
  v_source_file_id uuid;
  v_correlation_id uuid;
  v_output jsonb;
  v_file jsonb;
  v_contract media.processing_profile_outputs%rowtype;
  v_role text;
  v_seen_roles text[] := array[]::text[];
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
  then
    raise exception
      using
        errcode = '22023',
        message =
          'Media processing-profile registration request is invalid.';
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
  then
    raise exception
      using
        errcode = '55000',
        message =
          'The Media processing-profile job is not actively leased to this worker.';
  end if;

  select profile.*
  into v_profile
  from media.processing_profiles profile
  where profile.profile_version =
          nullif(v_job.input_payload ->> 'profile_version', '')
    and profile.enabled;

  if not found then
    raise exception
      'Leased Media job does not identify an enabled canonical processing profile.';
  end if;

  select count(*)
  into v_expected_count
  from media.processing_profile_outputs output_contract
  where output_contract.profile_version =
    v_profile.profile_version;

  if v_expected_count < 1
     or jsonb_array_length(p_outputs) <> v_expected_count
  then
    raise exception
      'Processing output count does not match canonical profile %.'
      , v_profile.profile_version;
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
          'Media processing-profile receipt actor or state is invalid.';
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
         and asset.asset_kind = v_profile.asset_kind
         and source_file.verification_state = 'verified'
         and source_file.storage_provider = 'lightsail_media'
         and source_file.storage_path !~ '[.][.]'
         and source_file.storage_path ~
              ('^masters/' || v_profile.asset_kind || '/')
     )
  then
    raise exception
      'Media processing-profile source authority changed or is invalid.';
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
        'Every Media processing-profile output must contain file, transformation, and technical metadata objects.';
    end if;

    v_role := nullif(
      btrim(v_output ->> 'variant_role'),
      ''
    );

    if v_role is null
       or v_role = any(v_seen_roles)
    then
      raise exception
        'Media processing-profile variant roles must be present and unique.';
    end if;

    select contract.*
    into v_contract
    from media.processing_profile_outputs contract
    where contract.profile_version = v_profile.profile_version
      and contract.variant_role = v_role;

    if not found then
      raise exception
        'Variant role % is not permitted for processing profile %.',
        v_role,
        v_profile.profile_version;
    end if;

    v_seen_roles := array_append(
      v_seen_roles,
      v_role
    );

    if v_output -> 'transformation_spec'
         is distinct from v_contract.transformation_spec
       or v_output ->> 'generator_name'
            is distinct from v_profile.generator_name
       or v_output ->> 'generator_version'
            is distinct from v_profile.generator_version
       or v_output -> 'technical_metadata' ->> 'processing_profile'
            is distinct from v_profile.profile_version
       or v_output -> 'technical_metadata' ->> 'source_file_object_id'
            is distinct from v_source_file_id::text
    then
      raise exception
        'Processing-profile transformation or generator contract is invalid for role %.',
        v_role;
    end if;

    v_file := v_output -> 'file';

    if v_file ->> 'storage_provider'
         is distinct from 'lightsail_media'
       or coalesce(
            v_file ->> 'storage_namespace',
            ''
          ) is distinct from 'lightsail-media'
       or v_file ->> 'mime_type'
            is distinct from v_contract.mime_type
    then
      raise exception
        'Processing-profile file authority is invalid for role %.',
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
      v_profile.profile_version || '/' ||
      v_source_file_id::text || '/' ||
      v_contract.filename;

    v_expected_delivery_url :=
      'https://media.wakilisha.africa/derivatives/' ||
      v_asset_id::text || '/' ||
      v_revision_id::text || '/' ||
      v_profile.profile_version || '/' ||
      v_source_file_id::text || '/' ||
      v_contract.filename;

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
        'Processing-profile immutable file identity is invalid for role %.',
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
         or v_existing_file.mime_type <> v_contract.mime_type
         or v_existing_file.delivery_url <> v_delivery_url
      then
        raise exception
          'Immutable processing-profile storage collision does not match registered bytes.';
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
        v_profile.generator_name,
        v_profile.generator_version,
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
        'Immutable canonical Media processing-profile derivative registered',
        jsonb_build_object(
          'variant_role', v_role,
          'source_file_object_id', v_source_file_id,
          'derived_file_object_id', v_file_object_id,
          'processing_profile', v_profile.profile_version
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
        'Canonical Media processing-profile derivative activated',
        jsonb_build_object(
          'variant_role', v_role,
          'selection_revision', v_selection_revision,
          'processing_profile', v_profile.profile_version
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
        'Canonical Media processing-profile derivative activation advanced',
        jsonb_build_object(
          'variant_role', v_role,
          'selection_revision', v_selection_revision,
          'processing_profile', v_profile.profile_version
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

  if cardinality(v_seen_roles) <> v_expected_count
     or exists (
       select 1
       from media.processing_profile_outputs contract
       where contract.profile_version =
             v_profile.profile_version
         and not (
           contract.variant_role =
             any(v_seen_roles)
         )
     )
  then
    raise exception
      'Processing-profile output set is incomplete for %.',
      v_profile.profile_version;
  end if;

  return jsonb_build_object(
    'job_id', p_job_id,
    'asset_id', v_asset_id,
    'asset_revision_id', v_revision_id,
    'source_file_object_id', v_source_file_id,
    'profile_version', v_profile.profile_version,
    'correlation_id', v_correlation_id,
    'outputs', v_results
  );
end;
$function$;

revoke all
  on function public.register_media_processing_profile_outputs_v1(
    uuid,
    text,
    jsonb
  )
  from public, anon, authenticated;

grant execute
  on function public.register_media_processing_profile_outputs_v1(
    uuid,
    text,
    jsonb
  )
  to service_role;

-- ---------------------------------------------------------------------------
-- Migrate the first-domain Audio candidate to compatibility wrappers.
-- These names remain for backward compatibility; they no longer own authority.
-- ---------------------------------------------------------------------------

create or replace function
  public.submit_audio_delivery_processing_v1(
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
language sql
security definer
set search_path to
  'pg_catalog',
  'public'
as $function$
  select *
  from public.submit_media_processing_profile_v1(
    p_asset_id,
    p_asset_revision_id,
    'audio-publication-v1',
    p_idempotency_key,
    p_correlation_id
  );
$function$;

revoke all
  on function public.submit_audio_delivery_processing_v1(
    uuid,
    uuid,
    text,
    uuid
  )
  from public, anon, service_role;

grant execute
  on function public.submit_audio_delivery_processing_v1(
    uuid,
    uuid,
    text,
    uuid
  )
  to authenticated;

create or replace function
  public.register_audio_delivery_processing_outputs_v1(
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
  'platform_private'
as $function$
declare
  v_profile_version text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception
      using
        errcode = '42501',
        message = 'Service-role access is required.';
  end if;

  select job.input_payload ->> 'profile_version'
  into v_profile_version
  from platform_private.jobs job
  where job.id = p_job_id;

  if v_profile_version is distinct from
       'audio-publication-v1'
  then
    raise exception
      'Audio delivery compatibility registration accepts only audio-publication-v1.';
  end if;

  return public.register_media_processing_profile_outputs_v1(
    p_job_id,
    p_worker_id,
    p_outputs
  );
end;
$function$;

revoke all
  on function public.register_audio_delivery_processing_outputs_v1(
    uuid,
    text,
    jsonb
  )
  from public, anon, authenticated;

grant execute
  on function public.register_audio_delivery_processing_outputs_v1(
    uuid,
    text,
    jsonb
  )
  to service_role;

commit;
