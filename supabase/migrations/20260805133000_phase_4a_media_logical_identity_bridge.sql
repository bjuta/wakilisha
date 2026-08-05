begin;

set local statement_timeout = '120s';
set local lock_timeout = '5s';

do $phase_4a_m2_preflight$
declare
  v_count bigint;
  v_fingerprint text;
begin
  if to_regnamespace('media') is null then
    raise exception 'STOP: media schema does not exist';
  end if;

  if to_regclass('public.registry_media_assets') is null then
    raise exception 'STOP: public.registry_media_assets does not exist';
  end if;

  select count(*)
  into v_count
  from public.registry_media_assets;

  if v_count <> 1079 then
    raise exception
      'STOP: Expected 1079 compatibility assets, found %',
      v_count;
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
      'STOP: Compatibility asset fingerprint changed: %',
      v_fingerprint;
  end if;

  if exists (
    select 1
    from public.registry_media_assets
    where status <> 'active'
       or status is null
  ) then
    raise exception
      'STOP: Migration 2 requires every compatibility asset to remain active';
  end if;

  if (
    (select count(*) from media.assets)
    + (select count(*) from media.file_objects)
    + (select count(*) from media.asset_revisions)
    + (select count(*) from media.variants)
    + (select count(*) from media.variant_selections)
    + (select count(*) from media.asset_governance_versions)
    + (select count(*) from media.usage_links)
    + (select count(*) from media.legacy_asset_links)
    + (select count(*) from media.events)
  ) <> 0 then
    raise exception
      'STOP: Canonical Media tables are not empty before Migration 2';
  end if;
end;
$phase_4a_m2_preflight$;

create temporary table phase_4a_m2_map
on commit drop
as
select
  legacy.id as asset_id,
  gen_random_uuid() as governance_version_id,
  legacy.id as correlation_id
from public.registry_media_assets legacy;

insert into media.assets (
  id,
  asset_kind,
  asset_purpose,
  title,
  lifecycle_state,
  compatibility_folder_id,
  current_revision_id,
  current_governance_version_id,
  authority_revision,
  created_by,
  updated_by,
  archived_by,
  archived_at,
  archive_reason,
  created_at,
  updated_at
)
select
  legacy.id,
  case
    when legacy.file_kind in (
      select asset_kind
      from media.asset_kinds
      where enabled
    )
      then legacy.file_kind
    when legacy.media_kind in (
      select asset_kind
      from media.asset_kinds
      where enabled
    )
      then legacy.media_kind
    else 'other'
  end,
  case
    when legacy.asset_purpose in (
      select asset_purpose
      from media.asset_purposes
      where enabled
    )
      then legacy.asset_purpose
    else 'general'
  end,
  coalesce(
    nullif(btrim(legacy.title), ''),
    nullif(btrim(legacy.slug), ''),
    'Legacy media ' || legacy.id::text
  ),
  'active',
  legacy.folder_id,
  null,
  null,
  1,
  null,
  null,
  null,
  null,
  null,
  legacy.created_at,
  legacy.updated_at
from public.registry_media_assets legacy
order by legacy.id;

insert into media.asset_governance_versions (
  id,
  asset_id,
  version_number,
  rights_status,
  rights_basis,
  rights_holder,
  licence_identifier,
  licence_terms,
  consent_status,
  consent_scope,
  sensitivity,
  embargo_state,
  embargo_until,
  source_protection_class,
  preservation_state,
  retention_state,
  public_safety_state,
  internal_reason,
  approved_by,
  created_by,
  created_at
)
select
  mapping.governance_version_id,
  legacy.id,
  1,
  legacy.rights_status,
  null,
  null,
  null,
  null,
  'unknown',
  null,
  'none',
  'none',
  null,
  'internal',
  'unassessed',
  'retain',
  'internal',
  'Initial governance copied without inference from registry_media_assets',
  null,
  null,
  legacy.created_at
from public.registry_media_assets legacy
join phase_4a_m2_map mapping
  on mapping.asset_id = legacy.id
order by legacy.id;

update media.assets asset
set
  current_governance_version_id = mapping.governance_version_id
from phase_4a_m2_map mapping
where mapping.asset_id = asset.id;

