create table if not exists public.institute_review_packets (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.institute_inquiries(id) on delete cascade,
  packet_version integer not null default 1 check (packet_version > 0),
  status text not null default 'submitted' check (
    status in (
      'submitted',
      'under_review',
      'changes_requested',
      'approved_for_promotion',
      'accepted_for_internal_memory',
      'rejected',
      'withdrawn'
    )
  ),
  submitted_by uuid references auth.users(id) on delete set null default auth.uid(),
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  editor_decision text,
  editor_notes text,
  contributor_note text,
  snapshot_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (inquiry_id, packet_version)
);

drop trigger if exists institute_review_packets_set_updated_at on public.institute_review_packets;
create trigger institute_review_packets_set_updated_at
before update on public.institute_review_packets
for each row execute function public.institute_set_updated_at();

create index if not exists institute_review_packets_inquiry_idx
  on public.institute_review_packets(inquiry_id, submitted_at desc);

create index if not exists institute_review_packets_status_idx
  on public.institute_review_packets(status, submitted_at desc);

alter table public.institute_review_packets enable row level security;

drop policy if exists institute_review_packets_select on public.institute_review_packets;
create policy institute_review_packets_select
on public.institute_review_packets
for select
to authenticated
using (
  public.current_user_is_administrator()
  or public.current_user_has_capability('institute_read')
  or public.current_user_has_capability('institute_review')
);

drop policy if exists institute_review_packets_insert on public.institute_review_packets;
create policy institute_review_packets_insert
on public.institute_review_packets
for insert
to authenticated
with check (
  public.current_user_is_administrator()
  or public.current_user_has_capability('institute_write')
);

drop policy if exists institute_review_packets_update on public.institute_review_packets;
create policy institute_review_packets_update
on public.institute_review_packets
for update
to authenticated
using (
  public.current_user_is_administrator()
  or public.current_user_has_capability('institute_review')
)
with check (
  public.current_user_is_administrator()
  or public.current_user_has_capability('institute_review')
);

drop policy if exists institute_review_packets_delete on public.institute_review_packets;
create policy institute_review_packets_delete
on public.institute_review_packets
for delete
to authenticated
using (
  public.current_user_is_administrator()
  or public.current_user_has_capability('institute_admin')
);

grant select, insert, update, delete on public.institute_review_packets to authenticated;
