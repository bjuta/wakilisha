begin;

set local statement_timeout = '180s';
set local lock_timeout = '5s';

do $phase_4a_m5a_preflight$
declare
  v_count bigint;
  v_fingerprint text;
begin
  if to_regprocedure(
    'public.resolve_media_asset_delivery(uuid,uuid,uuid,text)'
  ) is null then
    raise exception
      'STOP: Migration 4 Media resolver does not exist';
  end if;

  if to_regclass('media.assets') is null
     or to_regclass('media.asset_governance_versions') is null
     or to_regclass('media.legacy_asset_links') is null
     or to_regclass('media.usage_links') is null
     or to_regclass('public.registry_media_assets') is null
  then
    raise exception
      'STOP: Required Media compatibility authority is missing';
  end if;

  select count(*)
  into v_count
  from media.usage_links usage_row
  where usage_row.usage_state = 'active'
    and usage_row.resolution_mode = 'legacy_snapshot';

  if v_count <> 985 then
    raise exception
      'STOP: Expected 985 active legacy usages, found %',
      v_count;
  end if;

  if exists (
    select 1
    from media.usage_links usage_row
    where usage_row.usage_state = 'active'
      and (
        usage_row.resolution_mode <> 'legacy_snapshot'
        or usage_row.asset_revision_id is not null
      )
  ) then
    raise exception
      'STOP: Active usage resolution modes changed';
  end if;

  if exists (
    select 1
    from media.usage_links usage_row
    join media.assets asset_row
      on asset_row.id = usage_row.asset_id
    join media.asset_governance_versions governance_row
      on governance_row.id =
        asset_row.current_governance_version_id
    where usage_row.usage_state = 'active'
      and (
        asset_row.lifecycle_state <> 'active'
        or governance_row.version_number <> 1
        or governance_row.rights_status <> 'unknown'
        or governance_row.consent_status <> 'unknown'
        or governance_row.sensitivity <> 'none'
        or governance_row.embargo_state <> 'none'
        or governance_row.source_protection_class <> 'internal'
        or governance_row.preservation_state <> 'unassessed'
        or governance_row.retention_state <> 'retain'
        or governance_row.public_safety_state <> 'internal'
        or governance_row.internal_reason <>
          'Initial governance copied without inference from registry_media_assets'
      )
  ) then
    raise exception
      'STOP: Active legacy usage governance no longer matches the accepted baseline';
  end if;

  if exists (
    select 1
    from media.usage_links usage_row
    join media.legacy_asset_links bridge_row
      on bridge_row.asset_id = usage_row.asset_id
    join public.registry_media_assets compatibility_row
      on compatibility_row.id =
        bridge_row.legacy_asset_id
    where usage_row.usage_state = 'active'
      and (
        bridge_row.legacy_asset_id <>
          bridge_row.asset_id
        or compatibility_row.id <>
          usage_row.asset_id
        or compatibility_row.status <> 'active'
        or nullif(
          btrim(
            bridge_row.legacy_snapshot ->> 'url'
          ),
          ''
        ) is null
        or btrim(compatibility_row.url) is distinct from
          btrim(
            bridge_row.legacy_snapshot ->> 'url'
          )
      )
  ) then
    raise exception
      'STOP: Legacy URL parity is not ready for compatibility resolution';
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

  if v_fingerprint <>
     'f32e074f96b01549b5e597ad8b5f4324'
  then
    raise exception
      'STOP: Compatibility asset fingerprint changed: %',
      v_fingerprint;
  end if;

  select md5(
    coalesce(
      string_agg(
        concat_ws(
          '|',
          source_namespace.nspname,
          source_table.relname,
          constraint_row.conname,
          pg_get_constraintdef(
            constraint_row.oid,
            true
          )
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
    on source_table.oid =
      constraint_row.conrelid
  join pg_namespace source_namespace
    on source_namespace.oid =
      source_table.relnamespace
  join pg_class referenced_table
    on referenced_table.oid =
      constraint_row.confrelid
  join pg_namespace referenced_namespace
    on referenced_namespace.oid =
      referenced_table.relnamespace
  where constraint_row.contype = 'f'
    and source_namespace.nspname <> 'media'
    and referenced_namespace.nspname = 'public'
    and referenced_table.relname =
      'registry_media_assets';

  if v_fingerprint <>
     '54274ae6a613d38c257c543ccf7050cc'
  then
    raise exception
      'STOP: Compatibility foreign-key fingerprint changed: %',
      v_fingerprint;
  end if;
end;
$phase_4a_m5a_preflight$;

create or replace function public.resolve_media_asset_delivery(
  p_asset_id uuid,
  p_usage_link_id uuid default null,
  p_exact_asset_revision_id uuid default null,
  p_requested_variant_role text default null
)
returns table (
  logical_asset_id uuid,
  resolved_mode text,
  resolved_asset_revision_id uuid,
  resolved_file_object_id uuid,
  safe_delivery_url text,
  resolved_mime_type text,
  width integer,
  height integer,
  duration_seconds numeric,
  approved_alt_text text,
  approved_caption text,
  approved_credit text
)
language plpgsql
security definer
set search_path = pg_catalog, public, media
as $function$
declare
  v_usage media.usage_links%rowtype;
  v_asset_lifecycle text;
  v_current_revision_id uuid;
  v_governance_version_number bigint;
  v_rights_status text;
  v_consent_status text;
  v_sensitivity text;
  v_embargo_state text;
  v_embargo_until timestamptz;
  v_source_protection_class text;
  v_preservation_state text;
  v_retention_state text;
  v_public_safety_state text;
  v_internal_reason text;
  v_resolution_mode text;
  v_revision_id uuid;
  v_file_object_id uuid;
  v_delivery_url text;
  v_mime_type text;
  v_technical_metadata jsonb;
  v_legacy_snapshot jsonb;
  v_compatibility_status text;
  v_compatibility_url text;
  v_alt_text text;
  v_caption text;
  v_credit text;
  v_width integer;
  v_height integer;
  v_duration numeric;
  v_is_approved_public boolean;
  v_is_legacy_compatibility boolean;
begin
  if p_asset_id is null then
    raise exception
      'Media resolver requires a logical asset identity';
  end if;

  select
    asset_row.lifecycle_state,
    asset_row.current_revision_id,
    governance_row.version_number,
    governance_row.rights_status,
    governance_row.consent_status,
    governance_row.sensitivity,
    governance_row.embargo_state,
    governance_row.embargo_until,
    governance_row.source_protection_class,
    governance_row.preservation_state,
    governance_row.retention_state,
    governance_row.public_safety_state,
    governance_row.internal_reason
  into
    v_asset_lifecycle,
    v_current_revision_id,
    v_governance_version_number,
    v_rights_status,
    v_consent_status,
    v_sensitivity,
    v_embargo_state,
    v_embargo_until,
    v_source_protection_class,
    v_preservation_state,
    v_retention_state,
    v_public_safety_state,
    v_internal_reason
  from media.assets asset_row
  join media.asset_governance_versions governance_row
    on governance_row.id =
      asset_row.current_governance_version_id
  where asset_row.id = p_asset_id;

  if not found then
    raise exception
      'Media resolver asset does not exist or lacks current governance';
  end if;

  if p_usage_link_id is not null then
    select usage_row.*
    into v_usage
    from media.usage_links usage_row
    where usage_row.id = p_usage_link_id;

    if not found
       or v_usage.usage_state <> 'active'
    then
      raise exception
        'Active Media usage does not exist';
    end if;

    if v_usage.asset_id <> p_asset_id then
      raise exception
        'Media usage does not belong to the supplied asset';
    end if;

    if p_exact_asset_revision_id is not null
       and p_exact_asset_revision_id is distinct from
         v_usage.asset_revision_id
    then
      raise exception
        'Supplied Media revision does not match the usage';
    end if;

    v_resolution_mode := v_usage.resolution_mode;
    v_revision_id := v_usage.asset_revision_id;
    v_alt_text := v_usage.alt_text_snapshot;
    v_caption := v_usage.caption_snapshot;
    v_credit := v_usage.credit_snapshot;

    if v_resolution_mode = 'current_revision'
       and media.usage_role_requires_stability(
         v_usage.usage_role
       )
    then
      raise exception
        'Publication-stable Media usage cannot resolve through current revision';
    end if;

  elsif p_exact_asset_revision_id is not null then
    v_resolution_mode := 'exact_revision';
    v_revision_id := p_exact_asset_revision_id;

  else
    v_resolution_mode := 'current_revision';
    v_revision_id := v_current_revision_id;
  end if;

  v_is_approved_public := coalesce(
    v_asset_lifecycle = 'active'
    and v_public_safety_state in (
      'approved_public',
      'approved_redacted'
    )
    and v_rights_status in (
      'owned',
      'licensed',
      'public_domain',
      'fair_use'
    )
    and v_consent_status in (
      'granted',
      'not_required'
    )
    and v_source_protection_class in (
      'public',
      'public_redacted'
    )
    and v_retention_state in (
      'retain',
      'review_required'
    )
    and v_embargo_state <> 'active'
    and not (
      v_embargo_state = 'scheduled'
      and v_embargo_until is not null
      and v_embargo_until > now()
    ),
    false
  );

  v_is_legacy_compatibility := coalesce(
    v_asset_lifecycle = 'active'
    and v_governance_version_number = 1
    and v_rights_status = 'unknown'
    and v_consent_status = 'unknown'
    and v_sensitivity = 'none'
    and v_embargo_state = 'none'
    and v_embargo_until is null
    and v_source_protection_class = 'internal'
    and v_preservation_state = 'unassessed'
    and v_retention_state = 'retain'
    and v_public_safety_state = 'internal'
    and v_internal_reason =
      'Initial governance copied without inference from registry_media_assets',
    false
  );

  if v_resolution_mode = 'legacy_snapshot' then
    if p_usage_link_id is null then
      raise exception
        'Legacy-snapshot delivery requires a usage link';
    end if;

    if p_requested_variant_role is not null then
      raise exception
        'Legacy-snapshot delivery cannot resolve a variant';
    end if;

    if v_revision_id is not null then
      raise exception
        'Legacy-snapshot usage cannot bind a revision';
    end if;

    select
      bridge_row.legacy_snapshot,
      compatibility_row.status,
      compatibility_row.url
    into
      v_legacy_snapshot,
      v_compatibility_status,
      v_compatibility_url
    from media.legacy_asset_links bridge_row
    join public.registry_media_assets compatibility_row
      on compatibility_row.id =
        bridge_row.legacy_asset_id
    where bridge_row.asset_id = p_asset_id
      and bridge_row.legacy_asset_id =
        p_asset_id;

    if not found
       or nullif(
         btrim(v_legacy_snapshot ->> 'url'),
         ''
       ) is null
    then
      raise exception
        'Legacy-snapshot delivery requires one immutable captured URL';
    end if;

    if v_compatibility_status <> 'active' then
      raise exception
        'Legacy Media compatibility row is not active';
    end if;

    if btrim(v_compatibility_url) is distinct from
       btrim(v_legacy_snapshot ->> 'url')
    then
      raise exception
        'Legacy Media compatibility URL changed after capture';
    end if;

    if not (
      v_is_approved_public
      or v_is_legacy_compatibility
    ) then
      raise exception
        'Media delivery is blocked by current governance';
    end if;

    v_delivery_url :=
      btrim(v_legacy_snapshot ->> 'url');
    v_mime_type :=
      nullif(
        btrim(v_legacy_snapshot ->> 'mime_type'),
        ''
      );

    v_width :=
      case
        when coalesce(
          v_legacy_snapshot #>> '{metadata,width}',
          ''
        ) ~ '^[0-9]+$'
          then (
            v_legacy_snapshot #>>
              '{metadata,width}'
          )::integer
        else null
      end;

    v_height :=
      case
        when coalesce(
          v_legacy_snapshot #>> '{metadata,height}',
          ''
        ) ~ '^[0-9]+$'
          then (
            v_legacy_snapshot #>>
              '{metadata,height}'
          )::integer
        else null
      end;

    v_duration :=
      case
        when coalesce(
          v_legacy_snapshot #>> '{metadata,duration}',
          ''
        ) ~ '^[0-9]+([.][0-9]+)?$'
          then (
            v_legacy_snapshot #>>
              '{metadata,duration}'
          )::numeric
        else null
      end;

    return query
    select
      p_asset_id,
      v_resolution_mode,
      null::uuid,
      null::uuid,
      v_delivery_url,
      v_mime_type,
      v_width,
      v_height,
      v_duration,
      v_alt_text,
      v_caption,
      v_credit;

    return;
  end if;

  if not v_is_approved_public then
    raise exception
      'Media delivery is blocked by current governance';
  end if;

  if v_revision_id is null then
    raise exception
      'Media delivery has no valid asset revision';
  end if;

  if not exists (
    select 1
    from media.asset_revisions revision_row
    where revision_row.id = v_revision_id
      and revision_row.asset_id = p_asset_id
  ) then
    raise exception
      'Media delivery revision does not belong to the asset';
  end if;

  if p_requested_variant_role is null then
    select revision_row.original_file_object_id
    into v_file_object_id
    from media.asset_revisions revision_row
    where revision_row.id = v_revision_id;
  else
    select variant_row.derived_file_object_id
    into v_file_object_id
    from media.variant_selections selection_row
    join media.variants variant_row
      on variant_row.id = selection_row.variant_id
    where selection_row.asset_revision_id =
      v_revision_id
      and selection_row.variant_role =
        p_requested_variant_role
      and variant_row.asset_revision_id =
        v_revision_id
      and variant_row.variant_role =
        p_requested_variant_role;

    if not found then
      raise exception
        'Requested Media variant has no governed selection';
    end if;
  end if;

  select
    file_row.delivery_url,
    file_row.mime_type,
    file_row.technical_metadata
  into
    v_delivery_url,
    v_mime_type,
    v_technical_metadata
  from media.file_objects file_row
  where file_row.id = v_file_object_id
    and file_row.verification_state = 'verified';

  if not found
     or nullif(btrim(v_delivery_url), '') is null
  then
    raise exception
      'Media delivery requires one verified file object with a safe URL';
  end if;

  v_width :=
    case
      when jsonb_typeof(
        v_technical_metadata -> 'width'
      ) = 'number'
        then (
          v_technical_metadata ->> 'width'
        )::numeric::integer
      else null
    end;

  v_height :=
    case
      when jsonb_typeof(
        v_technical_metadata -> 'height'
      ) = 'number'
        then (
          v_technical_metadata ->> 'height'
        )::numeric::integer
      else null
    end;

  v_duration :=
    case
      when jsonb_typeof(
        v_technical_metadata -> 'duration'
      ) = 'number'
        then (
          v_technical_metadata ->> 'duration'
        )::numeric
      else null
    end;

  return query
  select
    p_asset_id,
    v_resolution_mode,
    v_revision_id,
    v_file_object_id,
    v_delivery_url,
    v_mime_type,
    v_width,
    v_height,
    v_duration,
    v_alt_text,
    v_caption,
    v_credit;
end;
$function$;

comment on function public.resolve_media_asset_delivery(
  uuid,
  uuid,
  uuid,
  text
) is
  'Phase 4A Media resolver with exact approved delivery and a narrow untouched-legacy compatibility lane.';

revoke all on function public.resolve_media_asset_delivery(
  uuid,
  uuid,
  uuid,
  text
)
from public, anon, authenticated;

grant execute on function public.resolve_media_asset_delivery(
  uuid,
  uuid,
  uuid,
  text
)
to anon, authenticated, service_role;

do $phase_4a_m5a_assertions$
declare
  v_count bigint;
  v_fingerprint text;
  v_definition text;
begin
  select pg_get_functiondef(
    'public.resolve_media_asset_delivery(uuid,uuid,uuid,text)'::regprocedure
  )
  into v_definition;

  if position(
    'Legacy Media compatibility URL changed after capture'
    in v_definition
  ) = 0
     or position(
       'Initial governance copied without inference from registry_media_assets'
       in v_definition
     ) = 0
  then
    raise exception
      'STOP: Legacy compatibility resolver contract is incomplete';
  end if;

  if not has_function_privilege(
    'anon',
    'public.resolve_media_asset_delivery(uuid,uuid,uuid,text)',
    'EXECUTE'
  )
     or not has_function_privilege(
       'authenticated',
       'public.resolve_media_asset_delivery(uuid,uuid,uuid,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.resolve_media_asset_delivery(uuid,uuid,uuid,text)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: Resolver grants are incomplete';
  end if;

  if (
    select count(*)
    from media.assets
  ) <> 1079
     or (
       select count(*)
       from media.legacy_asset_links
     ) <> 1079
     or (
       select count(*)
       from media.usage_links
     ) <> 987
     or (
       select count(*)
       from media.events
     ) <> 3147
     or (
       select count(*)
       from media.file_objects
     ) <> 0
     or (
       select count(*)
       from media.asset_revisions
     ) <> 0
     or (
       select count(*)
       from media.variants
     ) <> 0
     or (
       select count(*)
       from media.variant_selections
     ) <> 0
  then
    raise exception
      'STOP: Migration 5A changed canonical Media rows';
  end if;

  select count(*)
  into v_count
  from public.registry_media_assets;

  if v_count <> 1079 then
    raise exception
      'STOP: Compatibility row count changed: %',
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

  if v_fingerprint <>
     'f32e074f96b01549b5e597ad8b5f4324'
  then
    raise exception
      'STOP: Compatibility asset fingerprint changed: %',
      v_fingerprint;
  end if;
end;
$phase_4a_m5a_assertions$;

commit;
