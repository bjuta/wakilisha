create or replace view public.registry_relationship_consolidation_queue
with (security_invoker = true)
as
select
  r.id as relationship_id,
  r.source_entity_type,
  r.source_entity_id,
  r.source_slug,
  r.target_entity_type,
  r.target_entity_id,
  r.target_slug,
  r.relationship_type,
  r.relationship_role,
  r.relationship_status,
  r.review_status,
  r.public_safe,
  r.plain_reason,
  count(re.evidence_id)::integer as evidence_count,
  case
    when r.source_entity_id is null or r.target_entity_id is null then 'resolve_endpoints'
    when count(re.evidence_id) = 0 then 'attach_evidence'
    when nullif(btrim(r.plain_reason), '') is null then 'add_plain_reason'
    when r.review_status in ('unreviewed','pending_review','disputed') then 'review_required'
    when r.review_status = 'approved' and r.public_safe = false then 'publication_review'
    else 'ready'
  end as consolidation_state,
  case
    when r.relationship_type in ('features','featured_on','collaboration','popular_track') then true
    else false
  end as vocabulary_supported,
  exists (
    select 1
    from public.registry_entity_relationships d
    where d.id <> r.id
      and d.source_entity_type = r.source_entity_type
      and d.target_entity_type = r.target_entity_type
      and d.source_entity_id is not distinct from r.source_entity_id
      and d.target_entity_id is not distinct from r.target_entity_id
      and d.relationship_type = r.relationship_type
      and d.relationship_role is not distinct from r.relationship_role
      and d.relationship_status <> 'archived'
  ) as duplicate_candidate
from public.registry_entity_relationships r
left join public.registry_relationship_evidence re
  on re.relationship_id = r.id
group by r.id;

comment on view public.registry_relationship_consolidation_queue is
  'Read-only audit queue for endpoint, evidence, reason, duplicate, vocabulary, review, and publication readiness of canonical Registry relationships.';;
