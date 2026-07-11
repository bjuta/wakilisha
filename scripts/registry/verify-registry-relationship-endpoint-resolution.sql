-- PR9 verification: controlled canonical endpoint resolution.

select
  count(*) as total_relationships,
  count(*) filter (where source_entity_id is not null) as source_uuid_count,
  count(*) filter (where target_entity_id is not null) as target_uuid_count,
  count(*) filter (where source_entity_id is not null and target_entity_id is not null) as both_uuid_count
from public.registry_entity_relationships;

select endpoint_side, resolution_state, count(*) as row_count
from public.registry_relationship_endpoint_resolution_queue
group by endpoint_side, resolution_state
order by endpoint_side, resolution_state;

select
  p.prosecdef as security_definer,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute,
  p.proconfig
from pg_proc p
where p.oid = 'public.resolve_registry_relationship_endpoint(uuid,text,text,uuid,text)'::regprocedure;

select reloptions
from pg_class
where oid = 'public.registry_relationship_endpoint_resolution_queue'::regclass;

select count(*) as invalid_resolved_sources
from public.registry_entity_relationships r
where r.source_entity_id is not null
  and not exists (
    select 1 from public.registry_entity_index i
    where i.entity_id = r.source_entity_id
      and i.entity_type = r.source_entity_type
  );

select count(*) as invalid_resolved_targets
from public.registry_entity_relationships r
where r.target_entity_id is not null
  and not exists (
    select 1 from public.registry_entity_index i
    where i.entity_id = r.target_entity_id
      and i.entity_type = r.target_entity_type
  );
