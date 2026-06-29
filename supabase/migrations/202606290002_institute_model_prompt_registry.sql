create extension if not exists pgcrypto;

create table if not exists public.model_providers (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null unique,
  display_name text not null,
  provider_type text not null check (
    provider_type in (
      'hosted_closed',
      'hosted_open_weight',
      'self_hosted',
      'local',
      'custom_http',
      'embedding',
      'reranker',
      'evaluation'
    )
  ),
  status text not null default 'active' check (status in ('active', 'paused', 'deprecated')),
  base_url text,
  docs_url text,
  secret_name text,
  supports_text_generation boolean not null default false,
  supports_structured_output boolean not null default false,
  supports_tool_use boolean not null default false,
  supports_citations boolean not null default false,
  supports_embeddings boolean not null default false,
  supports_reranking boolean not null default false,
  supports_fine_tuning boolean not null default false,
  license_notes text,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.model_registry (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.model_providers(id) on delete cascade,
  model_key text not null,
  display_name text not null,
  model_family text,
  model_type text not null check (
    model_type in (
      'chat',
      'completion',
      'embedding',
      'reranker',
      'evaluation',
      'classification',
      'local'
    )
  ),
  hosting_mode text not null check (
    hosting_mode in (
      'hosted_closed',
      'hosted_open_weight',
      'self_hosted',
      'local',
      'custom_http'
    )
  ),
  weight_access text not null default 'unknown' check (
    weight_access in ('closed', 'open_weight', 'open_source', 'unknown')
  ),
  status text not null default 'active' check (status in ('active', 'paused', 'deprecated', 'experimental')),
  context_window_tokens integer,
  output_token_limit integer,
  embedding_dimensions integer,
  supports_structured_output boolean not null default false,
  supports_json_mode boolean not null default false,
  supports_tool_use boolean not null default false,
  supports_citations boolean not null default false,
  supports_streaming boolean not null default false,
  supports_fine_tuning boolean not null default false,
  approved_task_types text[] not null default '{}'::text[],
  license_notes text,
  operational_notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, model_key)
);

create table if not exists public.inference_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_key text not null unique,
  display_name text not null,
  task_type text not null check (
    task_type in (
      'relationship_suggestion',
      'evidence_summary',
      'contributor_triage',
      'surface_draft',
      'retrieval_test',
      'evaluation',
      'tone_check',
      'overclaim_check',
      'embedding'
    )
  ),
  primary_model_id uuid references public.model_registry(id) on delete set null,
  fallback_model_id uuid references public.model_registry(id) on delete set null,
  temperature numeric(4,3),
  max_output_tokens integer,
  requires_structured_output boolean not null default true,
  requires_source_logging boolean not null default true,
  requires_human_review boolean not null default true,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'deprecated')),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inference_profile_distinct_models check (
    primary_model_id is null
    or fallback_model_id is null
    or primary_model_id <> fallback_model_id
  )
);

create table if not exists public.prompt_recipes (
  id uuid primary key default gen_random_uuid(),
  recipe_key text not null unique,
  display_name text not null,
  task_type text not null check (
    task_type in (
      'relationship_suggestion',
      'evidence_summary',
      'contributor_triage',
      'surface_draft',
      'retrieval_test',
      'evaluation',
      'tone_check',
      'overclaim_check'
    )
  ),
  purpose text not null,
  owner_id uuid default auth.uid(),
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'deprecated')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prompt_versions (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.prompt_recipes(id) on delete cascade,
  version_name text not null,
  version_label text,
  system_prompt text not null,
  developer_prompt text,
  user_prompt_template text not null,
  output_schema jsonb not null default '{}'::jsonb,
  retrieval_policy jsonb not null default '{}'::jsonb,
  safety_notes text,
  evaluation_notes text,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'deprecated')),
  created_by uuid default auth.uid(),
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recipe_id, version_name),
  constraint prompt_versions_active_requires_approval check (
    status <> 'active'
    or approved_by is not null
  )
);

