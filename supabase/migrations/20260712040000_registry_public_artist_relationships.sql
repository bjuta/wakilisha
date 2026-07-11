-- PR16B: Narrow public contract for reviewed artist relationships.

create or replace view public.registry_public_artist_relationships
with (security_invoker = true)
as
with publishable as (
  select
    r.id as relationship_id,
    r.source_entity_id,
    r.target_entity_id,
    r.source_entity_type,
    r.target_entity_type,
    r.relationship_type,
    r.relationship_role,
    r.plain_reason,
    r.valid_from,
    r.valid_to,
    r.reviewed_at,
    (select count(*)::integer from public.registry_relationship_evidence e where e.relationship_id = r.id) as evidence_count
  from public.registry_entity_relationships r
  where r.relationship_status = 'active'
    and r.review_status = 'approved'
    and r.public_safe = true
    and nullif(btrim(r.plain_reason), '') is not null
    and r.source_entity_id is not null
    and r.target_entity_id is not null
    and exists (
      select 1
      from public.registry_relationship_evidence e
      where e.relationship_id = r.id
    )
), expanded as (
  select
    p.relationship_id,
    p.source_entity_id as artist_id,
    'outgoing'::text as direction,
    p.target_entity_id as related_entity_id,
    p.target_entity_type as related_entity_type,
    p.relationship_type,
    p.relationship_role,
    p.plain_reason,
    p.evidence_count,
    p.valid_from,
    p.valid_to,
    p.reviewed_at
  from publishable p
  where p.source_entity_type = 'artist'
  union all
  select
    p.relationship_id,
    p.target_entity_id as artist_id,
    'incoming'::text as direction,
    p.source_entity_id as related_entity_id,
    p.source_entity_type as related_entity_type,
    p.relationship_type,
    p.relationship_role,
    p.plain_reason,
    p.evidence_count,
    p.valid_from,
    p.valid_to,
    p.reviewed_at
  from publishable p
  where p.target_entity_type = 'artist'
)
select
  x.relationship_id,
  x.artist_id,
  x.direction,
  x.related_entity_id,
  x.related_entity_type,
  coalesce(a.display_name, t.title) as related_entity_name,
  coalesce(a.slug, t.slug) as related_entity_slug,
  coalesce(a.public_image_url, t.artwork_url) as related_entity_image_url,
  case when x.related_entity_type = 'artist' then '/artists/' || a.slug else null end as related_entity_url,
  x.relationship_type,
  x.relationship_role,
  x.plain_reason,
  x.evidence_count,
  x.valid_from,
  x.valid_to,
  x.reviewed_at
from expanded x
left join public.registry_artists a
  on x.related_entity_type = 'artist'
 and a.id = x.related_entity_id
 and a.status = 'active'
left join public.registry_tracks t
  on x.related_entity_type = 'track'
 and t.id = x.related_entity_id
 and t.status = 'active'
where coalesce(a.id, t.id) is not null;

revoke all on public.registry_public_artist_relationships from public, anon, authenticated;
grant select on public.registry_public_artist_relationships to anon, authenticated, service_role;

comment on view public.registry_public_artist_relationships is
  'Public artist relationship contract. Exposes only active, approved, public-safe, explained, evidence-backed relationships.';
