-- Registry Knowledge PR2: relationship foundation
--
-- Additive only. Existing readers and writers continue to use the legacy
-- slug and relationship columns. This migration adds the institutional
-- judgment fields required by the Registry Knowledge Contract and performs
-- safe canonical-ID backfills for entity types that already have typed
-- Registry tables.

alter table public.registry_entity_relationships
  add column if not exists source_entity_id uuid,
  add column if not exists target_entity_id uuid,
  add column if not exists plain_reason text,
  add column if not exists review_status text not null default 'unreviewed',
  add column if not exists public_safe boolean not null default false,
  add column if not exists valid_from date,
  add column if not exists valid_to date,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text,
  add column if not exists status_reason text,
  add column if not exists superseded_by_relationship_id uuid references public.registry_entity_relationships(id) on delete set null,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

-- Keep lifecycle status and review status separate.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'registry_entity_relationships_review_status_check'
  ) then
    alter table public.registry_entity_relationships
      add constraint registry_entity_relationships_review_status_check
      check (review_status in (
        'unreviewed',
        'pending_review',
        'approved',
        'rejected',
        'disputed',
        'superseded'
      )) not valid;
  end if;
end $$;

alter table public.registry_entity_relationships
  validate constraint registry_entity_relationships_review_status_check;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'registry_entity_relationships_valid_period_check'
  ) then
    alter table public.registry_entity_relationships
      add constraint registry_entity_relationships_valid_period_check
      check (valid_to is null or valid_from is null or valid_to >= valid_from) not valid;
  end if;
end $$;

alter table public.registry_entity_relationships
  validate constraint registry_entity_relationships_valid_period_check;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'registry_entity_relationships_review_fields_check'
  ) then
    alter table public.registry_entity_relationships
      add constraint registry_entity_relationships_review_fields_check
      check (
        review_status not in ('approved', 'rejected', 'disputed', 'superseded')
        or reviewed_at is not null
      ) not valid;
  end if;
end $$;

alter table public.registry_entity_relationships
  validate constraint registry_entity_relationships_review_fields_check;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'registry_entity_relationships_supersession_check'
  ) then
    alter table public.registry_entity_relationships
      add constraint registry_entity_relationships_supersession_check
      check (
        review_status <> 'superseded'
        or superseded_by_relationship_id is not null
      ) not valid;
  end if;
end $$;

alter table public.registry_entity_relationships
  validate constraint registry_entity_relationships_supersession_check;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'registry_entity_relationships_public_safe_check'
  ) then
    alter table public.registry_entity_relationships
      add constraint registry_entity_relationships_public_safe_check
      check (
        public_safe = false
        or (
          review_status = 'approved'
          and relationship_status = 'active'
          and reviewed_at is not null
        )
      ) not valid;
  end if;
end $$;

alter table public.registry_entity_relationships
  validate constraint registry_entity_relationships_public_safe_check;

-- Safe canonical-ID backfills. Slugs remain in place for compatibility.
update public.registry_entity_relationships rel
set source_entity_id = entity_row.id
from public.registry_artists entity_row
where rel.source_entity_id is null
  and rel.source_entity_type = 'artist'
  and entity_row.slug = rel.source_slug;

update public.registry_entity_relationships rel
set source_entity_id = entity_row.id
from public.registry_tracks entity_row
where rel.source_entity_id is null
  and rel.source_entity_type = 'track'
  and entity_row.slug = rel.source_slug;

update public.registry_entity_relationships rel
set source_entity_id = entity_row.id
from public.registry_releases entity_row
where rel.source_entity_id is null
  and rel.source_entity_type = 'release'
  and entity_row.slug = rel.source_slug;

update public.registry_entity_relationships rel
set source_entity_id = entity_row.id
from public.registry_labels entity_row
where rel.source_entity_id is null
  and rel.source_entity_type = 'label'
  and entity_row.slug = rel.source_slug;

update public.registry_entity_relationships rel
set source_entity_id = entity_row.id
from public.registry_genres entity_row
where rel.source_entity_id is null
  and rel.source_entity_type = 'genre'
  and entity_row.slug = rel.source_slug;

update public.registry_entity_relationships rel
set target_entity_id = entity_row.id
from public.registry_artists entity_row
where rel.target_entity_id is null
  and rel.target_entity_type = 'artist'
  and entity_row.slug = rel.target_slug;

update public.registry_entity_relationships rel
set target_entity_id = entity_row.id
from public.registry_tracks entity_row
where rel.target_entity_id is null
  and rel.target_entity_type = 'track'
  and entity_row.slug = rel.target_slug;

update public.registry_entity_relationships rel
set target_entity_id = entity_row.id
from public.registry_releases entity_row
where rel.target_entity_id is null
  and rel.target_entity_type = 'release'
  and entity_row.slug = rel.target_slug;

update public.registry_entity_relationships rel
set target_entity_id = entity_row.id
from public.registry_labels entity_row
where rel.target_entity_id is null
  and rel.target_entity_type = 'label'
  and entity_row.slug = rel.target_slug;

update public.registry_entity_relationships rel
set target_entity_id = entity_row.id
from public.registry_genres entity_row
where rel.target_entity_id is null
  and rel.target_entity_type = 'genre'
  and entity_row.slug = rel.target_slug;

-- Existing rows were imported or derived before the review model existed.
-- They remain usable, but they are not silently declared reviewed or public-safe.
update public.registry_entity_relationships
set review_status = 'unreviewed'
where review_status is null;

create index if not exists registry_entity_relationships_source_id_idx
  on public.registry_entity_relationships(source_entity_id)
  where source_entity_id is not null;

create index if not exists registry_entity_relationships_target_id_idx
  on public.registry_entity_relationships(target_entity_id)
  where target_entity_id is not null;

create index if not exists registry_entity_relationships_review_queue_idx
  on public.registry_entity_relationships(review_status, relationship_type, updated_at desc);

create index if not exists registry_entity_relationships_public_safe_idx
  on public.registry_entity_relationships(relationship_type, updated_at desc)
  where public_safe = true and review_status = 'approved' and relationship_status = 'active';

create index if not exists registry_entity_relationships_superseded_by_idx
  on public.registry_entity_relationships(superseded_by_relationship_id)
  where superseded_by_relationship_id is not null;

comment on column public.registry_entity_relationships.source_entity_id is
  'Canonical Registry entity UUID where the typed source table exposes one. Slug remains for compatibility.';

comment on column public.registry_entity_relationships.target_entity_id is
  'Canonical Registry entity UUID where the typed target table exposes one. Slug remains for compatibility.';

comment on column public.registry_entity_relationships.review_status is
  'Human review state, separate from relationship lifecycle status.';

comment on column public.registry_entity_relationships.public_safe is
  'True only when an approved relationship may be used on public surfaces.';

comment on column public.registry_entity_relationships.plain_reason is
  'Plain-language explanation of why the relationship is asserted.';

comment on table public.registry_entity_relationships is
  'Registry-owned flexible cultural relationship graph. Typed structural relationships remain authoritative in their dedicated Registry join tables.';
