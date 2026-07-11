-- PR13 production verification.

select count(*) as total_relationships
from public.registry_entity_relationships;

select endpoint_work_state, count(*) as row_count
from public.registry_relationship_endpoint_work_queue
group by endpoint_work_state
order by endpoint_work_state;

select evidence_work_state, count(*) as row_count
from public.registry_relationship_evidence_readiness_queue
group by evidence_work_state
order by evidence_work_state;

select
  count(*) filter (where source_entity_id is null or target_entity_id is null) as unresolved_relationships,
  count(*) filter (where source_entity_id is not null and target_entity_id is not null) as fully_resolved_relationships
from public.registry_entity_relationships
where relationship_status <> 'archived';

select
  p.prosecdef as security_definer,
  p.proconfig,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute
from pg_proc p
where p.oid = 'public.resolve_registry_relationship_endpoint_from_alias(uuid,text,text)'::regprocedure;
