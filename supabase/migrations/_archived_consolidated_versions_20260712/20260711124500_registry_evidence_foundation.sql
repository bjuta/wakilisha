create table if not exists public.registry_relationship_evidence (
  relationship_id uuid not null
    references public.registry_entity_relationships(id) on delete cascade,

  evidence_id uuid not null
    references public.evidence_items(id) on delete cascade,

  support_type text not null default 'supports'
    check (
      support_type in (
        'supports',
        'challenges',
        'contextualizes'
      )
    ),

  note text,

  created_by uuid
    references auth.users(id) on delete set null
    default auth.uid(),

  created_at timestamptz not null default now(),

  primary key (
    relationship_id,
    evidence_id,
    support_type
  )
);

comment on table public.registry_relationship_evidence is
  'Links shared evidence items to Registry relationships without replacing legacy relationship evidence links.';

comment on column public.registry_relationship_evidence.support_type is
  'States whether the evidence supports, challenges, or contextualizes the relationship.';

create index if not exists registry_relationship_evidence_evidence_idx
  on public.registry_relationship_evidence (
    evidence_id,
    created_at desc
  );

create index if not exists registry_relationship_evidence_relationship_idx
  on public.registry_relationship_evidence (
    relationship_id,
    created_at desc
  );

alter table public.registry_relationship_evidence
  enable row level security;

drop policy if exists registry_relationship_evidence_select
  on public.registry_relationship_evidence;

create policy registry_relationship_evidence_select
on public.registry_relationship_evidence
for select
to authenticated
using (
  public.institute_can_read()
);

drop policy if exists registry_relationship_evidence_insert
  on public.registry_relationship_evidence;

create policy registry_relationship_evidence_insert
on public.registry_relationship_evidence
for insert
to authenticated
with check (
  public.institute_can_manage()
);

drop policy if exists registry_relationship_evidence_delete
  on public.registry_relationship_evidence;

create policy registry_relationship_evidence_delete
on public.registry_relationship_evidence
for delete
to authenticated
using (
  public.institute_can_manage()
);

grant select, insert, delete
  on public.registry_relationship_evidence
  to authenticated;
