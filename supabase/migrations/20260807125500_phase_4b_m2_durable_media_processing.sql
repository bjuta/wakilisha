begin;

set local statement_timeout = '120s';
set local lock_timeout = '5s';

do $phase_4b_m2_preflight$
begin
  if to_regclass('editorial.resources') is null
     or to_regclass('media.assets') is null
     or to_regclass('media.asset_revisions') is null
     or to_regclass('media.file_objects') is null
     or to_regclass('media.variants') is null
     or to_regclass('media.variant_selections') is null
     or to_regclass('platform_private.command_receipts') is null
     or to_regclass('platform_private.jobs') is null
     or to_regclass('platform_private.outbox_events') is null
  then
    raise exception
      'STOP: Phase 4B M2 authority dependencies are incomplete';
  end if;

  if to_regprocedure(
       'platform_private.complete_job(uuid,text,jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.fail_job(uuid,text,text,boolean,integer)'
     ) is null
     or to_regprocedure(
       'media.insert_verified_file_object_v2(jsonb,uuid,uuid)'
     ) is null
     or to_regprocedure(
       'public.current_user_has_capability(text)'
     ) is null
     or to_regprocedure(
       'public.current_user_is_administrator()'
     ) is null
  then
    raise exception
      'STOP: Phase 4B M2 required command helpers are incomplete';
  end if;

  if exists (
    select 1
    from editorial.resource_kinds
    where kind = 'media_asset'
  ) then
    raise exception
      'STOP: media_asset resource kind already exists';
  end if;

  if to_regclass('editorial.media_asset_resources') is not null then
    raise exception
      'STOP: editorial.media_asset_resources already exists';
  end if;

  if exists (
    select 1
    from platform_private.command_types
    where command_type = 'media.process_revision'
       or job_type = 'media.process_revision'
  ) then
    raise exception
      'STOP: Media processing command type already exists';
  end if;

  if exists (
    select 1
    from media.variant_roles
    where variant_role = 'waveform_data'
  ) then
    raise exception
      'STOP: waveform_data variant role already exists';
  end if;
end;
$phase_4b_m2_preflight$;

insert into editorial.resource_kinds (
  kind,
  label,
  description
)
values (
  'media_asset',
  'Media asset',
  'Stable shared resource identity for one canonical Media asset.'
);

create table editorial.media_asset_resources (
  resource_id uuid primary key,
  resource_kind text not null default 'media_asset',
  asset_id uuid not null unique,

  constraint media_asset_resources_kind_check
    check (resource_kind = 'media_asset'),

  constraint media_asset_resources_resource_fkey
    foreign key (resource_id, resource_kind)
    references editorial.resources(id, resource_kind)
    on update cascade
    on delete cascade,

  constraint media_asset_resources_asset_fkey
    foreign key (asset_id)
    references media.assets(id)
    on update cascade
    on delete restrict
);

comment on table editorial.media_asset_resources is
  'Typed immutable binding between shared resource identity and canonical Media asset identity.';

create or replace function editorial.assert_resource_binding_integrity()
returns trigger
language plpgsql
set search_path = pg_catalog, editorial
as $function$
declare
  target_resource_id uuid;
  target_kind text;
  binding_count integer;
begin
  if tg_table_name = 'resources' then
    if tg_op = 'DELETE' then
      return null;
    end if;

    target_resource_id := new.id;
  else
    if tg_op = 'DELETE' then
      target_resource_id := old.resource_id;
    else
      target_resource_id := new.resource_id;
    end if;
  end if;

  select resource_kind
  into target_kind
  from editorial.resources
  where id = target_resource_id;

  if not found then
    return null;
  end if;

  case target_kind
    when 'article' then
      select count(*)
      into binding_count
      from editorial.article_resources
      where resource_id = target_resource_id;

    when 'playlist' then
      select count(*)
      into binding_count
      from editorial.playlist_resources
      where resource_id = target_resource_id;

    when 'registry_artist' then
      select count(*)
      into binding_count
      from editorial.registry_artist_resources
      where resource_id = target_resource_id;

    when 'correction_case' then
      select count(*)
      into binding_count
      from editorial.correction_cases
      where resource_id = target_resource_id;

    when 'media_asset' then
      select count(*)
      into binding_count
      from editorial.media_asset_resources
      where resource_id = target_resource_id;

    else
      raise exception
        'Unsupported resource kind: %',
        target_kind;
  end case;

  if binding_count <> 1 then
    raise exception
      'Resource % with kind % must have exactly one typed binding.',
      target_resource_id,
      target_kind;
  end if;

  return null;
