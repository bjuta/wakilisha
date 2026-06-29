create extension if not exists pgcrypto;
create extension if not exists vector;

create or replace function public.institute_can_read()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    coalesce(public.current_user_has_capability('view_registry'), false)
    or coalesce(public.current_user_has_capability('view_relationships'), false)
    or coalesce(public.current_user_has_capability('view_review_queue'), false)
    or coalesce(public.current_user_has_capability('view_settings'), false)
    or coalesce(public.current_user_has_capability('view_developer_tools'), false);
$$;

create or replace function public.institute_can_manage()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    coalesce(public.current_user_has_capability('manage_registry'), false)
    or coalesce(public.current_user_has_capability('manage_relationships'), false)
    or coalesce(public.current_user_has_capability('manage_review_queue'), false)
    or coalesce(public.current_user_has_capability('manage_settings'), false)
    or coalesce(public.current_user_has_capability('manage_developer_tools'), false);
$$;

create or replace function public.institute_can_review()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    coalesce(public.current_user_has_capability('manage_review_queue'), false)
    or coalesce(public.current_user_has_capability('manage_registry'), false)
    or coalesce(public.current_user_has_capability('manage_relationships'), false)
    or coalesce(public.current_user_has_capability('manage_settings'), false);
$$;

grant execute on function public.institute_can_read() to authenticated;
grant execute on function public.institute_can_manage() to authenticated;
grant execute on function public.institute_can_review() to authenticated;

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  inquiry_number text not null unique,
  title text not null,
  slug text not null unique,
  primary_question text not null,
  short_question text,
  why_it_matters text not null,
  status text not null default 'draft' check (status in ('draft', 'open', 'active', 'paused', 'closed')),
  visibility text not null default 'internal' check (visibility in ('internal', 'private', 'public')),
  owner_id uuid default auth.uid(),
  summary text,
  current_understanding text,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inquiry_notes (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.inquiries(id) on delete cascade,
  note_type text not null check (note_type in ('known_known', 'known_unknown', 'unknown_unknown', 'memory', 'open_question', 'decision_note')),
  title text,
  body text not null,
  confidence text not null default 'medium' check (confidence in ('low', 'medium', 'high')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.evidence_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  evidence_type text not null check (
    evidence_type in (
      'internal_memory',
      'book_reference',
      'field_note',
      'article',
      'official_documentation',
      'academic_paper',
      'chart_record',
      'release_metadata',
      'track_metadata',
      'artist_metadata',
      'contributor_memory',
      'correction',
      'interview',
      'video',
      'screenshot',
      'product_test',
      'technical_test'
    )
  ),
  source_url text,
  source_file text,
  source_note text,
  summary text not null,
  main_claim text,
  why_it_matters text,
  reliability text not null default 'medium' check (reliability in ('low', 'medium', 'high')),
  confidence text not null default 'medium' check (confidence in ('low', 'medium', 'high')),
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed', 'reviewed', 'approved', 'disputed', 'rejected')),
  retrieval_status text not null default 'excluded' check (retrieval_status in ('excluded', 'review_only', 'default_retrieval')),
  created_by uuid default auth.uid(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint evidence_default_retrieval_requires_review check (
    retrieval_status <> 'default_retrieval'
    or review_status in ('reviewed', 'approved')
  )
);

create table if not exists public.inquiry_evidence (
  inquiry_id uuid not null references public.inquiries(id) on delete cascade,
  evidence_id uuid not null references public.evidence_items(id) on delete cascade,
  use_note text,
  added_by uuid default auth.uid(),
  added_at timestamptz not null default now(),
  primary key (inquiry_id, evidence_id)
);

create table if not exists public.cultural_entities (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (
    entity_type in ('artist', 'track', 'release', 'label', 'genre', 'place', 'scene', 'language', 'article', 'inquiry', 'memory', 'source')
  ),
  source_table text,
  source_id text,
  name text not null,
  slug text,
  description text,
  status text not null default 'active' check (status in ('active', 'draft', 'merged', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cultural_entities_source_pair check (
    (source_table is null and source_id is null)
    or (source_table is not null and source_id is not null)
  )
);

create unique index if not exists cultural_entities_source_unique_idx
  on public.cultural_entities (entity_type, source_table, source_id)
  where source_table is not null and source_id is not null;

create index if not exists cultural_entities_type_slug_idx
  on public.cultural_entities (entity_type, slug);

create table if not exists public.entity_relationships (
  id uuid primary key default gen_random_uuid(),
  source_entity_id uuid not null references public.cultural_entities(id) on delete cascade,
  target_entity_id uuid not null references public.cultural_entities(id) on delete cascade,
  relationship_type text not null check (
    relationship_type in (
      'collaborated_with',
      'appeared_on',
      'released_by',
      'produced_by',
      'belongs_to_scene',
      'connected_to_place',
      'uses_language',
      'charted_with',
      'mentioned_in',
      'remembered_for',
      'influenced_by',
      'influenced',
      'shares_context_with',
      'opened_question',
      'disputed_by',
      'corrected_by'
    )
  ),
  reason text not null,
  confidence text not null default 'low' check (confidence in ('low', 'medium', 'high')),
  review_status text not null default 'suggested' check (review_status in ('suggested', 'pending_review', 'approved', 'rejected', 'disputed')),
  public_safe boolean not null default false,
  created_by uuid default auth.uid(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entity_relationships_no_self_link check (source_entity_id <> target_entity_id)
);

create index if not exists entity_relationships_source_idx
  on public.entity_relationships (source_entity_id, review_status, updated_at desc);

create index if not exists entity_relationships_target_idx
  on public.entity_relationships (target_entity_id, review_status, updated_at desc);

create table if not exists public.relationship_evidence (
  relationship_id uuid not null references public.entity_relationships(id) on delete cascade,
  evidence_id uuid not null references public.evidence_items(id) on delete cascade,
  support_type text not null default 'supports' check (support_type in ('supports', 'challenges', 'contextualizes')),
  note text,
  primary key (relationship_id, evidence_id, support_type)
);

create table if not exists public.contributors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  display_name text not null,
  role_note text,
  contributor_status text not null default 'invited' check (contributor_status in ('invited', 'active', 'paused', 'blocked')),
  trust_level text not null default 'new' check (trust_level in ('new', 'known', 'trusted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists contributors_user_unique_idx
  on public.contributors (user_id)
  where user_id is not null;

create table if not exists public.contributor_submissions (
  id uuid primary key default gen_random_uuid(),
  contributor_id uuid not null references public.contributors(id) on delete cascade,
  inquiry_id uuid references public.inquiries(id) on delete set null,
  entity_id uuid references public.cultural_entities(id) on delete set null,
  submission_type text not null check (submission_type in ('memory', 'evidence', 'relationship_suggestion', 'correction', 'context_note')),
  title text,
  body text not null,
  source_url text,
  source_note text,
  consent_status text not null default 'internal_use' check (consent_status in ('private', 'internal_use', 'public_review_allowed')),
  review_status text not null default 'submitted' check (
    review_status in (
      'submitted',
      'triaged',
      'needs_source',
      'needs_clarification',
      'accepted_as_memory',
      'accepted_as_evidence',
      'accepted_as_relationship_context',
      'rejected',
      'merged',
      'archived'
    )
  ),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  accepted_evidence_id uuid references public.evidence_items(id) on delete set null,
  accepted_relationship_id uuid references public.entity_relationships(id) on delete set null,
  correction_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contributor_submissions_inquiry_idx
  on public.contributor_submissions (inquiry_id, review_status, created_at desc);

create index if not exists contributor_submissions_entity_idx
  on public.contributor_submissions (entity_id, review_status, created_at desc);

create table if not exists public.review_decisions (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (
    subject_type in ('relationship', 'evidence', 'surface_draft', 'ai_run', 'correction', 'claim', 'contributor_submission')
  ),
  subject_id uuid not null,
  decision text not null check (
    decision in (
      'approved',
      'rejected',
      'needs_more_evidence',
      'needs_rewrite',
      'too_vague',
      'overclaims',
      'internal_only',
      'duplicate',
      'accepted_as_memory',
      'accepted_as_evidence'
    )
  ),
  reason text not null,
  reviewer_id uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists review_decisions_subject_idx
  on public.review_decisions (subject_type, subject_id, created_at desc);

create table if not exists public.surface_drafts (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid references public.inquiries(id) on delete set null,
  entity_id uuid references public.cultural_entities(id) on delete set null,
  surface_type text not null check (surface_type in ('artist_orientation', 'start_here', 'relationship_reason', 'community_question')),
  draft_title text,
  draft_body text not null,
  ai_run_id uuid,
  review_status text not null default 'draft' check (review_status in ('draft', 'pending_review', 'approved', 'rejected', 'revised')),
  public_safe boolean not null default false,
  created_by uuid default auth.uid(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint surface_draft_has_scope check (inquiry_id is not null or entity_id is not null)
);

create index if not exists surface_drafts_entity_idx
  on public.surface_drafts (entity_id, surface_type, review_status, updated_at desc);

create table if not exists public.corrections (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('inquiry', 'evidence', 'relationship', 'draft', 'surface', 'entity', 'contributor_submission')),
  subject_id uuid not null,
  correction_text text not null,
  correction_status text not null default 'submitted' check (correction_status in ('submitted', 'accepted', 'rejected', 'unresolved')),
  submitted_by uuid default auth.uid(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);

alter table public.contributor_submissions
  drop constraint if exists contributor_submissions_correction_fk;

alter table public.contributor_submissions
  add constraint contributor_submissions_correction_fk
  foreign key (correction_id)
  references public.corrections(id)
  on delete set null;

create index if not exists corrections_subject_idx
  on public.corrections (subject_type, subject_id, created_at desc);

create table if not exists public.memory_embeddings (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('inquiry', 'evidence', 'relationship', 'surface_draft', 'correction', 'field_note', 'contributor_submission')),
  source_id uuid not null,
  content text not null,
  embedding vector,
  metadata jsonb not null default '{}'::jsonb,
  retrieval_status text not null default 'excluded' check (retrieval_status in ('excluded', 'review_only', 'default_retrieval')),
  created_at timestamptz not null default now()
);

create index if not exists memory_embeddings_source_idx
  on public.memory_embeddings (source_type, source_id);

create index if not exists memory_embeddings_retrieval_idx
  on public.memory_embeddings (retrieval_status, created_at desc);

alter table public.inquiries enable row level security;
alter table public.inquiry_notes enable row level security;
alter table public.evidence_items enable row level security;
alter table public.inquiry_evidence enable row level security;
alter table public.cultural_entities enable row level security;
alter table public.entity_relationships enable row level security;
alter table public.relationship_evidence enable row level security;
alter table public.contributors enable row level security;
alter table public.contributor_submissions enable row level security;
alter table public.review_decisions enable row level security;
alter table public.surface_drafts enable row level security;
alter table public.corrections enable row level security;
alter table public.memory_embeddings enable row level security;

drop policy if exists inquiries_admin_select on public.inquiries;
create policy inquiries_admin_select on public.inquiries
  for select to authenticated
  using (public.institute_can_read());

drop policy if exists inquiries_admin_insert on public.inquiries;
create policy inquiries_admin_insert on public.inquiries
  for insert to authenticated
  with check (public.institute_can_manage());

drop policy if exists inquiries_admin_update on public.inquiries;
create policy inquiries_admin_update on public.inquiries
  for update to authenticated
  using (public.institute_can_manage())
  with check (public.institute_can_manage());

drop policy if exists inquiry_notes_admin_select on public.inquiry_notes;
create policy inquiry_notes_admin_select on public.inquiry_notes
  for select to authenticated
  using (public.institute_can_read());

drop policy if exists inquiry_notes_admin_insert on public.inquiry_notes;
create policy inquiry_notes_admin_insert on public.inquiry_notes
  for insert to authenticated
  with check (public.institute_can_manage());

drop policy if exists inquiry_notes_admin_update on public.inquiry_notes;
create policy inquiry_notes_admin_update on public.inquiry_notes
  for update to authenticated
  using (public.institute_can_manage())
  with check (public.institute_can_manage());

drop policy if exists evidence_items_admin_select on public.evidence_items;
create policy evidence_items_admin_select on public.evidence_items
  for select to authenticated
  using (public.institute_can_read());

drop policy if exists evidence_items_admin_insert on public.evidence_items;
create policy evidence_items_admin_insert on public.evidence_items
  for insert to authenticated
  with check (public.institute_can_manage());

drop policy if exists evidence_items_admin_update on public.evidence_items;
create policy evidence_items_admin_update on public.evidence_items
  for update to authenticated
  using (public.institute_can_review())
  with check (public.institute_can_review());

drop policy if exists inquiry_evidence_admin_select on public.inquiry_evidence;
create policy inquiry_evidence_admin_select on public.inquiry_evidence
  for select to authenticated
  using (public.institute_can_read());

drop policy if exists inquiry_evidence_admin_insert on public.inquiry_evidence;
create policy inquiry_evidence_admin_insert on public.inquiry_evidence
  for insert to authenticated
  with check (public.institute_can_manage());

drop policy if exists inquiry_evidence_admin_delete on public.inquiry_evidence;
create policy inquiry_evidence_admin_delete on public.inquiry_evidence
  for delete to authenticated
  using (public.institute_can_manage());

drop policy if exists cultural_entities_admin_select on public.cultural_entities;
create policy cultural_entities_admin_select on public.cultural_entities
  for select to authenticated
  using (public.institute_can_read());

drop policy if exists cultural_entities_admin_insert on public.cultural_entities;
create policy cultural_entities_admin_insert on public.cultural_entities
  for insert to authenticated
  with check (public.institute_can_manage());

drop policy if exists cultural_entities_admin_update on public.cultural_entities;
create policy cultural_entities_admin_update on public.cultural_entities
  for update to authenticated
  using (public.institute_can_manage())
  with check (public.institute_can_manage());

drop policy if exists entity_relationships_admin_select on public.entity_relationships;
create policy entity_relationships_admin_select on public.entity_relationships
  for select to authenticated
  using (public.institute_can_read());

drop policy if exists entity_relationships_admin_insert on public.entity_relationships;
create policy entity_relationships_admin_insert on public.entity_relationships
  for insert to authenticated
  with check (public.institute_can_manage());

drop policy if exists entity_relationships_admin_update on public.entity_relationships;
create policy entity_relationships_admin_update on public.entity_relationships
  for update to authenticated
  using (public.institute_can_review())
  with check (public.institute_can_review());

drop policy if exists relationship_evidence_admin_select on public.relationship_evidence;
create policy relationship_evidence_admin_select on public.relationship_evidence
  for select to authenticated
  using (public.institute_can_read());

drop policy if exists relationship_evidence_admin_insert on public.relationship_evidence;
create policy relationship_evidence_admin_insert on public.relationship_evidence
  for insert to authenticated
  with check (public.institute_can_manage());

drop policy if exists relationship_evidence_admin_delete on public.relationship_evidence;
create policy relationship_evidence_admin_delete on public.relationship_evidence
  for delete to authenticated
  using (public.institute_can_manage());

drop policy if exists contributors_admin_select on public.contributors;
create policy contributors_admin_select on public.contributors
  for select to authenticated
  using (public.institute_can_read());

drop policy if exists contributors_own_select on public.contributors;
create policy contributors_own_select on public.contributors
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists contributors_admin_insert on public.contributors;
create policy contributors_admin_insert on public.contributors
  for insert to authenticated
  with check (public.institute_can_manage() or user_id = auth.uid());

drop policy if exists contributors_admin_update on public.contributors;
create policy contributors_admin_update on public.contributors
  for update to authenticated
  using (public.institute_can_review())
  with check (public.institute_can_review());

drop policy if exists contributor_submissions_admin_select on public.contributor_submissions;
create policy contributor_submissions_admin_select on public.contributor_submissions
  for select to authenticated
  using (public.institute_can_read());

drop policy if exists contributor_submissions_own_select on public.contributor_submissions;
create policy contributor_submissions_own_select on public.contributor_submissions
  for select to authenticated
  using (
    exists (
      select 1
      from public.contributors c
      where c.id = contributor_submissions.contributor_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists contributor_submissions_insert on public.contributor_submissions;
create policy contributor_submissions_insert on public.contributor_submissions
  for insert to authenticated
  with check (
    public.institute_can_manage()
    or (
      review_status = 'submitted'
      and exists (
        select 1
        from public.contributors c
        where c.id = contributor_id
          and c.user_id = auth.uid()
          and c.contributor_status in ('invited', 'active')
      )
    )
  );

drop policy if exists contributor_submissions_admin_update on public.contributor_submissions;
create policy contributor_submissions_admin_update on public.contributor_submissions
  for update to authenticated
  using (public.institute_can_review())
  with check (public.institute_can_review());

drop policy if exists review_decisions_admin_select on public.review_decisions;
create policy review_decisions_admin_select on public.review_decisions
  for select to authenticated
  using (public.institute_can_read());

drop policy if exists review_decisions_admin_insert on public.review_decisions;
create policy review_decisions_admin_insert on public.review_decisions
  for insert to authenticated
  with check (public.institute_can_review());

drop policy if exists surface_drafts_admin_select on public.surface_drafts;
create policy surface_drafts_admin_select on public.surface_drafts
  for select to authenticated
  using (public.institute_can_read());

drop policy if exists surface_drafts_admin_insert on public.surface_drafts;
create policy surface_drafts_admin_insert on public.surface_drafts
  for insert to authenticated
  with check (public.institute_can_manage());

drop policy if exists surface_drafts_admin_update on public.surface_drafts;
create policy surface_drafts_admin_update on public.surface_drafts
  for update to authenticated
  using (public.institute_can_review())
  with check (public.institute_can_review());

drop policy if exists corrections_admin_select on public.corrections;
create policy corrections_admin_select on public.corrections
  for select to authenticated
  using (public.institute_can_read());

drop policy if exists corrections_own_select on public.corrections;
create policy corrections_own_select on public.corrections
  for select to authenticated
  using (submitted_by = auth.uid());

drop policy if exists corrections_insert on public.corrections;
create policy corrections_insert on public.corrections
  for insert to authenticated
  with check (public.institute_can_manage() or submitted_by = auth.uid());

drop policy if exists corrections_admin_update on public.corrections;
create policy corrections_admin_update on public.corrections
  for update to authenticated
  using (public.institute_can_review())
  with check (public.institute_can_review());

drop policy if exists memory_embeddings_admin_select on public.memory_embeddings;
create policy memory_embeddings_admin_select on public.memory_embeddings
  for select to authenticated
  using (public.institute_can_read());

drop policy if exists memory_embeddings_admin_insert on public.memory_embeddings;
create policy memory_embeddings_admin_insert on public.memory_embeddings
  for insert to authenticated
  with check (public.institute_can_manage());

drop policy if exists memory_embeddings_admin_update on public.memory_embeddings;
create policy memory_embeddings_admin_update on public.memory_embeddings
  for update to authenticated
  using (public.institute_can_manage())
  with check (public.institute_can_manage());

grant select, insert, update on public.inquiries to authenticated;
grant select, insert, update on public.inquiry_notes to authenticated;
grant select, insert, update on public.evidence_items to authenticated;
grant select, insert, delete on public.inquiry_evidence to authenticated;
grant select, insert, update on public.cultural_entities to authenticated;
grant select, insert, update on public.entity_relationships to authenticated;
grant select, insert, delete on public.relationship_evidence to authenticated;
grant select, insert, update on public.contributors to authenticated;
grant select, insert, update on public.contributor_submissions to authenticated;
grant select, insert on public.review_decisions to authenticated;
grant select, insert, update on public.surface_drafts to authenticated;
grant select, insert, update on public.corrections to authenticated;
grant select, insert, update on public.memory_embeddings to authenticated;
