# MIZIZI Slice 2 — Registry Materialization Primitive Family

Date: 14 September 2026

Status: **DESIGN AUTHORITY — SUPERSEDES NARROW MATERIALIZATION ASSUMPTIONS IN #939 WHERE THEY CONFLICT**

Issue: #939

Base merged-main authority: `88d0184304bf60f418dbf56dbd4bb0fbaf0df07c`

Production migration head at freeze: `20260914193300`

Parent design: `docs/engineering/mizizi-slice2-chart-origin-and-artist-creation-design.md`

Programme authority: `docs/engineering/mizizi-registry-authority-security-convergence-programme.md`

Source durability authority: `docs/engineering/charts-public-source-accessibility-soak-final.md`

## 1. Decision

#939 now establishes a reusable Registry materialization family rather than an Artist-only primitive plus chart-specific Track compatibility commands.

The family is:

- `registry.artist.create/v1`
- `registry.track.create/v1`
- `registry.release.create/v1`
- `registry.track_artist_credit.admit/v1`
- `registry.release_track.admit/v1`
- `registry.release_artist_credit.admit/v1`
- existing `registry.artist_origin.admit/v1`

The family exists because recurrence is already proven across Chart ingestion, artist/discography ingestion, intake promotion, administrative Registry work, provider evidence, playback enrichment and future bounded MIZIZI execution.

This is not a generic CRUD framework.

> **Do not primitive the culture. Primitive the governance.**

Every operation is one named canonical state transition with its own exact evidence, collision/state rules, target budget, plan fingerprint, idempotency, audit receipts and verifier.

## 2. Release taxonomy decision

There is one canonical Release identity primitive:

`registry.release.create/v1`

There are no separate creation operations for:

- Album
- EP
- Single
- Mixtape
- Compilation
- Soundtrack
- Deluxe / Expanded Edition
- Reissue
- Regional edition

Those are taxonomy/classification facts on a Release, not separate canonical entity kinds.

A Track is the atomic recorded unit used to compose Releases, but Track existence does not imply Release identity. The same canonical Track can legitimately occur on multiple Releases. Therefore Releases retain independent canonical identity and cannot be generated merely by aggregating Tracks.

## 3. Materialization graph

The intended canonical composition is:

`evidence`

→ `registry.artist.create/v1` when an Artist identity is genuinely absent

→ `registry.track.create/v1` when a Track identity is genuinely absent

→ `registry.track_artist_credit.admit/v1` for exact Track credits

→ `registry.release.create/v1` when a Release identity is genuinely absent

→ `registry.release_track.admit/v1` for exact Release sequencing/membership

→ `registry.release_artist_credit.admit/v1` for exact Release-level credits

→ typed fact admissions such as `registry.artist_origin.admit/v1`

→ later lifecycle/promotion operations when activation/publication is justified.

Creation, membership, credit, taxonomy, enrichment and lifecycle are intentionally different authorities.

## 4. Creation invariant

Artist, Track and Release creation V1 are **draft-only**.

A creation operation establishes canonical identity. It does not imply cultural publication, activation, enrichment completeness or provider truth.

No creation operation accepts a requested status other than its fixed V1 draft status.

Lifecycle activation is a separate typed decision.

## 5. Generic creation-governance pattern

All three create operations share governance behavior without erasing domain semantics.

Each creation operation:

1. receives a pre-generated exact future UUID;
2. derives a deterministic canonical identity representation;
3. records immutable evidence;
4. computes a domain-specific collision-state fingerprint;
5. issues a one-target / one-row exact grant;
6. binds a five-minute-or-less grant TTL;
7. acquires a deterministic advisory lock on the identity key at execution;
8. recomputes collision state under that lock;
9. inserts exactly one draft canonical row;
10. records canonical write receipts;
11. leaves verifier state pending;
12. requires a separate verifier transaction.

The shared Registry execution journal remains the governance substrate.

The operations do **not** share a generic insert executor or arbitrary field payload.

## 6. Artist Create V1

Operation:

`registry.artist.create`

Version: `1`

Capability:

`create_registry_artist`

Risk: `medium`

Subject: `artist`

`requires_existing_target=false`

Max targets: `1`

Max rows: `1`

TTL ceiling: `300` seconds

Verifier: required

### Canonical identity nucleus

Artist Create V1 may write only:

- exact future `id`;
- deterministic `slug`;
- canonical `display_name`;
- deterministic `normalized_name`;
- deterministic `sort_name`;
- `artist_type='unknown'`;
- `status='draft'`;
- standard audit timestamps.

It must not write origin, biography, images, provider IDs, genre authority, relationships, discography, memberships, living-memory fields, activation, or arbitrary metadata.

### Artist collision state

The plan binds at minimum:

