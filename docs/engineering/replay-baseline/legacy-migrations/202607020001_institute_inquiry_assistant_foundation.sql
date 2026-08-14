create extension if not exists pgcrypto;

insert into public.capability_definitions (capability_key, label, domain, description) values
  ('institute_read', 'Read Institute', 'institute', 'View Institute inquiries, context, and assistant records.'),
  ('institute_write', 'Write Institute', 'institute', 'Create and edit Institute inquiries, anchors, workbench setup, and events.'),
  ('institute_review', 'Review Institute', 'institute', 'Review Assistant suggestions, doubts, relationship leads, and public-safe decisions.'),
  ('institute_assistant_use', 'Use Inquiry Assistant', 'institute', 'Run structured Inquiry Assistant tasks.'),
  ('institute_public_safe', 'Mark Institute Public-Safe', 'institute', 'Mark Institute material as ready for public surfaces.'),
  ('institute_admin', 'Administer Institute', 'institute', 'Administer Institute records and hard-delete data when needed.')
on conflict (capability_key) do update set
  label = excluded.label,
  domain = excluded.domain,
  description = excluded.description,
  updated_at = now();

with role_caps(role_key, capability_key) as (
  values
    ('administrator', 'institute_read'),
    ('administrator', 'institute_write'),
    ('administrator', 'institute_review'),
    ('administrator', 'institute_assistant_use'),
    ('administrator', 'institute_public_safe'),
    ('administrator', 'institute_admin'),
    ('editor', 'institute_read'),
    ('editor', 'institute_write'),
    ('editor', 'institute_review'),
    ('editor', 'institute_assistant_use'),
    ('editor', 'institute_public_safe'),
    ('registry_editor', 'institute_read'),
    ('registry_editor', 'institute_write'),
    ('registry_editor', 'institute_review'),
    ('registry_editor', 'institute_assistant_use'),
    ('reviewer', 'institute_read'),
    ('reviewer', 'institute_review'),
    ('reviewer', 'institute_assistant_use'),
    ('viewer', 'institute_read')
)
insert into public.role_capabilities (role_key, capability_key)
select role_key, capability_key from role_caps
on conflict (role_key, capability_key) do nothing;

create sequence if not exists public.institute_inquiry_code_seq;

create table if not exists public.institute_inquiries (
  id uuid primary key default gen_random_uuid(),
  code text not null default ('INQ-' || lpad(nextval('public.institute_inquiry_code_seq')::text, 4, '0')),
  title text,
  raw_question text not null,
  current_question text not null,
  current_question_version_id uuid,
  inquiry_type text,
  status text not null default 'draft' check (status in ('draft', 'framing', 'active', 'needs_review', 'public_safe', 'published', 'paused', 'archived')),
  maturity text not null default 'raw' check (maturity in ('raw', 'clinic', 'framing', 'evidence', 'review', 'public_safe', 'published', 'paused')),
  visibility text not null default 'internal' check (visibility in ('private', 'internal', 'public_preview', 'public')),
  featured_image_url text,
  featured_image_alt text,
  featured_image_credit text,
  featured_image_source text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (code),
  check (length(trim(raw_question)) > 0),
  check (length(trim(current_question)) > 0)
);

create table if not exists public.institute_question_versions (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.institute_inquiries(id) on delete cascade,
  version_number integer not null,
  question_text text not null,
  version_type text not null default 'working' check (version_type in ('raw', 'working', 'clinic_refinement', 'fork_source', 'review_revision')),
  reason text,
  assessment_state text check (assessment_state in ('raw_but_promising', 'ready', 'too_broad', 'too_narrow', 'loaded', 'false_assumption', 'too_speculative', 'not_answerable_yet', 'already_answered', 'different_question', 'should_fork', 'should_merge', 'should_pause')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (inquiry_id, version_number),
  check (version_number > 0),
  check (length(trim(question_text)) > 0)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'institute_inquiries_current_question_version_id_fkey'
  ) then
    alter table public.institute_inquiries
      add constraint institute_inquiries_current_question_version_id_fkey
      foreign key (current_question_version_id)
      references public.institute_question_versions(id)
      on delete set null;
  end if;
end $$;

create table if not exists public.institute_inquiry_anchors (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.institute_inquiries(id) on delete cascade,
  source_system text not null default 'registry' check (source_system in ('registry', 'institute', 'external')),
  anchor_entity_type text not null check (anchor_entity_type in ('artist', 'track', 'release', 'label', 'genre', 'scene', 'place', 'contributor_memory', 'claim', 'correction')),
  anchor_entity_id text,
  anchor_slug text,
  anchor_label text not null,
  anchor_url text,
  anchor_image_url text,
  anchor_metadata jsonb not null default '{}'::jsonb,
  is_primary boolean not null default true,
  status text not null default 'active' check (status in ('active', 'superseded', 'removed')),
  anchored_by uuid references auth.users(id) on delete set null,
  anchored_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(anchor_label)) > 0)
);

