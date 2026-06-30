-- BOOK4.1: Question Lineage Foundation
-- Preserves the path from raw curiosity to current working question.

create table if not exists public.question_versions (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.inquiries(id) on delete cascade,
  version_number integer not null,
  question_text text not null,
  change_reason text not null,
  change_type text not null default 'manual_refinement',
  is_current boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint question_versions_question_text_not_blank check (length(btrim(question_text)) > 0),
  constraint question_versions_change_reason_not_blank check (length(btrim(change_reason)) > 0),
  constraint question_versions_version_number_positive check (version_number > 0),
  constraint question_versions_unique_inquiry_version unique (inquiry_id, version_number)
);

create index if not exists question_versions_inquiry_id_idx
  on public.question_versions (inquiry_id);

create index if not exists question_versions_inquiry_current_idx
  on public.question_versions (inquiry_id, is_current);

create unique index if not exists question_versions_one_current_per_inquiry_idx
  on public.question_versions (inquiry_id)
  where is_current;

alter table public.question_versions enable row level security;

drop policy if exists question_versions_admin_select on public.question_versions;
create policy question_versions_admin_select on public.question_versions
  for select to authenticated
  using (auth.role() = 'authenticated');

drop policy if exists question_versions_admin_insert on public.question_versions;
create policy question_versions_admin_insert on public.question_versions
  for insert to authenticated
  with check (auth.role() = 'authenticated');

drop policy if exists question_versions_admin_update on public.question_versions;
create policy question_versions_admin_update on public.question_versions
  for update to authenticated
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

grant select, insert, update on public.question_versions to authenticated;

insert into public.question_versions (
  inquiry_id,
  version_number,
  question_text,
  change_reason,
  change_type,
  is_current,
  created_by,
  created_at,
  metadata
)
select
  inquiries.id,
  1,
  inquiries.primary_question,
  'Initial question preserved during BOOK4.1 lineage migration.',
  'migration_backfill',
  true,
  inquiries.owner_id,
  inquiries.created_at,
  jsonb_build_object('source', 'book4_1_backfill')
from public.inquiries
where length(btrim(inquiries.primary_question)) > 0
on conflict (inquiry_id, version_number) do nothing;
