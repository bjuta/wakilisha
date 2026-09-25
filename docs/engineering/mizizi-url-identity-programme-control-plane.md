# MIZIZI URL-Identity Programme Control Plane

Date: 25 September 2026

Programme issue: #1013

Status: **HISTORICAL RELEASE + CHART URL-IDENTITY FAMILIES PRODUCTION CLOSED; PUBLIC MUSIC IDENTITY SLICE 2 REVIEW AUTHORITY LIVE; SLICE 3 ONE-TRACK SINGLE ALIGNMENT CANDIDATE FROZEN AT 80 AUTOMATIC + 35 RELEASE REVIEWS; SLICE 3 PRODUCTION APPLY NOT YET AUTHORIZED; AUTHORITY ZERO AT REST**

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

Protected pull-request preflight remains strictly non-mutating, but it accepts
two exact entry states:

- **zero at rest**: no standing grant, no exact grant, and none of the four
  stewardship operations enabled; or
- **reviewed human authority**: exactly one active standing grant, zero active
  exact grants, exactly one enabled stewardship operation, and the branch's
  reviewed trigger file names that exact grant and matching operation/capability
  with at least 30 minutes of lifetime remaining.

This second state exists so the human approval can be reviewed by protected CI
before the trigger is merged. A mismatched grant, an unrelated enabled
operation, multiple standing grants, or any active exact child authority still
fails closed. PR preflight never executes the apply path.

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
- Release title strings were not mutated; the in-run frozen audit preserved 737
  title observations, while a fresh post-partial audit reports title packaging
  only for the six rows whose slugs still carry matching provider packaging;
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

The first post-repair trigger attempt exposed a sequencing defect in the
preflight contract: a valid human approval necessarily made the old
zero-at-rest-only PR gate fail. Trigger PR #1027 was closed without merge, and
its approval was reduced through the accepted Stage-C reducer in temporary
never-merge PR #1028 / workflow run `35768159746`, returning Production to
disabled / 0 / 0 authority with the Registry still at 731 / 731 / 6.

The control plane now explicitly reviews the exact branch-bound human approval
in PR mode instead of forcing operators to choose between protected CI and a
valid approval window.


## Final Release-slug Production closure

The repaired six-row resume was authorized by the fresh human grant:

`833e42c4-44ae-46f8-8014-3a38aef6235d`

against exact protected main:

`84e26cd90dff9d839b62138db8e336cf698d86ef`.

Trigger PR **#1030** changed only the reviewed grant id. Protected PR
preflight run `35769222291` proved:

- `preflight entry authority = reviewed_human_authority`;
- Release programme state: `accepted_partial`;
- Registry mutation: **NO**.

PR #1030 merged as:

`605d08052b12478b75151c8d41ab6c29e5c6b9dd`.

That exact push launched authoritative Production apply run
`35769680464`. The run executed only the six repaired Release plans through
the existing Stage B exact-grant / typed-operation / independent-verifier
boundary, then reduced the human authority window before final acceptance.

Final Production Release state:

- verified Release-slug operations: **737**;
- Release-slug canonical write events: **737**;
- remaining deterministic Release-slug candidates: **0**;
- post-apply fresh Release audit findings: **0**;
- Release operation enabled: **false**;
- active MIZIZI standing grants: **0**;
- active MIZIZI exact grants: **0**;
- human grant status: **expired**;
- exact child grants descended from the final approval: **6**, all consumed;
- all six mutation operations: `succeeded`;
- all six independent verifiers: `passed`;
- permanent verifier:
  `MIZIZI_RELEASE_SLUG_RESUME_INTEGRITY_PASS`;
- JIT mapping restored;
- Production temporary access disabled at rest.

The six final canonical slugs are:

- `nilotic-2022-04-01`;
- `wameyo-2025-10-10`;
- `maybe-2022-09-23`;
- `kesho-2023-10-27`;
- `catch-a-vibe-2021-03-26`;
- `son-of-the-city-2020-11-22`.

No Release title was rewritten by this programme.

Push Critical run `35769680551` also passed completely, including migration
replay, browser acceptance, security/RLS, live schema drift and application
build.

