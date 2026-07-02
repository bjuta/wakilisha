create table if not exists public.institute_work_product_links (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.institute_inquiries(id) on delete cascade,
  product_type text not null check (product_type in ('article')),
  format_label text not null default 'Article',
  product_id uuid not null,
  product_slug text not null,
  status text not null default 'draft' check (
    status in (
      'draft',
      'in_progress',
      'submitted_for_review',
      'approved',
      'rejected',
      'published',
      'archived'
    )
  ),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (inquiry_id, product_type, format_label)
);

drop trigger if exists institute_work_product_links_set_updated_at on public.institute_work_product_links;
create trigger institute_work_product_links_set_updated_at
before update on public.institute_work_product_links
for each row execute function public.institute_set_updated_at();

create index if not exists institute_work_product_links_inquiry_idx
  on public.institute_work_product_links(inquiry_id, product_type);

create index if not exists institute_work_product_links_product_idx
  on public.institute_work_product_links(product_type, product_id);

alter table public.institute_work_product_links enable row level security;

drop policy if exists institute_work_product_links_select on public.institute_work_product_links;
create policy institute_work_product_links_select
on public.institute_work_product_links
for select
to authenticated
using (
  public.current_user_is_administrator()
  or public.current_user_has_capability('institute_read')
  or public.current_user_has_capability('institute_write')
  or public.current_user_has_capability('institute_review')
);

drop policy if exists institute_work_product_links_insert on public.institute_work_product_links;
create policy institute_work_product_links_insert
on public.institute_work_product_links
for insert
to authenticated
with check (
  public.current_user_is_administrator()
  or public.current_user_has_capability('institute_write')
);

drop policy if exists institute_work_product_links_update on public.institute_work_product_links;
create policy institute_work_product_links_update
on public.institute_work_product_links
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

drop policy if exists institute_work_product_links_delete on public.institute_work_product_links;
create policy institute_work_product_links_delete
on public.institute_work_product_links
for delete
to authenticated
using (
  public.current_user_is_administrator()
  or public.current_user_has_capability('institute_admin')
);

grant select, insert, update, delete on public.institute_work_product_links to authenticated;
