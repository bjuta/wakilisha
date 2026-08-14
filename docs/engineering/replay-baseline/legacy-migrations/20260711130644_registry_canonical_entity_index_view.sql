create or replace view public.registry_entity_index
with (security_invoker = true)
as
select a.id as entity_id, 'artist'::text as entity_type, a.display_name as name, a.slug, a.bio as description, a.status, 'registry_artists'::text as canonical_source_table, a.id as canonical_source_id, (a.status = 'active') as public_safe, 'authoritative'::text as review_status
from public.registry_artists a
union all
select t.id, 'track'::text, t.title, t.slug, null::text, t.status, 'registry_tracks'::text, t.id, (t.status = 'active'), 'authoritative'::text
from public.registry_tracks t
union all
select r.id, 'release'::text, r.title, r.slug, r.description, r.status, 'registry_releases'::text, r.id, (r.status = 'active'), 'authoritative'::text
from public.registry_releases r
union all
select l.id, 'label'::text, l.name, l.slug, l.description, l.status, 'registry_labels'::text, l.id, (l.status = 'active'), 'authoritative'::text
from public.registry_labels l
union all
select g.id, 'genre'::text, g.name, g.slug, g.description, g.status, 'registry_genres'::text, g.id, (g.status = 'active'), 'authoritative'::text
from public.registry_genres g
union all
select c.id, c.entity_type, c.name, c.slug, c.description, c.status, coalesce(c.canonical_source_table, 'cultural_entities'::text), coalesce(c.canonical_source_id, c.id), c.public_safe, c.review_status
from public.cultural_entities c
where c.status <> 'merged';

comment on view public.registry_entity_index is
  'Canonical read index across music Registry entities and broader reviewed cultural entities. Source tables remain authoritative.';;
