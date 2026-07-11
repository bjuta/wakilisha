-- PR17 verification. This script performs no writes.

select
  p.prosecdef as security_definer,
  p.proconfig,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_execute
from pg_proc p
where p.oid = 'public.complete_registry_relationship_review(uuid,text,text,text,text,text,text,text,text,text,text,boolean)'::regprocedure;

select
  count(*) filter (where source_entity_id is not null and target_entity_id is not null) as resolved_relationships,
  count(*) filter (where review_status = 'approved') as approved_relationships,
  count(*) filter (where public_safe) as public_safe_relationships
from public.registry_entity_relationships
where relationship_status <> 'archived';

select count(*) as invalid_public_relationships
from public.registry_entity_relationships r
where r.public_safe
  and (
    r.review_status <> 'approved'
    or r.relationship_status <> 'active'
    or nullif(btrim(r.plain_reason), '') is null
    or not exists (
      select 1
      from public.registry_relationship_evidence link
      join public.evidence_items evidence on evidence.id = link.evidence_id
      where link.relationship_id = r.id
        and link.support_type = 'supports'
        and evidence.review_status = 'approved'
        and evidence.retrieval_status = 'default_retrieval'
    )
  );
