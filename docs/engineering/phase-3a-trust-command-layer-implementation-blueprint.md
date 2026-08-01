# Phase 3A Trust Command Layer Implementation Blueprint

## Objective

Implement the complete synchronous transactional command layer over the Phase 3A trust identity and attachment foundations.

## Migration

Planned migration:

`20260801120000_phase_3a_trust_command_layer.sql`

## Verifier

Planned verifier:

`scripts/control-plane/verify-phase-3a-trust-command-layer.sql`

## Command inventory

### Source

- `public.create_source`
- `public.save_source_version`
- `public.submit_source_version_for_review`
- `public.review_source_version`
- `public.withdraw_source`
- `public.restore_source`

### Citation

- `public.create_citation`
- `public.attach_article_version_citation`
- `public.replace_article_version_citations`

### Credit

- `public.create_external_contributor`
- `public.update_external_contributor`
- `public.create_credit`
- `public.set_credit_governance`
- `public.attach_article_version_credit`
- `public.replace_article_version_credits`

## Common function shape

Every public command must be:

- PL/pgSQL
- `SECURITY DEFINER`
- configured with a fixed safe `search_path`
- explicit about required caller authority
- explicit about `auth.uid()` requirements
- callable by `authenticated` and `service_role`
- unavailable to `public` and `anon`

Every command must use schema-qualified table and function names.

## Authorization matrix

| Command family | Capability | Additional authority |
|---|---|---|
| Source create and edit | `manage_sources` | None |
| Source submit | `manage_sources` | None |
| Source review | `review_sources` | None |
| Source withdraw and restore | `withdraw_sources` | None |
| Citation create | `manage_citations` | None |
| Citation attach and replace | `manage_citations` | Article edit authority |
| Contributor and Credit create | `manage_credits` | None |
| Credit governance | `manage_credits` | None |
| Credit attach and replace | `manage_credits` | Article edit authority |

Administrator and service role remain accepted through the existing authorization helpers and explicit service-role branch.

## Transaction pattern for Article attachment replacement

1. Reject unauthenticated non-service calls.
2. Check the required trust capability.
3. Validate that the payload is a JSON array.
4. Resolve the immutable Article version.
5. Resolve its `resource_id`.
6. Check `editorial.current_user_can_edit_article(resource_id)`.
7. Insert the trust-revision row if absent.
8. Lock the trust-revision row `FOR UPDATE`.
9. Compare the expected family revision.
10. Parse requested rows with ordinality.
11. Validate every row before deletion.
12. Reject duplicates and non-contiguous order.
13. Delete only the matching Article version attachment family.
14. Insert the complete validated set.
15. Increment only the relevant family revision.
16. Return the resulting revision and ordered rows.

All steps occur in one function transaction.

## Empty replacement

`[]` is valid.

It removes every attachment in that family for the specified Article version and increments that family revision once.

## Citation payload

Each replacement item must carry:

- `citation_id`
- `citation_purpose`
- `target_anchor_type`
- `target_anchor_data`
- `public_safe`
- `display_order`

Validation must use:

- `editorial.validate_citation_target_anchor`
- active Citation state
- Citation public-safe eligibility when requested
- duplicate identity protection
- duplicate order protection

## Credit payload

Each replacement item must carry:

- `credit_id`
- `is_primary`
- `public_safe`
- `display_order`

Validation must enforce:

- active Credit governance
- public-safe governance eligibility when requested
- duplicate Credit protection
- duplicate order protection
- at most one primary author

## Source lifecycle

Source-version review must lock both the Source and reviewed Source version.

Approval updates the Source current-approved-version pointer atomically.

Withdrawal must write all required actor, timestamp, reason, and public-mode fields.

Restore clears withdrawal metadata and returns the Source to the approved internal review state defined by the schema design.

## Credit creation

`public.create_credit` must:

- require exactly one credited-party UUID
- resolve the selected authority without fallback name matching
- snapshot the display name
- snapshot Registry author slug when applicable in `registry_author_slug_snapshot`
- snapshot authenticated-user username where available in `user_username_snapshot`
- use `role_label_snapshot` only for the explicit role-label override
- snapshot authenticated username internally when applicable
- validate the Credit role
- insert the immutable Credit
- insert governance revision 1
- return Credit ID and governance revision

## Citation lifecycle

Migration 3 must not automatically retire Citations when an attachment is removed.

The transaction-local lifecycle gate created by Migration 2 remains unused until an explicit approved retirement command requires it.

## Verification requirements

The verifier must prove:

- all 15 functions exist
- every command is `SECURITY DEFINER`
- every command has a fixed search path
- `public` and `anon` cannot execute any command
- `authenticated` and `service_role` can execute every command
- no authenticated direct write grants exist on trust tables
- capability names appear in the correct command definitions
- Article attachment commands call Article edit authority
- replacement commands lock trust revisions
- replacement commands compare expected revisions
- Citation replacement changes only Citation revision
- Credit replacement changes only Credit revision
- empty arrays are accepted
- malformed payloads are rejected
- duplicate identities are rejected
- duplicate orders are rejected
- non-contiguous orders are rejected
- failed replacement rolls back attachments and revision
- Source lifecycle writes review events
- Credit creation creates governance
- Migration 1 and Migration 2 verifiers still pass

## Rollback rehearsal

Before commit, execute the migration and verifier inside one linked transaction and roll it back.

After rollback:

- none of the 15 commands may exist
- the remote migration ledger must remain unchanged
- Migration 1 and Migration 2 production objects must remain intact

## Production boundary

No production apply before:

- structural audit passes
- linked rollback rehearsal passes
- exact migration diff is reviewed
- critical tests pass
- PR is merged
