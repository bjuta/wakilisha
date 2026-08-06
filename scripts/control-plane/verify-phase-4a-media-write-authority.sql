begin;

set local statement_timeout = '180s';
set local lock_timeout = '5s';

do $phase_4a_write_contract$
declare
  v_count bigint;
begin
  select count(*)
  into v_count
  from pg_proc procedure_row
  join pg_namespace namespace_row
    on namespace_row.oid = procedure_row.pronamespace
  where namespace_row.nspname = 'public'
    and procedure_row.proname in (
      'create_media_asset_write_v2',
      'replace_media_asset_file_v2',
      'update_media_asset_record_v2',
      'update_media_asset_status_batch_v2'
    )
    and procedure_row.prosecdef
    and exists (
      select 1
      from unnest(procedure_row.proconfig) setting_row
      where setting_row like 'search_path=%'
    );

  if v_count <> 4 then
    raise exception 'STOP: Safe Media write command count changed: %', v_count;
  end if;

  select count(*)
  into v_count
  from information_schema.role_routine_grants grant_row
  where grant_row.routine_schema = 'public'
    and grant_row.routine_name in (
      'create_media_asset_write_v2',
      'replace_media_asset_file_v2',
      'update_media_asset_record_v2',
      'update_media_asset_status_batch_v2'
    )
    and grant_row.grantee = 'authenticated'
    and grant_row.privilege_type = 'EXECUTE';

  if v_count <> 4 then
    raise exception 'STOP: Authenticated Media write command grant count changed: %', v_count;
  end if;

  if exists (
    select 1
    from information_schema.role_routine_grants grant_row
    where grant_row.routine_schema = 'public'
      and grant_row.routine_name in (
        'create_media_asset_write_v2',
        'replace_media_asset_file_v2',
        'update_media_asset_record_v2',
        'update_media_asset_status_batch_v2'
      )
      and grant_row.grantee = 'anon'
  ) then
    raise exception 'STOP: Anonymous Media write command grant exists';
  end if;

  if (select count(*) from media.assets) <> 1079
     or (select count(*) from public.registry_media_assets) <> 1079
     or (select count(*) from media.legacy_asset_links) <> 1079
     or (select count(*) from media.usage_links) <> 987
     or (select count(*) from media.file_objects) <> 0
     or (select count(*) from media.asset_revisions) <> 0
     or (select count(*) from media.variants) <> 0
     or (select count(*) from media.variant_selections) <> 0
  then
    raise exception 'STOP: Live Media write baseline changed before runtime acceptance';
  end if;
end;
$phase_4a_write_contract$;

savepoint phase_4a_write_runtime;

do $phase_4a_write_actor_collision$
begin
  if exists (
    select 1 from auth.users
    where id = 'f4a50000-0000-4000-8000-000000000001'::uuid
  ) then
    raise exception 'STOP: Reserved Phase 4A write verifier actor exists';
  end if;
end;
$phase_4a_write_actor_collision$;

set local session_replication_role = replica;

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  'f4a50000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'phase4a-write-verifier@local.invalid',
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

set local session_replication_role = origin;

insert into public.user_role_assignments (
  id,
  user_id,
  role_key,
  status,
  assigned_by,
  notes
)
values (
  'f4a50000-0000-4000-8000-000000000002',
  'f4a50000-0000-4000-8000-000000000001',
  'administrator',
  'active',
  'f4a50000-0000-4000-8000-000000000001',
  'Transactional Phase 4A write verifier actor'
);

do $phase_4a_write_runtime_acceptance$
declare
  v_actor constant uuid := 'f4a50000-0000-4000-8000-000000000001';
  v_created jsonb;
  v_updated jsonb;
  v_replaced jsonb;
  v_batch jsonb;
  v_asset_id uuid;
  v_revision_one uuid;
  v_original_one uuid;
  v_authority_revision bigint;
  v_rejected boolean;
