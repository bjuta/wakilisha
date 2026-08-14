create table if not exists public.institute_evidence_items (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.institute_inquiries(id) on delete cascade,
  evidence_kind text not null check (
    evidence_kind in (
      'WAKILISHA record',
      'Article',
      'Link',
      'Citation',
      'Audio',
      'Video',
      'Photo',
      'Interview',
      'Chart data',
      'Archive document',
      'Personal note'
    )
  ),
  title text not null,
  source text not null,
  source_url text,
  summary text not null,
  why_it_matters text not null,
  media_minutes numeric(10,2) not null default 0 check (media_minutes >= 0),
  review_state text not null default 'Draft' check (
    review_state in (
      'Draft',
      'Needs review',
      'Accepted for internal memory',
      'Public-safe candidate',
      'Needs more evidence',
      'Kept as doubt',
      'Rejected with reason'
    )
  ),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (length(trim(title)) > 0),
  check (length(trim(source)) > 0),
  check (length(trim(summary)) > 0),
  check (length(trim(why_it_matters)) > 0)
);

drop trigger if exists institute_evidence_items_set_updated_at on public.institute_evidence_items;
create trigger institute_evidence_items_set_updated_at
before update on public.institute_evidence_items
for each row execute function public.institute_set_updated_at();

create index if not exists institute_evidence_items_inquiry_idx
  on public.institute_evidence_items(inquiry_id, created_at desc)
  where deleted_at is null;

create index if not exists institute_evidence_items_review_state_idx
  on public.institute_evidence_items(review_state)
  where deleted_at is null;

alter table public.institute_evidence_items enable row level security;

drop policy if exists institute_evidence_items_select on public.institute_evidence_items;
create policy institute_evidence_items_select
on public.institute_evidence_items
for select
to authenticated
using (
  public.current_user_is_administrator()
  or public.current_user_has_capability('institute_read')
);

drop policy if exists institute_evidence_items_insert on public.institute_evidence_items;
create policy institute_evidence_items_insert
on public.institute_evidence_items
for insert
to authenticated
with check (
  public.current_user_is_administrator()
  or public.current_user_has_capability('institute_write')
);

drop policy if exists institute_evidence_items_update on public.institute_evidence_items;
create policy institute_evidence_items_update
on public.institute_evidence_items
for update
to authenticated
using (
  public.current_user_is_administrator()
  or public.current_user_has_capability('institute_write')
  or public.current_user_has_capability('institute_review')
)
with check (
  public.current_user_is_administrator()
  or public.current_user_has_capability('institute_write')
  or public.current_user_has_capability('institute_review')
);

drop policy if exists institute_evidence_items_delete on public.institute_evidence_items;
create policy institute_evidence_items_delete
on public.institute_evidence_items
for delete
to authenticated
using (
  public.current_user_is_administrator()
  or public.current_user_has_capability('institute_admin')
);

grant select, insert, update, delete on public.institute_evidence_items to authenticated;
