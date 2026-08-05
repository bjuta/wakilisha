# Phase 4A Migration 5A Legacy Compatibility Resolver

Date: 5 August 2026

## Status

Implementation package for transactional review.

This migration does not cut over frontend consumers, tighten compatibility policies, change foreign keys, or review 985 legacy assets individually.

## Problem

Phase 4A Migration 4 created 987 governed usage links:

- 985 active usages
- 2 archived historical usages

Every active usage is bound to an immutable legacy URL snapshot. Discovery proved:

- 985 active usage probes
- 985 resolver rejections
- 0 resolved usages
- 0 differences between immutable legacy snapshot URLs and current compatibility URLs

The resolver rejects these usages because the initial Migration 2 governance remains intentionally conservative:

- rights unknown
- consent unknown
- source protection internal
- public safety internal

The current website still delivers the same assets through `public.registry_media_assets`.

## Decision

Add one narrow legacy compatibility lane to `public.resolve_media_asset_delivery`.

An active `legacy_snapshot` usage may resolve through its immutable captured URL when all of these conditions hold:

1. The logical asset is active.
2. The usage is active and belongs to the supplied asset.
3. The usage has no asset revision.
4. No variant is requested.
5. The one-to-one legacy bridge exists.
6. The captured URL is nonblank.
7. The compatibility row remains active.
8. The current compatibility URL exactly matches the immutable captured URL.
9. Governance is either:
   - approved for normal public delivery, or
   - still the exact untouched Migration 2 baseline.

The untouched Migration 2 baseline is:

- governance version 1
- rights unknown
- consent unknown
- sensitivity none
- embargo none
- source protection internal
- preservation unassessed
- retention retain
- public safety internal
- the original Migration 2 internal reason

Any later governance change that is not fully approved blocks this compatibility lane.

## Safety boundary

This lane does not claim that rights or consent were reviewed.

It preserves the current public presentation while keeping canonical governance conservative.

The resolver still rejects:

- archived logical assets
- inactive or mismatched usages
- missing legacy snapshots
- changed compatibility URLs
- non-active compatibility rows
- requested variants for legacy snapshots
- active or scheduled embargoes
- later governance changes that are not approved
- blocked, restricted, or non-public governance

## Expected proof

Transactional validation must prove:

- active legacy usage count: 985
- resolved count: 985
- rejected count: 0
- legacy snapshot URL parity: 985
- compatibility URL parity: 985
- legacy resolution mode count: 985
- one legacy variant request blocks delivery
- one temporary compatibility URL change blocks delivery
- rollback leaves production unchanged

## Compatibility

This migration preserves:

- all 1,079 compatibility rows
- all 14 foreign keys
- existing policies and grants
- all 987 usage links
- all 3,147 Media events
- existing frontend output
- current storage files and paths

## Deployment

- SQL migration: required after review
- Edge Function deployment: not required
- frontend deployment: not required
- Readdy update: not required
- generated database types: unchanged because the RPC signature is unchanged
