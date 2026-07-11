select
  c.relname as view_name,
  has_table_privilege('authenticated', c.oid, 'select') as authenticated_select,
  has_table_privilege('anon', c.oid, 'select') as anon_select,
  has_table_privilege('service_role', c.oid, 'select') as service_role_select
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'registry_missing_artist_intake_queue',
    'registry_relationship_endpoint_work_queue',
    'registry_relationship_evidence_readiness_queue',
    'registry_relationship_consolidation_queue'
  )
order by c.relname;
