-- PR3 verification: Registry evidence foundation
-- Read-only checks to run after applying the migration.

select count(*) as registry_relationship_evidence_rows
from public.registry_relationship_evidence;

select count(*) as evidence_items_rows
from public.evidence_items;

select count(*) as legacy_relationship_evidence_rows
from public.relationship_evidence;

select
  count(*) filter (where support_type = 'supports') as supports_rows,
  count(*) filter (where support_type = 'challenges') as challenges_rows,
  count(*) filter (where support_type = 'contextualizes') as contextualizes_rows
from public.registry_relationship_evidence;

select
  conname,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.registry_relationship_evidence'::regclass
order by conname;

select
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'registry_relationship_evidence'
order by indexname;

select
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'registry_relationship_evidence'
order by policyname;

select
  has_table_privilege('authenticated', 'public.registry_relationship_evidence', 'SELECT') as authenticated_can_select,
  has_table_privilege('authenticated', 'public.registry_relationship_evidence', 'INSERT') as authenticated_can_insert,
  has_table_privilege('authenticated', 'public.registry_relationship_evidence', 'DELETE') as authenticated_can_delete,
  has_table_privilege('authenticated', 'public.registry_relationship_evidence', 'UPDATE') as authenticated_can_update;

select count(*) as orphaned_relationship_links
from public.registry_relationship_evidence rre
left join public.registry_entity_relationships rer
  on rer.id = rre.relationship_id
where rer.id is null;

select count(*) as orphaned_evidence_links
from public.registry_relationship_evidence rre
left join public.evidence_items e
  on e.id = rre.evidence_id
where e.id is null;