## Final Chart Track-slug Production closure

The derived Chart Track-slug synchronization was authorized by human grant:

`c5c518d4-4fbf-4ee4-9379-47b13a598add`

against exact protected main:

`9272ce3c31b9c4402f7b21f1f4b8aae3c48e8b8a`.

Reviewed trigger PR **#1032** bound the exact accepted Chart programme:

- candidate count: **161**;
- candidate fingerprint:
  `28a3b8362f8721ad4f35045a2cd938d265adf35373b522b492054af80eb8a910`;
- operation:
  `registry.chart_track_slug.synchronize/v1`;
- capability:
  `synchronize_chart_track_slug`.

Protected preflight run `35771365881` passed with:

- `preflight entry authority = reviewed_human_authority`;
- exactly **161** `chart_track_slug_drift` candidates;
- Release programme state: `accepted_final`;
- Registry mutation: **NO**.

PR #1032 merged as:

`6109dc18f1e79c45d4c04a92cff51f4563daf2de`.

That exact push launched authoritative Production apply run
`35771792617`. Final independent Production proof:

- exact child grants descended from the approval: **161**;
- consumed child grants: **161**;
- succeeded + verifier-passed operations: **161**;
- exact final Chart-slug matches to both the frozen plan and current canonical
  Track slug: **161**;
- mismatches: **0**;
- canonical Chart Track-slug write events: **161**;
- remaining Chart Track-slug drift: **0**;
- Chart operation enabled: **false**;
- human approval status: **expired**;
- active MIZIZI standing/exact grants: **0 / 0**;
- Release programme remains **737 / 737 / 0**;
- open Track `mizizi_data_hygiene` reviews remain **66**, untouched;
- JIT mapping restored;
- Production temporary access disabled at rest.

Apply evidence artifact:

- artifact id: `10714830965`;
- SHA-256:
  `965e6e5500ea00f9a78e0480e2ee61506a28a69c6ffc9a36b0069202fe1e87f9`.

Push Critical run `35771792584` passed completely.

The 91 `chart_artist_slug_drift` findings remain observe-only. They were not
part of this Track-slug projection authority.

### Accepted-final Chart control-plane state

After successful synchronization, protected preflight must not expect the
opening 161-row backlog to reappear. The final Chart state is exact only when:

1. the Chart journal has **161 verified operations / 161 canonical events**;
2. the current Chart Track-slug candidate set is **0**; and
3. the 161 succeeded verified grant plans reconstructed from history reproduce
   the original programme fingerprint exactly.

Any mixed or newly divergent state fails closed. New Chart drift created by a
future separately reviewed Track mutation is new evidence and cannot silently
reuse this closed 161-candidate authority.

### Remaining #1013 boundary

Release-slug cleanup and the accepted 161-row Chart Track-slug projection are
closed.

The parent programme remains open only for the **66** Track
`mizizi_data_hygiene` review items. Those are review authority, not automatic
Track mutation authority.

Release and Chart authority must remain closed unless new evidence creates a
new separately reviewed programme.

## Public Music Identity Slice 3 — one-track Single alignment candidate

This section records the forward Public Music Identity convergence candidate
prepared on 25 September 2026. It does **not** declare a Production data apply.

The public product invariant is already fixed by Slice 1:

- a canonical Track presents at
  `/tracks/{artistSlug}/{trackSlug}`;
- a multi-track Release presents at
  `/releases/{artistSlug}/{releaseSlug}`;
- a one-track Single does not own a second public Release page;
- Release membership is context, not Track address;
- the retired Release-scoped Track shape and UUID Track routes do not return.

Slice 3 therefore repairs internal one-track Release identity only where the
current Registry and Community graph proves a deterministic Track presentation.

### Production corpus classification

The read-only Production audit found **157** active Release slugs containing
feature-credit tokens. Their topology is:

- **148** one-track Releases;
- **3** multi-track Releases, excluded from the one-track automatic lane;
- **6** zero-resolvable Releases, blocked for separate repair.

Within the 148 one-track Releases, **33** are already blocked by an open Track
identity review. They are not duplicated into a second Release review while
their Track identity remains unresolved.

