-- Verify PR7: controlled broader cultural entity workflows.

select
  count(*) as cultural_entity_count,
  count(*) filter (where entity_type in ('artist','track','release','label','genre')) as legacy_music_smoke_rows,
  count(*) filter (where public_safe and (review_status <> 'approved' or status <> 'active' or reviewed_at is null or nullif(btrim(description), '') is null)) as invalid_public_safe_rows
from public.cultural_entities;

select
  p.proname,
  p.prosecdef as security_definer,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute,
  p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('create_registry_cultural_entity','review_registry_cultural_entity')
order by p.proname;

select
  has_table_privilege('authenticated', 'public.cultural_entities', 'SELECT') as authenticated_can_select,
  has_table_privilege('authenticated', 'public.cultural_entities', 'INSERT') as authenticated_can_insert_directly,
  has_table_privilege('authenticated', 'public.cultural_entities', 'UPDATE') as authenticated_can_update_directly,
  has_table_privilege('authenticated', 'public.cultural_entities', 'DELETE') as authenticated_can_delete_directly;

select
  count(*) filter (where subject_type = 'cultural_entity') as cultural_entity_review_decisions
from public.review_decisions;