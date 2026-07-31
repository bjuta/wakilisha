begin;

do $preflight$
declare
  dependent_object_count integer;
begin
  if to_regclass(
    'public.wk_resource_index'
  ) is null then
    raise exception
      'STOP: public.wk_resource_index does not exist';
  end if;

  if to_regclass(
    'editorial.resources'
  ) is null then
    raise exception
      'STOP: editorial.resources does not exist';
  end if;

  select count(*)
  into dependent_object_count
  from pg_depend dependency
  join pg_rewrite rewrite_rule
    on rewrite_rule.oid = dependency.objid
  join pg_class dependent_relation
    on dependent_relation.oid =
      rewrite_rule.ev_class
  where dependency.refobjid =
      'public.wk_resource_index'::regclass
    and dependent_relation.oid <>
      'public.wk_resource_index'::regclass;

  if dependent_object_count <> 0 then
    raise exception
      'STOP: public.wk_resource_index has % dependent database objects',
      dependent_object_count;
  end if;
end;
$preflight$;

drop view public.wk_resource_index;

create view public.wk_resource_index
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
  resources.updated_at
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
  resources.updated_at
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
  resources.updated_at
from editorial.resources
join editorial.registry_artist_resources
  on registry_artist_resources.resource_id = resources.id
left join editorial.resource_aliases as canonical_alias
  on canonical_alias.resource_id = resources.id
 and canonical_alias.is_canonical
 and canonical_alias.retired_at is null;

comment on view public.wk_resource_index is
  'Narrow stable public resource reference index. Canonical domain tables remain authoritative.';

revoke all
  on public.wk_resource_index
  from public, anon, authenticated;

grant select
  on public.wk_resource_index
  to anon, authenticated, service_role;

create view public.wk_resource_owner_index
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
  resources.owner_id
from editorial.resources
join editorial.article_resources
  on article_resources.resource_id = resources.id

union all

select
  resources.id as resource_id,
  resources.resource_kind,
  playlist_resources.playlist_id
    as canonical_record_id,
  resources.owner_id
from editorial.resources
join editorial.playlist_resources
  on playlist_resources.resource_id = resources.id

union all

select
  resources.id as resource_id,
  resources.resource_kind,
  registry_artist_resources.artist_id
    as canonical_record_id,
  resources.owner_id
from editorial.resources
join editorial.registry_artist_resources
  on registry_artist_resources.resource_id = resources.id;

comment on view public.wk_resource_owner_index is
  'Authenticated canonical account ownership read model for resource authority checks.';

revoke all
  on public.wk_resource_owner_index
  from public, anon, authenticated;

grant select
  on public.wk_resource_owner_index
  to authenticated, service_role;

commit;
