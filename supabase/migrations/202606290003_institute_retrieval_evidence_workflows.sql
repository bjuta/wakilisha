create extension if not exists pgcrypto;

create table if not exists public.evidence_review_events (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.evidence_items(id) on delete cascade,
  decision text not null check (
    decision in (
      'reviewed',
      'approved',
      'rejected',
      'disputed',
      'needs_more_evidence',
      'retrieval_enabled',
      'retrieval_disabled'
    )
  ),
  previous_review_status text,
  next_review_status text not null check (
    next_review_status in ('unreviewed', 'reviewed', 'approved', 'disputed', 'rejected')
  ),
  previous_retrieval_status text,
  next_retrieval_status text not null check (
    next_retrieval_status in ('excluded', 'review_only', 'default_retrieval')
  ),
  decision_note text,
  decided_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint evidence_review_event_default_retrieval_requires_review check (
    next_retrieval_status <> 'default_retrieval'
    or next_review_status in ('reviewed', 'approved')
  )
);

create table if not exists public.retrieval_policies (
  id uuid primary key default gen_random_uuid(),
  policy_key text not null unique,
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
  purpose text not null,
  requires_reviewed_evidence boolean not null default true,
  allow_unreviewed_evidence boolean not null default false,
  allow_disputed_evidence boolean not null default false,
  allowed_evidence_types text[] not null default '{}'::text[],
  excluded_evidence_types text[] not null default '{}'::text[],
  max_items integer not null default 12,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'deprecated')),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint retrieval_policy_review_safety check (
    allow_unreviewed_evidence = false
    or requires_reviewed_evidence = false
  ),
  constraint retrieval_policy_max_items_positive check (max_items > 0 and max_items <= 50)
);

create table if not exists public.retrieval_policy_versions (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.retrieval_policies(id) on delete cascade,
  version_name text not null,
  policy_json jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'deprecated')),
  created_by uuid default auth.uid(),
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (policy_id, version_name),
  constraint retrieval_policy_version_active_requires_approval check (
    status <> 'active'
    or approved_by is not null
  )
);

create table if not exists public.retrieval_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null check (
    run_type in (
      'manual_test',
      'context_build',
      'evidence_refresh',
      'embedding_candidate_refresh',
      'evaluation'
    )
  ),
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
  inquiry_id uuid references public.inquiries(id) on delete set null,
  entity_id uuid references public.cultural_entities(id) on delete set null,
  policy_id uuid references public.retrieval_policies(id) on delete set null,
  policy_version_id uuid references public.retrieval_policy_versions(id) on delete set null,
  query_text text,
  query_json jsonb not null default '{}'::jsonb,
  filters_json jsonb not null default '{}'::jsonb,
  top_k integer not null default 12,
  status text not null default 'queued' check (
    status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')
  ),
  error_message text,
  created_by uuid default auth.uid(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint retrieval_run_scope_present check (
    inquiry_id is not null
    or entity_id is not null
    or query_text is not null
  ),
  constraint retrieval_run_top_k_positive check (top_k > 0 and top_k <= 50)
);

create table if not exists public.retrieval_run_items (
  id uuid primary key default gen_random_uuid(),
  retrieval_run_id uuid not null references public.retrieval_runs(id) on delete cascade,
  source_type text not null check (
    source_type in (
      'evidence',
      'memory_embedding',
      'inquiry_note',
      'relationship',
      'contributor_submission',
      'manual_context'
    )
  ),
  evidence_id uuid references public.evidence_items(id) on delete set null,
  memory_embedding_id uuid references public.memory_embeddings(id) on delete set null,
  source_table text,
  source_id uuid,
  source_ref text,
  source_title text,
  excerpt text,
  retrieval_rank integer,
  similarity_score numeric(8,6),
  review_status_snapshot text,
  retrieval_status_snapshot text,
  included_in_context boolean not null default false,
  exclusion_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint retrieval_run_item_source_present check (
    evidence_id is not null
    or memory_embedding_id is not null
    or source_id is not null
    or source_ref is not null
  ),
  constraint retrieval_run_item_included_requires_safe_evidence check (
    included_in_context = false
    or source_type <> 'evidence'
    or (
      review_status_snapshot in ('reviewed', 'approved')
      and retrieval_status_snapshot = 'default_retrieval'
    )
  )
);

create or replace view public.institute_retrieval_ready_evidence
with (security_invoker = true) as
select
  evidence_items.*
from public.evidence_items
where evidence_items.review_status in ('reviewed', 'approved')
  and evidence_items.retrieval_status = 'default_retrieval';

