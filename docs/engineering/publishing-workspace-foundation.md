# Publishing workspace foundation

## Status

QPR4A establishes the governed operational domain for Publishing.

It does not replace canonical editors, Article review authority, Article
scheduling, or Article publication authority.

## Ownership boundary

Publishing owns:

- operational title and brief
- production stage
- planning state
- priority
- owner and internal assignments
- production deadline
- planned publication time
- intended distribution channels
- append-only operational history

Canonical resources own:

- content bodies
- immutable editorial versions
- submitted versions
- approval decisions
- scheduled Article versions
- published Article versions
- public publication snapshots

## State axes

### Production stage

- idea
- assigned
- producing
- production_review
- revisions
- ready

### Editorial authority

Derived from the linked canonical resource:

- not_linked
- draft
- submitted
- changes_requested
- approved
- published

### Publication state

Derived from planning state and canonical publication truth:

- unscheduled
- scheduled
- paused
- published
- dropped
- archived

A planned publication date is not proof that a linked Article is scheduled.
The governed Article schedule remains authoritative.

## Concurrency

Every Publishing item has a monotonic `record_version`.

Every mutation RPC requires the expected current version. Stale writes fail
with `STALE_PUBLISHING_ITEM_VERSION`.

## Permissions

`view_publishing_dashboard` grants broad read access.

`manage_publishing` grants operational mutation authority and is initially
assigned to Administrator and Editor roles.

Owners, creators, and assignees may read their own Publishing items even when
they do not have broad Publishing access.

Authenticated clients receive SELECT access only. Important writes use
governed RPCs.

Derived editorial and publication states enforce the same item-level read
authority before returning canonical or operational state.

## Canonical-resource linking

Publishing items may begin without a canonical resource.

A resource may be linked later when the controlled content kind supports that
resource kind.

Once linked, the resource cannot be removed or retargeted.

Only one non-archived Publishing item may be linked to a canonical resource.

## Typed client boundary

The Publishing client service reads the governed workspace view and controlled
lookup tables through generated database types.

Every operational write calls a governed Publishing RPC. The service does not
insert, update, or delete Publishing tables directly.

The Publishing service does not schedule, publish, unpublish, approve, or
change canonical Article versions.

## No automatic backfill

QPR4A does not create Publishing items for existing Articles, Guides,
Playlists, Registry records, or historical content.

A later preview-and-apply process will define explicit backfill inclusion
rules.

## Deferred work

QPR4A does not introduce:

- campaigns
- series
- templates
- tasks
- dependencies
- forms
- dashboards
- saved personal views
- workflow automations
- performance reporting
