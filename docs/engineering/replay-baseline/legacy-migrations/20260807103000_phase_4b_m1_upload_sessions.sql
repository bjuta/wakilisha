-- Phase 4B M1 resumable upload-session authority.
--
-- This migration adds durable control-plane state for protected large audio
-- masters. It reuses the existing canonical Media file-object authority and
-- does not create a second Media identity, job system, or processing queue.

begin;

set local statement_timeout = '180s';
set local lock_timeout = '5s';

do $phase_4b_m1_preflight$
begin
  if to_regnamespace('media') is null then
    raise exception 'STOP: media schema does not exist';
  end if;

  if to_regprocedure(
    'media.insert_verified_file_object_v2(jsonb,uuid,uuid)'
  ) is null then
    raise exception 'STOP: canonical verified Media file authority is absent';
  end if;

  if to_regclass('media.upload_sessions') is not null then
    raise exception 'STOP: media.upload_sessions already exists';
  end if;

  if exists (
    select 1
    from pg_proc procedure_row
    join pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname in (
        'create_media_upload_session_v1',
        'get_media_upload_session_v1',
        'verify_media_upload_session_v1',
        'expire_media_upload_session_v1',
        'fail_media_upload_session_v1',
        'cancel_media_upload_session_v1'
      )
  ) then
    raise exception 'STOP: Phase 4B M1 upload-session functions already exist';
  end if;
end;
$phase_4b_m1_preflight$;

create table media.upload_sessions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  idempotency_key text not null,
  state text not null default 'created',
  storage_provider text not null default 'lightsail_media',
  storage_namespace text not null default 'lightsail-media',
  storage_path text not null,
  original_filename text not null,
  file_extension text not null,
  mime_type text not null,
  expected_byte_size bigint not null,
  expected_sha256 text not null,
  part_size_bytes integer not null,
  total_parts integer not null,
  expires_at timestamptz not null,
  verified_byte_size bigint,
  verified_sha256 text,
  verified_at timestamptz,
  file_object_id uuid,
  correlation_id uuid not null,
  last_error text,
  cancelled_at timestamptz,
  expired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint upload_sessions_actor_fkey
    foreign key (actor_id)
    references auth.users(id)
    on delete restrict,

  constraint upload_sessions_provider_fkey
    foreign key (storage_provider)
    references media.storage_providers(storage_provider)
    on update cascade
    on delete restrict,

  constraint upload_sessions_file_object_fkey
    foreign key (file_object_id)
    references media.file_objects(id)
    on delete restrict,

  constraint upload_sessions_actor_idempotency_unique
    unique (actor_id, idempotency_key),

  constraint upload_sessions_storage_path_unique
    unique (storage_provider, storage_namespace, storage_path),

  constraint upload_sessions_file_object_unique
    unique (file_object_id),

  constraint upload_sessions_idempotency_check
    check (
      idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
    ),

  constraint upload_sessions_state_check
    check (
      state in (
        'created',
        'verified',
        'failed',
        'cancelled',
        'expired'
      )
    ),

  constraint upload_sessions_provider_check
    check (storage_provider = 'lightsail_media'),

  constraint upload_sessions_namespace_check
    check (storage_namespace = 'lightsail-media'),

  constraint upload_sessions_path_check
    check (
      storage_path ~
        '^masters/audio/[0-9]{4}/[0-9]{2}/[0-9a-f-]{36}\.[a-z0-9]{2,5}$'
    ),

  constraint upload_sessions_filename_check
    check (nullif(btrim(original_filename), '') is not null),

  constraint upload_sessions_extension_check
    check (
      file_extension in (
        'mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg', 'oga'
      )
    ),

  constraint upload_sessions_mime_check
    check (
      mime_type = lower(mime_type)
      and mime_type like 'audio/%'
    ),

  constraint upload_sessions_size_check
    check (
      expected_byte_size > 26214400
      and expected_byte_size <= 2147483648
    ),

  constraint upload_sessions_sha_check
    check (expected_sha256 ~ '^[0-9a-f]{64}$'),

  constraint upload_sessions_part_size_check
    check (
      part_size_bytes between 1048576 and 16777216
    ),

  constraint upload_sessions_total_parts_check
    check (total_parts >= 2),

  constraint upload_sessions_expiry_check
    check (expires_at > created_at),

  constraint upload_sessions_verified_integrity_check
    check (
      (
        state = 'verified'
        and verified_byte_size = expected_byte_size
        and verified_sha256 = expected_sha256
        and verified_at is not null
        and file_object_id is not null
        and last_error is null
        and cancelled_at is null
        and expired_at is null
      )
      or
      (
        state = 'failed'
        and nullif(btrim(last_error), '') is not null
        and verified_byte_size is null
        and verified_sha256 is null
        and file_object_id is null
        and verified_at is null
        and cancelled_at is null
        and expired_at is null
      )
      or
      (
        state = 'cancelled'
        and nullif(btrim(last_error), '') is not null
        and cancelled_at is not null
        and verified_byte_size is null
        and verified_sha256 is null
        and file_object_id is null
        and verified_at is null
        and expired_at is null
      )
      or
      (
        state = 'expired'
        and expired_at is not null
        and nullif(btrim(last_error), '') is not null
        and verified_byte_size is null
        and verified_sha256 is null
        and file_object_id is null
        and verified_at is null
        and cancelled_at is null
      )
      or
      (
        state = 'created'
        and last_error is null
        and verified_byte_size is null
        and verified_sha256 is null
        and file_object_id is null
        and verified_at is null
        and cancelled_at is null
        and expired_at is null
      )
    )
);

