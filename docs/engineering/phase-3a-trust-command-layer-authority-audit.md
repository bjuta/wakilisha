# Phase 3A Trust Command Layer Authority Audit

## Status

Authority audit complete.

No command-layer migration has been applied.

No production data has been changed.

## Production baseline

Phase 3A Migration 1 and Migration 2 are applied and verified.

The following trust tables contain zero rows:

- `editorial.sources`
- `editorial.source_versions`
- `editorial.credits`
- `editorial.citations`
- `editorial.resource_citations`
- `editorial.resource_credits`
- `editorial.article_version_trust_revisions`

Migration 3 therefore has no legacy trust records to migrate, transform, or reconcile.

## Canonical command scope

Migration 3 must implement all 15 transactional commands defined by the approved schema design.

### Source commands

1. `public.create_source`
2. `public.save_source_version`
3. `public.submit_source_version_for_review`
4. `public.review_source_version`
5. `public.withdraw_source`
6. `public.restore_source`

### Citation commands

7. `public.create_citation`
8. `public.attach_article_version_citation`
9. `public.replace_article_version_citations`

### Credit commands

10. `public.create_external_contributor`
11. `public.update_external_contributor`
12. `public.create_credit`
13. `public.set_credit_governance`
14. `public.attach_article_version_credit`
15. `public.replace_article_version_credits`

A partial command layer is rejected because the first Article proof path requires reviewed Sources, Citations, Credits, external contributors, governance, and Article-version attachment replacement.

## Proven authorization authority

The repository and production database already provide:

- `public.current_user_is_administrator()`
- `public.current_user_has_capability(text)`
- `editorial.current_user_can_edit_article(uuid)`

The Phase 3A capabilities already exist:

- `manage_sources`
- `review_sources`
- `withdraw_sources`
- `manage_citations`
- `manage_credits`
- `view_trust_records`

Commands must explicitly check their required capability.

Article attachment commands must additionally call:

`editorial.current_user_can_edit_article(resource_id)`

Trust capability alone must never grant Article edit authority.

Article edit authority alone must never grant Citation or Credit management authority.

## Proven RPC security convention

Canonical mutators use:

- `SECURITY DEFINER`
- a fixed explicit `search_path`
- explicit caller checks inside the function
- `auth.uid()` for authenticated actor snapshots
- service-role allowance where server operation is required
- `REVOKE ALL` from `public` and `anon`
- `GRANT EXECUTE` to `authenticated` and `service_role`

No command may grant direct authenticated mutation privileges on canonical trust tables.

## Source command authority

Source creation and version editing require `manage_sources`.

Source review requires `review_sources`.

Source withdrawal and restoration require `withdraw_sources`.

Review, withdrawal, and restoration must write the canonical Source review-event history established by Migration 1.

Source-version approval must update the Source pointer atomically.

Withdrawal must preserve existing historical Citations while preventing new public-safe Citation creation.

Restoration must return the Source to an internal reviewable state. It must not silently reapprove a prior Source version.

## Citation command authority

Citation creation requires `manage_citations`.

Citation identity is immutable after creation.

The existing lifecycle trigger permits only trusted:

- `active` to `withdrawn`
- `active` to `archived`

Migration 3 does not add an independent Citation retirement RPC because the approved design does not define one.

Article Citation replacement replaces attachments only. It does not automatically archive or withdraw detached Citation identities.

Citation retirement remains reserved for a later explicit command contract or a proven Source-governance requirement.

## Credit command authority

External-contributor creation and update require `manage_credits`.

Credit creation requires exactly one credited-party identity.

Credit identity is immutable.

Credit governance is mutable only through `public.set_credit_governance`.

Credit identity snapshots are distinct:

- `display_name_snapshot` stores the resolved credited name
- `role_label_snapshot` stores only an explicit role-label override
- `registry_author_slug_snapshot` stores the Registry-author slug where applicable
- `user_username_snapshot` stores the authenticated-user username where available

Article Credit replacement changes attachments only. It does not mutate Credit identity or governance.

## Article-version attachment authority

The canonical concurrency row is:

`editorial.article_version_trust_revisions`

Before replacement, a command must:

1. resolve the Article version
2. resolve its Article resource
3. verify the relevant trust capability
4. verify Article edit authority
5. create the trust-revision row if absent
6. lock it with `FOR UPDATE`
7. compare the expected family revision
8. validate the complete requested set before mutation

Citation replacement increments only `citation_revision`.

Credit replacement increments only `credit_revision`.

Empty replacement arrays are allowed and mean remove the complete attachment family for that Article version.

Replacement payloads must reject:

- non-array JSON
- malformed entries
- missing required keys
- duplicate identities
- duplicate order values
- negative order values
- non-contiguous order values
- invalid target anchors
- inactive or ineligible identities
- more than one primary author Credit

Failure must leave both the attachment set and revision unchanged.

## Single-attachment command authority

The two single-attachment commands remain part of the approved design.

They must use the same trust-revision lock as the complete replacement commands.

They must append deterministically and increment the relevant family revision exactly once.

They are not the canonical UI save path. Complete replacement remains the canonical Article Workspace save operation.

## Correlation identifiers

Replacement commands accept an optional correlation UUID.

Migration 3 must preserve it in command audit metadata where an existing suitable audit authority is available.

Migration 3 must not introduce a second general command bus or duplicate the Phase 1B command and outbox platform.

## Return contract

Create commands return the newly created canonical identity and required revision information.

Replacement commands return JSON containing:

- Article version ID
- resulting revision
- ordered attachment rows

The returned order must match persisted `display_order`.

## Audit authority

Source lifecycle commands write `editorial.source_review_events`.

Canonical rows store actor UUID snapshots in their existing actor fields.

Migration 3 must not write unrelated administrative audit tables merely to manufacture an additional event history.

The trust-specific history already designed into Phase 3A remains authoritative.

## Grant boundary

All 15 public commands must:

- revoke execution from `public`
- revoke execution from `anon`
- grant execution to `authenticated`
- grant execution to `service_role`

Internal helper functions must not be executable by `anon` or `authenticated` unless explicitly required by an RLS policy.

## Explicit non-goals

Migration 3 must not:

- change Article content
- change Article ownership
- change Article lifecycle
- change Article version identity
- change legacy Article bylines
- change publication pointers
- change publication snapshots
- add frontend services
- add Edge Functions
- add public read models
- add correction or provenance authority
- add Playlist, Audio, or Video adoption
- grant direct authenticated table writes