create table if not exists public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null check (
    run_type in (
      'relationship_suggestion',
      'evidence_summary',
      'contributor_triage',
      'surface_draft',
      'retrieval_test',
      'evaluation',
      'tone_check',
      'overclaim_check',
      'embedding'
    )
  ),
  inquiry_id uuid references public.inquiries(id) on delete set null,
  entity_id uuid references public.cultural_entities(id) on delete set null,
  inference_profile_id uuid references public.inference_profiles(id) on delete set null,
  provider_id uuid not null references public.model_providers(id) on delete restrict,
  model_id uuid not null references public.model_registry(id) on delete restrict,
  prompt_recipe_id uuid references public.prompt_recipes(id) on delete set null,
  prompt_version_id uuid references public.prompt_versions(id) on delete set null,
  provider_key_snapshot text not null,
  model_key_snapshot text not null,
  prompt_version_name_snapshot text,
  input_summary text not null,
  input_json jsonb not null default '{}'::jsonb,
  output_json jsonb not null default '{}'::jsonb,
  output_text text,
  status text not null default 'queued' check (
    status in ('queued', 'running', 'succeeded', 'failed', 'cancelled', 'rejected')
  ),
  error_message text,
  token_input_count integer,
  token_output_count integer,
  cost_estimate_usd numeric(12,6),
  requires_human_review boolean not null default true,
  review_status text not null default 'not_reviewed' check (
    review_status in ('not_reviewed', 'pending_review', 'approved', 'rejected', 'needs_more_evidence')
  ),
  created_by uuid default auth.uid(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint ai_runs_prompt_version_logged check (
    run_type = 'embedding'
    or (
      prompt_version_id is not null
      and prompt_version_name_snapshot is not null
    )
  ),
  constraint ai_runs_model_logged check (
    provider_id is not null
    and model_id is not null
    and length(trim(provider_key_snapshot)) > 0
    and length(trim(model_key_snapshot)) > 0
  )
);

create table if not exists public.ai_run_sources (
  id uuid primary key default gen_random_uuid(),
  ai_run_id uuid not null references public.ai_runs(id) on delete cascade,
  source_type text not null check (
    source_type in (
      'inquiry',
      'inquiry_note',
      'evidence',
      'relationship',
      'contributor_submission',
      'surface_draft',
      'correction',
      'memory_embedding',
      'registry_artist',
      'registry_track',
      'registry_release',
      'registry_label',
      'external_url',
      'manual_context'
    )
  ),
  source_id uuid,
  source_table text,
  source_ref text,
  source_title text,
  excerpt text,
  retrieval_rank integer,
  similarity_score numeric(8,6),
  used_in_prompt boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ai_run_sources_reference_present check (
    source_id is not null
    or source_ref is not null
    or source_table is not null
  )
);

alter table public.surface_drafts
  drop constraint if exists surface_drafts_ai_run_fk;

alter table public.surface_drafts
  add constraint surface_drafts_ai_run_fk
  foreign key (ai_run_id)
  references public.ai_runs(id)
  on delete set null;

create index if not exists model_registry_provider_idx
  on public.model_registry (provider_id, status, model_type);

create index if not exists inference_profiles_task_idx
  on public.inference_profiles (task_type, status);

create index if not exists prompt_versions_recipe_idx
  on public.prompt_versions (recipe_id, status, updated_at desc);

create index if not exists ai_runs_inquiry_idx
  on public.ai_runs (inquiry_id, run_type, created_at desc);

create index if not exists ai_runs_entity_idx
  on public.ai_runs (entity_id, run_type, created_at desc);

create index if not exists ai_runs_prompt_version_idx
  on public.ai_runs (prompt_version_id, created_at desc);

create index if not exists ai_run_sources_run_idx
  on public.ai_run_sources (ai_run_id, retrieval_rank);

alter table public.model_providers enable row level security;
alter table public.model_registry enable row level security;
alter table public.inference_profiles enable row level security;
alter table public.prompt_recipes enable row level security;
alter table public.prompt_versions enable row level security;
alter table public.ai_runs enable row level security;
alter table public.ai_run_sources enable row level security;

drop policy if exists model_providers_admin_select on public.model_providers;
create policy model_providers_admin_select on public.model_providers
  for select to authenticated
  using (public.institute_can_read());

