-- WAKILISHA Auth Phase 1: durable role, capability, scope, and audit substrate.
-- Supabase Auth owns identity. WAKILISHA-owned tables own roles, scopes, and governance.

create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  bio text,
  status text not null default 'active' check (status in ('active', 'pending', 'suspended', 'disabled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.role_definitions (
  role_key text primary key,
  label text not null,
  description text,
  priority integer not null default 100,
  is_system boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.capability_definitions (
  capability_key text primary key,
  label text not null,
  description text,
  domain text not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.role_capabilities (
  role_key text not null references public.role_definitions(role_key) on delete cascade,
  capability_key text not null references public.capability_definitions(capability_key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_key, capability_key)
);

create table if not exists public.user_role_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role_key text not null references public.role_definitions(role_key) on delete restrict,
  status text not null default 'active' check (status in ('active', 'pending', 'suspended', 'revoked')),
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  expires_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, role_key)
);

create table if not exists public.user_access_scopes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role_key text references public.role_definitions(role_key) on delete cascade,
  scope_type text not null check (scope_type in ('global', 'market', 'country', 'region', 'series', 'vertical', 'entity_type')),
  scope_value text not null,
  can_view boolean not null default true,
  can_edit boolean not null default false,
  can_publish boolean not null default false,
  status text not null default 'active' check (status in ('active', 'pending', 'suspended', 'revoked')),
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, role_key, scope_type, scope_value)
);

create table if not exists public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  target_table text,
  target_record_id text,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.role_definitions (role_key, label, description, priority) values
  ('administrator', 'Administrator', 'Full access to all admin areas, settings, users, import tools, registry, charts, and publishing.', 10),
  ('editor', 'Editor', 'Editorial lead with content, media, publishing, and review access. No imports, users, or system settings.', 30),
  ('chart_editor_global', 'Chart Editor — Global', 'Can manage chart admin, editions, and chart publishing across all markets and series.', 35),
  ('chart_editor_regional', 'Chart Editor — Regional', 'Can manage chart editions only within assigned market, country, region, or series scopes.', 40),
  ('registry_editor', 'Registry Editor', 'Can manage artists, tracks, releases, labels, genres, relationships, and duplicate cleanup.', 45),
  ('media_editor', 'Media Editor', 'Can manage the media library, missing images, and broken media links.', 50),
  ('reviewer', 'Reviewer', 'Can work review queues and resolver decisions without system-level settings access.', 55),
  ('author', 'Author', 'Legacy role: can write and publish own articles plus use media.', 70),
  ('writer', 'Writer', 'Can draft content and use the media library but cannot publish directly.', 80),
  ('viewer', 'Viewer', 'Read-only admin visibility for stakeholders and QA.', 90)
on conflict (role_key) do update set
  label = excluded.label,
  description = excluded.description,
  priority = excluded.priority,
  updated_at = now();

insert into public.capability_definitions (capability_key, label, domain, description) values
  ('view_dashboard', 'View dashboard', 'dashboard', 'View the admin dashboard.'),
  ('edit_own_articles', 'Edit own articles', 'content', 'Create and edit owned content.'),
  ('edit_others_articles', 'Edit others articles', 'content', 'Edit content owned by other authors.'),
  ('publish_articles', 'Publish articles', 'content', 'Publish editorial content.'),
  ('delete_articles', 'Delete articles', 'content', 'Delete editorial content.'),
  ('edit_guides', 'Edit guides', 'content', 'Create and edit guides.'),
  ('edit_pages', 'Edit pages', 'content', 'Create and edit static pages.'),
  ('view_publishing_dashboard', 'View publishing dashboard', 'content', 'View publishing workflow and schedule.'),
  ('view_archive', 'View archive', 'content', 'View content archive.'),
  ('manage_categories', 'Manage categories', 'content', 'Manage content categories.'),
  ('manage_tags', 'Manage tags', 'content', 'Manage content tags.'),
  ('upload_media', 'Upload media', 'media', 'Upload media assets.'),
  ('manage_media_library', 'Manage media library', 'media', 'Manage media assets.'),
  ('view_missing_images', 'View missing images', 'media', 'View missing image queues.'),
  ('view_broken_links', 'View broken links', 'media', 'View broken link queues.'),
  ('view_charts_admin', 'View charts admin', 'charts', 'View chart admin surfaces.'),
  ('manage_charts', 'Manage charts', 'charts', 'Manage chart families and editions.'),
  ('manage_ingest', 'Manage ingest', 'charts', 'Run chart/data ingest tools.'),
  ('publish_charts', 'Publish charts', 'charts', 'Publish chart editions.'),
  ('view_registry', 'View registry', 'registry', 'View registry admin.'),
  ('manage_registry', 'Manage registry', 'registry', 'Edit registry entities.'),
  ('view_relationships', 'View relationships', 'registry', 'View relationship/admin graph tools.'),
  ('manage_relationships', 'Manage relationships', 'registry', 'Edit relationship/admin graph data.'),
  ('view_review_queue', 'View review queue', 'review', 'View review queues.'),
  ('manage_review_queue', 'Manage review queue', 'review', 'Resolve review queue items.'),
  ('view_imports', 'View imports', 'imports', 'View import tooling and jobs.'),
  ('manage_imports', 'Manage imports', 'imports', 'Run import/promote tooling.'),
  ('view_settings', 'View settings', 'settings', 'View settings.'),
  ('manage_settings', 'Manage settings', 'settings', 'Manage settings.'),
  ('manage_integrations', 'Manage integrations', 'settings', 'Manage integrations.'),
  ('manage_appearance', 'Manage appearance', 'settings', 'Manage appearance/navigation.'),
  ('manage_users', 'Manage users', 'users', 'Manage user roles and access.'),
  ('view_media_migration', 'View media migration', 'media', 'View media migration tools.'),
  ('view_admin_readonly', 'View admin read-only', 'admin', 'Read-only access to approved admin dashboards.')
