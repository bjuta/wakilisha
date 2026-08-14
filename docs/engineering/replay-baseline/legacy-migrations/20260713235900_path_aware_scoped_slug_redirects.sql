-- Allow multiple scoped redirects for the same artist and legacy slug
-- when the exact public paths are different.
--
-- Example:
--   /tracks/nyashinski/legendary-2
--   /releases/nyashinski/yariasu/legendary-2
--
-- Exact legacy paths remain globally unique through
-- wk_slug_redirects_old_path_unique.

begin;

do $path_aware_scoped_redirects$
declare
  v_existing_index_definition text;
begin
  select indexdef
  into v_existing_index_definition
  from pg_indexes
  where schemaname = 'public'
    and tablename = 'wk_slug_redirects'
    and indexname = 'wk_slug_redirects_scoped_entity_unique';

  if v_existing_index_definition is null then
    raise exception
      'STOP: Expected wk_slug_redirects_scoped_entity_unique to exist';
  end if;

  if v_existing_index_definition not like
    '%(entity_type, scope_slug, old_slug)%'
  then
    raise exception
      'STOP: Existing scoped redirect uniqueness definition changed: %',
      v_existing_index_definition;
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'wk_slug_redirects'
      and indexname = 'wk_slug_redirects_old_path_unique'
  ) then
    raise exception
      'STOP: Exact old-path uniqueness index is missing';
  end if;

  if exists (
    select 1
    from public.wk_slug_redirects
    where scope_slug is not null
      and (
        nullif(btrim(old_path), '') is null
        or nullif(btrim(new_path), '') is null
      )
  ) then
    raise exception
      'STOP: One or more scoped redirects is missing an exact path';
  end if;

  if exists (
    select 1
    from public.wk_slug_redirects
    where old_path is not null
    group by old_path
    having count(*) > 1
  ) then
    raise exception
      'STOP: Duplicate exact old paths exist';
  end if;
end
$path_aware_scoped_redirects$;

drop index public.wk_slug_redirects_scoped_entity_unique;

create unique index
  wk_slug_redirects_scoped_path_unique
on public.wk_slug_redirects (
  entity_type,
  scope_slug,
  old_slug,
  old_path
)
where scope_slug is not null
  and old_path is not null;

comment on index public.wk_slug_redirects_scoped_path_unique is
  'Allows the same scoped legacy slug to redirect from multiple exact public paths while keeping each route unique.';

do $path_aware_scoped_redirects$
begin
  if exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'wk_slug_redirects'
      and indexname = 'wk_slug_redirects_scoped_entity_unique'
  ) then
    raise exception
      'STOP: Legacy slug-only uniqueness index still exists';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'wk_slug_redirects'
      and indexname = 'wk_slug_redirects_scoped_path_unique'
      and indexdef like
        '%(entity_type, scope_slug, old_slug, old_path)%'
  ) then
    raise exception
      'STOP: Path-aware scoped uniqueness index was not created';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'wk_slug_redirects'
      and indexname = 'wk_slug_redirects_old_path_unique'
  ) then
    raise exception
      'STOP: Global exact-path uniqueness was lost';
  end if;
end
$path_aware_scoped_redirects$;

commit;
