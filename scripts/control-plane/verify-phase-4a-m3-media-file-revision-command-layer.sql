begin;

set local statement_timeout = '120s';
set local lock_timeout = '5s';

do $phase_4a_m3_verify$
declare
  v_count bigint;
  v_text text;
begin
  select count(*)
  into v_count
  from pg_proc procedure_row
  join pg_namespace namespace
    on namespace.oid = procedure_row.pronamespace
  where namespace.nspname = 'public'
    and procedure_row.proname in (
      'create_media_asset',
      'register_media_file_object',
      'verify_media_file_object',
      'create_media_asset_revision',
      'register_media_variant',
      'activate_media_variant',
      'create_media_governance_version',
      'archive_media_asset',
      'restore_media_asset'
    )
    and procedure_row.prosecdef
    and exists (
      select 1
      from unnest(procedure_row.proconfig) setting
      where setting like 'search_path=%'
    );

  if v_count <> 9 then
    raise exception
      'STOP: Safe security-definer Media command count changed: %',
      v_count;
  end if;

  select count(*)
  into v_count
  from information_schema.role_routine_grants grant_row
  where grant_row.routine_schema = 'public'
    and grant_row.routine_name in (
      'create_media_asset',
      'register_media_file_object',
      'verify_media_file_object',
      'create_media_asset_revision',
      'register_media_variant',
      'activate_media_variant',
      'create_media_governance_version',
      'archive_media_asset',
      'restore_media_asset'
    )
    and grant_row.grantee = 'authenticated'
    and grant_row.privilege_type = 'EXECUTE';

  if v_count <> 9 then
    raise exception
      'STOP: Authenticated Media command grant count changed: %',
      v_count;
  end if;

  select count(*)
  into v_count
  from information_schema.role_routine_grants grant_row
  where grant_row.routine_schema = 'public'
    and grant_row.routine_name in (
      'create_media_asset',
      'register_media_file_object',
      'verify_media_file_object',
      'create_media_asset_revision',
      'register_media_variant',
      'activate_media_variant',
      'create_media_governance_version',
      'archive_media_asset',
      'restore_media_asset'
    )
    and grant_row.grantee = 'anon';

  if v_count <> 0 then
    raise exception
      'STOP: Anonymous Media command grant count changed: %',
      v_count;
  end if;

  select count(*)
  into v_count
  from information_schema.role_table_grants grant_row
  where grant_row.table_schema = 'media'
    and grant_row.grantee = 'authenticated'
    and grant_row.privilege_type in (
      'INSERT',
      'UPDATE',
      'DELETE',
      'TRUNCATE'
    );

  if v_count <> 0 then
    raise exception
      'STOP: Authenticated canonical write grant count changed: %',
      v_count;
  end if;

  if (select count(*) from media.assets) <> 1079
     or (
       select count(*)
       from media.asset_governance_versions
     ) <> 1079
     or (
       select count(*)
       from media.legacy_asset_links
     ) <> 1079
  then
    raise exception
      'STOP: Migration 2 canonical identity counts changed';
  end if;

  if (
    (select count(*) from media.file_objects)
    + (select count(*) from media.asset_revisions)
    + (select count(*) from media.variants)
    + (select count(*) from media.variant_selections)
    + (select count(*) from media.usage_links)
  ) <> 0 then
    raise exception
      'STOP: Command installation changed canonical data';
  end if;

  select md5(
    string_agg(
      to_jsonb(asset_row)::text,
      E'\n'
      order by asset_row.id::text
    )
  )
  into v_text
  from public.registry_media_assets asset_row;

  if v_text <> 'f32e074f96b01549b5e597ad8b5f4324' then
    raise exception
      'STOP: Compatibility fingerprint changed: %',
      v_text;
  end if;
end;
$phase_4a_m3_verify$;

savepoint phase_4a_m3_runtime_acceptance;

do $phase_4a_m3_actor_collision$
begin
  if exists (
    select 1
    from auth.users
    where id = 'f4a30000-0000-4000-8000-000000000001'::uuid
  ) then
    raise exception 'STOP: Reserved Phase 4A M3 verifier actor exists';
  end if;
end;
$phase_4a_m3_actor_collision$;

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
  'f4a30000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'phase4a-m3-verifier@local.invalid',
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
  'f4a30000-0000-4000-8000-000000000002',
  'f4a30000-0000-4000-8000-000000000001',
  'administrator',
  'active',
  'f4a30000-0000-4000-8000-000000000001',
  'Transactional Phase 4A M3 verifier actor'
);