on conflict (capability_key) do update set
  label = excluded.label,
  domain = excluded.domain,
  description = excluded.description,
  updated_at = now();

with role_caps(role_key, capability_key) as (
  values
    ('administrator', 'view_dashboard'), ('administrator', 'edit_own_articles'), ('administrator', 'edit_others_articles'), ('administrator', 'publish_articles'), ('administrator', 'delete_articles'), ('administrator', 'edit_guides'), ('administrator', 'edit_pages'), ('administrator', 'view_publishing_dashboard'), ('administrator', 'view_archive'), ('administrator', 'manage_categories'), ('administrator', 'manage_tags'), ('administrator', 'upload_media'), ('administrator', 'manage_media_library'), ('administrator', 'view_missing_images'), ('administrator', 'view_broken_links'), ('administrator', 'view_charts_admin'), ('administrator', 'manage_charts'), ('administrator', 'manage_ingest'), ('administrator', 'publish_charts'), ('administrator', 'view_registry'), ('administrator', 'manage_registry'), ('administrator', 'view_relationships'), ('administrator', 'manage_relationships'), ('administrator', 'view_review_queue'), ('administrator', 'manage_review_queue'), ('administrator', 'view_imports'), ('administrator', 'manage_imports'), ('administrator', 'view_settings'), ('administrator', 'manage_settings'), ('administrator', 'manage_integrations'), ('administrator', 'manage_appearance'), ('administrator', 'manage_users'), ('administrator', 'view_media_migration'), ('administrator', 'view_admin_readonly'),
    ('editor', 'view_dashboard'), ('editor', 'edit_own_articles'), ('editor', 'edit_others_articles'), ('editor', 'publish_articles'), ('editor', 'delete_articles'), ('editor', 'edit_guides'), ('editor', 'edit_pages'), ('editor', 'view_publishing_dashboard'), ('editor', 'view_archive'), ('editor', 'manage_categories'), ('editor', 'manage_tags'), ('editor', 'upload_media'), ('editor', 'manage_media_library'), ('editor', 'view_missing_images'), ('editor', 'view_broken_links'), ('editor', 'view_review_queue'), ('editor', 'manage_review_queue'), ('editor', 'view_media_migration'), ('editor', 'view_admin_readonly'),
    ('chart_editor_global', 'view_dashboard'), ('chart_editor_global', 'view_charts_admin'), ('chart_editor_global', 'manage_charts'), ('chart_editor_global', 'manage_ingest'), ('chart_editor_global', 'publish_charts'), ('chart_editor_global', 'view_review_queue'), ('chart_editor_global', 'view_admin_readonly'),
    ('chart_editor_regional', 'view_dashboard'), ('chart_editor_regional', 'view_charts_admin'), ('chart_editor_regional', 'manage_charts'), ('chart_editor_regional', 'publish_charts'), ('chart_editor_regional', 'view_review_queue'), ('chart_editor_regional', 'view_admin_readonly'),
    ('registry_editor', 'view_dashboard'), ('registry_editor', 'view_registry'), ('registry_editor', 'manage_registry'), ('registry_editor', 'view_relationships'), ('registry_editor', 'manage_relationships'), ('registry_editor', 'view_review_queue'), ('registry_editor', 'manage_review_queue'), ('registry_editor', 'upload_media'), ('registry_editor', 'manage_media_library'), ('registry_editor', 'view_admin_readonly'),
    ('media_editor', 'view_dashboard'), ('media_editor', 'upload_media'), ('media_editor', 'manage_media_library'), ('media_editor', 'view_missing_images'), ('media_editor', 'view_broken_links'), ('media_editor', 'view_media_migration'), ('media_editor', 'view_review_queue'), ('media_editor', 'view_admin_readonly'),
    ('reviewer', 'view_dashboard'), ('reviewer', 'view_review_queue'), ('reviewer', 'manage_review_queue'), ('reviewer', 'view_missing_images'), ('reviewer', 'view_broken_links'), ('reviewer', 'view_admin_readonly'),
    ('author', 'view_dashboard'), ('author', 'edit_own_articles'), ('author', 'publish_articles'), ('author', 'upload_media'), ('author', 'manage_media_library'), ('author', 'view_admin_readonly'),
    ('writer', 'edit_own_articles'), ('writer', 'upload_media'), ('writer', 'manage_media_library'),
    ('viewer', 'view_dashboard'), ('viewer', 'view_admin_readonly')
)
insert into public.role_capabilities (role_key, capability_key)
select role_key, capability_key from role_caps
on conflict (role_key, capability_key) do nothing;

