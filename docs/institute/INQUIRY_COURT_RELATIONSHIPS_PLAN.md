# Relationship Mapper Plan: Tables Proposal

Status: Proposal awaiting JB approval. No mapper code will be written before the schema decision.
Follows: INQUIRY_COURT_INSPECTION_NOTE.md, INQUIRY_COURT_SPRINT_ADDENDUM.md
Date: 2026-07-05

## What this is, in plain language

The Relationship Mapper needs somewhere to keep relationships once a human accepts them. Candidates already have a home (`institute_assistant_suggestions` rows with type `relationship_lead`); accepted relationships do not. One new table gives them one: a relationship is a judgment with a reason, evidence behind it, and a review trail, not a decorative link.

## Learned Adjustment

Original plan:
The brief implies relationship candidate storage plus accepted relationship storage as new infrastructure.

Finding:
Candidates already fit the suggestions table (typed `relationship_lead`, with evidence source references, confidence, review statuses). Only the accepted record lacks a home. The registry has its own relationship tables for canonical music data, but Institute relationships span culture objects (people, works, places, scenes, events, evidence, claims, inquiries) and carry review state; forcing them into registry tables would distort both.

Decision:
One new table, `institute_relationships`, holding accepted (and later superseded) relationships. Candidates stay in the suggestions pipeline. Accepting a `relationship_lead` creates a row here, marks the suggestion accepted, and writes a learning event.

Logic:
Smallest schema that preserves doctrine: relationships as cultural logic with reasons and evidence, candidates never silently becoming records.

Risk:
A second relationship vocabulary next to the registry's. Mitigated: `source_system` and entity slugs let a future bridge map Institute relationships onto registry entities without guessing.

Approval:
JB approval needed before implementation (new table).

Rollback:
Drop the table; suggestion rows and events remain the audit trail.

## Draft migration (for review, not applied)

```sql
-- 2026070X0001_institute_relationships.sql
create table if not exists public.institute_relationships (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.institute_inquiries(id) on delete cascade,
  source_entity_type text not null check (source_entity_type in (
    'artist','track','release','label','genre','scene','place','event',
    'institution','person','work','contributor_memory','evidence_item','claim','inquiry')),
  source_entity_label text not null,
  source_entity_slug text,
  target_entity_type text not null check (target_entity_type in (
    'artist','track','release','label','genre','scene','place','event',
    'institution','person','work','contributor_memory','evidence_item','claim','inquiry')),
  target_entity_label text not null,
  target_entity_slug text,
  relationship_kind text not null,
  plain_reason text not null,
  confidence_band text not null default 'partly_supported' check (confidence_band in
    ('well_supported','partly_supported','thin_support')),
  evidence_refs jsonb not null default '[]'::jsonb,
  source_suggestion_id uuid references public.institute_assistant_suggestions(id) on delete set null,
  status text not null default 'accepted' check (status in ('accepted','superseded','withdrawn_with_reason')),
  status_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(source_entity_label)) > 0),
  check (length(trim(target_entity_label)) > 0),
  check (length(trim(plain_reason)) > 3)
);

-- updated_at trigger, indexes on (inquiry_id, created_at desc) and
-- (source_entity_type, source_entity_slug), RLS copied exactly from the
-- institute pattern: read = institute_read, insert/update = institute_write,
-- delete = institute_admin. Grants match the other institute tables.
-- No hard-delete path in services; withdrawn_with_reason keeps the record.
```

Notes baked into the shape:
- `plain_reason` is not nullable and has a length check: a link without a reason is not a relationship.
- `confidence_band` is the human three-band scale, not a numeric score.
- `evidence_refs` carries the evidence item ids the relationship stands on.
- No numeric cultural quality anywhere.

Verification queries (run after applying):

```sql
select count(*) from public.institute_relationships;              -- expect 0
-- insert without plain_reason should fail (check constraint)
-- select a row as a non-institute role should return nothing (RLS)
```

## What follows once approved

PR 6 (mapper): relationship_mapper job already fits the enum from PR 2's migration; a review queue surface on the unlocked `relationships` screen; accept/edit/reject/fork actions; manual creation second; learning events. PR 7 (forks) and PR 8 (claims + audited shim backfill) will come as their own proposals in this same format.

## Approvals requested

1. The `institute_relationships` table as drafted (or amendments).
2. Confirmation that candidates staying in the suggestions pipeline (no separate candidates table) matches your intent.