do $phase_4a_m3_runtime_acceptance$
declare
  v_actor constant uuid :=
    'f4a30000-0000-4000-8000-000000000001';
  v_asset_corr constant uuid :=
    'f4a30000-0000-4000-8000-000000000101';
  v_revision_corr constant uuid :=
    'f4a30000-0000-4000-8000-000000000102';

  v_asset record;
  v_original record;
  v_revision record;
  v_derived_one record;
  v_derived_two record;
  v_variant_one record;
  v_variant_two record;
  v_selection record;
  v_governance record;
  v_lifecycle record;

  v_asset_id uuid;
  v_original_id uuid;
  v_revision_id uuid;
  v_derived_one_id uuid;
  v_derived_two_id uuid;
  v_variant_one_id uuid;
  v_variant_two_id uuid;

  v_blocked boolean;
  v_rejected boolean;
  v_event_count bigint;
begin
  perform set_config(
    'request.jwt.claim.role',
    'authenticated',
    true
  );
  perform set_config(
    'request.jwt.claim.sub',
    v_actor::text,
    true
  );
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'role',
      'authenticated',
      'sub',
      v_actor
    )::text,
    true
  );

  if auth.uid() is distinct from v_actor
     or not public.current_user_is_administrator()
  then
    raise exception 'STOP: M3 verifier actor context failed';
  end if;

  select *
  into v_asset
  from public.create_media_asset(
    'image',
    'general',
    'Phase 4A M3 verifier asset',
    null,
    v_asset_corr
  );

  v_asset_id := v_asset.asset_id;

  if v_asset.authority_revision <> 1
     or v_asset.correlation_id is distinct from v_asset_corr
  then
    raise exception 'STOP: create_media_asset failed';
  end if;

  select *
  into v_original
  from public.register_media_file_object(
    'lightsail_media',
    'phase4a-m3-verifier',
    'phase4a/m3/verifier/original.png',
    'https://media.invalid/phase4a/m3/original.png',
    'original.png',
    'image/png',
    3,
    '{"width":1,"height":1}'::jsonb,
    gen_random_uuid()
  );

  v_original_id := v_original.file_object_id;

  perform 1
  from public.verify_media_file_object(
    v_original_id,
    'verified',
    repeat('a', 64),
    3,
    'image/png',
    '{"width":1,"height":1}'::jsonb,
    null,
    gen_random_uuid()
  );

  select *
  into v_revision
  from public.create_media_asset_revision(
    v_asset_id,
    1,
    v_original_id,
    'Create verifier revision 1',
    v_revision_corr
  );

  v_revision_id := v_revision.asset_revision_id;

  if v_revision.revision_number <> 1
     or v_revision.authority_revision <> 2
  then
    raise exception 'STOP: create_media_asset_revision failed';
  end if;

  v_rejected := false;
  begin
    perform 1
    from public.create_media_asset_revision(
      v_asset_id,
      1,
      v_original_id,
      'Stale verifier revision',
      gen_random_uuid()
    );
  exception
    when others then
      v_rejected :=
        position(
          'stale media authority revision'
          in lower(sqlerrm)
        ) > 0;
  end;

  if not v_rejected then
    raise exception 'STOP: Stale authority revision was accepted';
  end if;

  select *
  into v_derived_one
  from public.register_media_file_object(
    'lightsail_media',
    'phase4a-m3-verifier',
    'phase4a/m3/verifier/thumbnail-one.png',
    'https://media.invalid/phase4a/m3/thumbnail-one.png',
    'thumbnail-one.png',
    'image/png',
    2,
    '{}'::jsonb,
    gen_random_uuid()
  );

  v_derived_one_id := v_derived_one.file_object_id;

  perform 1
  from public.verify_media_file_object(
    v_derived_one_id,
    'verified',
    repeat('b', 64),
    2,
    'image/png',
    '{}'::jsonb,
    null,
    gen_random_uuid()
  );

  select *
  into v_variant_one
  from public.register_media_variant(
    v_asset_id,
    v_revision_id,
    v_original_id,
    v_derived_one_id,
    'thumbnail',
    '{"operation":"resize","width":1}'::jsonb,
    '{"width":1,"height":1}'::jsonb,
    'phase4a-m3-verifier',
    '1',
    gen_random_uuid()
  );

  v_variant_one_id := v_variant_one.variant_id;

  select *
  into v_selection
  from public.activate_media_variant(
    v_revision_id,
    'thumbnail',
    v_variant_one_id,
    0,
    'Activate verifier thumbnail one',
    gen_random_uuid()
  );

  if v_selection.selection_revision <> 1 then
    raise exception 'STOP: First variant activation failed';
  end if;

  select *
  into v_derived_two
  from public.register_media_file_object(
    'lightsail_media',
    'phase4a-m3-verifier',
    'phase4a/m3/verifier/thumbnail-two.png',
    'https://media.invalid/phase4a/m3/thumbnail-two.png',
    'thumbnail-two.png',
    'image/png',
    2,
    '{}'::jsonb,
    gen_random_uuid()
  );

  v_derived_two_id := v_derived_two.file_object_id;

  perform 1
  from public.verify_media_file_object(
    v_derived_two_id,
    'verified',
    repeat('c', 64),
    2,
    'image/png',
    '{}'::jsonb,
    null,
    gen_random_uuid()
  );

  select *
  into v_variant_two
  from public.register_media_variant(
    v_asset_id,
    v_revision_id,
    v_original_id,
    v_derived_two_id,
    'thumbnail',
    '{"operation":"resize","width":1,"revision":2}'::jsonb,
    '{"width":1,"height":1}'::jsonb,
    'phase4a-m3-verifier',
    '2',
    gen_random_uuid()
  );

  v_variant_two_id := v_variant_two.variant_id;

  select *
  into v_selection
  from public.activate_media_variant(
    v_revision_id,
    'thumbnail',
    v_variant_two_id,
    1,
    'Activate verifier thumbnail two',
    gen_random_uuid()
  );

  if v_selection.selection_revision <> 2 then
    raise exception 'STOP: Replacement variant activation failed';
  end if;

  v_rejected := false;
  begin
    perform 1
    from public.activate_media_variant(
      v_revision_id,
      'thumbnail',
      v_variant_one_id,
      1,
      'Stale verifier selection',
      gen_random_uuid()
    );
  exception
    when others then
      v_rejected :=
        position(
          'stale media selection revision'
          in lower(sqlerrm)
        ) > 0;
  end;

  if not v_rejected then
    raise exception 'STOP: Stale selection revision was accepted';
  end if;

  select *
  into v_governance
  from public.create_media_governance_version(
    v_asset_id,
    2,
    jsonb_build_object(
      'rights_status',
      'owned',
      'consent_status',
      'not_required',
      'sensitivity',
      'none',
      'embargo_state',
      'none',
      'source_protection_class',
      'internal',
      'preservation_state',
      'working_copy',
      'retention_state',
      'retain',
      'public_safety_state',
      'internal'
    ),
    'Create verifier governance version 2',
    gen_random_uuid()
  );

  if v_governance.version_number <> 2
     or v_governance.authority_revision <> 3
  then
    raise exception 'STOP: Governance version activation failed';
  end if;

  select *
  into v_lifecycle
  from public.archive_media_asset(
    v_asset_id,
    3,
    'Archive verifier asset',
    gen_random_uuid()
  );

  if v_lifecycle.lifecycle_state <> 'archived'
     or v_lifecycle.authority_revision <> 4
  then
    raise exception 'STOP: Asset archive failed';
  end if;

  select *
  into v_lifecycle
  from public.restore_media_asset(
    v_asset_id,
    4,
    'Restore verifier asset',
    gen_random_uuid()
  );

  if v_lifecycle.lifecycle_state <> 'active'
     or v_lifecycle.authority_revision <> 5
  then
    raise exception 'STOP: Asset restore failed';
  end if;

  v_blocked := false;
  begin
    update media.file_objects
    set delivery_url =
      'https://media.invalid/phase4a/m3/illegal.png'
    where id = v_original_id;
  exception
    when others then
      v_blocked :=
        position('immutable' in lower(sqlerrm)) > 0;
  end;

  if not v_blocked then
    raise exception 'STOP: File-object immutability failed';
  end if;

  v_blocked := false;
  begin
    update media.asset_revisions
    set replacement_reason = 'Illegal rewrite'
    where id = v_revision_id;
  exception
    when others then
      v_blocked :=
        position('immutable' in lower(sqlerrm)) > 0;
  end;

  if not v_blocked then
    raise exception 'STOP: Revision immutability failed';
  end if;

  v_blocked := false;
  begin
    update media.variants
    set generator_name = 'illegal-rewrite'
    where id = v_variant_one_id;
  exception
    when others then
      v_blocked :=
        position('immutable' in lower(sqlerrm)) > 0;
  end;

  if not v_blocked then
    raise exception 'STOP: Variant immutability failed';
  end if;

  v_blocked := false;
  begin
    update media.events
    set reason = 'Illegal rewrite'
    where correlation_id = v_asset_corr;
  exception
    when others then
      v_blocked :=
        position('immutable' in lower(sqlerrm)) > 0;
  end;

  if not v_blocked then
    raise exception 'STOP: Event immutability failed';
  end if;

  select count(*)
  into v_event_count
  from media.events event
  where event.actor_id = v_actor
    and (
      event.asset_id = v_asset_id
      or event.file_object_id in (
        v_original_id,
        v_derived_one_id,
        v_derived_two_id
      )
    );

  if v_event_count <> 17 then
    raise exception
      'STOP: Expected 17 Media command events, found %',
      v_event_count;
  end if;

  if not exists (
    select 1
    from media.assets asset
    where asset.id = v_asset_id
      and asset.lifecycle_state = 'active'
      and asset.authority_revision = 5
      and asset.current_revision_id = v_revision_id
      and asset.current_governance_version_id =
        v_governance.governance_version_id
  ) then
    raise exception 'STOP: Final Media authority state is invalid';
  end if;