The remaining 115 one-track Releases divide into:

- **80** safe automatic Single alignments;
- **35** Release public-identity reviews.

The 35 review targets are the union of concrete ambiguity evidence, including
one duplicate active Single for the same canonical Track, nine Release-primary
versus Track-primary Artist-scope mismatches, and 29 cases where both a
Release-owned Community thread and a Track-owned thread already exist. Four
Artist-scope mismatches overlap the dual-thread set, so those findings resolve
to 35 unique Release review targets rather than 39.

Automatic eligibility also requires exactly one distinct primary Artist UUID
and exactly one distinct primary Artist slug on both the Release and Track,
exact UUID/slug agreement between those scopes, no same-Artist target-slug
collision, no unsupported Release-owned current pointer, and no malformed
Release/Track thread route state.

### Exact programme freezes

Automatic Single alignment:

- candidate count: **80**;
- candidate fingerprint:
  `8cb08c3447b0e8acaf3279ef7b0317e915783b87a7e37678976b01fd02401eab`;
- exact per-operation row ceiling: **2**.

Release conflict review programme:

- review target count: **35**;
- review fingerprint:
  `3e6ce99990ebd2e3bb5bbfd2600748da20104696bff3ced7875e4d5fe358638d`;
- rule:
  `release_single_identity_conflict/1.4.0`.

Both fingerprints bind the exact Release/Track identities, current and proposed
slugs, Artist route authority, current thread ownership, relevant downstream
pointer state, and deterministic aggregate state fingerprints.

### Community topology

Of the 80 automatic candidates:

- **45** have no Community thread;
- **25** have one Release-owned thread and no Track-owned thread;
- **10** already have the canonical Track-owned thread and no Release-owned
  thread.

For the 25 movable threads, the existing thread id and all comments are
preserved. The operation changes only the current thread owner to the canonical
Track UUID and canonical Track route. It does not create a second thread and
does not merge two discussions.

A Release/Track dual-thread collision is review-only.

### Mutation boundary

The automatic operation is:

`registry.release_single_identity.align/v1`

with capability:

`align_registry_release_single_identity`.

One exact operation may change only:

1. the target active Single Release slug; and
2. at most one collision-free Community thread current owner.

It must not:

- mutate `registry_tracks`;
- mutate `registry_release_tracks`;
- rewrite Track identity;
- create or reactivate `wk_slug_redirects`;
- use Release-date suffix fallback;
- merge duplicate Singles;
- merge two Community threads;
- bypass an existing Track identity review.

The executor reuses the mature Release serialization namespace
`mizizi:release-slug:{primaryArtistId}`, then revalidates the complete
candidate after locking current Release, Track, membership, credit and thread
state.

Every successful mutation emits exactly one
`align_release_single_identity` canonical-write event and requires an
independent verifier PASS.

### Review authority

Ambiguous one-track cases are materialized through the bounded private review
broker as `mizizi_data_hygiene` Release reviews. The review evidence stores
the exact frozen programme candidate and concrete reason codes.

The existing 33 Track-review-blocked Releases remain blocked by their current
Track review rather than receiving duplicate Release review work.

### Migration and control-plane integration

The canonical migration filename was minted by the accepted pinned Supabase
CLI, not hand-authored:

`supabase/migrations/20260925082706_public_music_identity_slice3_release_single_alignment_v1.sql`.

The permanent verifier is:

`scripts/control-plane/verify-public-music-identity-slice3-release-single-alignment.sql`.

This lane extends the existing
`mizizi-url-identity-production-control-plane`; it does not create another
Production workflow.

The implementation PR is strictly schema/control-plane authority. It does not
contain the later reviewed Production apply trigger. After the migration is
merged, replay-proven and Production-applied, a real `manage_registry` user
must open the dedicated time-bounded Single-alignment authority window. A
separate tiny reviewed trigger PR will then bind that exact human grant to the
80/35 programme freeze.

Until that later trigger is reviewed and merged:

- Registry data mutation: **NO**;
- new Slice 3 Release reviews in Production: **NO**;
- Single slug convergence in Production: **NO**;
- Track mutation: **NO**;
- redirects: **NO**.

