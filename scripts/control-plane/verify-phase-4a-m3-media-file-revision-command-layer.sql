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
