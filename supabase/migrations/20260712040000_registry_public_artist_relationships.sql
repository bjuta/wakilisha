-- PR16B: Narrow public contract for reviewed artist relationships.

create or replace function public.get_public_artist_relationships(p_artist_id uuid)
returns table (
  relationship_id uuid,
  direction text,
  related_entity_id uuid,
  related_entity_type text,
  related_entity_name text,
  related_entity_slug text,
  related_entity_image_url text,
  related_entity_url text,
  relationship_type text,
  relationship_role text,
  plain_reason text,
  evidence_count integer,
  reviewed_at timestamptz
)
language sql
stable
security definer
set search_path = public, auth
as $$
  with publishable as (
    select
      r.id,
      r.source_entity_id,
      r.target_entity_id,
      r.source_entity_type,
      r.target_entity_type,
      r.relationship_type,
      r.relationship_role,
      r.plain_reason,
      r.reviewed_at,
      (select count(*)::integer from public.registry_relationship_evidence e where e.relationship_id = r.id) as evidence_count
    from public.registry_entity_relationships r
    where p_artist_id is not null
      and exists (
        select 1
        from public.registry_artists current_artist
        where current_artist.id = p_artist_id
          and current_artist.status = 'active'
      )
      and r.relationship_status = 'active'
      and r.review_status = 'approved'
      and r.public_safe = true
      and nullif(btrim(r.plain_reason), '') is not null
      and r.source_entity_id is not null
      and r.target_entity_id is not null
      and (r.source_entity_id = p_artist_id or r.target_entity_id = p_artist_id)
      and exists (
        select 1
        from public.registry_relationship_evidence e
        where e.relationship_id = r.id
      )
  ), expanded as (
    select
      p.id as relationship_id,
      'outgoing'::text as direction,
      p.target_entity_id as related_entity_id,
      p.target_entity_type as related_entity_type,
      p.relationship_type,
      p.relationship_role,
      p.plain_reason,
      p.evidence_count,
      p.reviewed_at
    from publishable p
    where p.source_entity_type = 'artist'
      and p.source_entity_id = p_artist_id
    union all
    select
      p.id as relationship_id,
      'incoming'::text as direction,
      p.source_entity_id as related_entity_id,
      p.source_entity_type as related_entity_type,
      p.relationship_type,
      p.relationship_role,
      p.plain_reason,
      p.evidence_count,
      p.reviewed_at
    from publishable p
    where p.target_entity_type = 'artist'
      and p.target_entity_id = p_artist_id
  )
  select
    x.relationship_id,
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
  where coalesce(a.id, t.id) is not null
  order by x.reviewed_at desc nulls last, x.relationship_id;
$$;

revoke all on function public.get_public_artist_relationships(uuid) from public;
grant execute on function public.get_public_artist_relationships(uuid) to anon, authenticated, service_role;

comment on function public.get_public_artist_relationships(uuid) is
  'Returns only active, approved, public-safe, explained, evidence-backed relationships for one active Registry artist page.';
