-- PR10: Separate operational provenance from canonical cultural relationships.
-- Preserves legacy chart artwork links before removing them from the cultural graph.

create table if not exists public.registry_provenance_links (
  id uuid primary key default gen_random_uuid(),
  original_relationship_id uuid not null unique,
  source_entity_type text not null,
  source_slug text not null,
  source_kind text,
  source_entity text,
  source_record_id text,
  source_staging_record_id uuid,
  target_entity_type text not null,
  target_slug text not null,
  target_media_asset_id uuid references public.registry_media_assets(id) on delete set null,
  relationship_type text not null,
  relationship_role text,
  relationship_status text not null,
  metadata jsonb not null default '{}'::jsonb,
  original_created_at timestamptz not null,
  original_updated_at timestamptz not null,
  archived_at timestamptz not null default now()
);

create index if not exists registry_provenance_links_source_idx
  on public.registry_provenance_links (source_entity_type, source_record_id);

create index if not exists registry_provenance_links_target_media_idx
  on public.registry_provenance_links (target_media_asset_id)
  where target_media_asset_id is not null;

alter table public.registry_provenance_links enable row level security;

revoke all on table public.registry_provenance_links from public, anon, authenticated;
grant select on table public.registry_provenance_links to authenticated;
grant all on table public.registry_provenance_links to service_role;

drop policy if exists registry_provenance_links_registry_read
  on public.registry_provenance_links;

create policy registry_provenance_links_registry_read
  on public.registry_provenance_links
  for select
  to authenticated
  using (
    public.current_user_has_capability('manage_registry')
    or public.current_user_has_capability('view_registry')
    or public.current_user_is_administrator()
  );

insert into public.registry_provenance_links (
  original_relationship_id,
  source_entity_type,
  source_slug,
  source_kind,
  source_entity,
  source_record_id,
  source_staging_record_id,
  target_entity_type,
  target_slug,
  target_media_asset_id,
  relationship_type,
  relationship_role,
  relationship_status,
  metadata,
  original_created_at,
  original_updated_at
)
select
  r.id,
  r.source_entity_type,
  r.source_slug,
  r.source_kind,
  r.source_entity,
  r.source_record_id,
  r.source_staging_record_id,
  r.target_entity_type,
  r.target_slug,
  ma.id,
  r.relationship_type,
  r.relationship_role,
  r.relationship_status,
  r.metadata,
  r.created_at,
  r.updated_at
from public.registry_entity_relationships r
join public.registry_media_assets ma
  on ma.slug = r.target_slug
where r.source_entity_type = 'chart_entries'
  and r.target_entity_type = 'media_assets'
  and r.relationship_type = 'entity_media'
  and r.relationship_role = 'artwork'
on conflict (original_relationship_id) do nothing;

do $$
declare
  v_relationship_count bigint;
  v_provenance_count bigint;
begin
  select count(*) into v_relationship_count
  from public.registry_entity_relationships
  where source_entity_type = 'chart_entries'
    and target_entity_type = 'media_assets'
    and relationship_type = 'entity_media'
    and relationship_role = 'artwork';

  select count(*) into v_provenance_count
  from public.registry_provenance_links p
  where exists (
    select 1
    from public.registry_entity_relationships r
    where r.id = p.original_relationship_id
      and r.source_entity_type = 'chart_entries'
      and r.target_entity_type = 'media_assets'
      and r.relationship_type = 'entity_media'
      and r.relationship_role = 'artwork'
  );

  if v_relationship_count <> v_provenance_count then
    raise exception 'Provenance copy verification failed: % source rows, % copied rows.',
      v_relationship_count, v_provenance_count;
  end if;
end;
$$;

delete from public.registry_entity_relationships r
where r.source_entity_type = 'chart_entries'
  and r.target_entity_type = 'media_assets'
  and r.relationship_type = 'entity_media'
  and r.relationship_role = 'artwork'
  and exists (
    select 1
    from public.registry_provenance_links p
    where p.original_relationship_id = r.id
  );

comment on table public.registry_provenance_links is
  'Internal provenance records separated from canonical cultural relationships. Preserves legacy source-to-media history without presenting it as a cultural claim.';