# Relationship Mapper Schema Plan

Status: Approved by JB with amendments, 2026-07-05. All six required amendments are
reflected below; this is the implementation contract for the migration and the mapper.
Supersedes the earlier draft in this file.

## 1. Product reason

A relationship at the Institute is a judgment, not a link: this artist shaped that scene, this track answered that moment, and here is why, standing on this evidence. The assistant already produces relationship candidates (`relationship_lead` suggestions from the Evidence Reader and, next, the Relationship Mapper job), but an accepted relationship has nowhere to live. Without a home, accepted relationships would either stay trapped in the suggestions table (candidates and records blurred together) or leak into registry tables built for canonical music metadata, not reviewed cultural judgments. One new table keeps the doctrine clean: candidates in the pipeline, records in the record.

## 2. Table columns

One table: `public.institute_relationships`.

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | Row id |
| inquiry_id | uuid | no | | The inquiry this judgment belongs to |
| source_entity_type | text | no | | What kind of thing the relationship starts from |
| source_entity_label | text | no | | Human name, exactly as written |
| source_entity_slug | text | yes | | Registry slug when the entity exists in the registry |
| target_entity_type | text | no | | What kind of thing it points to |
| target_entity_label | text | no | | Human name |
| target_entity_slug | text | yes | | Registry slug when known |
| relationship_kind | text | no | | Short human phrase: "mentored", "answered", "grew out of" |
| plain_reason | text | no | | The why, in plain language. A link without a reason is not a relationship |
| confidence_band | text | no | 'partly_supported' | Human three-band scale, never a number |
| evidence_refs | jsonb | no | '[]' | Array of {type:"evidence_item", id} the judgment stands on |
| source_suggestion_id | uuid | yes | | The assistant candidate this came from, when it did |
| status | text | no | 'accepted' | accepted, superseded, withdrawn_with_reason |
| status_reason | text | yes | | Enforced by DB check when status leaves accepted (amendment 2) |
| superseded_by_relationship_id | uuid | yes | | The better judgment that replaced this one; FK to this table, on delete set null (amendment 3) |
| created_by | uuid | yes | | Reviewer who accepted it |
| updated_by | uuid | yes | | Reviewer who last changed it; written by the service on every status change (amendment 4) |
| status_changed_at | timestamptz | yes | | When the status last changed; written by the service on every status change (amendment 4) |
| created_at / updated_at | timestamptz | no | now() | Standard, with the house updated_at trigger |

Entity type vocabulary (both source and target): artist, track, release, label, genre, scene, place, event, institution, person, work, contributor_memory, evidence_item, claim, inquiry.

## 3. Constraints

- Check: entity types limited to the vocabulary above (both columns).
- Check: `length(trim(source_entity_label)) > 0`, same for target.
- Check: `length(trim(relationship_kind)) > 0`.
- Check: `length(trim(plain_reason)) > 3` (the database itself refuses reasonless links).
- Check (amendment 1, evidence is not optional): `jsonb_typeof(evidence_refs) = 'array' and jsonb_array_length(evidence_refs) > 0`. A candidate without evidence stays a suggestion or a doubt; it never becomes an accepted relationship.
- Check (amendment 2, reasons enforced by the database): `status not in ('superseded','withdrawn_with_reason') or length(trim(coalesce(status_reason, ''))) > 3`.
- Check (amendment 3, superseded rows point forward): `status <> 'superseded' or superseded_by_relationship_id is not null`.
- Check: `confidence_band in ('well_supported','partly_supported','thin_support')`.
- Check: `status in ('accepted','superseded','withdrawn_with_reason')`.
- FK: inquiry_id -> institute_inquiries on delete cascade; source_suggestion_id -> institute_assistant_suggestions on delete set null; superseded_by_relationship_id -> institute_relationships on delete set null; created_by and updated_by -> auth.users on delete set null.
- Indexes: (inquiry_id, created_at desc); (source_entity_type, source_entity_slug); (target_entity_type, target_entity_slug).
- Duplicate guard (amendment 5), a partial unique index over standing relationships only:

```sql
create unique index institute_relationships_one_standing
on public.institute_relationships (
  inquiry_id,
  source_entity_type,
  lower(coalesce(nullif(trim(source_entity_slug), ''), trim(source_entity_label))),
  target_entity_type,
  lower(coalesce(nullif(trim(target_entity_slug), ''), trim(target_entity_label))),
  lower(trim(relationship_kind))
) where status = 'accepted';
```

Superseded and withdrawn rows fall outside the index and remain as history.

## 4. RLS

Copied exactly from the institute house pattern, no new capabilities:

- select: `institute_read` (or administrator)
- insert: `institute_write`
- update: `institute_write` (status changes are updates; superseding and withdrawing are writes with reasons)
- delete: `institute_admin` only (and no service code path calls it)

Grants: select, insert, update to authenticated (delete only via institute_admin policy), matching the other institute tables.

## 5. Write paths

Three, all human-initiated, all in one frontend service (`relationshipService.ts`):

