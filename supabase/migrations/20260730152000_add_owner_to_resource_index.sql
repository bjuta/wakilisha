create or replace view public.wk_resource_index
with (
  security_invoker = true,
  security_barrier = true
)
as
select
  resources.id as resource_id,
  resources.resource_kind,
  article_resources.article_id
    as canonical_record_id,
  canonical_alias.path
    as canonical_path,
  resources.visibility,
  resources.lifecycle_state,
  resources.created_at,
  resources.updated_at,
  resources.owner_id
from editorial.resources
join editorial.article_resources
  on article_resources.resource_id = resources.id
left join editorial.resource_aliases as canonical_alias
  on canonical_alias.resource_id = resources.id
 and canonical_alias.is_canonical
 and canonical_alias.retired_at is null

union all

select
  resources.id as resource_id,
  resources.resource_kind,
  playlist_resources.playlist_id
    as canonical_record_id,
  canonical_alias.path
    as canonical_path,
  resources.visibility,
  resources.lifecycle_state,
  resources.created_at,
  resources.updated_at,
  resources.owner_id
from editorial.resources
join editorial.playlist_resources
  on playlist_resources.resource_id = resources.id
left join editorial.resource_aliases as canonical_alias
  on canonical_alias.resource_id = resources.id
 and canonical_alias.is_canonical
 and canonical_alias.retired_at is null

union all

select
  resources.id as resource_id,
  resources.resource_kind,
  registry_artist_resources.artist_id
    as canonical_record_id,
  canonical_alias.path
    as canonical_path,
  resources.visibility,
  resources.lifecycle_state,
  resources.created_at,
  resources.updated_at,
  resources.owner_id
from editorial.resources
join editorial.registry_artist_resources
  on registry_artist_resources.resource_id = resources.id
left join editorial.resource_aliases as canonical_alias
  on canonical_alias.resource_id = resources.id
 and canonical_alias.is_canonical
 and canonical_alias.retired_at is null;

comment on view public.wk_resource_index is
  'Narrow stable resource reference index including canonical account ownership. Canonical domain tables remain authoritative.';

revoke all
  on public.wk_resource_index
  from public, anon, authenticated;

grant select
  on public.wk_resource_index
  to anon, authenticated, service_role;
