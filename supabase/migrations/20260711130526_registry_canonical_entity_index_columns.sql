alter table public.cultural_entities
  add column if not exists canonical_source_table text,
  add column if not exists canonical_source_id uuid,
  add column if not exists review_status text not null default 'unreviewed',
  add column if not exists public_safe boolean not null default false,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;;