- future Artist UUID;
- display name;
- normalized name;
- slug;
- exact ordered collisions by normalized name and slug;
- operation ruleset version.

Any collision or collision-state drift rejects automatic creation.

No random slug suffix fallback is allowed.

## 7. Track Create V1

Operation:

`registry.track.create`

Version: `1`

Capability:

`create_registry_track`

Risk: `medium`

Subject: `track`

`requires_existing_target=false`

Max targets: `1`

Max rows: `1`

TTL ceiling: `300` seconds

Verifier: required

### Canonical identity nucleus

Track Create V1 may write only:

- exact future `id`;
- deterministic canonical `slug`;
- canonical `title`;
- deterministic `normalized_title`;
- optional canonical `isrc` when the evidence contract binds it;
- `status='draft'`;
- standard audit timestamps.

It must not write:

- Artist credits;
- Release membership;
- artwork;
- preview URL;
- release ID;
- duration unless a later Track-fact contract explicitly admits it;
- provider IDs;
- provider metadata;
- lifecycle activation;
- living-memory editorial fields;
- arbitrary metadata.

### Track collision state

The Track creation plan binds:

- future Track UUID;
- title;
- normalized title;
- deterministic slug;
- optional ISRC;
- exact ordered collisions by ISRC when present;
- exact ordered collisions by deterministic identity/title key required by V1;
- operation ruleset version.

Production already provides a unique partial ISRC index. V1 treats ISRC conflict as identity conflict, not as permission to silently reuse or overwrite a row.

Where no ISRC exists, title alone is insufficient to automatically disambiguate legitimate same-title recordings. The chart/provider broker must supply the exact V1 identity evidence set; ambiguity goes to review.

## 8. Release Create V1

Operation:

`registry.release.create`

Version: `1`

Capability:

`create_registry_release`

Risk: `medium`

Subject: `release`

`requires_existing_target=false`

Max targets: `1`

Max rows: `1`

TTL ceiling: `300` seconds

Verifier: required

### Canonical identity nucleus

Release Create V1 may write only the minimum identity nucleus supported by the live Release schema and verified evidence:

- exact future `id`;
- deterministic canonical slug / identity key;
- canonical title;
- deterministic normalized title representation where the current schema supports it;
- optional canonical UPC when bound to admissible identity evidence and supported by schema;
- `status='draft'`;
- standard audit timestamps.

The implementation must audit the exact live Release columns/indexes before writing the migration and must use the real schema rather than inventing columns.

Release Create V1 must not automatically write:

- release taxonomy/type;
- release date;
- label;
- artwork;
- provider IDs;
- track membership;
- Artist credits;
- activation;
- arbitrary metadata.

### Release taxonomy

Album/EP/Single/etc. classification is intentionally outside Release Create V1 unless an existing canonical non-ambiguous schema default is required for row validity.

If a required legacy column forces a taxonomy value at insert time, the implementation must stop and design the compatibility rule explicitly rather than silently encoding a cultural classification as a technical default.

## 9. Track↔Artist Credit Admission V1

Operation:

`registry.track_artist_credit.admit`

Version: `1`

Capability:

`admit_registry_track_artist_credit`

Risk: `medium`

Subject authority:

- existing Track;
- existing Artist.

The exact plan binds:

- Track UUID;
- Artist UUID;
- canonical role;
- `is_primary`;
- `is_featured`;
- credit order;
- display credit where supported;
- evidence assertion;
- expected Track and Artist state fingerprints;
- exact current credit-collision state.

Production uniqueness on `(track_id, artist_id, role, credit_order)` is a conflict boundary.

The operation never turns a uniqueness conflict into an implicit update of different credit semantics.

A semantic mismatch requires reconciliation/review.

## 10. Release↔Track Admission V1

Operation:

`registry.release_track.admit`

Version: `1`

Capability:

`admit_registry_release_track`

Risk: `medium`

The exact plan binds:

- Release UUID;
- Track UUID;
- disc/side/sequence semantics supported by the current canonical schema;
- evidence assertion;
- expected Release and Track state fingerprints;
- exact membership-collision state.

It inserts one membership fact only.

It does not mutate the Track identity, Release identity or unrelated sequence rows.

## 11. Release↔Artist Credit Admission V1

Operation:

`registry.release_artist_credit.admit`

Version: `1`

Capability:

`admit_registry_release_artist_credit`

Risk: `medium`

The exact plan binds one Release, one Artist and the exact supported release-credit semantics.

It is separate from Track credit because an Artist can have valid release-level credit not reducible to any one Track, and because release-level ordering/roles are culturally meaningful facts.

## 12. Evidence doctrine

Evidence producers remain domain-specific.

The Registry operations accept immutable assertions, not arbitrary provider payloads.

Possible trust classes remain those defined by the governance foundation.

