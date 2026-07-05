# Lineage and Forks Schema Plan

Status: Awaiting JB approval. No fork code before this schema is approved or amended.
Format: the ten-section review structure. Date: 2026-07-05.

## 1. Product reason

Forks protect the main inquiry from false neatness. When a question, a piece of evidence, a relationship, or a doubt reveals a second inquiry trying to get out, the honest move is to open it as its own inquiry with a recorded reason, not to force one blended answer. The clinic already flags should_fork and files possible-fork doubts; BOOK4 requires no fork without a source inquiry and a reason, and no merge without a review decision. What is missing is the object that ties parent and child together with that reason on the record.

## 2. Table columns

One table: `public.institute_inquiry_forks`.

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | Row id |
| source_inquiry_id | uuid | no | | The inquiry the fork grew out of |
| forked_inquiry_id | uuid | no | | The new inquiry; unique (a child has one origin) |
| fork_reason | text | no | | Why this deserves its own inquiry, plain language |
| fork_trigger_type | text | no | | What revealed it: question, evidence_item, relationship, claim, suggestion, editor_note, correction |
| fork_trigger_id | uuid | yes | | The specific record that revealed it, when one exists |
| fork_state | text | no | 'investigating' | draft, investigating, proposed_merge, merged, rejected, archived |
| state_reason | text | yes | | DB-enforced when state becomes merged, rejected, or archived |
| evidence_carry | text | no | 'none' | none, copied, moved: what happened to shared evidence |
| created_by | uuid | yes | | Who opened the fork |
| updated_by | uuid | yes | | Who last changed its state |
| state_changed_at | timestamptz | yes | | When the state last changed |
| created_at / updated_at | timestamptz | no | now() | Standard, with the house trigger |

## 3. Constraints

- Check: `length(trim(fork_reason)) > 3` (no fork without a reason, enforced by the database).
- Check: `fork_trigger_type in ('question','evidence_item','relationship','claim','suggestion','editor_note','correction')`.
- Check: `fork_state in ('draft','investigating','proposed_merge','merged','rejected','archived')`.
- Check: `evidence_carry in ('none','copied','moved')`.
- Check: `source_inquiry_id <> forked_inquiry_id`.
- Check (mirrors the relationships amendment): `fork_state not in ('merged','rejected','archived') or length(trim(coalesce(state_reason,''))) > 3`.
- Unique: `forked_inquiry_id` (one origin per child).
- FK: both inquiry columns -> institute_inquiries on delete cascade; created_by and updated_by -> auth.users on delete set null.
- Indexes: (source_inquiry_id, created_at desc); the unique on forked_inquiry_id covers child lookups.

## 4. RLS

House pattern verbatim: select `institute_read`; insert and update `institute_write`; delete `institute_admin` only, with no delete path in service code.

## 5. Write paths

All human, in one service (`forkService.ts`):

1. Open a fork: creates the child inquiry through the existing `createInstituteInquiry` path (raw question preserved as v1, the same as any inquiry), inserts the fork row with reason and trigger, and when evidence_carry is copied, copies chosen evidence items to the child as new rows marked with their origin in metadata (moved additionally sets the originals' review_state to "Kept as doubt" with a note; originals are never deleted). Writes a `fork_opened` learning event on both inquiries.
2. Change fork state: investigating to proposed_merge to merged, or rejected, or archived, with a DB-enforced reason for terminal states; sets updated_by and state_changed_at; writes `fork_state_changed` events on both inquiries. Merge is a review decision recorded here; nothing auto-merges content.
3. Accepting a clinic possible-fork doubt can prefill path 1; the suggestion is marked accepted only when the fork is actually opened.

The Edge Function never writes this table. The existing `lineage_fork_analyzer` job type (already in the deployed enum) will only ever file suggestions.

## 6. Review states

Fork states are the review states: draft, investigating, proposed_merge (asks for a review decision), merged, rejected, archived. Terminal states require reasons. Question-level lineage stays where it already lives, in `institute_question_versions`; this table adds the inquiry-to-inquiry edge.

## 7. Rollback

Feature: remove the Lineage and Forks screen entry points; the table goes dormant. Schema: drop the table; child inquiries remain ordinary inquiries with their full question lineage, and fork learning events survive in institute_events, so the trail is reconstructable.

## 8. Verification SQL

```sql
select count(*) from public.institute_inquiry_forks;   -- expect 0

-- each must FAIL:
-- fork with empty reason
-- fork with source = forked (self-fork)
-- second fork row for the same forked_inquiry_id (unique violation)
-- state merged with no state_reason
-- state rejected with no state_reason
-- fork_trigger_type = 'banana'
-- evidence_carry = 'duplicated'

-- RLS: viewer can select, cannot insert.
-- existing tables untouched: counts on institute_inquiries unchanged by migration.
```

## 9. What UI will read and write

- Read: a Lineage and Forks screen (unlocking the existing nav item) showing this inquiry's parent (when it is a child), its children with states and reasons, and the question lineage summary; How This Learned gains fork events in a lineage group.
- Write: only the Lineage and Forks screen through forkService (open fork, change state). The Clinic's possible-fork doubts gain an "Open as its own inquiry" action that routes here.

## 10. What the assistant can suggest but not decide

- Suggest: possible forks (already flowing from the clinic as doubts) and, later, `lineage_fork_analyzer` runs that flag when a question, evidence item, relationship, or claim should branch; all as suggestions.
- Not decide: opening a fork, carrying evidence, proposing a merge, and every state change are human actions. No assistant output touches this table.

## Approvals requested

1. The table as specified in sections 2 to 4, or amendments.
2. The evidence carry model (copied or moved, originals never deleted; moved originals become "Kept as doubt" with a note).
3. Confirmation that merge remains a recorded review decision only; no content auto-merge in this sprint.
