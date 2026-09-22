# MIZIZI URL-Identity Programme Control Plane

Date: 22 September 2026

Programme issue: #1013

Status: **IMPLEMENTATION CANDIDATE — audit authority accepted; Production mutation not yet authorized**

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

No trigger file ships with the implementation. Production mutation remains
unavailable until a separately reviewed trigger is merged on exact main after
Preview and migration promotion acceptance.
