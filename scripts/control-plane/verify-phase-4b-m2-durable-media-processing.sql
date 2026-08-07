\set ON_ERROR_STOP on

do $phase_4b_m2_verify$
declare
  v_definition text;
  v_count bigint;
begin
  if not exists (
    select 1
    from editorial.resource_kinds
    where kind = 'media_asset'
      and enabled
  ) then
    raise exception
      'FAIL: media_asset resource kind is missing';
  end if;

  if to_regclass('editorial.media_asset_resources') is null then
    raise exception
      'FAIL: Media asset resource binding table is missing';
  end if;

  if not exists (
    select 1
    from pg_class relation
    join pg_namespace namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'editorial'
      and relation.relname = 'media_asset_resources'
      and relation.relrowsecurity
  ) then
    raise exception
      'FAIL: Media asset resource binding RLS is disabled';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    join pg_class relation
      on relation.oid = trigger_row.tgrelid
    join pg_namespace namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'editorial'
      and relation.relname = 'media_asset_resources'
      and trigger_row.tgname =
        'media_asset_resources_binding_integrity'
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'FAIL: Media asset resource binding integrity trigger is missing';
  end if;

  select pg_get_functiondef(
    'editorial.assert_resource_binding_integrity()'::regprocedure
  )
  into v_definition;

  if position(
    'media_asset' in v_definition
  ) = 0
     or position(
       'editorial.media_asset_resources' in v_definition
     ) = 0
  then
    raise exception
      'FAIL: Shared resource binding integrity does not support Media assets';
  end if;

  if not exists (
    select 1
    from media.variant_roles
    where variant_role = 'waveform_data'
      and enabled
  ) then
    raise exception
      'FAIL: waveform_data variant role is missing';
  end if;

  if not exists (
    select 1
    from platform_private.command_types
    where command_type = 'media.process_revision'
      and job_type = 'media.process_revision'
      and accepted_event_type =
        'media.processing.accepted'
      and success_event_type =
        'media.processing.succeeded'
      and failure_event_type =
        'media.processing.failed'
      and retry_event_type =
        'media.processing.retry_scheduled'
      and enabled
  ) then
    raise exception
      'FAIL: Media processing command registry is incomplete';
  end if;

  if to_regprocedure(
       'public.submit_media_processing_command_v1(uuid,uuid,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.claim_media_processing_jobs_v1(text,integer,integer)'
     ) is null
     or to_regprocedure(
       'public.renew_media_processing_lease_v1(uuid,text,integer)'
     ) is null
     or to_regprocedure(
       'public.recover_expired_media_processing_jobs_v1(integer,integer)'
     ) is null
     or to_regprocedure(
       'public.register_media_processing_outputs_v1(uuid,text,jsonb)'
     ) is null
     or to_regprocedure(
       'public.complete_media_processing_job_v1(uuid,text,jsonb)'
     ) is null
     or to_regprocedure(
       'public.fail_media_processing_job_v1(uuid,text,text,boolean,integer)'
     ) is null
  then
    raise exception
      'FAIL: M2 processing RPC contract is incomplete';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.submit_media_processing_command_v1(uuid,uuid,text,text,uuid)',
       'execute'
     )
     or has_function_privilege(
       'anon',
       'public.submit_media_processing_command_v1(uuid,uuid,text,text,uuid)',
       'execute'
     )
  then
    raise exception
      'FAIL: Processing submission grants are incorrect';
  end if;

  if exists (
    select 1
    from (
      values
        (
          'public.claim_media_processing_jobs_v1(text,integer,integer)'::regprocedure
        ),
        (
          'public.renew_media_processing_lease_v1(uuid,text,integer)'::regprocedure
        ),
        (
          'public.recover_expired_media_processing_jobs_v1(integer,integer)'::regprocedure
        ),
        (
          'public.register_media_processing_outputs_v1(uuid,text,jsonb)'::regprocedure
        ),
        (
          'public.complete_media_processing_job_v1(uuid,text,jsonb)'::regprocedure
        ),
        (
          'public.fail_media_processing_job_v1(uuid,text,text,boolean,integer)'::regprocedure
        )
    ) functions(function_oid)
    where not has_function_privilege(
        'service_role',
        functions.function_oid,
        'execute'
      )
      or has_function_privilege(
        'authenticated',
        functions.function_oid,
        'execute'
      )
      or has_function_privilege(
        'anon',
        functions.function_oid,
        'execute'
      )
  ) then
    raise exception
      'FAIL: Worker RPC grant boundary is incorrect';
  end if;

  select pg_get_functiondef(
    'public.submit_media_processing_command_v1(uuid,uuid,text,text,uuid)'::regprocedure
  )
  into v_definition;

  if position(
       'job.command_receipt_id = v_receipt_id'
       in v_definition
     ) = 0
     or position(
       'job.job_key = ''primary'''
       in v_definition
     ) = 0
     or position(
       'event.event_key ='
       in v_definition
     ) = 0
  then
    raise exception
      'FAIL: Media processing idempotent replay lookup is not fully qualified';
  end if;

  if exists (
    select 1
    from pg_class relation
    join pg_namespace namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'media'
      and relation.relname in (
        'processing_jobs',
        'processing_queue',
        'processing_outbox'
      )
  ) then
    raise exception
      'FAIL: A competing Media processing queue exists';
  end if;

  select count(*)
  into v_count
  from pg_indexes
  where schemaname = 'platform_private'
    and indexname =
      'jobs_media_processing_claim_idx'
    and indexdef ilike
      '%media.process_revision%';

  if v_count <> 1 then
    raise exception
      'FAIL: Media processing filtered claim index is missing';
  end if;
end;
$phase_4b_m2_verify$;

select jsonb_build_object(
  'verification',
    'PHASE_4B_M2_DURABLE_PROCESSING_AUTHORITY_PASS',
  'media_asset_resources',
    (
      select count(*)
      from editorial.media_asset_resources
    ),
  'processing_jobs',
    (
      select count(*)
      from platform_private.jobs
      where command_type =
        'media.process_revision'
    ),
  'processing_variants',
    (
      select count(*)
      from media.variants
      where generator_name =
        'wakilisha-media-processor'
    )
) as phase_4b_m2_durable_processing_authority;