end;
$function$;

revoke execute
  on function editorial.assert_resource_binding_integrity()
  from public, anon, authenticated;

create trigger media_asset_resources_prevent_retarget
before update
on editorial.media_asset_resources
for each row
execute function editorial.prevent_resource_binding_retarget();

create constraint trigger media_asset_resources_binding_integrity
after insert or update or delete
on editorial.media_asset_resources
deferrable initially deferred
for each row
execute function editorial.assert_resource_binding_integrity();

alter table editorial.media_asset_resources
  enable row level security;

revoke all on editorial.media_asset_resources
  from public, anon, authenticated;

insert into media.variant_roles (
  variant_role,
  label,
  description,
  sort_order
)
values (
  'waveform_data',
  'Waveform data',
  'Bounded waveform peak-envelope derivative for audio playback interfaces.',
  75
);

insert into platform_private.command_types (
  command_type,
  job_type,
  accepted_event_type,
  success_event_type,
  failure_event_type,
  retry_event_type
)
values (
  'media.process_revision',
  'media.process_revision',
  'media.processing.accepted',
  'media.processing.succeeded',
  'media.processing.failed',
  'media.processing.retry_scheduled'
);

create index jobs_media_processing_claim_idx
  on platform_private.jobs (
    status,
    available_at,
    priority,
    created_at
  )
  where command_type = 'media.process_revision'
    and job_type = 'media.process_revision'
    and status in ('queued', 'retry_wait');

