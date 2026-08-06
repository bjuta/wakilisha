begin;

set local statement_timeout = '180s';
set local lock_timeout = '5s';

do $phase_4a_deferred_trigger_contract$
declare
  v_trigger_function oid;
begin
  v_trigger_function :=
    to_regprocedure(
      'media.enforce_asset_pointer_integrity()'
    );

  if not exists (
    select 1
    from pg_proc procedure_row
    where procedure_row.oid = v_trigger_function
      and pg_get_userbyid(procedure_row.proowner) = 'postgres'
      and procedure_row.prosecdef
      and exists (
        select 1
        from unnest(procedure_row.proconfig) setting_row
        where setting_row = 'search_path=pg_catalog, media'
      )
  ) then
    raise exception
      'STOP: Deferred pointer trigger is not owner-authorized';
  end if;

  if has_function_privilege(
    'authenticated',
    v_trigger_function,
    'EXECUTE'
  ) then
    raise exception
      'STOP: Authenticated can execute the private trigger function';
  end if;

  if has_table_privilege(
    'authenticated',
    'media.asset_governance_versions',
    'SELECT'
  ) then
    raise exception
      'STOP: Authenticated gained direct governance-table SELECT';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    join pg_class table_row
      on table_row.oid = trigger_row.tgrelid
    join pg_namespace namespace_row
      on namespace_row.oid = table_row.relnamespace
    where namespace_row.nspname = 'media'
      and table_row.relname = 'assets'
      and trigger_row.tgname = 'assets_pointer_integrity'
      and trigger_row.tgfoid = v_trigger_function
      and trigger_row.tgconstraint <> 0
      and trigger_row.tgdeferrable
      and trigger_row.tginitdeferred
  ) then
    raise exception
      'STOP: Deferred pointer trigger contract changed';
  end if;
end;
$phase_4a_deferred_trigger_contract$;

create temporary table phase4a_deferred_trigger_runtime (
  asset_id uuid,
  result jsonb
) on commit drop;

grant all
on phase4a_deferred_trigger_runtime
to authenticated;

savepoint phase_4a_deferred_trigger_runtime;

set local role authenticated;

select set_config(
  'request.jwt.claim.role',
  'authenticated',
  true
);

select set_config(
  'request.jwt.claim.sub',
  '27937fb0-147f-4d0f-b735-3b9b9b82f38f',
  true
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'role',
    'authenticated',
    'sub',
    '27937fb0-147f-4d0f-b735-3b9b9b82f38f'
  )::text,
  true
);

do $phase_4a_authenticated_commit_boundary$
declare
  v_result jsonb;
begin
  if not public.current_user_is_administrator()
     or not public.current_user_has_capability(
       'manage_media_assets'
     )
  then
    raise exception
      'STOP: Authenticated Media verifier actor is unauthorized';
  end if;

  v_result := public.create_media_asset_write_v2(
    jsonb_build_object(
      'slug',
        'phase4a-deferred-trigger-authority-verifier',
      'title',
        'Phase 4A deferred trigger authority verifier',
      'asset_kind', 'image',
      'media_kind', 'image',
      'file_kind', 'image',
      'asset_purpose', 'general',
      'status', 'active',
      'source_kind', 'editor_upload',
      'source_entity', 'admin_upload',
      'storage_bucket', 'lightsail-media',
      'display_filename',
        'phase4a-deferred-trigger-authority.png',
      'metadata',
        jsonb_build_object(
          'alt_text',
            'Rollback-only deferred trigger verifier',
          'width', 1600,
          'height', 900
        )
    ),
    jsonb_build_object(
      'storage_provider', 'lightsail_media',
      'storage_namespace', 'lightsail-media',
      'storage_path',
        'phase4a/verifier/deferred-trigger-original.png',
      'delivery_url',
        'https://media.invalid/phase4a/verifier/deferred-trigger-original.png',
      'original_filename',
        'phase4a-deferred-trigger-authority.png',
      'mime_type', 'image/png',
      'byte_size', 8,
      'sha256', repeat('a', 64),
      'technical_metadata',
        jsonb_build_object(
          'width', 1600,
          'height', 900
        )
    ),
    jsonb_build_object(
      'variant_role', 'responsive_width',
      'file',
        jsonb_build_object(
          'storage_provider', 'lightsail_media',
          'storage_namespace', 'lightsail-media',
          'storage_path',
            '__image/w640/phase4a/verifier/deferred-trigger-original.png',
          'delivery_url',
            'https://media.invalid/__image/w640/phase4a/verifier/deferred-trigger-original.png',
          'original_filename',
            'w640-phase4a-deferred-trigger-authority.png',
          'mime_type', 'image/png',
          'byte_size', 4,
          'sha256', repeat('b', 64),
          'technical_metadata',
            jsonb_build_object(
              'width', 640,
              'source_storage_path',
                'phase4a/verifier/deferred-trigger-original.png',
              'delivery_kind',
                'nginx_responsive_derivative'
            )
        ),
      'transformation_spec',
        jsonb_build_object(
          'operation', 'resize_width',
          'width', 640
        ),
      'technical_metadata',
        jsonb_build_object(
          'width', 640,
          'source_storage_path',
            'phase4a/verifier/deferred-trigger-original.png'
        ),
      'generator_name', 'nginx-image-filter',
      'generator_version', 'production'
    ),
    'Rollback-only deferred commit-boundary verification',
    'f4a50000-0000-4000-8000-000000000051'
  );

  insert into phase4a_deferred_trigger_runtime (
    asset_id,
    result
  )
  values (
    (v_result ->> 'asset_id')::uuid,
    v_result
  );
