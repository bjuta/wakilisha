begin;

do $phase_4b_m2_replay_fix_preflight$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.submit_media_processing_command_v1(uuid,uuid,text,text,uuid)'::regprocedure
  )
  into v_definition;

  if position(
    'where command_receipt_id = v_receipt_id'
    in v_definition
  ) = 0 then
    raise exception
      'STOP: Expected ambiguous M2 replay lookup is not present';
  end if;
end;
$phase_4b_m2_replay_fix_preflight$;

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

    select job.id
    into v_job_id
    from platform_private.jobs job
    where job.command_receipt_id = v_receipt_id
      and job.job_key = 'primary';

    select event.id
    into v_event_id
    from platform_private.outbox_events event
    where event.event_key =
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

commit;