Provider/chart observations normally remain `EXTERNAL_EVIDENCE`.

A qualified source from the completed chart soak is eligible evidence input; qualification does not elevate it to `TRUSTED_CONTROL`.

Human review decisions can become `INTERNAL_FACT` or otherwise governed human evidence where the specific operation contract permits.

`WEB_UNTRUSTED` and `USER_CONTENT` cannot autonomously authorize canonical materialization.

## 13. Chart-specific broker

Chart uses actor:

`registry_chart_admission`

Kind: `automation`

Transport binding: PostgREST `authenticator`

This actor is distinct from:

- `mizizi`;
- `registry_artist_origin_admin`;
- any future provider/intake actor.

Current chart product execution is human-driven. Exact grants are issued to the live authenticated user after required chart capabilities are checked.

No standing System-Actor grant is introduced for the new materialization operations.

## 14. Chart evidence derivation

The chart broker derives evidence from canonical chart working state, including run/candidate/match/source context.

The caller cannot send an arbitrary title/name and claim it came from Charts.

At minimum, a chart materialization request must bind:

- run ID;
- candidate or resolved row ID;
- exact source-derived Artist/Track/Release identity tokens available in chart working state;
- current chart action capability;
- source policy / methodology version as relevant;
- source URLs or provider identity observations where admissible;
- immutable source payload fingerprint(s);
- current review/commit context.

If chart working state changed after grant issuance, the operation rejects.

## 15. Chart composition

Chart materialization becomes orchestration over the primitive family.

For a candidate requiring new identities, the logical flow is:

1. resolve/reuse an unambiguous existing Artist or execute `registry.artist.create/v1`;
2. resolve/reuse an unambiguous existing Track or execute `registry.track.create/v1`;
3. execute `registry.track_artist_credit.admit/v1` where the credit does not exist;
4. resolve/reuse an unambiguous Release or execute `registry.release.create/v1` only where the chart workflow genuinely has Release identity evidence;
5. execute Release↔Track and Release↔Artist admissions when evidence and product semantics require them;
6. execute `registry.artist_origin.admit/v1` separately for missing origin when admissible;
7. continue chart-domain commit/publication under caller JWT + RLS.

The UI may present a guided workflow, but each canonical state transition remains separately journaled and verified.

## 16. No transactional fiction across cultural facts

Legacy code sometimes creates identity, writes origin, writes credits and activates rows inside one convenient transaction.

The governed design does not preserve that transactional fiction.

If Artist creation succeeds and origin admission fails, the draft Artist remains a valid canonical identity with its own operation receipts.

If Track creation succeeds and a credit admission fails, the draft Track remains a valid canonical identity requiring later review.

If Release creation succeeds and membership admission fails, the draft Release remains a valid canonical identity requiring later review.

A later failed fact does not erase already-proven cultural identity history.

## 17. Service-role removal from chart-ingest-api

`chart-ingest-api` currently loads `SUPABASE_SERVICE_ROLE_KEY` globally.

#939 cannot close while that ambient credential remains available to the resolver.

Target runtime:

- `SUPABASE_URL`;
- `SUPABASE_ANON_KEY`;
- live caller bearer JWT.

Ordinary chart working tables use authenticated caller RLS.

Canonical Registry tables keep their current no-direct-authenticated-DML boundary.

Registry materialization occurs only through the typed command surfaces.

The implementation must audit all remaining service-role-only chart mutations before removing the secret. If any remaining non-Registry chart write is not currently allowed by caller RLS, it must be given the narrowest capability/RLS or command boundary needed for its real domain semantics. It must not justify retaining a global service-role credential.

## 18. Browser and private authority

Authenticated product callers may execute only public chart broker surfaces with explicit capability checks.

Private evidence recorders, grant issuers, executors and verifiers remain unavailable to `anon`, `authenticated` and `service_role` unless the exact public bridge requires execution via SECURITY DEFINER semantics already proven by the governance model.

Direct browser DML to Registry Artists, Tracks, Releases, memberships or credits remains forbidden.

## 19. Idempotency

Each primitive owns a semantic idempotency key derived from immutable evidence + operation identity + exact target.

Idempotency never means "upsert whatever is there now."

A retry of the same exact operation returns the existing operation/result.

A changed plan, changed target, changed credit semantics, changed sequence semantics or changed identity evidence cannot reuse the old idempotency key.

## 20. Kill switches

Every new operation type is independently enable/disable governed.

Disabling one materialization operation must prevent new execution/resume for that operation without requiring shutdown of unrelated Registry operations.

Chart runtime must surface a controlled conflict/review state when a required primitive is disabled; it must not fall back to direct service-role DML.

## 21. MIZIZI boundary

MIZIZI receives no standing grants for the new create/membership/credit capabilities in #939.

