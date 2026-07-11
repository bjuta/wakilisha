-- Verify PR11 Registry relationship consolidation queue and workflow.

select count(*)::integer as relationship_count
from public.registry_entity_relationships;

select consolidation_state, count(*)::integer as row_count
from public.registry_relationship_consolidation_queue
group by consolidation_state
order by consolidation_state;

select
  count(*) filter (where duplicate_candidate)::integer as duplicate_candidates,
  count(*) filter (where not vocabulary_supported)::integer as unsupported_vocabulary,
  count(*) filter (where source_entity_id is null or target_entity_id is null)::integer as unresolved_endpoint_rows,
  count(*) filter (where evidence_count = 0)::integer as rows_without_evidence,
  count(*) filter (where nullif(btrim(plain_reason), '') is null)::integer as rows_without_reason
from public.registry_relationship_consolidation_queue;

select
  p.prosecdef as security_definer,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute,
  p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'normalize_registry_relationship_vocabulary';

select reloptions
from pg_class
where oid = 'public.registry_relationship_consolidation_queue'::regclass;