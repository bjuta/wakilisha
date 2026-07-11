-- PR8 verification: canonical Registry relationship creation workflow.

select
  count(*) as relationship_count,
  count(*) filter (where source_entity_id is not null) as source_uuid_count,
  count(*) filter (where target_entity_id is not null) as target_uuid_count,
  count(*) filter (where source_entity_id is not null and target_entity_id is not null) as both_uuid_count,
  count(*) filter (where public_safe) as public_safe_count
from public.registry_entity_relationships;

select
  has_table_privilege('authenticated', 'public.registry_entity_relationships', 'select') as authenticated_can_select,
  has_table_privilege('authenticated', 'public.registry_entity_relationships', 'insert') as authenticated_can_insert,
  has_table_privilege('authenticated', 'public.registry_entity_relationships', 'update') as authenticated_can_update,
  has_table_privilege('authenticated', 'public.registry_entity_relationships', 'delete') as authenticated_can_delete;

select
  p.prosecdef as security_definer,
  has_function_privilege(
    'anon',
    'public.create_registry_entity_relationship(text,uuid,text,uuid,text,text,text,date,date,uuid,text,text,jsonb)',
    'execute'
  ) as anon_can_execute,
  has_function_privilege(
    'authenticated',
    'public.create_registry_entity_relationship(text,uuid,text,uuid,text,text,text,date,date,uuid,text,text,jsonb)',
    'execute'
  ) as authenticated_can_execute,
  has_function_privilege(
    'service_role',
    'public.create_registry_entity_relationship(text,uuid,text,uuid,text,text,text,date,date,uuid,text,text,jsonb)',
    'execute'
  ) as service_role_can_execute,
  p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'create_registry_entity_relationship';

select count(*) as invalid_new_relationships
from public.registry_entity_relationships r
where r.source_kind = 'registry_workflow'
  and (
    r.source_entity_id is null
    or r.target_entity_id is null
    or r.relationship_status <> 'draft'
    or r.review_status <> 'unreviewed'
    or r.public_safe
  );

select count(*) as orphan_relationship_evidence_links
from public.registry_relationship_evidence rre
left join public.registry_entity_relationships r on r.id = rre.relationship_id
left join public.evidence_items e on e.id = rre.evidence_id
where r.id is null or e.id is null;