end;
$phase_4a_m3_runtime_acceptance$;

rollback to savepoint phase_4a_m3_runtime_acceptance;
release savepoint phase_4a_m3_runtime_acceptance;

with metrics as (
  select
    (
      select count(*)
      from pg_proc procedure_row
      join pg_namespace namespace
        on namespace.oid = procedure_row.pronamespace
      where namespace.nspname = 'public'
        and procedure_row.proname in (
          'create_media_asset',
          'register_media_file_object',
          'verify_media_file_object',
          'create_media_asset_revision',
          'register_media_variant',
          'activate_media_variant',
          'create_media_governance_version',
          'archive_media_asset',
          'restore_media_asset'
        )
        and procedure_row.prosecdef
    ) as command_count,
    (
      select count(*)
      from information_schema.role_routine_grants
      where routine_schema = 'public'
        and routine_name in (
          'create_media_asset',
          'register_media_file_object',
          'verify_media_file_object',
          'create_media_asset_revision',
          'register_media_variant',
          'activate_media_variant',
          'create_media_governance_version',
          'archive_media_asset',
          'restore_media_asset'
        )
        and grantee = 'authenticated'
        and privilege_type = 'EXECUTE'
    ) as authenticated_command_grant_count,
    (
      select count(*)
      from information_schema.role_routine_grants
      where routine_schema = 'public'
        and routine_name in (
          'create_media_asset',
          'register_media_file_object',
          'verify_media_file_object',
          'create_media_asset_revision',
          'register_media_variant',
          'activate_media_variant',
          'create_media_governance_version',
          'archive_media_asset',
          'restore_media_asset'
        )
        and grantee = 'anon'
    ) as anonymous_command_grant_count,
    (
      select count(*)
      from information_schema.role_table_grants
      where table_schema = 'media'
        and grantee = 'authenticated'
        and privilege_type in (
          'INSERT',
          'UPDATE',
          'DELETE',
          'TRUNCATE'
        )
    ) as authenticated_direct_write_grant_count,
    (select count(*) from media.assets)
      as canonical_asset_count,
    (select count(*) from media.asset_governance_versions)
      as governance_version_count,
    (select count(*) from media.legacy_asset_links)
      as legacy_bridge_count,
    (select count(*) from media.file_objects)
      as file_object_count,
    (select count(*) from media.asset_revisions)
      as asset_revision_count,
    (select count(*) from media.variants)
      as variant_count,
    (select count(*) from media.variant_selections)
      as variant_selection_count,
    (select count(*) from media.usage_links)
      as usage_link_count,
    (
      select md5(
        string_agg(
          to_jsonb(asset_row)::text,
          E'\n'
          order by asset_row.id::text
        )
      )
      from public.registry_media_assets asset_row
    ) as compatibility_asset_fingerprint
)
select jsonb_build_object(
  'verification', 'PASS',
  'migration_scope', 'file_revision_command_layer',
  'command_count', command_count,
  'authenticated_command_grant_count',
    authenticated_command_grant_count,
  'anonymous_command_grant_count',
    anonymous_command_grant_count,
  'authenticated_direct_write_grant_count',
    authenticated_direct_write_grant_count,
  'canonical_asset_count', canonical_asset_count,
  'governance_version_count', governance_version_count,
  'legacy_bridge_count', legacy_bridge_count,
  'file_object_count', file_object_count,
  'asset_revision_count', asset_revision_count,
  'variant_count', variant_count,
  'variant_selection_count', variant_selection_count,
  'usage_link_count', usage_link_count,
  'compatibility_asset_fingerprint',
    compatibility_asset_fingerprint
) as phase_4a_m3_media_file_revision_command_layer
from metrics;

rollback;
