-- Inquiry Court: accepted relationships.
-- Implementation of the approved contract in
-- docs/institute/INQUIRY_COURT_RELATIONSHIPS_PLAN.md (JB approval with six
-- amendments, 2026-07-05). A relationship is a judgment with a reason,
-- standing on evidence. Candidates stay in institute_assistant_suggestions;
-- only human-accepted judgments land here. The assistant Edge Function has
-- no write path to this table. Verification SQL: plan section 8.

create table if not exists public.institute_relationships (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.institute_inquiries(id) on delete cascade,
  source_entity_type text not null check (source_entity_type in (
    'artist','track','release','label','genre','scene','place','event',
    'institution','person','work','contributor_memory','evidence_item','claim','inquiry')),
  source_entity_label text not null,
  source_entity_slug text,
  target_entity_type text not null check (target_entity_type in (
    'artist','track','release','label','genre','scene','place','event',
    'institution','person','work','contributor_memory','evidence_item','claim','inquiry')),
  target_entity_label text not null,
  target_entity_slug text,
  relationship_kind text not null,
  plain_reason text not null,
  confidence_band text not null default 'partly_supported' check (confidence_band in
    ('well_supported','partly_supported','thin_support')),
  evidence_refs jsonb not null default '[]'::jsonb,
  source_suggestion_id uuid references public.institute_assistant_suggestions(id) on delete set null,
  status text not null default 'accepted' check (status in ('accepted','superseded','withdrawn_with_reason')),
  status_reason text,
  superseded_by_relationship_id uuid references public.institute_relationships(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  status_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(source_entity_label)) > 0),
  check (length(trim(target_entity_label)) > 0),
  check (length(trim(relationship_kind)) > 0),
  check (length(trim(plain_reason)) > 3),
  -- Amendment 1: a relationship stands on evidence, always.
  check (jsonb_typeof(evidence_refs) = 'array' and jsonb_array_length(evidence_refs) > 0),
  -- Amendment 2: leaving accepted requires a reason, enforced here.
  check (status not in ('superseded','withdrawn_with_reason')
         or length(trim(coalesce(status_reason, ''))) > 3),
  -- Amendment 3: superseded rows point at the better judgment.
  check (status <> 'superseded' or superseded_by_relationship_id is not null)
);

drop trigger if exists institute_relationships_set_updated_at on public.institute_relationships;
create trigger institute_relationships_set_updated_at
before update on public.institute_relationships
for each row execute function public.institute_set_updated_at();

create index if not exists institute_relationships_inquiry_idx
  on public.institute_relationships(inquiry_id, created_at desc);
create index if not exists institute_relationships_source_idx
  on public.institute_relationships(source_entity_type, source_entity_slug);
create index if not exists institute_relationships_target_idx
  on public.institute_relationships(target_entity_type, target_entity_slug);

-- Amendment 5: one standing judgment per edge per inquiry. History stays out.
create unique index if not exists institute_relationships_one_standing
  on public.institute_relationships (
    inquiry_id,
    source_entity_type,
    lower(coalesce(nullif(trim(source_entity_slug), ''), trim(source_entity_label))),
    target_entity_type,
    lower(coalesce(nullif(trim(target_entity_slug), ''), trim(target_entity_label))),
    lower(trim(relationship_kind))
  ) where status = 'accepted';

alter table public.institute_relationships enable row level security;

drop policy if exists institute_relationships_read on public.institute_relationships;
create policy institute_relationships_read on public.institute_relationships
for select to authenticated
using (public.current_user_is_administrator() or public.current_user_has_capability('institute_read'));

drop policy if exists institute_relationships_insert on public.institute_relationships;
create policy institute_relationships_insert on public.institute_relationships
for insert to authenticated
with check (public.current_user_is_administrator() or public.current_user_has_capability('institute_write'));

drop policy if exists institute_relationships_update on public.institute_relationships;
create policy institute_relationships_update on public.institute_relationships
for update to authenticated
using (public.current_user_is_administrator() or public.current_user_has_capability('institute_write'))
with check (public.current_user_is_administrator() or public.current_user_has_capability('institute_write'));

drop policy if exists institute_relationships_delete on public.institute_relationships;
create policy institute_relationships_delete on public.institute_relationships
for delete to authenticated
using (public.current_user_is_administrator() or public.current_user_has_capability('institute_admin'));

grant select, insert, update, delete on public.institute_relationships to authenticated;