create index upload_sessions_actor_state_idx
  on media.upload_sessions(actor_id, state, created_at desc);

create index upload_sessions_expiry_idx
  on media.upload_sessions(expires_at)
  where state = 'created';

alter table media.upload_sessions enable row level security;

revoke all on media.upload_sessions
from public, anon, authenticated, service_role;

create or replace function public.create_media_upload_session_v1(
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
  v_correlation_id uuid := coalesce(p_correlation_id, gen_random_uuid());
  v_filename text := btrim(coalesce(p_original_filename, ''));
  v_mime_type text := lower(btrim(coalesce(p_mime_type, '')));
  v_sha256 text := lower(btrim(coalesce(p_expected_sha256, '')));
  v_extension text;
  v_part_size integer := 8388608;
  v_total_parts integer;
  v_storage_path text;
  v_existing media.upload_sessions%rowtype;
begin
  v_actor_id := media.require_command_actor('manage_media_assets');

  if p_idempotency_key is null
     or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
  then
    raise exception 'Upload idempotency key is invalid';
  end if;

  if v_filename = '' or strpos(v_filename, '.') = 0 then
    raise exception 'Audio master filename with extension is required';
  end if;

  v_extension := lower(reverse(split_part(reverse(v_filename), '.', 1)));

  if v_extension not in ('mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg', 'oga') then
    raise exception 'Unsupported audio master extension';
  end if;

  if v_mime_type not like 'audio/%' then
    raise exception 'Audio master MIME type is required';
  end if;

  if p_expected_byte_size is null
     or p_expected_byte_size <= 26214400
     or p_expected_byte_size > 2147483648
  then
    raise exception 'Resumable audio master must be larger than 25 MiB and no larger than 2 GiB';
  end if;

  if v_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'Expected audio master SHA-256 is invalid';
  end if;

  if p_ttl_seconds not between 300 and 86400 then
    raise exception 'Upload session TTL must be between 300 and 86400 seconds';
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
      raise exception 'Upload idempotency key is already bound to different file metadata';
    end if;

    return jsonb_build_object(
      'session_id', v_existing.id,
      'state', v_existing.state,
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

  v_total_parts := ceil(
    p_expected_byte_size::numeric / v_part_size::numeric
  )::integer;

  v_storage_path :=
    'masters/audio/' ||
    to_char(now(), 'YYYY/MM') || '/' ||
    v_session_id::text || '.' ||
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

create or replace function public.get_media_upload_session_v1(
  p_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, media, auth
as $function$
declare
  v_actor_id uuid;
  v_session media.upload_sessions%rowtype;
begin
  v_actor_id := media.require_command_actor('manage_media_assets');

  select session_row.*
  into v_session
  from media.upload_sessions session_row
  where session_row.id = p_session_id;

  if not found then
    raise exception 'Upload session does not exist';
  end if;

  if v_session.actor_id <> v_actor_id then
    raise exception 'Upload session belongs to another actor';
  end if;

  return jsonb_build_object(
    'session_id', v_session.id,
    'state', v_session.state,
    'storage_path', v_session.storage_path,
    'storage_provider', v_session.storage_provider,
    'storage_namespace', v_session.storage_namespace,
    'original_filename', v_session.original_filename,
    'mime_type', v_session.mime_type,
    'expected_byte_size', v_session.expected_byte_size,
    'expected_sha256', v_session.expected_sha256,
    'part_size_bytes', v_session.part_size_bytes,
    'total_parts', v_session.total_parts,
    'expires_at', v_session.expires_at,
    'verified_byte_size', v_session.verified_byte_size,
    'verified_sha256', v_session.verified_sha256,
    'verified_at', v_session.verified_at,
    'expired_at', v_session.expired_at,
    'file_object_id', v_session.file_object_id,
    'last_error', v_session.last_error,
    'correlation_id', v_session.correlation_id
  );
end;
$function$;

create or replace function public.verify_media_upload_session_v1(
  p_session_id uuid,
  p_storage_path text,
  p_byte_size bigint,
  p_sha256 text,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, media, auth
as $function$
declare
  v_session media.upload_sessions%rowtype;
  v_file_object_id uuid;
  v_correlation_id uuid;
  v_file jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception
      using
        errcode = '42501',
        message = 'Service-role access is required.';
  end if;

  select session_row.*
  into v_session
  from media.upload_sessions session_row
  where session_row.id = p_session_id
  for update;

  if not found then
    raise exception 'Upload session does not exist';
  end if;

  if v_session.state = 'verified' then
    if v_session.storage_path is distinct from p_storage_path
       or v_session.verified_byte_size is distinct from p_byte_size
       or v_session.verified_sha256 is distinct from lower(btrim(p_sha256))
       or v_session.file_object_id is null
    then
      raise exception 'Verified upload session evidence does not match retry';
    end if;

    return jsonb_build_object(
      'session_id', v_session.id,
      'state', v_session.state,
      'storage_path', v_session.storage_path,
      'byte_size', v_session.verified_byte_size,
      'sha256', v_session.verified_sha256,
      'file_object_id', v_session.file_object_id,
      'correlation_id', v_session.correlation_id
    );
  end if;

  if v_session.state <> 'created' then
    raise exception 'Upload session is not eligible for verification';
  end if;

  if v_session.expires_at <= now() then
    raise exception 'Upload session has expired';
  end if;

  if v_session.storage_path is distinct from nullif(btrim(p_storage_path), '')
     or v_session.expected_byte_size is distinct from p_byte_size
     or v_session.expected_sha256 is distinct from lower(btrim(p_sha256))
  then
    raise exception 'Receiver verification evidence does not match upload session';
  end if;

  v_correlation_id := coalesce(p_correlation_id, v_session.correlation_id);

  v_file := jsonb_build_object(
    'storage_provider', v_session.storage_provider,
    'storage_namespace', v_session.storage_namespace,
    'storage_path', v_session.storage_path,
    'delivery_url',
      'https://media.wakilisha.africa/__private/media-master/' ||
      v_session.id::text,
    'original_filename', v_session.original_filename,
    'mime_type', v_session.mime_type,
    'byte_size', v_session.expected_byte_size,
    'sha256', v_session.expected_sha256,
    'technical_metadata', jsonb_build_object(
      'upload_session_id', v_session.id,
      'transfer_kind', 'resumable_parts',
      'protected_original', true,
      'part_size_bytes', v_session.part_size_bytes,
      'total_parts', v_session.total_parts
    )
  );

  v_file_object_id := media.insert_verified_file_object_v2(
    v_file,
    v_session.actor_id,
    v_correlation_id
  );

  update media.upload_sessions
  set
    state = 'verified',
    verified_byte_size = p_byte_size,
    verified_sha256 = lower(btrim(p_sha256)),
    verified_at = now(),
    file_object_id = v_file_object_id,
    last_error = null,
    updated_at = now()
  where id = v_session.id;

  return jsonb_build_object(
    'session_id', v_session.id,
    'state', 'verified',
    'storage_path', v_session.storage_path,
    'byte_size', p_byte_size,
    'sha256', lower(btrim(p_sha256)),
    'file_object_id', v_file_object_id,
    'correlation_id', v_correlation_id
  );
end;
$function$;

create or replace function public.expire_media_upload_session_v1(
  p_session_id uuid,
  p_reason text default 'Upload session expired before verification'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, media, auth
as $function$
declare
  v_session media.upload_sessions%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception
      using
        errcode = '42501',
        message = 'Service-role access is required.';
  end if;

  if nullif(btrim(p_reason), '') is null then
    raise exception 'Upload expiry reason is required';
  end if;

  select session_row.*
  into v_session
  from media.upload_sessions session_row
  where session_row.id = p_session_id
  for update;

  if not found then
    raise exception 'Upload session does not exist';
  end if;

  if v_session.state = 'verified' then
    raise exception 'Verified upload session cannot expire';
  end if;

  if v_session.state in ('failed', 'cancelled', 'expired') then
    return jsonb_build_object(
      'session_id', v_session.id,
      'state', v_session.state,
      'expired_at', v_session.expired_at
    );
  end if;

  if v_session.expires_at > now() then
    raise exception 'Upload session has not expired';
  end if;

  update media.upload_sessions
  set
    state = 'expired',
    last_error = btrim(p_reason),
    expired_at = now(),
    updated_at = now()
  where id = v_session.id;

  return jsonb_build_object(
    'session_id', v_session.id,
    'state', 'expired',
    'expired_at', now(),
    'error', btrim(p_reason)
  );
end;
$function$;

create or replace function public.fail_media_upload_session_v1(
  p_session_id uuid,
  p_error text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, media, auth
as $function$
declare
  v_session media.upload_sessions%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception
      using
        errcode = '42501',
        message = 'Service-role access is required.';
  end if;

  if nullif(btrim(p_error), '') is null then
    raise exception 'Upload-session failure reason is required';
  end if;

  select session_row.*
  into v_session
  from media.upload_sessions session_row
  where session_row.id = p_session_id
  for update;

  if not found then
    raise exception 'Upload session does not exist';
  end if;

  if v_session.state = 'verified' then
    raise exception 'Verified upload session cannot be failed';
  end if;

  if v_session.state in ('failed', 'cancelled', 'expired') then
    return jsonb_build_object(
      'session_id', v_session.id,
      'state', v_session.state,
      'error', v_session.last_error
    );
  end if;

  update media.upload_sessions
  set
    state = 'failed',
    last_error = btrim(p_error),
    updated_at = now()
  where id = v_session.id;

  return jsonb_build_object(
    'session_id', v_session.id,
    'state', 'failed',
    'error', btrim(p_error)
  );
end;
$function$;

create or replace function public.cancel_media_upload_session_v1(
  p_session_id uuid,
  p_reason text default 'Cancel resumable Media upload session'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, media, auth
as $function$
declare
  v_actor_id uuid;
  v_session media.upload_sessions%rowtype;
begin
  v_actor_id := media.require_command_actor('manage_media_assets');

  if nullif(btrim(p_reason), '') is null then
    raise exception 'Upload cancellation reason is required';
  end if;

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

  if v_session.state = 'verified' then
    raise exception 'Verified upload session cannot be cancelled';
  end if;

  if v_session.state in ('failed', 'cancelled', 'expired') then
    return jsonb_build_object(
      'session_id', v_session.id,
      'state', v_session.state,
      'error', v_session.last_error,
      'cancelled_at', v_session.cancelled_at,
      'expired_at', v_session.expired_at
    );
  end if;

  if v_session.state <> 'created' then
    raise exception 'Upload session is not eligible for cancellation';
  end if;

  update media.upload_sessions
  set
    state = 'cancelled',
    last_error = btrim(p_reason),
    cancelled_at = now(),
    expired_at = null,
    updated_at = now()
  where id = v_session.id;

  return jsonb_build_object(
    'session_id', v_session.id,
    'state', 'cancelled'
  );
end;
$function$;

revoke all on function public.create_media_upload_session_v1(
  text, text, text, bigint, text, integer, uuid
) from public, anon, authenticated, service_role;

grant execute on function public.create_media_upload_session_v1(
  text, text, text, bigint, text, integer, uuid
) to authenticated;

revoke all on function public.get_media_upload_session_v1(uuid)
from public, anon, authenticated, service_role;

grant execute on function public.get_media_upload_session_v1(uuid)
to authenticated;

revoke all on function public.verify_media_upload_session_v1(
  uuid, text, bigint, text, uuid
) from public, anon, authenticated, service_role;

grant execute on function public.verify_media_upload_session_v1(
  uuid, text, bigint, text, uuid
) to service_role;

revoke all on function public.expire_media_upload_session_v1(uuid, text)
from public, anon, authenticated, service_role;

grant execute on function public.expire_media_upload_session_v1(uuid, text)
to service_role;

revoke all on function public.fail_media_upload_session_v1(uuid, text)
from public, anon, authenticated, service_role;

grant execute on function public.fail_media_upload_session_v1(uuid, text)
to service_role;

revoke all on function public.cancel_media_upload_session_v1(uuid, text)
from public, anon, authenticated, service_role;

grant execute on function public.cancel_media_upload_session_v1(uuid, text)
to authenticated;

commit;