create or replace view public.institute_review_queue_evidence
with (security_invoker = true) as
select
  evidence_items.*
from public.evidence_items
where evidence_items.review_status in ('unreviewed', 'disputed')
   or evidence_items.retrieval_status = 'review_only';

create index if not exists evidence_review_events_evidence_idx
  on public.evidence_review_events (evidence_id, created_at desc);

create index if not exists retrieval_policies_task_idx
  on public.retrieval_policies (task_type, status);

create index if not exists retrieval_policy_versions_policy_idx
  on public.retrieval_policy_versions (policy_id, status, updated_at desc);

create index if not exists retrieval_runs_scope_idx
  on public.retrieval_runs (task_type, inquiry_id, entity_id, created_at desc);

create index if not exists retrieval_run_items_run_idx
  on public.retrieval_run_items (retrieval_run_id, retrieval_rank);

create index if not exists retrieval_run_items_evidence_idx
  on public.retrieval_run_items (evidence_id)
  where evidence_id is not null;

alter table public.evidence_review_events enable row level security;
alter table public.retrieval_policies enable row level security;
alter table public.retrieval_policy_versions enable row level security;
alter table public.retrieval_runs enable row level security;
alter table public.retrieval_run_items enable row level security;

drop policy if exists evidence_review_events_admin_select on public.evidence_review_events;
create policy evidence_review_events_admin_select on public.evidence_review_events
  for select to authenticated
  using (public.institute_can_read());

drop policy if exists evidence_review_events_admin_insert on public.evidence_review_events;
create policy evidence_review_events_admin_insert on public.evidence_review_events
  for insert to authenticated
  with check (public.institute_can_review());

drop policy if exists retrieval_policies_admin_select on public.retrieval_policies;
create policy retrieval_policies_admin_select on public.retrieval_policies
  for select to authenticated
  using (public.institute_can_read());

drop policy if exists retrieval_policies_admin_insert on public.retrieval_policies;
create policy retrieval_policies_admin_insert on public.retrieval_policies
  for insert to authenticated
  with check (public.institute_can_manage());

drop policy if exists retrieval_policies_admin_update on public.retrieval_policies;
create policy retrieval_policies_admin_update on public.retrieval_policies
  for update to authenticated
  using (public.institute_can_manage())
  with check (public.institute_can_manage());

drop policy if exists retrieval_policy_versions_admin_select on public.retrieval_policy_versions;
create policy retrieval_policy_versions_admin_select on public.retrieval_policy_versions
  for select to authenticated
  using (public.institute_can_read());

drop policy if exists retrieval_policy_versions_admin_insert on public.retrieval_policy_versions;
create policy retrieval_policy_versions_admin_insert on public.retrieval_policy_versions
  for insert to authenticated
  with check (public.institute_can_manage());

drop policy if exists retrieval_policy_versions_admin_update on public.retrieval_policy_versions;
create policy retrieval_policy_versions_admin_update on public.retrieval_policy_versions
  for update to authenticated
  using (public.institute_can_review())
  with check (public.institute_can_review());

drop policy if exists retrieval_runs_admin_select on public.retrieval_runs;
create policy retrieval_runs_admin_select on public.retrieval_runs
  for select to authenticated
  using (public.institute_can_read());

drop policy if exists retrieval_runs_admin_insert on public.retrieval_runs;
create policy retrieval_runs_admin_insert on public.retrieval_runs
  for insert to authenticated
  with check (public.institute_can_manage());

drop policy if exists retrieval_runs_admin_update on public.retrieval_runs;
create policy retrieval_runs_admin_update on public.retrieval_runs
  for update to authenticated
  using (public.institute_can_manage())
  with check (public.institute_can_manage());

drop policy if exists retrieval_run_items_admin_select on public.retrieval_run_items;
create policy retrieval_run_items_admin_select on public.retrieval_run_items
  for select to authenticated
  using (public.institute_can_read());

drop policy if exists retrieval_run_items_admin_insert on public.retrieval_run_items;
create policy retrieval_run_items_admin_insert on public.retrieval_run_items
  for insert to authenticated
  with check (public.institute_can_manage());

grant select, insert on public.evidence_review_events to authenticated;
grant select, insert, update on public.retrieval_policies to authenticated;
grant select, insert, update on public.retrieval_policy_versions to authenticated;
grant select, insert, update on public.retrieval_runs to authenticated;
grant select, insert on public.retrieval_run_items to authenticated;
grant select on public.institute_retrieval_ready_evidence to authenticated;
grant select on public.institute_review_queue_evidence to authenticated;
