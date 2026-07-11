-- PR5 verification: Registry relationship promotion rules.

select
  count(*) as relationship_rows,
  count(*) filter (where review_status = 'unreviewed') as unreviewed_rows,
  count(*) filter (where public_safe) as public_safe_rows
from public.registry_entity_relationships;

select count(*) as relationship_evidence_links
from public.registry_relationship_evidence;

select
  count(*) filter (
    where review_status = 'approved'
      and not exists (
        select 1
        from public.registry_relationship_evidence rre
        join public.evidence_items e on e.id = rre.evidence_id
        where rre.relationship_id = rer.id
          and rre.support_type = 'supports'
          and e.review_status in ('reviewed', 'approved')
      )
  ) as approved_without_reviewed_support,
  count(*) filter (
    where public_safe
      and not exists (
        select 1
        from public.registry_relationship_evidence rre
        join public.evidence_items e on e.id = rre.evidence_id
        where rre.relationship_id = rer.id
          and rre.support_type = 'supports'
          and e.review_status = 'approved'
          and e.retrieval_status = 'default_retrieval'
      )
  ) as public_safe_without_approved_support
from public.registry_entity_relationships rer;

select
  p.prosecdef as security_definer,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute,
  p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'review_registry_relationship';

select
  tgname,
  tgenabled
from pg_trigger
where tgrelid = 'public.registry_entity_relationships'::regclass
  and tgname = 'trg_registry_relationship_promotion_rules';
