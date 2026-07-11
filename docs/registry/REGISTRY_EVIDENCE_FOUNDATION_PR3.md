# PR3: Registry Evidence Foundation

## Purpose

This PR connects WAKILISHA's shared evidence authority to the Registry relationship authority without creating a new evidence system or rewriting legacy evidence links.

## Current production baseline

- `evidence_items`: 3 rows
- `evidence_review_events`: 5 rows
- `relationship_evidence`: 2 legacy links to `entity_relationships`
- `inquiry_evidence`: 3 legacy links to `inquiries`
- `registry_entity_relationships`: 6,468 rows
- `institute_evidence_items`: 0 rows

The existing shared evidence model is retained as authoritative. The missing piece is a direct bridge from `evidence_items` to `registry_entity_relationships`.

## Change

Create `registry_relationship_evidence` with:

- `relationship_id` referencing `registry_entity_relationships`
- `evidence_id` referencing `evidence_items`
- `support_type`: `supports`, `challenges`, or `contextualizes`
- optional note
- creator and timestamp
- composite primary key preventing duplicate support links
- RLS and authenticated grants

## Safety

This migration is additive.

It does not:

- alter existing evidence rows
- alter existing Registry relationships
- migrate the two legacy relationship-evidence links
- drop or rename old tables
- approve evidence
- mark evidence retrieval-safe
- expose evidence publicly
- change frontend or Edge Function behavior

## Rollback

Because the table has no automatic backfill, rollback before application use is:

```sql
drop table if exists public.registry_relationship_evidence;
```

Once product code begins writing links, export or migrate those rows before dropping the table.

## Verification

Run `scripts/registry/verify-registry-evidence-foundation.sql` after applying the migration.

The verification checks:

- new table row count
- preservation of shared evidence rows
- preservation of legacy relationship-evidence rows
- constraints and indexes
- RLS policies and grants
- zero orphaned relationship links
- zero orphaned evidence links

## Deployment

- SQL migration: required after merge
- Edge Function deploy: not required
- Readdy Finish update: not required
- Frontend deploy: not required
- Production data rewrite: none
