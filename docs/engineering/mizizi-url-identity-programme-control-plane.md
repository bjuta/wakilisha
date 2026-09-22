# MIZIZI URL-Identity Programme Control Plane

Date: 22 September 2026

Programme issue: #1013

Status: **PRODUCTION PARTIAL STOP ACCEPTED — 731 / 737 Release slug operations verified; six exact resume candidates remain; authority zero at rest**

## Purpose

The historical Track and Release Production control planes are immutable
anti-replay records for their accepted one-time applies. They are not the
permanent mutation surface for the resumed URL-identity programme.

The current programme therefore composes the already-accepted Stage B typed
broker and Stage C `mizizi_executor` transport through one new control plane.

It does not create a second mutation framework.

## Frozen Production candidate authority

The accepted full-corpus audit on rule set `1.2.0` proved:

- Track: 2,101 rows scanned, 66 blocked slug candidates, 495 observe-only
  findings. No automatic Track write is authorized.
- Release: 841 rows scanned, 737 deterministic provider-packaging slug
  candidates and 737 title observations.
- Chart: 1,800 rows scanned, 161 deterministic Track-slug projection repairs
  and 91 Artist-slug observations.
- Release taxonomy drift: zero.

Current candidate-set fingerprints:

- Release slug:
  `b96da159df4ffa8b19a5bb39574995a6b25cac2552823ef24af8f737fb1278be`;
- Chart Track slug:
  `28a3b8362f8721ad4f35045a2cd938d265adf35373b522b492054af80eb8a910`.

The fingerprints bind candidate identity, current/proposed value, canonical
scope and server-side state fingerprint. The current control plane reproduces
them through the private Stage B plan functions while connected as
`mizizi_executor`.

## Human approval boundary

The control plane cannot create standing MIZIZI authority.

Before apply, a real authenticated user with `manage_registry` must use the
existing public admin commands to:

1. enable exactly one requested stewardship operation; and
2. issue exactly one matching time-bounded MIZIZI capability grant.

The reviewed GitHub trigger binds the exact grant id, operation, capability,
candidate count and candidate fingerprint.

Apply refuses to start unless:

- exact merged `main` equals the reviewed trigger commit;
- the new authority-window-close migration is present in Production;
- exactly one active MIZIZI standing grant exists;
- it is the exact grant named by the trigger;
- its scope matches the exact operation;
- at least 30 minutes of grant lifetime remains;
- no active exact MIZIZI execution grant exists;
- the requested operation is enabled.

## Earned authority-reduction primitive

Existing human commands can open a stewardship window, but Stage C deliberately
gave `mizizi_executor` no direct private-table authority and no way to close
that human window.

Without a bounded close primitive, a successful automated run would have to
leave standing authority alive until expiry or bypass governance as an owner.
Neither is acceptable.

Migration
`20260922143000_mizizi_url_identity_authority_window_close_v1.sql` therefore
adds one narrow private function:

`mizizi_private.close_stewardship_authority_window_v1(text,uuid,text)`.

It can only reduce authority. It:

- requires the active `mizizi_executor` binding;
- accepts only the four existing Stage B stewardship operations;
- binds one exact human capability grant to its operation;
- refuses closure while an operation is in-flight or succeeded without
  verifier PASS;
- expires any unconsumed exact grants descended from that standing grant;
- disables the exact operation;
- expires the standing grant when it is still active;
- records the reduction in Registry audit history;
- cannot enable an operation or create a grant.

## Current apply surface

Only two automatic scopes are admitted by #1013:

- `release_slug` ->
  `registry.release_slug.canonicalize/v1`;
- `chart_track_slug` ->
  `registry.chart_track_slug.synchronize/v1`.

Track slug work is deliberately excluded because all 66 current cases are
blocked review work.

Release-title packaging and Chart Artist-slug findings remain observe-only.

## Failure behavior

Every apply run executes through JIT `mizizi_executor`.

The control plane attempts authority-window closure even if the runner fails.
A partially completed run therefore keeps accepted one-row operations and their
verifiers, expires any still-unconsumed exact grants from the named window, and
returns the operation to disabled-at-rest state.

If the close itself cannot prove safe reduction, the workflow fails loudly and
does not claim acceptance.

## Forward repair Preview acceptance