create or replace function public.submit_media_processing_command_v1(
  p_asset_id uuid,
  p_asset_revision_id uuid,
  p_idempotency_key text,
  p_profile_version text,
  p_correlation_id uuid default null
)
returns table (
  command_receipt_id uuid,
  job_id uuid,
  accepted_event_id uuid,
  receipt_status text,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path =
  pg_catalog,
  public,
  auth,
  editorial,
  media,
  platform_private,
  extensions
as $function$
declare
  v_command_type constant text := 'media.process_revision';
  v_actor_id uuid;
  v_principal_key text;
  v_asset media.assets%rowtype;
  v_revision media.asset_revisions%rowtype;
  v_source media.file_objects%rowtype;
  v_profile_version text;
  v_correlation_id uuid := coalesce(
    p_correlation_id,
    gen_random_uuid()
  );
  v_request_payload jsonb;
  v_request_fingerprint text;
  v_receipt_id uuid;
  v_existing_fingerprint text;
  v_receipt_status text;
  v_job_id uuid;
  v_event_id uuid;
  v_created boolean;
  v_resource_kind text;
begin
  if auth.role() <> 'authenticated'
     or auth.uid() is null
  then
    raise exception
      using
        errcode = '42501',
        message = 'Authenticated Media processing actor is required.';
  end if;

  v_actor_id := auth.uid();

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
  then
    raise exception
      using
        errcode = '22023',
        message = 'asset_id and asset_revision_id are required.';
  end if;

  if p_idempotency_key is null
     or p_idempotency_key !~
       '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
  then
    raise exception
      using
        errcode = '22023',
        message = 'idempotency_key is invalid.';
  end if;

  v_profile_version := nullif(
    btrim(p_profile_version),
    ''
  );

  select *
  into v_asset
  from media.assets
  where id = p_asset_id;

  if not found then
    raise exception
      using
        errcode = 'P0002',
        message = 'Media asset does not exist.';
  end if;

  if v_asset.lifecycle_state <> 'active' then
    raise exception
      using
        errcode = '55000',
        message = 'Only an active Media asset may be processed.';
  end if;

  if (
    v_asset.asset_kind = 'audio'
    and v_profile_version <> 'audio-v1'
  ) or (
    v_asset.asset_kind = 'video'
    and v_profile_version <> 'video-v1'
  ) or v_asset.asset_kind not in ('audio', 'video')
  then
    raise exception
      using
        errcode = '22023',
        message = 'Processing profile does not match the Media asset kind.';
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
        message = 'Media revision does not belong to the requested asset.';
  end if;

  select *
  into v_source
  from media.file_objects
  where id = v_revision.original_file_object_id;

  if not found
     or v_source.verification_state <> 'verified'
     or v_source.storage_provider <> 'lightsail_media'
     or v_source.storage_path is null
     or v_source.storage_path !~ '^masters/(audio|video)/'
     or v_source.sha256 is null
     or v_source.byte_size is null
  then
    raise exception
      using
        errcode = '55000',
        message = 'M2 processing requires a verified protected Lightsail master.';
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
      v_actor_id,
      'internal',
      'active',
      v_actor_id
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
    if v_resource_kind <> 'media_asset' then
      raise exception
        'Media asset UUID collides with another resource kind.';
    end if;

    if not exists (
      select 1
      from editorial.media_asset_resources
      where resource_id = p_asset_id
        and asset_id = p_asset_id
    ) then
      raise exception
        'Existing media_asset resource is missing its immutable binding.';
    end if;
  end if;

  v_principal_key := 'user:' || v_actor_id::text;

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

  v_request_fingerprint := encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'command_type', v_command_type,
          'asset_id', p_asset_id,
          'asset_revision_id', p_asset_revision_id,
          'source_file_object_id', v_source.id,
          'source_sha256', v_source.sha256,
          'source_byte_size', v_source.byte_size,
          'profile_version', v_profile_version
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
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
    v_principal_key,
    v_actor_id,
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
  returning
    id,
    status
  into
    v_receipt_id,
    v_receipt_status;

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
    where receipt.principal_key = v_principal_key
      and receipt.command_type = v_command_type
      and receipt.idempotency_key = p_idempotency_key
    for update;

    if not found then
      raise exception
        'Media processing idempotency receipt disappeared.';
    end if;

    if v_existing_fingerprint <> v_request_fingerprint then
      raise exception
        using
          errcode = '23505',
          message = 'The idempotency key was already used for a different processing request.';
    end if;

    select id
    into v_job_id
    from platform_private.jobs
    where command_receipt_id = v_receipt_id
      and job_key = 'primary';

    select id
    into v_event_id
    from platform_private.outbox_events
    where event_key =
      'command:' ||
      v_receipt_id::text ||
      ':accepted';

    if v_job_id is null
       or v_event_id is null
    then
      raise exception
        'Accepted Media processing command is missing its durable job or event.';
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
    'command:' ||
      v_receipt_id::text ||
      ':accepted',
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
      'principal_key', v_principal_key,
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
  on function public.submit_media_processing_command_v1(
    uuid,
    uuid,
    text,
    text,
    uuid
  )
  from public, anon, service_role;

grant execute
  on function public.submit_media_processing_command_v1(
    uuid,
    uuid,
    text,
    text,
    uuid
  )
  to authenticated;

create or replace function public.claim_media_processing_jobs_v1(
  p_worker_id text,
  p_limit integer default 1,
  p_lease_seconds integer default 3600
)
returns table (
  job_id uuid,
  command_receipt_id uuid,
  resource_id uuid,
  command_type text,
  job_type text,
  attempt_count integer,
  max_attempts integer,
  input_payload jsonb,
  lease_expires_at timestamptz
)
language plpgsql
security definer
set search_path =
  pg_catalog,
  auth,
  platform_private
as $function$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception
      using
        errcode = '42501',
        message = 'Service-role access is required.';
  end if;

  if p_worker_id is null
     or p_worker_id !~
       '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$'
  then
    raise exception
      using
        errcode = '22023',
        message = 'worker_id is invalid.';
  end if;

  if p_limit not between 1 and 10 then
    raise exception
      using
        errcode = '22023',
        message = 'limit must be between 1 and 10.';
  end if;

  if p_lease_seconds not between 60 and 3600 then
    raise exception
      using
        errcode = '22023',
        message = 'lease_seconds must be between 60 and 3600.';
  end if;

  return query
  with candidates as (
    select job.id
    from platform_private.jobs job
    where job.command_type = 'media.process_revision'
      and job.job_type = 'media.process_revision'
      and job.status in ('queued', 'retry_wait')
      and job.available_at <= now()
      and job.attempt_count < job.max_attempts
      and job.locked_by is null
    order by
      job.priority,
      job.available_at,
      job.created_at
    for update skip locked
    limit p_limit
  ),
  claimed as (
    update platform_private.jobs job
    set
      status = 'running',
      attempt_count = job.attempt_count + 1,
      locked_by = p_worker_id,
      locked_at = now(),
      lease_expires_at =
        now() +
        make_interval(secs => p_lease_seconds),
      started_at = coalesce(job.started_at, now())
    from candidates
    where job.id = candidates.id
    returning job.*
  )
  select
    claimed.id,
    claimed.command_receipt_id,
    claimed.resource_id,
    claimed.command_type,
    claimed.job_type,
    claimed.attempt_count,
    claimed.max_attempts,
    claimed.input_payload,
    claimed.lease_expires_at
  from claimed;
end;
$function$;

revoke all
  on function public.claim_media_processing_jobs_v1(
    text,
    integer,
    integer
  )
  from public, anon, authenticated;

grant execute
  on function public.claim_media_processing_jobs_v1(
    text,
    integer,
    integer
  )
  to service_role;

create or replace function public.renew_media_processing_lease_v1(
  p_job_id uuid,
  p_worker_id text,
  p_lease_seconds integer default 3600
)
returns timestamptz
language plpgsql
security definer
set search_path =
  pg_catalog,
  auth,
  platform_private
as $function$
declare
  v_expires_at timestamptz;
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
  then
    raise exception
      using
        errcode = '22023',
        message = 'job_id and valid worker_id are required.';
  end if;

  if p_lease_seconds not between 60 and 3600 then
    raise exception
      using
        errcode = '22023',
        message = 'lease_seconds must be between 60 and 3600.';
  end if;

  update platform_private.jobs job
  set
    lease_expires_at =
      now() +
      make_interval(
        secs => p_lease_seconds
      )
  where job.id = p_job_id
    and job.command_type = 'media.process_revision'
    and job.job_type = 'media.process_revision'
    and job.status = 'running'
    and job.locked_by = p_worker_id
    and job.lease_expires_at is not null
    and job.lease_expires_at > now()
  returning job.lease_expires_at
  into v_expires_at;

  if v_expires_at is null then
    raise exception
      using
        errcode = '55000',
        message =
          'The Media processing job is not actively leased to this worker.';
  end if;

  return v_expires_at;
end;
$function$;

revoke all
  on function public.renew_media_processing_lease_v1(
    uuid,
    text,
    integer
  )
  from public, anon, authenticated;

grant execute
  on function public.renew_media_processing_lease_v1(
    uuid,
    text,
    integer
  )
  to service_role;

create or replace function public.recover_expired_media_processing_jobs_v1(
  p_limit integer default 10,
  p_retry_delay_seconds integer default 30
)
returns integer
language plpgsql
security definer
set search_path =
  pg_catalog,
  auth,
  platform_private
as $function$
declare
  v_job platform_private.jobs%rowtype;
  v_event_id uuid;
  v_event_type text;
  v_count integer := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception
      using
        errcode = '42501',
        message = 'Service-role access is required.';
  end if;

  if p_limit not between 1 and 100 then
    raise exception
      using
        errcode = '22023',
        message = 'limit must be between 1 and 100.';
  end if;

  if p_retry_delay_seconds not between 1 and 3600 then
    raise exception
      using
        errcode = '22023',
        message = 'retry delay must be between 1 and 3600 seconds.';
  end if;

  for v_job in
    select job.*
    from platform_private.jobs job
    where job.command_type = 'media.process_revision'
      and job.job_type = 'media.process_revision'
      and job.status = 'running'
      and job.lease_expires_at is not null
      and job.lease_expires_at <= now()
    order by
      job.lease_expires_at,
      job.created_at
    for update skip locked
    limit p_limit
  loop
    if v_job.attempt_count >= v_job.max_attempts then
      update platform_private.jobs
      set
        status = 'dead_letter',
        locked_by = null,
        locked_at = null,
        lease_expires_at = null,
        finished_at = now(),
        last_error =
          'Media processing worker lease expired after the final allowed attempt.'
      where id = v_job.id;

      update platform_private.command_receipts
      set
        status = 'failed',
        error_code = 'job_failed',
        error_message =
          'Media processing worker lease expired after the final allowed attempt.',
        completed_at = now()
      where id = v_job.command_receipt_id;

      select command_types.failure_event_type
      into v_event_type
      from platform_private.command_types
      where command_type = v_job.command_type;

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
        'command:' ||
          v_job.command_receipt_id::text ||
          ':failed',
        v_job.command_receipt_id,
        v_job.id,
        v_job.command_type,
        v_job.resource_id,
        v_event_type,
        jsonb_build_object(
          'command_receipt_id', v_job.command_receipt_id,
          'job_id', v_job.id,
          'resource_id', v_job.resource_id,
          'error',
            'Media processing worker lease expired after the final allowed attempt.',
          'failed_at', now()
        )
      )
      on conflict (event_key)
      do nothing
      returning id
      into v_event_id;
    else
      update platform_private.jobs
      set
        status = 'retry_wait',
        available_at =
          now() +
          make_interval(
            secs => p_retry_delay_seconds
          ),
        locked_by = null,
        locked_at = null,
        lease_expires_at = null,
        last_error =
          'Media processing worker lease expired before completion.'
      where id = v_job.id;

      select command_types.retry_event_type
      into v_event_type
      from platform_private.command_types
      where command_type = v_job.command_type;

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
        'job:' ||
          v_job.id::text ||
          ':retry:' ||
          v_job.attempt_count::text,
        v_job.command_receipt_id,
        v_job.id,
        v_job.command_type,
        v_job.resource_id,
        v_event_type,
        jsonb_build_object(
          'command_receipt_id', v_job.command_receipt_id,
          'job_id', v_job.id,
          'resource_id', v_job.resource_id,
          'attempt_count', v_job.attempt_count,
          'error',
            'Media processing worker lease expired before completion.',
          'available_at',
            now() +
            make_interval(
              secs => p_retry_delay_seconds
            )
        )
      )
      on conflict (event_key)
      do nothing
      returning id
      into v_event_id;
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$function$;

