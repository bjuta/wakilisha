-- PR10 production verification.

select count(*)::bigint as canonical_relationship_count
from public.registry_entity_relationships;

select count(*)::bigint as provenance_link_count
from public.registry_provenance_links;

select count(*)::bigint as remaining_chart_media_relationships
from public.registry_entity_relationships
where source_entity_type = 'chart_entries'
  and target_entity_type = 'media_assets'
  and relationship_type = 'entity_media'
  and relationship_role = 'artwork';

select
  count(*)::bigint as provenance_rows,
  count(*) filter (where target_media_asset_id is not null)::bigint as resolved_media_assets,
  count(distinct original_relationship_id)::bigint as distinct_original_relationships,
  count(*) filter (where source_record_id is null)::bigint as missing_source_record_ids
from public.registry_provenance_links;

select
  has_table_privilege('anon', 'public.registry_provenance_links', 'select') as anon_can_select,
  has_table_privilege('authenticated', 'public.registry_provenance_links', 'select') as authenticated_can_select,
  has_table_privilege('authenticated', 'public.registry_provenance_links', 'insert') as authenticated_can_insert,
  has_table_privilege('authenticated', 'public.registry_provenance_links', 'update') as authenticated_can_update,
  has_table_privilege('authenticated', 'public.registry_provenance_links', 'delete') as authenticated_can_delete,
  has_table_privilege('service_role', 'public.registry_provenance_links', 'select') as service_role_can_select;

select endpoint_side, resolution_state, count(*)::bigint as row_count
from public.registry_relationship_endpoint_resolution_queue
group by endpoint_side, resolution_state
order by endpoint_side, resolution_state;