The existing `mizizi` postgres-bound executor remains separate convergence debt from prior Slice-2 authority.

No new primitive in #939 becomes autonomously callable by MIZIZI merely because it is reusable.

## 22. Compatibility retirement

The following roads are retirement/convergence targets only after replacement dependency proof:

- `chart_set_artist_origin_for_charts(...)`;
- `chart_create_artist_origin_shell(...)`;
- `findOrCreateRegistryArtist(...)` direct Registry insert logic;
- direct Registry Track inserts in chart commit/reingest;
- direct `registry_track_artists` writes in chart commit/reingest;
- any discovered direct chart Release/membership/credit writes;
- the chart resolver's `SUPABASE_SERVICE_ROLE_KEY` dependency.

Historical audit records are preserved.

Historical origins/activation are not rewritten merely because the authority model changes.

## 23. Boundary A implementation order

Boundary A is one implementation boundary with internally ordered dependencies:

1. audit exact Release and Release-membership live schema before coding Release contracts;
2. add canonical capability vocabulary;
3. add/activate `registry_chart_admission` transport actor;
4. add domain-specific collision fingerprint helpers;
5. install Artist Create V1;
6. install Track Create V1;
7. install Release Create V1;
8. install Track↔Artist Credit V1;
9. install Release↔Track V1;
10. install Release↔Artist Credit V1;
11. install chart evidence/gateway surfaces;
12. extend chart-specific use of Artist Origin V1;
13. add permanent control-plane verifier(s);
14. keep all operations inert/disabled until replay/Preview acceptance proves them where appropriate.

The exact number of forward-only migrations is an implementation detail; migration boundaries follow atomic authority/integrity needs, not artificial phase count.

## 24. Boundary B implementation order

After Boundary A is proven in Preview:

1. route chart Artist resolution through the Artist primitive / explicit existing-identity resolution;
2. route Track creation through Track Create V1;
3. route credit writes through Track↔Artist admission;
4. route Release materialization only where chart actually requires it;
5. route chart origin decisions through Artist Origin V1;
6. convert ordinary chart-domain reads/writes to caller JWT + RLS;
7. remove all direct Registry DML from `chart-ingest-api`;
8. remove `SUPABASE_SERVICE_ROLE_KEY` from `chart-ingest-api`;
9. prove legacy compatibility roads have zero required callers;
10. retire/internalize the obsolete roads;
11. execute full chart commit/reingest/publication acceptance.

## 25. Acceptance matrix

Boundary A and B acceptance must cover at least:

- successful draft Artist creation;
- successful draft Track creation;
- successful draft Release creation;
- successful exact Track↔Artist credit;
- successful exact Release↔Track membership;
- successful exact Release↔Artist credit where exercised;
- successful missing-origin admission through chart provenance;
- idempotent replay for each exercised primitive;
- future-target UUID collision rejection;
- slug/name/title collision rejection;
- ISRC conflict rejection;
- UPC/release identity conflict rejection where supported;
- stale collision-state rejection;
- stale existing-target state rejection for membership/credit;
- duplicate semantic membership/credit rejection;
- conflicting credit/order semantics rejection;
- operation disabled rejection;
- expired grant rejection;
- wrong capability rejection;
- wrong user / issuer rejection;
- private RPC non-exposure;
- browser direct Registry DML rejection;
- over-budget/fan-out rejection;
- established-origin overwrite rejection;
- chart evidence no longer matching run/candidate rejection;
- MIZIZI standing grants remain zero;
- no service-role credential remains in `chart-ingest-api`;
- real chart commit/reingest fixture succeeds end to end;
- canonical write receipts and operation links are exact;
- independent verifier passes each successful canonical transition.

## 26. Production closure gate

#939 is not complete at merge.

Closure requires:

- replay-sealed migrations;
- paid Preview acceptance where required by project policy;
- protected CI green on exact accepted head;
- exact merged-main Production promotion;
- independent Production verification;
- deployed chart runtime proven to contain no `SUPABASE_SERVICE_ROLE_KEY`;
- no new standing MIZIZI grants;
- legacy chart materialization roads retired/internalized only after caller proof;
- Preview deleted after Production acceptance;
- closure documentation records remaining adjacent Registry debt explicitly.

## 27. Explicitly deferred facts

This primitive family does not by itself govern every Registry fact.

Still separate operations/designs include, as needed:

- Artist/Track/Release lifecycle activation;
- Release taxonomy admission/correction;
- release date admission/correction;
- label relationships;
- artwork/media attachment;
- provider identifier admission/correction;
- playback/provider metadata;
- biography/editorial enrichment;
- genre/taxonomy facts;
- identity merge/split/disambiguation;
- established-origin correction/reconciliation.

The primitive family gives these future facts stable canonical identities to attach to. It does not collapse them into creation.