begin;

set local statement_timeout = '120s';
set local lock_timeout = '5s';

do $phase_4b_m4_preflight$
declare
  v_definition text;
begin
  if to_regclass('media.file_objects') is null
     or to_regclass('media.asset_revisions') is null
     or to_regclass('media.variants') is null
     or to_regclass('media.variant_selections') is null
     or to_regclass('media.upload_sessions') is null
     or to_regclass('platform_private.jobs') is null
     or to_regclass('public.registry_media_assets') is null
  then
    raise exception
      'STOP: Phase 4B M4 Media authority dependencies are incomplete';
  end if;

  select pg_get_constraintdef(constraint_row.oid)
  into v_definition
  from pg_constraint constraint_row
  join pg_class table_row
    on table_row.oid = constraint_row.conrelid
  join pg_namespace namespace_row
    on namespace_row.oid = table_row.relnamespace
  where namespace_row.nspname = 'public'
    and table_row.relname = 'registry_media_assets'
    and constraint_row.conname =
      'registry_media_assets_file_kind_check';

  if v_definition is null
     or position('transcript' in v_definition) > 0
     or position('caption' in v_definition) > 0
  then
    raise exception
      'STOP: Media compatibility file-kind authority is not at the expected pre-M4 state';
  end if;

  if to_regprocedure(
       'public.get_media_private_delivery_target_v1(uuid)'
     ) is not null
     or to_regprocedure(
       'public.read_media_maintenance_manifest_v1()'
     ) is not null
  then
    raise exception
      'STOP: Phase 4B M4 operational functions already exist';
  end if;
end;
$phase_4b_m4_preflight$;

alter table public.registry_media_assets
  drop constraint registry_media_assets_file_kind_check;

alter table public.registry_media_assets
  add constraint registry_media_assets_file_kind_check
  check (
    file_kind is null
    or file_kind in (
      'image',
      'document',
      'audio',
      'video',
      'archive',
      'transcript',
      'caption',
      'other'
    )
  );

create or replace function public.get_media_private_delivery_target_v1(
  p_file_object_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path =
  pg_catalog,
  public,
  auth,
  media
as $function$
declare
  v_file media.file_objects%rowtype;
begin
  if coalesce(auth.role(), '') <> 'authenticated'
     or auth.uid() is null
  then
    raise exception
      using
        errcode = '42501',
        message = 'Authenticated Media actor is required.';
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

  if p_file_object_id is null then
    raise exception
      using
        errcode = '22023',
        message = 'file_object_id is required.';
  end if;

  select *
  into v_file
  from media.file_objects
  where id = p_file_object_id;

  if not found then
    raise exception
      using
        errcode = 'P0002',
        message = 'Media file object does not exist.';
  end if;

  if v_file.verification_state <> 'verified'
     or v_file.storage_provider <> 'lightsail_media'
     or v_file.storage_path is null
     or v_file.storage_path !~
       '^(masters/(audio|video)/|derived-objects/|private-files/(transcripts|captions)/)'
  then
    raise exception
      using
        errcode = '55000',
        message = 'Only verified protected Lightsail Media files may use private delivery.';
  end if;

  if not (
    exists (
      select 1
      from media.asset_revisions revision
      where revision.original_file_object_id = v_file.id
    )
    or exists (
      select 1
      from media.variants variant
      where variant.derived_file_object_id = v_file.id
    )
  ) then
    raise exception
      using
        errcode = '55000',
        message = 'Private delivery requires a canonical Media revision or variant binding.';
  end if;

  return jsonb_build_object(
    'file_object_id', v_file.id,
    'storage_path', v_file.storage_path,
    'original_filename', v_file.original_filename,
    'mime_type', v_file.mime_type,
    'byte_size', v_file.byte_size,
    'sha256', v_file.sha256,
    'verification_state', v_file.verification_state
  );
end;
$function$;

revoke all
  on function public.get_media_private_delivery_target_v1(uuid)
  from public, anon, service_role;

grant execute
  on function public.get_media_private_delivery_target_v1(uuid)
  to authenticated;

create or replace function public.read_media_maintenance_manifest_v1()
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
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception
      using
        errcode = '42501',
        message = 'Service-role access is required.';
  end if;

  return jsonb_build_object(
    'generated_at', now(),
    'file_objects',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', file_object.id,
              'storage_provider', file_object.storage_provider,
              'storage_path', file_object.storage_path,
              'delivery_url', file_object.delivery_url,
              'byte_size', file_object.byte_size,
              'sha256', file_object.sha256,
              'verification_state', file_object.verification_state,
              'created_at', file_object.created_at
            )
            order by file_object.created_at, file_object.id
          )
          from media.file_objects file_object
          where file_object.storage_provider = 'lightsail_media'
        ),
        '[]'::jsonb
      ),
    'selected_derivatives',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'asset_revision_id', selection.asset_revision_id,
              'variant_role', selection.variant_role,
              'variant_id', selection.variant_id,
              'file_object_id', file_object.id,
              'storage_path', file_object.storage_path,
              'delivery_url', file_object.delivery_url,
              'byte_size', file_object.byte_size,
              'sha256', file_object.sha256,
              'verification_state', file_object.verification_state
            )
            order by
              selection.asset_revision_id,
              selection.variant_role
          )
          from media.variant_selections selection
          join media.variants variant
            on variant.id = selection.variant_id
          join media.file_objects file_object
            on file_object.id = variant.derived_file_object_id
        ),
        '[]'::jsonb
      ),
    'upload_sessions',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', session.id,
              'state', session.state,
              'storage_path', session.storage_path,
              'file_object_id', session.file_object_id,
              'expires_at', session.expires_at,
              'created_at', session.created_at,
              'updated_at', session.updated_at
            )
            order by session.created_at, session.id
          )
          from media.upload_sessions session
        ),
        '[]'::jsonb
      ),
    'processing_jobs',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', job.id,
              'status', job.status,
              'created_at', job.created_at,
              'updated_at', job.updated_at,
              'finished_at', job.finished_at
            )
            order by job.created_at, job.id
          )
          from platform_private.jobs job
          where job.command_type = 'media.process_revision'
            and job.job_type = 'media.process_revision'
        ),
        '[]'::jsonb
      )
  );
end;
$function$;

revoke all
  on function public.read_media_maintenance_manifest_v1()
  from public, anon, authenticated;

grant execute
  on function public.read_media_maintenance_manifest_v1()
  to service_role;

comment on function public.get_media_private_delivery_target_v1(uuid) is
  'M4 authenticated control-plane read for one verified protected canonical Media file.';

comment on function public.read_media_maintenance_manifest_v1() is
  'M4 service-role reconciliation manifest for repository-owned Media maintenance.';

commit;