insert into media.legacy_asset_links (
  legacy_asset_id,
  asset_id,
  mapping_reason,
  legacy_snapshot,
  created_by,
  created_at
)
select
  legacy.id,
  legacy.id,
  'Phase 4A Migration 2 deterministic logical identity bridge',
  to_jsonb(legacy),
  null,
  legacy.created_at
from public.registry_media_assets legacy
order by legacy.id;

insert into media.events (
  asset_id,
  governance_version_id,
  event_type,
  actor_id,
  reason,
  prior_state,
  resulting_state,
  correlation_id,
  created_at
)
select
  legacy.id,
  mapping.governance_version_id,
  'governance_version_created',
  null,
  'Initial governance created from compatibility metadata without inference',
  null,
  jsonb_build_object(
    'version_number', 1,
    'rights_status', legacy.rights_status,
    'consent_status', 'unknown',
    'sensitivity', 'none',
    'embargo_state', 'none',
    'source_protection_class', 'internal',
    'preservation_state', 'unassessed',
    'retention_state', 'retain',
    'public_safety_state', 'internal'
  ),
  mapping.correlation_id,
  legacy.created_at
from public.registry_media_assets legacy
join phase_4a_m2_map mapping
  on mapping.asset_id = legacy.id
order by legacy.id;

insert into media.events (
  asset_id,
  event_type,
  actor_id,
  reason,
  prior_state,
  resulting_state,
  correlation_id,
  created_at
)
select
  legacy.id,
  'legacy_asset_mapped',
  null,
  'Compatibility asset mapped one-to-one to canonical logical Media identity',
  to_jsonb(legacy),
  jsonb_build_object(
    'legacy_asset_id', legacy.id,
    'asset_id', legacy.id,
    'mapping_reason',
      'Phase 4A Migration 2 deterministic logical identity bridge'
  ),
  mapping.correlation_id,
  legacy.created_at
from public.registry_media_assets legacy
join phase_4a_m2_map mapping
  on mapping.asset_id = legacy.id
order by legacy.id;

do $phase_4a_m2_assertions$
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
      'STOP: Migration 2 created prohibited file, revision, variant, selection, or usage rows';
  end if;

  select count(*) into v_count
  from public.registry_media_assets;
  if v_count <> 1079 then
    raise exception
      'STOP: Compatibility asset count changed: %',
      v_count;
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

  select count(*)
  into v_count
  from pg_constraint constraint_row
  join pg_class source_table
    on source_table.oid = constraint_row.conrelid
  join pg_namespace source_namespace
    on source_namespace.oid = source_table.relnamespace
  join pg_class referenced_table
    on referenced_table.oid = constraint_row.confrelid
  join pg_namespace referenced_namespace
    on referenced_namespace.oid = referenced_table.relnamespace
  where constraint_row.contype = 'f'
    and source_namespace.nspname <> 'media'
    and referenced_namespace.nspname = 'public'
    and referenced_table.relname = 'registry_media_assets';

  if v_count <> 14 then
    raise exception
      'STOP: Compatibility foreign-key count changed: %',
      v_count;
  end if;

  select md5(
    coalesce(
      string_agg(
        concat_ws(
          '|',
          source_namespace.nspname,
          source_table.relname,
          constraint_row.conname,
          pg_get_constraintdef(constraint_row.oid, true)
        ),
        E'\n'
        order by
          source_namespace.nspname,
          source_table.relname,
          constraint_row.conname
      ),
      ''
    )
  )
  into v_fingerprint
  from pg_constraint constraint_row
  join pg_class source_table
    on source_table.oid = constraint_row.conrelid
  join pg_namespace source_namespace
    on source_namespace.oid = source_table.relnamespace
  join pg_class referenced_table
    on referenced_table.oid = constraint_row.confrelid
  join pg_namespace referenced_namespace
    on referenced_namespace.oid = referenced_table.relnamespace
  where constraint_row.contype = 'f'
    and source_namespace.nspname <> 'media'
    and referenced_namespace.nspname = 'public'
    and referenced_table.relname = 'registry_media_assets';

  if v_fingerprint <> '54274ae6a613d38c257c543ccf7050cc' then
    raise exception
      'STOP: Compatibility foreign-key fingerprint changed: %',
      v_fingerprint;
  end if;
end;
$phase_4a_m2_assertions$;

commit;
