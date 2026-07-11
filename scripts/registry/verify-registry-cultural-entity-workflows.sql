-- PR7 verification: controlled cultural entity creation and review workflows.

select
  (select count(*) from public.cultural_entities) as cultural_entities,
  (select count(*) from public.cultural_entities where entity_type in ('artist','track','release','label','genre')) as music_entity_rows,
  (select count(*) from public.cultural_entities where public_safe and (review_status <> 'approved' or status <> 'active' or nullif(btrim(description), '') is null)) as invalid_public_safe_rows;

select
  has_table_privilege('authenticated', 'public.cultural_entities', 'SELECT') as authenticated_can_select,
  has_table_privilege('authenticated', 'public.cultural_entities', 'INSERT') as authenticated_can_insert,
  has_table_privilege('authenticated', 'public.cultural_entities', 'UPDATE') as authenticated_can_update,
  has_table_privilege('authenticated', 'public.cultural_entities', 'DELETE') as authenticated_can_delete;

select
  has_function_privilege('anon', 'public.create_registry_cultural_entity(text,text,text,text,text,text,text,uuid,jsonb)', 'EXECUTE') as anon_create,
  has_function_privilege('authenticated', 'public.create_registry_cultural_entity(text,text,text,text,text,text,text,uuid,jsonb)', 'EXECUTE') as authenticated_create,
  has_function_privilege('service_role', 'public.create_registry_cultural_entity(text,text,text,text,text,text,text,uuid,jsonb)', 'EXECUTE') as service_role_create,
  has_function_privilege('anon', 'public.review_registry_cultural_entity(uuid,text,text,boolean,text)', 'EXECUTE') as anon_review,
  has_function_privilege('authenticated', 'public.review_registry_cultural_entity(uuid,text,text,boolean,text)', 'EXECUTE') as authenticated_review,
  has_function_privilege('service_role', 'public.review_registry_cultural_entity(uuid,text,text,boolean,text)', 'EXECUTE') as service_role_review;

select
  count(*) filter (where policyname = 'cultural_entities_admin_select') as select_policies,
  count(*) filter (where cmd = 'INSERT') as insert_policies,
  count(*) filter (where cmd = 'UPDATE') as update_policies
from pg_policies
where schemaname = 'public' and tablename = 'cultural_entities';

select
  count(*) as cultural_entity_subject_constraint
from information_schema.check_constraints
where constraint_name = 'review_decisions_subject_type_check'
  and check_clause like '%cultural_entity%';