create unique index if not exists institute_inquiry_anchors_one_primary_active
  on public.institute_inquiry_anchors(inquiry_id)
  where is_primary = true and status = 'active';

create table if not exists public.institute_anchor_context_snapshots (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.institute_inquiries(id) on delete cascade,
  inquiry_anchor_id uuid not null references public.institute_inquiry_anchors(id) on delete cascade,
  snapshot_version integer not null default 1,
  anchor_entity_type text not null,
  anchor_slug text,
  anchor_label text not null,
  source_context jsonb not null default '{}'::jsonb,
  knowns jsonb not null default '[]'::jsonb,
  unknowns jsonb not null default '[]'::jsonb,
  relationship_leads jsonb not null default '[]'::jsonb,
  evidence_gaps jsonb not null default '[]'::jsonb,
  related_entities jsonb not null default '[]'::jsonb,
  thin_data_notes jsonb not null default '[]'::jsonb,
  source_references jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (inquiry_anchor_id, snapshot_version)
);

create table if not exists public.institute_workbench_setup (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null unique references public.institute_inquiries(id) on delete cascade,
  inquiry_type text,
  output_surfaces jsonb not null default '[]'::jsonb,
  evidence_formats jsonb not null default '[]'::jsonb,
  tools jsonb not null default '[]'::jsonb,
  scope_edges jsonb not null default '{}'::jsonb,
  care_defaults jsonb not null default '{}'::jsonb,
  estimated_attention jsonb not null default '{}'::jsonb,
  assistant_seed jsonb not null default '{}'::jsonb,
  setup_source text not null default 'human' check (setup_source in ('human', 'assistant_suggested', 'assistant_edited')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.institute_assistant_runs (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid references public.institute_inquiries(id) on delete cascade,
  task text not null check (task in ('anchor_context_lift', 'question_clinic_help', 'workbench_setup_suggestions', 'evidence_search_plan', 'relationship_suggestions', 'risk_and_doubt_check', 'next_inquiry_suggestions')),
  anchor_context_snapshot_id uuid references public.institute_anchor_context_snapshots(id) on delete set null,
  question_version_id uuid references public.institute_question_versions(id) on delete set null,
  model_provider text,
  model_name text,
  prompt_version text not null default 'v1',
  input_context jsonb not null default '{}'::jsonb,
  output_json jsonb not null default '{}'::jsonb,
  source_references jsonb not null default '[]'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  error_message text,
  latency_ms integer,
  cost_estimate numeric(12,6),
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed', 'partially_reviewed', 'reviewed', 'rejected')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.institute_assistant_suggestions (
  id uuid primary key default gen_random_uuid(),
  assistant_run_id uuid not null references public.institute_assistant_runs(id) on delete cascade,
  inquiry_id uuid references public.institute_inquiries(id) on delete cascade,
  suggestion_type text not null check (suggestion_type in ('known', 'unknown', 'possible_question', 'relationship_lead', 'evidence_gap', 'risk_note', 'workbench_setup', 'next_move', 'public_path', 'doubt')),
  title text,
  body text not null,
  reason text,
  confidence numeric(5,2) check (confidence is null or (confidence >= 0 and confidence <= 100)),
  source_references jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'suggested' check (status in ('suggested', 'accepted', 'edited_and_accepted', 'rejected', 'saved_as_doubt', 'forked', 'converted_to_evidence_search', 'converted_to_relationship_proposal', 'converted_to_workbench_setup')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(body)) > 0)
);

create table if not exists public.institute_events (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid references public.institute_inquiries(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  event_label text,
  before_value jsonb not null default '{}'::jsonb,
  after_value jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.institute_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists institute_inquiries_set_updated_at on public.institute_inquiries;
create trigger institute_inquiries_set_updated_at
before update on public.institute_inquiries
for each row execute function public.institute_set_updated_at();

drop trigger if exists institute_inquiry_anchors_set_updated_at on public.institute_inquiry_anchors;
create trigger institute_inquiry_anchors_set_updated_at
before update on public.institute_inquiry_anchors
for each row execute function public.institute_set_updated_at();

drop trigger if exists institute_workbench_setup_set_updated_at on public.institute_workbench_setup;
create trigger institute_workbench_setup_set_updated_at
before update on public.institute_workbench_setup
for each row execute function public.institute_set_updated_at();

drop trigger if exists institute_assistant_suggestions_set_updated_at on public.institute_assistant_suggestions;
create trigger institute_assistant_suggestions_set_updated_at
before update on public.institute_assistant_suggestions
for each row execute function public.institute_set_updated_at();

create index if not exists institute_inquiries_status_idx on public.institute_inquiries(status);
create index if not exists institute_inquiries_created_at_idx on public.institute_inquiries(created_at desc);
create index if not exists institute_question_versions_inquiry_idx on public.institute_question_versions(inquiry_id, version_number desc);
create index if not exists institute_inquiry_anchors_inquiry_idx on public.institute_inquiry_anchors(inquiry_id);
create index if not exists institute_inquiry_anchors_entity_idx on public.institute_inquiry_anchors(anchor_entity_type, anchor_slug);
create index if not exists institute_anchor_snapshots_inquiry_idx on public.institute_anchor_context_snapshots(inquiry_id);
create index if not exists institute_workbench_setup_inquiry_idx on public.institute_workbench_setup(inquiry_id);
create index if not exists institute_assistant_runs_inquiry_idx on public.institute_assistant_runs(inquiry_id, created_at desc);
create index if not exists institute_assistant_runs_task_idx on public.institute_assistant_runs(task, status);
create index if not exists institute_assistant_suggestions_inquiry_idx on public.institute_assistant_suggestions(inquiry_id, status);
create index if not exists institute_events_inquiry_idx on public.institute_events(inquiry_id, created_at desc);

alter table public.institute_inquiries enable row level security;
alter table public.institute_question_versions enable row level security;
alter table public.institute_inquiry_anchors enable row level security;
alter table public.institute_anchor_context_snapshots enable row level security;
alter table public.institute_workbench_setup enable row level security;
alter table public.institute_assistant_runs enable row level security;
alter table public.institute_assistant_suggestions enable row level security;
alter table public.institute_events enable row level security;

drop policy if exists institute_inquiries_read on public.institute_inquiries;
create policy institute_inquiries_read on public.institute_inquiries
for select to authenticated
using (public.current_user_is_administrator() or public.current_user_has_capability('institute_read'));

drop policy if exists institute_inquiries_write on public.institute_inquiries;
create policy institute_inquiries_write on public.institute_inquiries
for insert to authenticated
with check (public.current_user_is_administrator() or public.current_user_has_capability('institute_write'));

drop policy if exists institute_inquiries_update on public.institute_inquiries;
create policy institute_inquiries_update on public.institute_inquiries
for update to authenticated
using (public.current_user_is_administrator() or public.current_user_has_capability('institute_write'))
with check (public.current_user_is_administrator() or public.current_user_has_capability('institute_write'));

drop policy if exists institute_inquiries_delete on public.institute_inquiries;
create policy institute_inquiries_delete on public.institute_inquiries
for delete to authenticated
using (public.current_user_is_administrator() or public.current_user_has_capability('institute_admin'));

drop policy if exists institute_question_versions_read on public.institute_question_versions;
create policy institute_question_versions_read on public.institute_question_versions
for select to authenticated
using (public.current_user_is_administrator() or public.current_user_has_capability('institute_read'));

drop policy if exists institute_question_versions_write on public.institute_question_versions;
create policy institute_question_versions_write on public.institute_question_versions
for insert to authenticated
with check (public.current_user_is_administrator() or public.current_user_has_capability('institute_write'));

drop policy if exists institute_question_versions_update on public.institute_question_versions;
create policy institute_question_versions_update on public.institute_question_versions
for update to authenticated
using (public.current_user_is_administrator() or public.current_user_has_capability('institute_write'))
with check (public.current_user_is_administrator() or public.current_user_has_capability('institute_write'));

drop policy if exists institute_inquiry_anchors_read on public.institute_inquiry_anchors;
create policy institute_inquiry_anchors_read on public.institute_inquiry_anchors
for select to authenticated
using (public.current_user_is_administrator() or public.current_user_has_capability('institute_read'));

drop policy if exists institute_inquiry_anchors_write on public.institute_inquiry_anchors;
create policy institute_inquiry_anchors_write on public.institute_inquiry_anchors
for insert to authenticated
with check (public.current_user_is_administrator() or public.current_user_has_capability('institute_write'));

drop policy if exists institute_inquiry_anchors_update on public.institute_inquiry_anchors;
create policy institute_inquiry_anchors_update on public.institute_inquiry_anchors
for update to authenticated
using (public.current_user_is_administrator() or public.current_user_has_capability('institute_write'))
with check (public.current_user_is_administrator() or public.current_user_has_capability('institute_write'));

drop policy if exists institute_anchor_context_snapshots_read on public.institute_anchor_context_snapshots;
create policy institute_anchor_context_snapshots_read on public.institute_anchor_context_snapshots
for select to authenticated
using (public.current_user_is_administrator() or public.current_user_has_capability('institute_read'));

drop policy if exists institute_anchor_context_snapshots_write on public.institute_anchor_context_snapshots;
create policy institute_anchor_context_snapshots_write on public.institute_anchor_context_snapshots
for insert to authenticated
with check (public.current_user_is_administrator() or public.current_user_has_capability('institute_write'));

drop policy if exists institute_workbench_setup_read on public.institute_workbench_setup;
create policy institute_workbench_setup_read on public.institute_workbench_setup
for select to authenticated
using (public.current_user_is_administrator() or public.current_user_has_capability('institute_read'));

drop policy if exists institute_workbench_setup_write on public.institute_workbench_setup;
create policy institute_workbench_setup_write on public.institute_workbench_setup
for insert to authenticated
with check (public.current_user_is_administrator() or public.current_user_has_capability('institute_write'));

drop policy if exists institute_workbench_setup_update on public.institute_workbench_setup;
create policy institute_workbench_setup_update on public.institute_workbench_setup
for update to authenticated
using (public.current_user_is_administrator() or public.current_user_has_capability('institute_write'))
with check (public.current_user_is_administrator() or public.current_user_has_capability('institute_write'));

drop policy if exists institute_assistant_runs_read on public.institute_assistant_runs;
create policy institute_assistant_runs_read on public.institute_assistant_runs
for select to authenticated
using (public.current_user_is_administrator() or public.current_user_has_capability('institute_read'));

drop policy if exists institute_assistant_runs_insert on public.institute_assistant_runs;
create policy institute_assistant_runs_insert on public.institute_assistant_runs
for insert to authenticated
with check (public.current_user_is_administrator() or public.current_user_has_capability('institute_assistant_use'));

drop policy if exists institute_assistant_runs_update on public.institute_assistant_runs;
create policy institute_assistant_runs_update on public.institute_assistant_runs
for update to authenticated
using (public.current_user_is_administrator() or public.current_user_has_capability('institute_assistant_use'))
with check (public.current_user_is_administrator() or public.current_user_has_capability('institute_assistant_use'));

drop policy if exists institute_assistant_suggestions_read on public.institute_assistant_suggestions;
create policy institute_assistant_suggestions_read on public.institute_assistant_suggestions
for select to authenticated
using (public.current_user_is_administrator() or public.current_user_has_capability('institute_read'));

drop policy if exists institute_assistant_suggestions_insert on public.institute_assistant_suggestions;
create policy institute_assistant_suggestions_insert on public.institute_assistant_suggestions
for insert to authenticated
with check (public.current_user_is_administrator() or public.current_user_has_capability('institute_assistant_use'));

drop policy if exists institute_assistant_suggestions_update on public.institute_assistant_suggestions;
create policy institute_assistant_suggestions_update on public.institute_assistant_suggestions
for update to authenticated
using (public.current_user_is_administrator() or public.current_user_has_capability('institute_review'))
with check (public.current_user_is_administrator() or public.current_user_has_capability('institute_review'));

drop policy if exists institute_events_read on public.institute_events;
create policy institute_events_read on public.institute_events
for select to authenticated
using (public.current_user_is_administrator() or public.current_user_has_capability('institute_read'));

drop policy if exists institute_events_insert on public.institute_events;
create policy institute_events_insert on public.institute_events
for insert to authenticated
with check (public.current_user_is_administrator() or public.current_user_has_capability('institute_write'));

grant usage, select on sequence public.institute_inquiry_code_seq to authenticated;
grant select, insert, update, delete on public.institute_inquiries to authenticated;
grant select, insert, update on public.institute_question_versions to authenticated;
grant select, insert, update on public.institute_inquiry_anchors to authenticated;
grant select, insert on public.institute_anchor_context_snapshots to authenticated;
grant select, insert, update on public.institute_workbench_setup to authenticated;
grant select, insert, update on public.institute_assistant_runs to authenticated;
grant select, insert, update on public.institute_assistant_suggestions to authenticated;
grant select, insert on public.institute_events to authenticated;
