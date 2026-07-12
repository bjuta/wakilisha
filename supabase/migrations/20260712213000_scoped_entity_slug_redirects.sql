begin;

alter table public.wk_slug_redirects
  add column if not exists scope_slug text,
  add column if not exists old_path text,
  add column if not exists new_path text,
  add column if not exists redirect_status integer not null default 308,
  add column if not exists updated_at timestamptz not null default now();

alter table public.wk_slug_redirects
  add constraint wk_slug_redirects_redirect_status_check
  check (redirect_status in (301, 308));

create unique index if not exists
  wk_slug_redirects_article_slug_unique
on public.wk_slug_redirects (
  entity_type,
  old_slug
)
where scope_slug is null
  and entity_type = 'article';

create unique index if not exists
  wk_slug_redirects_scoped_entity_unique
on public.wk_slug_redirects (
  entity_type,
  scope_slug,
  old_slug
)
where scope_slug is not null;

create unique index if not exists
  wk_slug_redirects_old_path_unique
on public.wk_slug_redirects (
  old_path
)
where old_path is not null;

create index if not exists
  wk_slug_redirects_scoped_lookup_idx
on public.wk_slug_redirects (
  entity_type,
  scope_slug,
  old_slug
);

comment on column public.wk_slug_redirects.scope_slug is
  'Artist or other route scope used when an entity slug is not globally unique.';

comment on column public.wk_slug_redirects.old_path is
  'Exact legacy public path, including entity and scope.';

comment on column public.wk_slug_redirects.new_path is
  'Exact canonical public path for permanent redirect delivery.';

comment on column public.wk_slug_redirects.redirect_status is
  'Permanent redirect status. Allowed values are 301 and 308.';

commit;
