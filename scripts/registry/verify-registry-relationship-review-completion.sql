-- PR17 verification. Read-only.

select
  p.proname,
  p.prosecdef as security_definer,
  p.proconfig,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'get_registry_relationship_review_context',
    'complete_registry_relationship_review',
    'create_registry_relationship_review_evidence'
  )
order by p.proname;

select
  count(*) as relationships,
  count(*) filter (where review_status = 'approved') as approved,
  count(*) filter (where public_safe) as public_safe
from public.registry_entity_relationships
where relationship_status <> 'archived';

select
  count(*) as evidence_items,
  count(*) filter (where review_status = 'approved' and retrieval_status = 'default_retrieval') as public_ready_evidence
from public.evidence_items;

select count(*) as invalid_public_relationships
from public.registry_entity_relationships r
where r.public_safe
  and (
    r.relationship_status <> 'active'
    or r.review_status <> 'approved'
    or nullif(btrim(r.plain_reason), '') is null
    or not exists (
      select 1
      from public.registry_relationship_evidence re
      join public.evidence_items e on e.id = re.evidence_id
      where re.relationship_id = r.id
        and re.support_type = 'supports'
        and e.review_status = 'approved'
        and e.retrieval_status = 'default_retrieval'
    )
  );