# Relationship Mapper Schema Plan

Status: Awaiting JB approval. No mapper code before this schema is approved or amended.
Supersedes the earlier draft in this file. Date: 2026-07-05.

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
| status_reason | text | yes | | Required in service code when status leaves accepted |
| created_by | uuid | yes | | Reviewer who accepted it |
| created_at / updated_at | timestamptz | no | now() | Standard, with the house updated_at trigger |

Entity type vocabulary (both source and target): artist, track, release, label, genre, scene, place, event, institution, person, work, contributor_memory, evidence_item, claim, inquiry.

## 3. Constraints

- Check: entity types limited to the vocabulary above (both columns).
- Check: `length(trim(source_entity_label)) > 0`, same for target.
- Check: `length(trim(relationship_kind)) > 0`.
- Check: `length(trim(plain_reason)) > 3` (the database itself refuses reasonless links).
- Check: `confidence_band in ('well_supported','partly_supported','thin_support')`.
- Check: `status in ('accepted','superseded','withdrawn_with_reason')`.
- FK: inquiry_id -> institute_inquiries on delete cascade; source_suggestion_id -> institute_assistant_suggestions on delete set null; created_by -> auth.users on delete set null.
- Indexes: (inquiry_id, created_at desc); (source_entity_type, source_entity_slug); (target_entity_type, target_entity_slug).

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
3. Change status: supersede or withdraw with a required reason; updates status and status_reason, writes a `relationship_status_changed` learning event. No hard delete exists in service code.

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

-- constraint checks (each should fail)
-- insert into public.institute_relationships (inquiry_id, source_entity_type, source_entity_label,
--   target_entity_type, target_entity_label, relationship_kind, plain_reason)
--   values ('<some-inquiry>', 'artist', 'A', 'scene', 'B', 'shaped', '');        -- reason too short
-- insert ... source_entity_type = 'banana' ...;                                  -- bad entity type
-- insert ... confidence_band = '87' ...;                                         -- numeric band rejected

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

## Approvals requested

1. The table as specified in sections 2 to 4 (or amendments).
2. Confirmation that candidates keep living in the suggestions pipeline; no separate candidates table.
3. Confirmation that superseded and withdrawn rows stay readable forever (no hard delete path).