begin
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_actor::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'authenticated', 'sub', v_actor)::text,
    true
  );

  if auth.uid() is distinct from v_actor
     or not public.current_user_is_administrator()
  then
    raise exception 'STOP: Write verifier actor context failed';
  end if;

  v_created := public.create_media_asset_write_v2(
    jsonb_build_object(
      'asset_kind', 'image',
      'file_kind', 'image',
      'media_kind', 'image',
      'asset_purpose', 'general',
      'title', 'Phase 4A write verifier asset',
      'slug', 'phase-4a-write-verifier-asset',
      'status', 'active',
      'source_kind', 'editor_upload',
      'storage_bucket', 'lightsail-media',
      'metadata', jsonb_build_object('alt_text', 'Verifier image'),
      'tags', jsonb_build_array('phase4a', 'verifier')
    ),
    jsonb_build_object(
      'storage_provider', 'lightsail_media',
      'storage_namespace', 'phase4a-write-verifier',
      'storage_path', 'phase4a/write/verifier/original-one.png',
      'delivery_url', 'https://media.invalid/phase4a/write/original-one.png',
      'original_filename', 'original-one.png',
      'mime_type', 'image/png',
      'byte_size', 3,
      'sha256', repeat('a', 64),
      'technical_metadata', jsonb_build_object('width', 2, 'height', 2)
    ),
    jsonb_build_object(
      'variant_role', 'thumbnail',
      'file', jsonb_build_object(
        'storage_provider', 'lightsail_media',
        'storage_namespace', 'phase4a-write-verifier',
        'storage_path', 'phase4a/write/verifier/thumbnail-one.webp',
        'delivery_url', 'https://media.invalid/phase4a/write/thumbnail-one.webp',
        'original_filename', 'thumbnail-one.webp',
        'mime_type', 'image/webp',
        'byte_size', 2,
        'sha256', repeat('b', 64),
        'technical_metadata', jsonb_build_object('width', 1, 'height', 1)
      ),
      'transformation_spec', jsonb_build_object('operation', 'resize', 'max_width', 480),
      'technical_metadata', jsonb_build_object('width', 1, 'height', 1),
      'generator_name', 'phase4a-write-verifier',
      'generator_version', '1'
    ),
    'Create transactional immutable Media proof',
    'f4a50000-0000-4000-8000-000000000101'
  );

  v_asset_id := (v_created ->> 'asset_id')::uuid;
  v_revision_one := (v_created ->> 'asset_revision_id')::uuid;
  v_original_one := (v_created ->> 'file_object_id')::uuid;

  if (v_created ->> 'authority_revision')::bigint <> 2
     or (v_created #>> '{variant,selection_revision}')::bigint <> 1
  then
    raise exception 'STOP: Create write command did not establish revision and derivative';
  end if;

  if not exists (
    select 1 from public.registry_media_assets where id = v_asset_id
  ) or not exists (
    select 1 from media.legacy_asset_links
    where legacy_asset_id = v_asset_id and asset_id = v_asset_id
  ) or (select count(*) from media.file_objects where storage_namespace = 'phase4a-write-verifier') <> 2
     or (select count(*) from media.asset_revisions where asset_id = v_asset_id) <> 1
     or (select count(*) from media.variants where asset_id = v_asset_id) <> 1
     or (select count(*) from media.variant_selections where asset_revision_id = v_revision_one) <> 1
  then
    raise exception 'STOP: Create write command did not establish the complete authority graph';
  end if;

  v_updated := public.update_media_asset_record_v2(
    v_asset_id,
    2,
    jsonb_build_object(
      'title', 'Phase 4A write verifier updated',
      'status', 'needs_review',
      'metadata', jsonb_build_object('caption', 'Updated caption')
    ),
    'Update transactional Media proof',
    gen_random_uuid()
  );

  if (v_updated ->> 'authority_revision')::bigint <> 3
     or v_updated ->> 'status' <> 'needs_review'
     or v_updated ->> 'lifecycle_state' <> 'active'
  then
    raise exception 'STOP: Metadata and review status update failed';
  end if;

  v_updated := public.update_media_asset_record_v2(
    v_asset_id,
    3,
    jsonb_build_object('status', 'archived'),
    'Archive transactional Media proof',
    gen_random_uuid()
  );

  if (v_updated ->> 'authority_revision')::bigint <> 4
     or v_updated ->> 'lifecycle_state' <> 'archived'
  then
    raise exception 'STOP: Archive command failed';
  end if;

  v_updated := public.update_media_asset_record_v2(
    v_asset_id,
    4,
    jsonb_build_object('status', 'active'),
    'Restore transactional Media proof',
    gen_random_uuid()
  );

  if (v_updated ->> 'authority_revision')::bigint <> 5
     or v_updated ->> 'lifecycle_state' <> 'active'
  then
    raise exception 'STOP: Restore command failed';
  end if;

  v_replaced := public.replace_media_asset_file_v2(
    v_asset_id,
    5,
    jsonb_build_object(
      'storage_provider', 'lightsail_media',
      'storage_namespace', 'phase4a-write-verifier',
      'storage_path', 'phase4a/write/verifier/original-two.png',
      'delivery_url', 'https://media.invalid/phase4a/write/original-two.png',
      'original_filename', 'original-two.png',
      'mime_type', 'image/png',
      'byte_size', 4,
      'sha256', repeat('c', 64),
      'technical_metadata', jsonb_build_object('width', 3, 'height', 3)
    ),
    jsonb_build_object(
      'variant_role', 'thumbnail',
      'file', jsonb_build_object(
        'storage_provider', 'lightsail_media',
        'storage_namespace', 'phase4a-write-verifier',
        'storage_path', 'phase4a/write/verifier/thumbnail-two.webp',
        'delivery_url', 'https://media.invalid/phase4a/write/thumbnail-two.webp',
        'original_filename', 'thumbnail-two.webp',
        'mime_type', 'image/webp',
        'byte_size', 2,
        'sha256', repeat('d', 64),
        'technical_metadata', jsonb_build_object('width', 1, 'height', 1)
      ),
      'transformation_spec', jsonb_build_object('operation', 'resize', 'max_width', 480),
      'technical_metadata', jsonb_build_object('width', 1, 'height', 1),
      'generator_name', 'phase4a-write-verifier',
      'generator_version', '1'
    ),
    'Create immutable replacement revision',
    gen_random_uuid()
  );

  if (v_replaced ->> 'revision_number')::bigint <> 2
     or (v_replaced ->> 'authority_revision')::bigint <> 6
     or (select count(*) from media.file_objects where storage_namespace = 'phase4a-write-verifier') <> 4
     or (select count(*) from media.asset_revisions where asset_id = v_asset_id) <> 2
     or (select count(*) from media.variants where asset_id = v_asset_id) <> 2
  then
    raise exception 'STOP: Immutable replacement command failed';
  end if;

  if not exists (
    select 1 from media.file_objects
    where id = v_original_one
      and storage_path = 'phase4a/write/verifier/original-one.png'
      and sha256 = repeat('a', 64)
  ) then
    raise exception 'STOP: Previous immutable original was changed or removed';
  end if;

  v_rejected := false;
  begin
    perform public.update_media_asset_record_v2(
      v_asset_id,
      5,
      jsonb_build_object('title', 'Stale update'),
      'Reject stale update',
      gen_random_uuid()
    );
  exception
    when others then
      v_rejected := position('stale media authority revision' in lower(sqlerrm)) > 0;
  end;

  if not v_rejected then
    raise exception 'STOP: Stale Media update was accepted';
  end if;

  v_batch := public.update_media_asset_status_batch_v2(
    array[v_asset_id],
    'archived',
    'Batch archive transactional Media proof',
    gen_random_uuid()
  );

  select authority_revision
  into v_authority_revision
  from media.assets
  where id = v_asset_id;

  if (v_batch ->> 'updated_count')::integer <> 1
     or v_authority_revision <> 7
     or (select status from public.registry_media_assets where id = v_asset_id) <> 'archived'
  then
    raise exception 'STOP: Batch Media status command failed';
  end if;
end;
$phase_4a_write_runtime_acceptance$;

rollback to savepoint phase_4a_write_runtime;

select
  'PHASE_4A_MEDIA_WRITE_AUTHORITY' as audit_section,
  'PASS' as verification,
  (select count(*) from public.registry_media_assets) as compatibility_assets,
  (select count(*) from media.assets) as canonical_assets,
  (select count(*) from media.file_objects) as file_objects,
  (select count(*) from media.asset_revisions) as asset_revisions,
  (select count(*) from media.variants) as variants,
  (select count(*) from media.variant_selections) as variant_selections,
  (select count(*) from media.usage_links) as usage_links;

rollback;
