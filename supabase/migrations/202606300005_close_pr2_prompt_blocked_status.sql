alter table public.prompt_recipes
  drop constraint if exists prompt_recipes_status_check;

alter table public.prompt_recipes
  add constraint prompt_recipes_status_check
  check (status in ('draft', 'active', 'paused', 'deprecated', 'blocked'));

alter table public.prompt_versions
  drop constraint if exists prompt_versions_status_check;

alter table public.prompt_versions
  add constraint prompt_versions_status_check
  check (status in ('draft', 'active', 'paused', 'deprecated', 'blocked'));