drop policy if exists model_providers_admin_insert on public.model_providers;
create policy model_providers_admin_insert on public.model_providers
  for insert to authenticated
  with check (public.institute_can_manage());

drop policy if exists model_providers_admin_update on public.model_providers;
create policy model_providers_admin_update on public.model_providers
  for update to authenticated
  using (public.institute_can_manage())
  with check (public.institute_can_manage());

drop policy if exists model_registry_admin_select on public.model_registry;
create policy model_registry_admin_select on public.model_registry
  for select to authenticated
  using (public.institute_can_read());

drop policy if exists model_registry_admin_insert on public.model_registry;
create policy model_registry_admin_insert on public.model_registry
  for insert to authenticated
  with check (public.institute_can_manage());

drop policy if exists model_registry_admin_update on public.model_registry;
create policy model_registry_admin_update on public.model_registry
  for update to authenticated
  using (public.institute_can_manage())
  with check (public.institute_can_manage());

drop policy if exists inference_profiles_admin_select on public.inference_profiles;
create policy inference_profiles_admin_select on public.inference_profiles
  for select to authenticated
  using (public.institute_can_read());

drop policy if exists inference_profiles_admin_insert on public.inference_profiles;
create policy inference_profiles_admin_insert on public.inference_profiles
  for insert to authenticated
  with check (public.institute_can_manage());

drop policy if exists inference_profiles_admin_update on public.inference_profiles;
create policy inference_profiles_admin_update on public.inference_profiles
  for update to authenticated
  using (public.institute_can_manage())
  with check (public.institute_can_manage());

drop policy if exists prompt_recipes_admin_select on public.prompt_recipes;
create policy prompt_recipes_admin_select on public.prompt_recipes
  for select to authenticated
  using (public.institute_can_read());

drop policy if exists prompt_recipes_admin_insert on public.prompt_recipes;
create policy prompt_recipes_admin_insert on public.prompt_recipes
  for insert to authenticated
  with check (public.institute_can_manage());

drop policy if exists prompt_recipes_admin_update on public.prompt_recipes;
create policy prompt_recipes_admin_update on public.prompt_recipes
  for update to authenticated
  using (public.institute_can_manage())
  with check (public.institute_can_manage());

drop policy if exists prompt_versions_admin_select on public.prompt_versions;
create policy prompt_versions_admin_select on public.prompt_versions
  for select to authenticated
  using (public.institute_can_read());

drop policy if exists prompt_versions_admin_insert on public.prompt_versions;
create policy prompt_versions_admin_insert on public.prompt_versions
  for insert to authenticated
  with check (public.institute_can_manage());

drop policy if exists prompt_versions_admin_update on public.prompt_versions;
create policy prompt_versions_admin_update on public.prompt_versions
  for update to authenticated
  using (public.institute_can_review())
  with check (public.institute_can_review());

drop policy if exists ai_runs_admin_select on public.ai_runs;
create policy ai_runs_admin_select on public.ai_runs
  for select to authenticated
  using (public.institute_can_read());

drop policy if exists ai_runs_admin_insert on public.ai_runs;
create policy ai_runs_admin_insert on public.ai_runs
  for insert to authenticated
  with check (public.institute_can_manage());

drop policy if exists ai_runs_admin_update on public.ai_runs;
create policy ai_runs_admin_update on public.ai_runs
  for update to authenticated
  using (public.institute_can_review())
  with check (public.institute_can_review());

drop policy if exists ai_run_sources_admin_select on public.ai_run_sources;
create policy ai_run_sources_admin_select on public.ai_run_sources
  for select to authenticated
  using (public.institute_can_read());

drop policy if exists ai_run_sources_admin_insert on public.ai_run_sources;
create policy ai_run_sources_admin_insert on public.ai_run_sources
  for insert to authenticated
  with check (public.institute_can_manage());

grant select, insert, update on public.model_providers to authenticated;
grant select, insert, update on public.model_registry to authenticated;
grant select, insert, update on public.inference_profiles to authenticated;
grant select, insert, update on public.prompt_recipes to authenticated;
grant select, insert, update on public.prompt_versions to authenticated;
grant select, insert, update on public.ai_runs to authenticated;
grant select, insert on public.ai_run_sources to authenticated;
