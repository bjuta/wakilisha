-- PR6: Canonical Registry entity index.
-- Hardens cultural_entities as the cross-cultural identity layer while keeping
-- music-specific Registry tables authoritative for their own records.

alter table public.cultural_entities
  add column if not exists canonical_source_table text,
  add column if not exists canonical_source_id uuid,
  add column if not exists review_status text not null default 'unreviewed',
  add column if not exists public_safe boolean not null default false,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.cultural_entities
  add constraint cultural_entities_entity_type_check
  check (entity_type in (
    'artist','track','release','label','genre',
    'person','scene','place','event','institution','work','concept',
    'language','movement','publication','organization'
  )) not valid;

alter table public.cultural_entities
  validate constraint cultural_entities_entity_type_check;

alter table public.cultural_entities
  add constraint cultural_entities_status_check
  check (status in ('draft','active','archived','merged')) not valid;

alter table public.cultural_entities
  validate constraint cultural_entities_status_check;

alter table public.cultural_entities
  add constraint cultural_entities_review_status_check
  check (review_status in ('unreviewed','pending_review','approved','rejected','disputed','superseded'));

alter table public.cultural_entities
  add constraint cultural_entities_canonical_pointer_check
  check (
    (canonical_source_table is null and canonical_source_id is null)
    or
    (canonical_source_table is not null and canonical_source_id is not null)
  );

alter table public.cultural_entities
  add constraint cultural_entities_public_safe_check
  check (
    public_safe = false
    or (
      review_status = 'approved'
      and status = 'active'
      and reviewed_at is not null
      and nullif(btrim(description), '') is not null
    )
  );

create unique index if not exists cultural_entities_canonical_source_uidx
  on public.cultural_entities (canonical_source_table, canonical_source_id)
  where canonical_source_table is not null and canonical_source_id is not null;

create unique index if not exists cultural_entities_type_slug_uidx
  on public.cultural_entities (entity_type, slug)
  where slug is not null and btrim(slug) <> '' and status <> 'merged';

create index if not exists cultural_entities_review_queue_idx
  on public.cultural_entities (review_status, public_safe, updated_at desc);

create or replace view public.registry_entity_index
with (security_invoker = true)
as
select
  a.id as entity_id,
  'artist'::text as entity_type,
  a.display_name as name,
  a.slug,
  a.bio as description,
  a.status,
  'registry_artists'::text as canonical_source_table,
  a.id as canonical_source_id,
  (a.status = 'active') as public_safe,
  'authoritative'::text as review_status
from public.registry_artists a
union all
select
  t.id,
  'track'::text,
  t.title,
  t.slug,
  null::text,
  t.status,
  'registry_tracks'::text,
  t.id,
  (t.status = 'active'),
  'authoritative'::text
from public.registry_tracks t
union all
select
  r.id,
  'release'::text,
  r.title,
  r.slug,
  r.description,
  r.status,
  'registry_releases'::text,
  r.id,
  (r.status = 'active'),
  'authoritative'::text
from public.registry_releases r
union all
select
  l.id,
  'label'::text,
  l.name,
  l.slug,
  l.description,
  l.status,
  'registry_labels'::text,
  l.id,
  (l.status = 'active'),
  'authoritative'::text
from public.registry_labels l
union all
select
  g.id,
  'genre'::text,
  g.name,
  g.slug,
  g.description,
  g.status,
  'registry_genres'::text,
  g.id,
  (g.status = 'active'),
  'authoritative'::text
from public.registry_genres g
union all
select
  c.id,
  c.entity_type,
  c.name,
  c.slug,
  c.description,
  c.status,
  coalesce(c.canonical_source_table, 'cultural_entities'::text),
  coalesce(c.canonical_source_id, c.id),
  c.public_safe,
  c.review_status
from public.cultural_entities c
where c.status <> 'merged';

comment on view public.registry_entity_index is
  'Canonical read index across music Registry entities and broader reviewed cultural entities. Source tables remain authoritative.';
