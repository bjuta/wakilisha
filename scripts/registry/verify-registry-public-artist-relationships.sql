-- PR16B verification. Run after applying the migration.

select
  p.prosecdef as security_definer,
  p.proconfig,
  has_function_privilege('anon', 'public.get_public_artist_relationships(uuid)', 'execute') as anon_execute,
  has_function_privilege('authenticated', 'public.get_public_artist_relationships(uuid)', 'execute') as authenticated_execute,
  has_function_privilege('service_role', 'public.get_public_artist_relationships(uuid)', 'execute') as service_role_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'get_public_artist_relationships';

select count(*) as current_public_relationship_rows
from public.registry_entity_relationships r
where r.relationship_status = 'active'
  and r.review_status = 'approved'
  and r.public_safe = true
  and nullif(btrim(r.plain_reason), '') is not null
  and exists (
    select 1
    from public.registry_relationship_evidence e
    where e.relationship_id = r.id
  );

-- The public function must never return rows that fail any publication gate.
with returned as (
  select result.*
  from public.registry_artists a
  cross join lateral public.get_public_artist_relationships(a.id) result
  where a.status = 'active'
)
select count(*) as invalid_returned_rows
from returned x
join public.registry_entity_relationships r on r.id = x.relationship_id
where r.relationship_status <> 'active'
   or r.review_status <> 'approved'
   or r.public_safe is distinct from true
   or nullif(btrim(r.plain_reason), '') is null
   or not exists (
     select 1
     from public.registry_relationship_evidence e
     where e.relationship_id = r.id
   );