create or replace function public.current_user_is_administrator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_role_assignments ura
    where ura.user_id = auth.uid()
      and ura.role_key = 'administrator'
      and ura.status = 'active'
      and (ura.expires_at is null or ura.expires_at > now())
  )
$$;

create or replace function public.current_user_has_capability(required_capability text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_role_assignments ura
    join public.role_capabilities rc on rc.role_key = ura.role_key
    where ura.user_id = auth.uid()
      and ura.status = 'active'
      and (ura.expires_at is null or ura.expires_at > now())
      and rc.capability_key = required_capability
  )
$$;

alter table public.user_profiles enable row level security;
alter table public.role_definitions enable row level security;
alter table public.capability_definitions enable row level security;
alter table public.role_capabilities enable row level security;
alter table public.user_role_assignments enable row level security;
alter table public.user_access_scopes enable row level security;
alter table public.admin_audit_events enable row level security;

drop policy if exists user_profiles_self_read on public.user_profiles;
create policy user_profiles_self_read on public.user_profiles for select using (user_id = auth.uid() or public.current_user_is_administrator());

drop policy if exists user_profiles_self_update on public.user_profiles;
create policy user_profiles_self_update on public.user_profiles for update using (user_id = auth.uid() or public.current_user_is_administrator()) with check (user_id = auth.uid() or public.current_user_is_administrator());

drop policy if exists role_definitions_authenticated_read on public.role_definitions;
create policy role_definitions_authenticated_read on public.role_definitions for select to authenticated using (true);

drop policy if exists capability_definitions_authenticated_read on public.capability_definitions;
create policy capability_definitions_authenticated_read on public.capability_definitions for select to authenticated using (true);

drop policy if exists role_capabilities_authenticated_read on public.role_capabilities;
create policy role_capabilities_authenticated_read on public.role_capabilities for select to authenticated using (true);

drop policy if exists user_role_assignments_self_or_admin_read on public.user_role_assignments;
create policy user_role_assignments_self_or_admin_read on public.user_role_assignments for select using (user_id = auth.uid() or public.current_user_is_administrator());

drop policy if exists user_role_assignments_admin_write on public.user_role_assignments;
create policy user_role_assignments_admin_write on public.user_role_assignments for all using (public.current_user_is_administrator()) with check (public.current_user_is_administrator());

drop policy if exists user_access_scopes_self_or_admin_read on public.user_access_scopes;
create policy user_access_scopes_self_or_admin_read on public.user_access_scopes for select using (user_id = auth.uid() or public.current_user_is_administrator());

drop policy if exists user_access_scopes_admin_write on public.user_access_scopes;
create policy user_access_scopes_admin_write on public.user_access_scopes for all using (public.current_user_is_administrator()) with check (public.current_user_is_administrator());

drop policy if exists admin_audit_events_admin_read on public.admin_audit_events;
create policy admin_audit_events_admin_read on public.admin_audit_events for select using (public.current_user_is_administrator());

drop policy if exists admin_audit_events_admin_insert on public.admin_audit_events;
create policy admin_audit_events_admin_insert on public.admin_audit_events for insert with check (public.current_user_is_administrator() or actor_user_id = auth.uid());

create index if not exists user_role_assignments_user_status_idx on public.user_role_assignments(user_id, status);
create index if not exists user_access_scopes_user_status_idx on public.user_access_scopes(user_id, status);
create index if not exists admin_audit_events_actor_created_idx on public.admin_audit_events(actor_user_id, created_at desc);
