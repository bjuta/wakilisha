do $phase_4b_m4_verify$
declare
  v_file_kind_constraint text;
  v_authenticated_execute boolean;
  v_service_execute boolean;
begin
  select pg_get_constraintdef(constraint_row.oid)
  into v_file_kind_constraint
  from pg_constraint constraint_row
  join pg_class table_row
    on table_row.oid = constraint_row.conrelid
  join pg_namespace namespace_row
    on namespace_row.oid = table_row.relnamespace
  where namespace_row.nspname = 'public'
    and table_row.relname = 'registry_media_assets'
    and constraint_row.conname =
      'registry_media_assets_file_kind_check';

  if v_file_kind_constraint is null
     or position('transcript' in v_file_kind_constraint) = 0
     or position('caption' in v_file_kind_constraint) = 0
  then
    raise exception
      'STOP: M4 transcript/caption compatibility kinds are missing';
  end if;

  if (
    select count(*)
    from media.asset_kinds
    where asset_kind in ('transcript', 'caption')
      and enabled
  ) <> 2
  then
    raise exception
      'STOP: M4 canonical transcript/caption Media asset kinds are missing';
  end if;

  if to_regprocedure(
       'public.get_media_private_delivery_target_v1(uuid)'
     ) is null
     or to_regprocedure(
       'public.read_media_maintenance_manifest_v1()'
     ) is null
  then
    raise exception
      'STOP: M4 operational functions are incomplete';
  end if;

  select has_function_privilege(
    'authenticated',
    'public.get_media_private_delivery_target_v1(uuid)',
    'EXECUTE'
  )
  into v_authenticated_execute;

  if not v_authenticated_execute
     or has_function_privilege(
          'anon',
          'public.get_media_private_delivery_target_v1(uuid)',
          'EXECUTE'
        )
  then
    raise exception
      'STOP: M4 private-delivery function grants are unsafe';
  end if;

  select has_function_privilege(
    'service_role',
    'public.read_media_maintenance_manifest_v1()',
    'EXECUTE'
  )
  into v_service_execute;

  if not v_service_execute
     or has_function_privilege(
          'authenticated',
          'public.read_media_maintenance_manifest_v1()',
          'EXECUTE'
        )
     or has_function_privilege(
          'anon',
          'public.read_media_maintenance_manifest_v1()',
          'EXECUTE'
        )
  then
    raise exception
      'STOP: M4 maintenance-manifest grants are unsafe';
  end if;

  if exists (
    select 1
    from media.upload_sessions session
    where session.state = 'verified'
      and session.file_object_id is null
  ) then
    raise exception
      'STOP: Verified upload session is missing a canonical file object';
  end if;

  if exists (
    select 1
    from media.upload_sessions session
    where session.state = 'cancelled'
      and session.file_object_id is not null
  ) then
    raise exception
      'STOP: Cancelled upload session owns a canonical file object';
  end if;

  if exists (
    select 1
    from media.variants variant
    left join media.file_objects file_object
      on file_object.id = variant.derived_file_object_id
    where file_object.id is null
  ) then
    raise exception
      'STOP: Media variant is missing its derived file object';
  end if;
end;
$phase_4b_m4_verify$;

select jsonb_build_object(
  'verification', 'PASS',
  'authoritative_migrations', (
    select count(*)
    from supabase_migrations.schema_migrations
  ),
  'canonical_text_asset_kinds', (
    select count(*)
    from media.asset_kinds
    where asset_kind in ('transcript', 'caption')
      and enabled
  ),
  'transcript_assets', (
    select count(*)
    from media.assets
    where asset_kind = 'transcript'
  ),
  'caption_assets', (
    select count(*)
    from media.assets
    where asset_kind = 'caption'
  ),
  'processing_jobs', (
    select count(*)
    from platform_private.jobs
    where command_type = 'media.process_revision'
  ),
  'processing_dead_letters', (
    select count(*)
    from platform_private.jobs
    where command_type = 'media.process_revision'
      and status = 'dead_letter'
  )
) as phase_4b_m4_operational_hardening_acceptance;
