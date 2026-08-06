with function_authority as (
  select
    procedure_row.oid,
    procedure_row.prosecdef as security_definer,
    pg_get_function_result(
      procedure_row.oid
    ) as result_contract,
    pg_get_functiondef(
      procedure_row.oid
    ) as function_definition
  from pg_proc procedure_row
  join pg_namespace namespace
    on namespace.oid = procedure_row.pronamespace
  where namespace.nspname = 'public'
    and procedure_row.proname =
      'read_media_assets_admin_v2'
    and pg_get_function_identity_arguments(
      procedure_row.oid
    ) = 'p_query jsonb'
),
authority_state as (
  select
    count(*) as function_count,
    count(*) filter (
      where security_definer
    ) as security_definer_count,
    count(*) filter (
      where result_contract = 'jsonb'
    ) as jsonb_result_count,
    count(*) filter (
      where function_definition like
        '%media.require_media_read_actor()%'
    ) as read_authority_count,
    count(*) filter (
      where function_definition like
        '%public.registry_media_assets%'
    ) as compatibility_read_count,
    count(*) filter (
      where function_definition like
        '%media.legacy_asset_links%'
    ) as canonical_bridge_count
  from function_authority
),
catalog_state as (
  select
    (
      select count(*)
      from public.registry_media_assets
    ) as compatibility_rows,
    (
      select count(*)
      from media.assets
    ) as canonical_assets,
    (
      select count(*)
      from media.usage_links
    ) as usage_links,
    (
      select count(*)
      from media.file_objects
    ) as file_objects,
    (
      select count(*)
      from media.asset_revisions
    ) as asset_revisions,
    (
      select count(*)
      from media.variants
    ) as variants,
    (
      select count(*)
      from media.variant_selections
    ) as variant_selections,
    (
      select count(*)
      from information_schema.role_table_grants grant_row
      where grant_row.table_schema = 'public'
        and grant_row.table_name =
          'registry_media_assets'
    ) as direct_grant_count,
    (
      select count(*)
      from pg_policies policy_row
      where policy_row.schemaname = 'public'
        and policy_row.tablename =
          'registry_media_assets'
    ) as policy_count
)
select
  'PHASE_4A_MEDIA_ADMIN_READ_ADAPTER' as audit_section,
  case
    when authority_state.function_count = 1
      and authority_state.security_definer_count = 1
      and authority_state.jsonb_result_count = 1
      and authority_state.read_authority_count = 1
      and authority_state.compatibility_read_count = 1
      and authority_state.canonical_bridge_count = 1
      and not has_function_privilege(
        'anon',
        'public.read_media_assets_admin_v2(jsonb)',
        'execute'
      )
      and has_function_privilege(
        'authenticated',
        'public.read_media_assets_admin_v2(jsonb)',
        'execute'
      )
      and has_function_privilege(
        'service_role',
        'public.read_media_assets_admin_v2(jsonb)',
        'execute'
      )
      and catalog_state.compatibility_rows = 1079
      and catalog_state.canonical_assets = 1079
      and catalog_state.usage_links = 987
      and catalog_state.file_objects = 0
      and catalog_state.asset_revisions = 0
      and catalog_state.variants = 0
      and catalog_state.variant_selections = 0
      and catalog_state.direct_grant_count = 25
      and catalog_state.policy_count = 5
    then 'PASS'
    else 'FAIL'
  end as verification,
  md5(
    (
      select function_definition
      from function_authority
      limit 1
    )
  ) as function_fingerprint,
  catalog_state.*
from authority_state
cross join catalog_state;
