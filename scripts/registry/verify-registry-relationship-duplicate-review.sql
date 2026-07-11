-- PR12 production verification.

select count(*) as total_relationships
from public.registry_entity_relationships;

select count(*) filter (where duplicate_candidate) as duplicate_candidates,
       count(*) filter (where duplicate_group_size > 1) as duplicate_rows,
       max(duplicate_group_size) as max_duplicate_group_size
from public.registry_relationship_consolidation_queue;

select count(*) as false_positive_null_key_rows
from public.registry_relationship_consolidation_queue q
where q.duplicate_candidate
  and (q.source_entity_id is null or q.target_entity_id is null)
  and not exists (
    select 1
    from public.registry_relationship_consolidation_queue d
    where d.relationship_id <> q.relationship_id
      and d.source_entity_type = q.source_entity_type
      and d.source_comparison_key = q.source_comparison_key
      and d.target_entity_type = q.target_entity_type
      and d.target_comparison_key = q.target_comparison_key
      and d.relationship_type = q.relationship_type
      and d.relationship_role is not distinct from q.relationship_role
  );

select p.prosecdef as security_definer,
       p.proconfig,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute
from pg_proc p
where p.oid = 'public.merge_registry_relationship_duplicate(uuid,uuid,text)'::regprocedure;

select count(*) as invalid_superseded_relationships
from public.registry_entity_relationships
where review_status = 'superseded'
  and (superseded_by_relationship_id is null or relationship_status <> 'archived');