revoke all
  on function public.recover_expired_media_processing_jobs_v1(
    integer,
    integer
  )
  from public, anon, authenticated;

grant execute
  on function public.recover_expired_media_processing_jobs_v1(
    integer,
    integer
  )
  to service_role;

create or replace function public.register_media_processing_outputs_v1(
  p_job_id uuid,
  p_worker_id text,
  p_outputs jsonb
)
returns jsonb
language plpgsql
security definer
set search_path =
  pg_catalog,
  public,
  auth,
  media,
  platform_private
as $function$
declare
  v_job platform_private.jobs%rowtype;
  v_receipt platform_private.command_receipts%rowtype;
  v_actor_id uuid;
  v_asset_id uuid;
  v_revision_id uuid;
  v_source_file_id uuid;
  v_correlation_id uuid;
  v_profile_version text;
  v_output jsonb;
  v_file jsonb;
  v_role text;
  v_storage_provider text;
  v_storage_namespace text;
  v_storage_path text;
  v_delivery_url text;
  v_sha256 text;
  v_byte_size bigint;
  v_mime_type text;
  v_file_object_id uuid;
  v_existing_file media.file_objects%rowtype;
  v_variant_id uuid;
  v_selection_variant_id uuid;
  v_selection_revision bigint;
  v_transformation_spec jsonb;
  v_technical_metadata jsonb;
  v_generator_name text;
  v_generator_version text;
  v_seen_roles text[] := array[]::text[];
  v_results jsonb := '[]'::jsonb;
  v_new_variant boolean;
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
  then
    raise exception
      using
        errcode = '22023',
        message = 'job_id and valid worker_id are required.';
  end if;

  if p_outputs is null
     or jsonb_typeof(p_outputs) <> 'array'
     or jsonb_array_length(p_outputs) not between 1 and 5
  then
    raise exception
      using
        errcode = '22023',
        message = 'outputs must be a JSON array containing 1 to 5 derivatives.';
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
        message = 'The Media processing job is not actively leased to this worker.';
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
        message = 'Media processing receipt actor or state is invalid.';
  end if;

  v_actor_id := v_receipt.actor_user_id;
  v_asset_id :=
    nullif(v_job.input_payload ->> 'asset_id', '')::uuid;
  v_revision_id :=
    nullif(v_job.input_payload ->> 'asset_revision_id', '')::uuid;
  v_source_file_id :=
    nullif(v_job.input_payload ->> 'source_file_object_id', '')::uuid;
  v_correlation_id :=
    nullif(v_job.input_payload ->> 'correlation_id', '')::uuid;
  v_profile_version :=
    nullif(v_job.input_payload ->> 'profile_version', '');

  if v_asset_id is null
     or v_revision_id is null
     or v_source_file_id is null
     or v_correlation_id is null
  then
    raise exception
      'Media processing job input identity is incomplete.';
  end if;

  if not exists (
    select 1
    from media.asset_revisions revision
    join media.file_objects source_file
      on source_file.id = revision.original_file_object_id
    where revision.id = v_revision_id
      and revision.asset_id = v_asset_id
      and revision.original_file_object_id = v_source_file_id
      and source_file.verification_state = 'verified'
  ) then
    raise exception
      'Media processing source authority changed or is invalid.';
  end if;

  for v_output in
    select value
    from jsonb_array_elements(p_outputs)
  loop
    if jsonb_typeof(v_output) <> 'object'
       or jsonb_typeof(v_output -> 'file') <> 'object'
    then
      raise exception
        'Every Media processing output must include a file object.';
    end if;

    v_role := nullif(
      btrim(v_output ->> 'variant_role'),
      ''
    );

    if v_role is null
       or v_role = any(v_seen_roles)
    then
      raise exception
        'Media processing variant roles must be present and unique.';
    end if;

    v_seen_roles := array_append(
      v_seen_roles,
      v_role
    );

    if (
      v_profile_version = 'audio-v1'
      and v_role not in (
        'audio_preview',
        'waveform_data'
      )
    ) or (
      v_profile_version = 'video-v1'
      and v_role not in (
        'video_transcode',
        'poster_frame',
        'thumbnail'
      )
    ) then
      raise exception
        'Variant role % is not permitted for processing profile %.',
        v_role,
        v_profile_version;
    end if;

    v_file := v_output -> 'file';
    v_storage_provider :=
      nullif(btrim(v_file ->> 'storage_provider'), '');
    v_storage_namespace :=
      nullif(btrim(v_file ->> 'storage_namespace'), '');
    v_storage_path :=
      nullif(btrim(v_file ->> 'storage_path'), '');
    v_delivery_url :=
      nullif(btrim(v_file ->> 'delivery_url'), '');
    v_sha256 :=
      lower(nullif(btrim(v_file ->> 'sha256'), ''));
    v_byte_size :=
      nullif(v_file ->> 'byte_size', '')::bigint;
    v_mime_type :=
      nullif(btrim(v_file ->> 'mime_type'), '');

    if v_storage_provider <> 'lightsail_media'
       or coalesce(v_storage_namespace, '') <> 'lightsail-media'
       or v_storage_path is null
       or v_storage_path !~ '^derived-objects/'
       or v_delivery_url is null
       or v_delivery_url !~
         '^https://media[.]wakilisha[.]africa/derivatives/'
       or v_sha256 is null
       or v_sha256 !~ '^[0-9a-f]{64}$'
       or v_byte_size is null
       or v_byte_size < 1
       or v_mime_type is null
    then
      raise exception
        'Media processing output file authority is invalid.';
    end if;

    select file_object.*
    into v_existing_file
    from media.file_objects file_object
    where file_object.storage_provider = v_storage_provider
      and coalesce(file_object.storage_namespace, '') =
        coalesce(v_storage_namespace, '')
      and file_object.storage_path = v_storage_path;

    if found then
      if v_existing_file.verification_state <> 'verified'
         or v_existing_file.sha256 <> v_sha256
         or v_existing_file.byte_size <> v_byte_size
         or v_existing_file.mime_type <> v_mime_type
         or v_existing_file.delivery_url <> v_delivery_url
      then
        raise exception
          'Immutable derivative storage collision does not match registered bytes.';
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

    v_transformation_spec :=
      coalesce(
        v_output -> 'transformation_spec',
        '{}'::jsonb
      );
    v_technical_metadata :=
      coalesce(
        v_output -> 'technical_metadata',
        '{}'::jsonb
      );
    v_generator_name :=
      nullif(
        btrim(v_output ->> 'generator_name'),
        ''
      );
    v_generator_version :=
      nullif(
        btrim(v_output ->> 'generator_version'),
        ''
      );

    if jsonb_typeof(v_transformation_spec) <> 'object'
       or jsonb_typeof(v_technical_metadata) <> 'object'
    then
      raise exception
        'Media processing transformation and technical metadata must be objects.';
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
      v_variant_id := gen_random_uuid();

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
        v_transformation_spec,
        v_technical_metadata,
        v_generator_name,
        v_generator_version,
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
        'Immutable Media processing derivative registered',
        jsonb_build_object(
          'variant_role', v_role,
          'source_file_object_id', v_source_file_id,
          'derived_file_object_id', v_file_object_id,
          'processing_profile', v_profile_version
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
        'Media processing derivative activated',
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
        'Media processing derivative activation advanced',
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

  if (
    v_profile_version = 'audio-v1'
    and (
      cardinality(v_seen_roles) <> 2
      or not ('audio_preview' = any(v_seen_roles))
      or not ('waveform_data' = any(v_seen_roles))
    )
  ) or (
    v_profile_version = 'video-v1'
    and (
      cardinality(v_seen_roles) <> 3
      or not ('video_transcode' = any(v_seen_roles))
      or not ('poster_frame' = any(v_seen_roles))
      or not ('thumbnail' = any(v_seen_roles))
    )
  ) then
    raise exception
      'Processing output set is incomplete for profile %.',
      v_profile_version;
  end if;

  return jsonb_build_object(
    'job_id', p_job_id,
    'asset_id', v_asset_id,
    'asset_revision_id', v_revision_id,
    'source_file_object_id', v_source_file_id,
    'profile_version', v_profile_version,
    'correlation_id', v_correlation_id,
    'outputs', v_results
  );
end;
$function$;

revoke all
  on function public.register_media_processing_outputs_v1(
    uuid,
    text,
    jsonb
  )
  from public, anon, authenticated;

grant execute
  on function public.register_media_processing_outputs_v1(
    uuid,
    text,
    jsonb
  )
  to service_role;

create or replace function public.complete_media_processing_job_v1(
  p_job_id uuid,
  p_worker_id text,
  p_result jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path =
  pg_catalog,
  auth,
  platform_private
as $function$
declare
  v_receipt_id uuid;
  v_event_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception
      using
        errcode = '42501',
        message = 'Service-role access is required.';
  end if;

  if not exists (
    select 1
    from platform_private.jobs job
    where job.id = p_job_id
      and job.command_type = 'media.process_revision'
      and job.job_type = 'media.process_revision'
  ) then
    raise exception
      'Requested job is not a Media processing job.';
  end if;

  select
    command_receipt_id,
    success_event_id
  into
    v_receipt_id,
    v_event_id
  from platform_private.complete_job(
    p_job_id,
    p_worker_id,
    coalesce(p_result, '{}'::jsonb)
  );

  return jsonb_build_object(
    'job_id', p_job_id,
    'command_receipt_id', v_receipt_id,
    'success_event_id', v_event_id,
    'job_status', 'succeeded'
  );
end;
$function$;

revoke all
  on function public.complete_media_processing_job_v1(
    uuid,
    text,
    jsonb
  )
  from public, anon, authenticated;

grant execute
  on function public.complete_media_processing_job_v1(
    uuid,
    text,
    jsonb
  )
  to service_role;

create or replace function public.fail_media_processing_job_v1(
  p_job_id uuid,
  p_worker_id text,
  p_error text,
  p_retryable boolean default true,
  p_retry_delay_seconds integer default 60
)
returns jsonb
language plpgsql
security definer
set search_path =
  pg_catalog,
  auth,
  platform_private
as $function$
declare
  v_job_status text;
  v_receipt_status text;
  v_event_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception
      using
        errcode = '42501',
        message = 'Service-role access is required.';
  end if;

  if not exists (
    select 1
    from platform_private.jobs job
    where job.id = p_job_id
      and job.command_type = 'media.process_revision'
      and job.job_type = 'media.process_revision'
  ) then
    raise exception
      'Requested job is not a Media processing job.';
  end if;

  select
    job_status,
    command_receipt_status,
    outbox_event_id
  into
    v_job_status,
    v_receipt_status,
    v_event_id
  from platform_private.fail_job(
    p_job_id,
    p_worker_id,
    p_error,
    p_retryable,
    p_retry_delay_seconds
  );

  return jsonb_build_object(
    'job_id', p_job_id,
    'job_status', v_job_status,
    'command_receipt_status', v_receipt_status,
    'outbox_event_id', v_event_id
  );
end;
$function$;

revoke all
  on function public.fail_media_processing_job_v1(
    uuid,
    text,
    text,
    boolean,
    integer
  )
  from public, anon, authenticated;

grant execute
  on function public.fail_media_processing_job_v1(
    uuid,
    text,
    text,
    boolean,
    integer
  )
  to service_role;

commit;
