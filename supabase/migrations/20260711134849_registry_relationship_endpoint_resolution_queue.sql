create or replace view public.registry_relationship_endpoint_resolution_queue
with (security_invoker = true)
as
select r.id relationship_id, 'source'::text endpoint_side,
       r.source_entity_type legacy_entity_type, r.source_slug legacy_slug,
       r.source_entity_id current_entity_id,
       case when r.source_entity_id is not null then 'resolved'
            when r.source_entity_type in ('chart_entries','media_assets') then 'provenance_only'
            when x.match_count = 0 then 'unresolved'
            when x.match_count = 1 then 'unique_candidate'
            else 'ambiguous' end resolution_state,
       x.match_count, x.candidate_entity_id, x.candidate_entity_type, x.candidate_slug
from public.registry_entity_relationships r
left join lateral (
  select count(*)::int match_count,
         min(i.entity_id::text)::uuid candidate_entity_id,
         min(i.entity_type) candidate_entity_type,
         min(i.slug) candidate_slug
  from public.registry_entity_index i
  where i.entity_type = r.source_entity_type and i.slug = r.source_slug
) x on true
union all
select r.id, 'target'::text,
       r.target_entity_type, r.target_slug,
       r.target_entity_id,
       case when r.target_entity_id is not null then 'resolved'
            when r.target_entity_type in ('chart_entries','media_assets') then 'provenance_only'
            when x.match_count = 0 then 'unresolved'
            when x.match_count = 1 then 'unique_candidate'
            else 'ambiguous' end,
       x.match_count, x.candidate_entity_id, x.candidate_entity_type, x.candidate_slug
from public.registry_entity_relationships r
left join lateral (
  select count(*)::int match_count,
         min(i.entity_id::text)::uuid candidate_entity_id,
         min(i.entity_type) candidate_entity_type,
         min(i.slug) candidate_slug
  from public.registry_entity_index i
  where i.entity_type = r.target_entity_type and i.slug = r.target_slug
) x on true;;