Disposable Preview:

- branch: `mizizi-release-slug-resume-1013`;
- branch id: `d64d23b3-4150-437c-8fdc-db83c8482ec7`;
- project ref: `ltcwajcrqdbefhulzibv`;
- parent Production: `pgzizndxdyhqmtyywjmt`;
- baseline replay after rebase: **171 / 20260922143000**;
- candidate canonical ledger: **172 / 20260922171632**;
- candidate migration SHA-256:
  `9eaa92df451c3e88eb5e25bbc1c1539c13735020f31cca356fa0a0b34bbc4c3b`;
- permanent verifier:
  `MIZIZI_RELEASE_SLUG_RESUME_INTEGRITY_PASS`;
- public/editorial type SHA-256 remains
  `5d229c68d65b3360ecef98882ed059b09a2e57b43daf3343358d1231b14aa1d3`.

Real Stage C behavior acceptance ran through workflow
`35761199065` with
`session_user = current_user = mizizi_executor`.

The provenance-backed second sibling planned
`wk-resume-kesho-2026-02-02` with date fallback enabled. The negative-control
date-looking sibling without a succeeded MIZIZI planner event planned the clean
base `wk-resume-control` with date fallback disabled.

The JIT mapping was restored, Production temporary access returned disabled,
and all Preview fixture rows plus their generated Artist resource identity were
removed. Security advisor output has no finding mentioning the repaired private
planner, the repair migration, or `mizizi_private`.

## Production acceptance

A successful apply requires all of the following:

- exact candidate fingerprint at entry;
- runner success through the Stage B broker;
- exactly one verified mutation operation and one canonical write event per
  frozen candidate;
- zero remaining candidates for the applied scope;
- post-apply full-corpus audit with only the expected observe-only findings;
- requested operation disabled;
- active MIZIZI standing grants: zero;
- active exact grants: zero;
- unconsumed exact grants: zero;
- JIT mapping restored;
- Supabase temporary access disabled.

## Accepted Release partial stop and forward resume

The first governed Release-slug apply ran from merged trigger commit
`80ffc7d07a041ae001bafa3f365a825016c50b44` in Production control-plane run
`35757733981`.

The run correctly failed closed after preserving every verified success:

- frozen Release programme: 737 candidates;
- original programme fingerprint:
  `b96da159df4ffa8b19a5bb39574995a6b25cac2552823ef24af8f737fb1278be`;
- verified Release slug operations: 731;
- canonical Release slug write events: 731;
- remaining provider-packaging slug candidates: 6;
- queued review rows: 0;
- stale apply outcomes: 6;
- Release title observations preserved: 737;
- Release operation after stop: disabled;
- active standing / exact MIZIZI grants after stop: 0 / 0;
- JIT mapping restored and Production temporary access disabled.

The six stale rows are the second members of six same-Artist/base collision
pairs. The first member of each pair had already moved to its frozen
release-date fallback. The original dynamic planner then recomputed the
remaining sibling as a singleton and changed its plan mid-run. No identity
ambiguity was discovered; this was order-dependent planner state.

Forward migration
`20260922171632_mizizi_release_slug_resume_integrity_v1.sql` makes the
date-fallback decision monotonic only when a same-Artist sibling's current slug
is backed by a succeeded `system:mizizi` canonical-write event from
`mizizi_private.release_slug_plan_v1`. Arbitrary date-looking slugs do not
become authority.

The six remaining repaired plans have exact fingerprint:

`2be28e013ce904e2a05f5d3c368304684c08a6ad7eadfe23a99c57162d0091b2`.

More importantly, the 731 stored succeeded grant plans plus those six repaired
plans reconstruct all 737 original candidates and reproduce the original
programme fingerprint exactly. Resume therefore remains inside the same
reviewed candidate authority.

The control plane admits only three exact Release programme states:

1. pristine: 0 verified / 737 current;
2. accepted partial: 731 verified / 6 current;
3. accepted final: 737 verified / 0 current.

Any other mixed state fails closed.

A resume must not replay the 731 accepted operations. After the forward
migration is Production accepted, a new separately reviewed human grant/trigger
may authorize only the six unfinished rows. Final acceptance still requires
737 verified operations, 737 canonical write events, zero remaining Release
slug candidates, and zero authority at rest.