end;
$phase_4a_authenticated_commit_boundary$;

set constraints all immediate;

reset role;

do $phase_4a_deferred_trigger_runtime_assertions$
declare
  v_asset_id uuid;
  v_result jsonb;
begin
  select
    runtime_row.asset_id,
    runtime_row.result
  into
    v_asset_id,
    v_result
  from phase4a_deferred_trigger_runtime runtime_row
  limit 1;

  if v_asset_id is null
     or (
       select count(*)
       from media.assets
       where id = v_asset_id
     ) <> 1
     or (
       select count(*)
       from media.asset_governance_versions
       where asset_id = v_asset_id
     ) <> 1
     or (
       select count(*)
       from media.file_objects
       where id in (
         (v_result ->> 'file_object_id')::uuid,
         (
           v_result
             #>> '{variant,derived_file_object_id}'
         )::uuid
       )
     ) <> 2
     or (
       select count(*)
       from media.asset_revisions
       where asset_id = v_asset_id
     ) <> 1
     or (
       select count(*)
       from media.variants
       where asset_id = v_asset_id
     ) <> 1
     or (
       select count(*)
       from media.variant_selections selection_row
       join media.asset_revisions revision_row
         on revision_row.id =
           selection_row.asset_revision_id
       where revision_row.asset_id = v_asset_id
     ) <> 1
  then
    raise exception
      'STOP: Deferred commit-boundary Media graph failed';
  end if;
end;
$phase_4a_deferred_trigger_runtime_assertions$;

rollback to savepoint phase_4a_deferred_trigger_runtime;

do $phase_4a_deferred_trigger_rollback_assertions$
begin
  if (select count(*) from media.assets) <> 1079
     or (
       select count(*)
       from media.asset_governance_versions
     ) <> 1079
     or (
       select count(*)
       from public.registry_media_assets
     ) <> 1079
     or (select count(*) from media.file_objects) <> 0
     or (select count(*) from media.asset_revisions) <> 0
     or (select count(*) from media.variants) <> 0
     or (
       select count(*)
       from media.variant_selections
     ) <> 0
     or (select count(*) from media.usage_links) <> 987
  then
    raise exception
      'STOP: Deferred-trigger verifier did not roll back cleanly';
  end if;
end;
$phase_4a_deferred_trigger_rollback_assertions$;

select jsonb_pretty(
  jsonb_build_object(
    'verification',
      'PHASE_4A_MEDIA_DEFERRED_POINTER_TRIGGER_AUTHORITY_PASS',
    'trigger_function',
      'media.enforce_asset_pointer_integrity()',
    'owner', 'postgres',
    'security_definer', true,
    'deferred_trigger_forced', true,
    'authenticated_direct_governance_select', false,
    'canonical_assets',
      (select count(*) from media.assets),
    'governance_versions',
      (
        select count(*)
        from media.asset_governance_versions
      ),
    'compatibility_assets',
      (
        select count(*)
        from public.registry_media_assets
      ),
    'file_objects',
      (select count(*) from media.file_objects),
    'asset_revisions',
      (select count(*) from media.asset_revisions),
    'variants',
      (select count(*) from media.variants),
    'variant_selections',
      (
        select count(*)
        from media.variant_selections
      ),
    'usage_links',
      (select count(*) from media.usage_links)
  )
) as phase4a_media_deferred_pointer_trigger_authority;

rollback;
