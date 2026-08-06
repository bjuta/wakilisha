# Phase 4A administrative Media read cutover

Date: 6 August 2026

## Status

Consolidated administrative-read implementation.

The public application Media read lane is closed.

This package removes the remaining non-legacy direct Media reads in one boundary. It does not split the work into per-call migrations.

Phase 4A remains open.

## Accepted discovery

The remaining compatibility-table perimeter before this package is:

- 28 direct calls across six files
- 19 selects
- six updates
- one insert
- one delete
- one upsert
- seven admin UI calls
- one admin service call
- eleven compatibility-service calls
- nine WordPress legacy-import calls

Runtime consumers include the Media Library, image editor, Article admin service, Inquiry record detail, broken-link audit and the deployed WordPress migration function.

## Decision

Create one authenticated administrative Media read adapter:

`public.read_media_assets_admin_v2(jsonb)`

The adapter:

- requires existing Media read authority
- grants no anonymous execution
- returns allowlisted compatibility-era fields needed by current admin screens
- includes canonical logical identity and usage context when available
- supports IDs, URLs, source keys, current Media Library filters, pagination and deterministic ordering
- optionally returns the existing eleven user-facing reference relationships
- does not mutate Media data
- does not change compatibility policies, grants or foreign keys

## Frontend cutover

The consolidated frontend adapter serves:

- Article admin inline caption enrichment
- Floating Image Toolbar lookup by ID or URL
- broken-link listing and metadata pre-read
- Media Library list, ID and URL reads
- Media edit and delete pre-reads
- Media metadata merge pre-read
- reference inspection

## Resulting direct-call perimeter

After this package:

- public or unclassified calls: zero
- admin UI calls: three direct calls
- admin service calls: zero
- compatibility-service calls: five direct writes
- legacy-import calls: nine
- total direct calls: seventeen across four files

The remaining direct calls are two frozen Institute reads, write authority or the deployed legacy migration application.

## Preserved behavior

This package preserves:

- Media Library filters and pagination
- current compatibility metadata
- existing Media IDs and URLs
- editor caption and alt-text behavior
- image toolbar ID backfill
- Inquiry Media summaries
- broken-link check history
- delete warning references
- upload behavior
- same-path image replacement behavior
- direct metadata and status writes
- hard deletion behavior
- WordPress migration behavior

The preserved write behavior remains Phase 4A debt and is not approved as the final authority.

## Explicit non-decisions

This package does not:

- create file objects or asset revisions
- create derivatives
- stop same-path overwrite
- change upload
- change metadata or status commands
- change archive, restore or delete authority
- change WordPress migration
- modify the frozen Institute inquiry interface
- tighten compatibility policies or grants
- remove foreign keys
- close Phase 4A
- update Readdy

## Deployment order

The SQL function is additive.

The preparation driver validates the migration through a transaction that rolls back.

The apply phase:

1. applies the additive SQL migration
2. verifies production
3. regenerates live schema types and baseline
4. validates the complete frontend
5. opens one implementation PR

The SQL function may exist unused before the frontend PR merges. That is the intentional rollback boundary.

## Rollback

Before SQL application, delete the branch.

After SQL application but before frontend merge, leave the unused additive function in place or remove it through a forward migration.

After frontend deployment, revert the frontend PR and deploy the previous build. The additive function can remain until a forward cleanup migration proves no consumer.
