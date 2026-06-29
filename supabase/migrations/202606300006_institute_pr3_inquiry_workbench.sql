create extension if not exists pgcrypto;

create table if not exists public.inquiry_entities (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.inquiries(id) on delete cascade,
  entity_id uuid not null references public.cultural_entities(id) on delete restrict,
  entity_role text not null default 'related_subject' check (
    entity_role in (
      'primary_subject',
      'related_subject',
      'context',
      'place',
      'scene',
      'language',
      'source'
    )
  ),
  link_note text,
  added_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (inquiry_id, entity_id, entity_role)
);

create index if not exists inquiry_entities_inquiry_idx
  on public.inquiry_entities (inquiry_id, entity_role, created_at desc);

create index if not exists inquiry_entities_entity_idx
  on public.inquiry_entities (entity_id, created_at desc);

alter table public.inquiry_entities enable row level security;

drop policy if exists inquiry_entities_admin_select on public.inquiry_entities;
create policy inquiry_entities_admin_select on public.inquiry_entities
  for select to authenticated
  using (public.institute_can_read());

drop policy if exists inquiry_entities_admin_insert on public.inquiry_entities;
create policy inquiry_entities_admin_insert on public.inquiry_entities
  for insert to authenticated
  with check (public.institute_can_manage());

drop policy if exists inquiry_entities_admin_update on public.inquiry_entities;
create policy inquiry_entities_admin_update on public.inquiry_entities
  for update to authenticated
  using (public.institute_can_manage())
  with check (public.institute_can_manage());

drop policy if exists inquiry_entities_admin_delete on public.inquiry_entities;
create policy inquiry_entities_admin_delete on public.inquiry_entities
  for delete to authenticated
  using (public.institute_can_manage());

grant select, insert, update, delete on public.inquiry_entities to authenticated;
