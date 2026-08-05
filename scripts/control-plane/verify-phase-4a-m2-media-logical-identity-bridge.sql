begin;

set local statement_timeout = '120s';
set local lock_timeout = '5s';

do $phase_4a_m2_verify$
declare
  v_count bigint;
  v_fingerprint text;
begin
  select count(*) into v_count from media.assets;
  if v_count <> 1079 then
    raise exception 'STOP: Canonical asset count changed: %', v_count;
  end if;

  select count(*) into v_count
  from media.asset_governance_versions
  where version_number = 1;
  if v_count <> 1079 then
    raise exception 'STOP: Initial governance count changed: %', v_count;
  end if;

  select count(*) into v_count from media.legacy_asset_links;
  if v_count <> 1079 then
    raise exception 'STOP: Legacy bridge count changed: %', v_count;
  end if;

  select count(*) into v_count
  from media.events
  where event_type = 'governance_version_created';
  if v_count <> 1079 then
    raise exception 'STOP: Governance event count changed: %', v_count;
  end if;

  select count(*) into v_count
  from media.events
  where event_type = 'legacy_asset_mapped';
  if v_count <> 1079 then
    raise exception 'STOP: Mapping event count changed: %', v_count;
  end if;

  select count(*) into v_count
  from public.registry_media_assets legacy
  full join media.assets asset
    on asset.id = legacy.id
  where legacy.id is null
     or asset.id is null;
  if v_count <> 0 then
    raise exception 'STOP: Asset UUID parity failure count: %', v_count;
  end if;

  select count(*) into v_count
  from media.assets asset
  join media.asset_governance_versions governance
    on governance.id = asset.current_governance_version_id
  where governance.asset_id <> asset.id
     or governance.version_number <> 1;
  if v_count <> 0 then
    raise exception 'STOP: Governance pointer mismatch count: %', v_count;
  end if;

  select count(*) into v_count
  from media.legacy_asset_links link
  where link.legacy_asset_id <> link.asset_id;
  if v_count <> 0 then
    raise exception 'STOP: Legacy bridge UUID mismatch count: %', v_count;
  end if;

  if (
    (select count(*) from media.file_objects)
    + (select count(*) from media.asset_revisions)
    + (select count(*) from media.variants)
    + (select count(*) from media.variant_selections)
    + (select count(*) from media.usage_links)
  ) <> 0 then
    raise exception
      'STOP: Prohibited file, revision, variant, selection, or usage rows exist';
  end if;

  select md5(
    string_agg(
      to_jsonb(asset_row)::text,
      E'\n'
      order by asset_row.id::text
    )
  )
  into v_fingerprint
  from public.registry_media_assets asset_row;

  if v_fingerprint <> 'f32e074f96b01549b5e597ad8b5f4324' then
    raise exception
      'STOP: Compatibility asset rows changed: %',
      v_fingerprint;
  end if;
end;
$phase_4a_m2_verify$;

with metrics as (
  select
    (select count(*) from public.registry_media_assets)
      as compatibility_asset_count,
    (select count(*) from media.assets)
      as canonical_asset_count,
    (select count(*) from media.asset_governance_versions)
      as governance_version_count,
    (select count(*) from media.legacy_asset_links)
      as legacy_bridge_count,
    (
      select count(*)
      from media.events
      where event_type = 'governance_version_created'
    ) as governance_event_count,
    (
      select count(*)
      from media.events
      where event_type = 'legacy_asset_mapped'
    ) as mapping_event_count,
    (
      select count(*)
      from public.registry_media_assets legacy
      join media.assets asset
        on asset.id = legacy.id
    ) as matching_uuid_count,
    (
      select count(*)
      from media.assets asset
      join media.asset_governance_versions governance
        on governance.id = asset.current_governance_version_id
       and governance.asset_id = asset.id
       and governance.version_number = 1
    ) as valid_governance_pointer_count,
    (
      (select count(*) from media.file_objects)
      + (select count(*) from media.asset_revisions)
      + (select count(*) from media.variants)
      + (select count(*) from media.variant_selections)
      + (select count(*) from media.usage_links)
    ) as prohibited_row_count,
    (
      select md5(
        string_agg(
          to_jsonb(asset_row)::text,
          E'\n'
          order by asset_row.id::text
        )
      )
      from public.registry_media_assets asset_row
    ) as compatibility_asset_fingerprint,
    (
      select count(*)
      from information_schema.role_table_grants grant_row
      where grant_row.table_schema = 'media'
        and grant_row.table_name in (
          'assets',
          'file_objects',
          'asset_revisions',
          'variants',
          'variant_selections',
          'asset_governance_versions',
          'usage_links',
          'legacy_asset_links',
          'events'
        )
        and grant_row.grantee = 'authenticated'
        and grant_row.privilege_type in (
          'INSERT',
          'UPDATE',
          'DELETE',
          'TRUNCATE'
        )
    ) as authenticated_direct_write_grant_count,
    (
      (
        case
          when has_schema_privilege('anon', 'media', 'USAGE')
            then 1
          else 0
        end
      )
      + (
        select count(*)
        from information_schema.role_table_grants
        where table_schema = 'media'
          and grantee = 'anon'
      )
      + (
        select count(*)
        from information_schema.role_routine_grants
        where routine_schema = 'media'
          and grantee = 'anon'
      )
    ) as anonymous_media_privilege_count
)
select jsonb_build_object(
  'verification', 'PASS',
  'migration_scope', 'logical_identity_bridge',
  'compatibility_asset_count', compatibility_asset_count,
  'canonical_asset_count', canonical_asset_count,
  'governance_version_count', governance_version_count,
  'legacy_bridge_count', legacy_bridge_count,
  'governance_event_count', governance_event_count,
  'mapping_event_count', mapping_event_count,
  'matching_uuid_count', matching_uuid_count,
  'valid_governance_pointer_count', valid_governance_pointer_count,
  'prohibited_row_count', prohibited_row_count,
  'compatibility_asset_fingerprint', compatibility_asset_fingerprint,
  'authenticated_direct_write_grant_count',
    authenticated_direct_write_grant_count,
  'anonymous_media_privilege_count',
    anonymous_media_privilege_count
) as phase_4a_m2_media_logical_identity_bridge
from metrics;

rollback;