1. Accept a candidate: takes a `relationship_lead` suggestion, requires the human to confirm or edit the kind and plain_reason, inserts the row with `source_suggestion_id`, marks the suggestion accepted, writes a `relationship_accepted` learning event.
2. Create manually: same fields without a suggestion; manual creation is the escape hatch, second in the UI, never hidden.
3. Change status: supersede or withdraw with a required reason; updates status, status_reason, `updated_by`, and `status_changed_at`, and for supersession also `superseded_by_relationship_id` (the replacement must exist first, so the service creates the new judgment and then supersedes the old one, pointing at it). Writes a `relationship_status_changed` learning event. No hard delete exists in service code.

The Edge Function never writes this table. The engine keeps writing only runs and suggestions.

## 6. Review states

- Candidate states live on the suggestion row as today: suggested, accepted, edited_and_accepted, rejected, saved_as_doubt.
- Record states live on this table: `accepted` (standing), `superseded` (a better judgment replaced it; the old row stays readable), `withdrawn_with_reason` (we no longer stand behind it; the reason stays).
- Nothing on this table is ever public-facing in this sprint; public exposure remains gated behind the review desk and future public-safe work.

## 7. Rollback

- Feature rollback: remove the mapper UI entry points; the table becomes dormant, RLS-protected data.
- Schema rollback: `drop table public.institute_relationships;` loses only accepted-relationship rows; every candidate, decision, and learning event survives in the suggestions and events tables, so the judgments can be reconstructed by re-accepting.
- The migration touches no existing table, so there is nothing else to unwind.

## 8. Verification SQL

```sql
-- after applying
select count(*) from public.institute_relationships;          -- expect 0

-- Deliberate failure probes. Use a real inquiry id and one real evidence id.
-- Every statement below must FAIL with a check or unique violation.

-- a valid seed insert for the probes that need an existing row:
insert into public.institute_relationships
  (inquiry_id, source_entity_type, source_entity_label, target_entity_type,
   target_entity_label, relationship_kind, plain_reason, evidence_refs)
values ('<inquiry>', 'artist', 'Test Artist', 'scene', 'Test Scene', 'shaped',
        'Verification seed row', '[{"type":"evidence_item","id":"<evidence>"}]');

-- 1. reason too short
-- insert ... plain_reason = '' ...;

-- 2. bad entity type
-- insert ... source_entity_type = 'banana' ...;

-- 3. numeric confidence band rejected
-- insert ... confidence_band = '87' ...;

-- 4. empty evidence_refs rejected (amendment 1)
-- insert ... evidence_refs = '[]' ...;

-- 5. non-array evidence_refs rejected (amendment 1)
-- insert ... evidence_refs = '{"type":"evidence_item"}' ...;

-- 6. superseded with no status_reason rejected (amendment 2)
-- update public.institute_relationships set status = 'superseded',
--   superseded_by_relationship_id = id where plain_reason = 'Verification seed row';

-- 7. withdrawn with no status_reason rejected (amendment 2)
-- update ... set status = 'withdrawn_with_reason' ...;

-- 8. superseded with no superseded_by_relationship_id rejected (amendment 3)
-- update ... set status = 'superseded', status_reason = 'A better judgment exists' ...;

-- 9. duplicate standing relationship rejected (amendment 5)
-- insert the seed row values a second time; expect unique violation on
-- institute_relationships_one_standing.

-- cleanup: delete the seed row (admin), or leave it superseded via a valid update.

-- RLS check: as a viewer-role user, select should return rows (institute_read);
-- insert should be refused (no institute_write).

-- existing tables untouched
select count(*) from public.institute_assistant_suggestions;   -- unchanged before vs after
```

## 9. What UI will read and write

- Read: the unlocked Relationships screen in the inquiry interface (candidate queue on top, accepted relationships below, each card showing kind, both entities, the why, the confidence band as words, and its evidence links); How This Learned gains a relationships group fed by the new learning events.
- Write: only the Relationships screen, through `relationshipService.ts` (the three paths in section 5). The Workbench and Evidence panels keep only their existing suggestion-decision writes.
- The dead registry-side `mockRelationships` viewer stays untouched; this is Institute-side.

## 10. What the assistant can suggest but not decide

- Suggest: relationship candidates (source, target, kind, reason, confidence, contradictions, recommended action) via the `relationship_mapper` job, which is already in the deployed task enum; the Evidence Reader keeps producing `relationship_lead` suggestions per evidence item.
- Not decide: nothing the assistant produces touches `institute_relationships`. Acceptance, editing, supersession, and withdrawal are human actions through RLS-gated writes with `created_by` stamped. The Edge Function has no code path to this table, enforced the same way as today and guarded by the existing no-canonical-writes test discipline.

## Approval record

Approved by JB on 2026-07-05 with six required amendments, all reflected above:

1. Evidence cannot be empty: DB checks force evidence_refs to be a non-empty array (section 3).
2. Status reasons enforced by the database, not only service code (section 3).
3. Superseded rows point to the better judgment via superseded_by_relationship_id, DB-enforced (sections 2 and 3).
4. updated_by and status_changed_at actor columns, written by the service on every status change (sections 2 and 5).
5. Duplicate guard: partial unique index over standing accepted relationships (section 3).
6. Verification SQL includes deliberate failure probes for every new rule (section 8).

Also confirmed: candidates stay in the suggestions pipeline (no separate candidates table); superseded and withdrawn rows stay readable forever; no hard delete in service code; the Edge Function never writes this table; confidence stays word-based. Relationship Mapper implementation may proceed against this contract.
