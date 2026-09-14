# MIZIZI Slice 2 — Chart Artist Creation + Origin Convergence

Date: 14 September 2026

Status: **DESIGN AUTHORITY — IMPLEMENTATION NOT YET PRODUCTION-ACTIVE**

Issue: #939

Base authority: `88d0184304bf60f418dbf56dbd4bb0fbaf0df07c`

Production migration head at design freeze: `20260914193300`

Programme authority: `docs/engineering/mizizi-registry-authority-security-convergence-programme.md`

Source durability authority: `docs/engineering/charts-public-source-accessibility-soak-final.md`

## 1. Objective

Close the remaining chart-side Artist identity/origin authority bypasses while introducing the reusable canonical Artist-creation primitive that the Registry already needs beyond Charts.

This substep must leave WAKILISHA with two distinct typed Registry operations:

- `registry.artist.create/v1` — establish one new canonical Artist identity as `draft`;
- `registry.artist_origin.admit/v1` — admit one missing Artist origin fact.

Chart ingestion remains evidence/orchestration. It must not possess ambient authority to insert or update canonical Registry Artists.

The governing principle remains:

> Do not primitive the culture. Primitive the governance.

Artist creation is therefore not a generic Artist patch primitive. It is one explicit canonical state transition with exact evidence, exact identity intent, bounded authority, collision/stale-state rejection, journaling and verification.

## 2. Entry authority

At entry:

- merged `main` is `88d0184304bf60f418dbf56dbd4bb0fbaf0df07c`;
- Production migration head is `20260914193300`;
- `registry.artist_origin.admit/v1` is enabled;
- the human administrative backfill path is Production-converged;
- active MIZIZI standing `admit_registry_artist_origin` grants remain `0`;
- MIZIZI has no Artist-create capability or standing grant;
- the #937 paid Preview has been deleted;
- the seven-day chart source durability soak is closed.

## 3. Source durability evidence

The authoritative chart-source cloud soak ran 28 six-hour observations across the seven-day window beginning 5 September 2026 18:00 UTC and closing at the 12 September 2026 18:00 UTC boundary.

Source qualification at design freeze:

- Audiomack — GREEN core consumption evidence, 28/28 HTTP 200;
- Boomplay — GREEN core consumption evidence, 28/28 HTTP 200;
- Mdundo — GREEN core Kenya consumption evidence, 28/28 HTTP 200;
- Shazam — GREEN core discovery/identification-intent evidence, 28/28 HTTP 200;
- YouTube — GREEN core video/UGC consumption evidence, 28/28 HTTP 200;
- Apple — AMBER supplementary, 12/28 HTTP 200 and 16/28 30-second timeouts;
- Spotify UGC panel — GREEN as optional/supplementary UGC evidence, 556/560 HTTP 2xx + parseable and four HTTP 504 observations.

The soak proves portfolio durability. It does **not** convert provider output into canonical cultural authority.

Source qualification means “eligible evidence input,” not “trusted control.”

## 4. Current chart-side Artist authority roads

The read-only audit found three live chart-side Artist creation/origin roads.

### 4.1 `chart_set_artist_origin_for_charts(...)`

Current behavior:

- `SECURITY DEFINER`;
- service-role/postgres executable;
- accepts an existing Artist UUID;
- accepts a two-character origin after uppercasing rather than using the canonical ISO2 validator;
- unconditionally overwrites `origin_iso2`;
- unconditionally sets `origin_confidence = 1`;
- records chart metadata/audit;
- does not bind an exact state fingerprint, evidence assertion, grant, row budget, idempotency or verifier.

Historical chart-origin audit proves overwrite behavior occurred.

This behavior is not reproduced by the governed path.

### 4.2 `chart_create_artist_origin_shell(...)`

Current behavior combines three authorities:

1. Artist identity creation;
2. origin assignment;
3. Artist lifecycle activation.

For a missing slug it can create an **active** Artist carrying origin/confidence `1`.

For an existing slug it can overwrite origin/confidence and force `status='active'`.

Historical evidence includes chart-origin activation of Artists previously in `draft` and `needs_review`.

This compatibility function therefore cannot be treated as merely an origin writer.

### 4.3 `findOrCreateRegistryArtist(...)` inside `chart-ingest-api`

Chart commit/reingest contains a third direct service-role creation road.

It currently:

- normalizes the incoming Artist display string;
- looks up by deterministic-looking slug;
- looks up exact display name;
- performs case-insensitive display-name lookup;
- if the CI lookup is ambiguous, selects the first returned Artist;
- if no match exists, creates a Registry Artist directly as `draft`;
- generates random slug suffixes when collisions occur.

The useful fact is that chart commit already works with newly created **draft** Artists. Forced activation by the origin-shell function is not necessary for chart publication.

The unsafe facts are the direct service-role insert, ambiguous first-match behavior, and random collision fallback.

## 5. Why a reusable Artist-creation primitive is required

The need is not speculative and not chart-specific.

Other live Registry roads also create Artists, including `artist-registry-intake`, which can currently create active Artists through service-role authority while simultaneously writing enrichment/provider fields.

A single typed creation primitive gives future convergence work one canonical identity-creation contract without collapsing distinct evidence producers into one feature.

The primitive belongs to Registry governance. Charts are merely the first live product path that proves the requirement end to end.

## 6. Operation identity

New operation:

`registry.artist.create`

Version:

`1`

Capability:

`create_registry_artist`

Risk:

`medium`

Subject type:

`artist`

Budgets:

- exact targets: `1`;
- maximum affected rows: `1`;
- exact grant TTL ceiling: `300` seconds;
- `requires_existing_target = false`;
- independent verifier required: yes.

The target is a pre-generated **future Artist UUID** bound into the exact grant before execution.

The operation never accepts arbitrary table names, columns, SQL, a JSON patch object, generic metadata, or a multi-Artist target set.

## 7. Creation V1 canonical write contract

V1 may write only the identity nucleus required to establish one canonical Artist safely:

- `id` — exact future UUID bound into the grant;
- `slug` — deterministic canonical slug bound into the plan;
- `display_name` — normalized/validated canonical display string;
- `normalized_name` — deterministic Registry normalization;
- `sort_name` — deterministic V1 value derived from display name;
- `artist_type = 'unknown'`;
- `status = 'draft'`;
- standard created/updated timestamps.

V1 must **not** write:

- `origin_iso2` or `origin_confidence`;
- biography;
- images;
- Spotify/provider identifiers;
- generic provider metadata;
- genre authority;
- relationships;
- discography;
- track/release memberships;
- lifecycle activation;
- living-memory fields;
- arbitrary metadata blobs.

Evidence/provenance belongs in the evidence assertion, execution grant, operation journal and canonical write receipts—not hidden inside Artist metadata.

## 8. Draft-only creation

`registry.artist.create/v1` always creates `status='draft'`.

No chart source, provider response, MIZIZI decision, intake source, or creation caller may ask V1 to create an already-active Artist.

Activation is a separate lifecycle authority and requires a separate typed operation/design.

This deliberately retires the old shell behavior that bundled creation + origin + activation.

## 9. Identity normalization and collision policy

V1 automatic creation is conservative.

The gateway derives:

- canonical display name;
- normalized name;
- deterministic slug candidate;
- future Artist UUID;
- current exact collision set.

Automatic creation rejects when any of the following are true:

- display name is empty or invalid;
- normalized name is empty;
- deterministic slug is empty;
- the future UUID already exists;
- the deterministic slug already exists;
- an exact normalized-name collision exists;
- the identity collision state changes after the grant is issued;
- chart evidence no longer supports the requested identity token;
- the request is ambiguous among existing Artists.

V1 does **not**:

- append a random slug suffix;
- select the first case-insensitive match;
- silently reuse an ambiguous Artist;
- create a duplicate because a provider uses a slightly different casing.

A legitimate same-name Artist therefore goes to explicit identity review/reconciliation in V1. A later identity-disambiguation primitive may admit richer evidence such as stable provider identities; V1 does not guess.

## 10. Creation collision-state fingerprint

The shared governance foundation supports non-existing targets because `requires_existing_target=false` skips the subject-existence gate.

The generic Registry subject-state fingerprint returns `null` for a missing Artist. V1 therefore adds an operation-specific collision-state fingerprint rather than pretending a future row has canonical state.

The fingerprint binds at minimum:

- future Artist UUID;
- normalized display/name representation;
- deterministic slug;
- ordered set of existing Artist IDs/slugs that collide by exact slug or exact normalized name;
- operation ruleset version.

The fingerprint is part of the immutable normalized plan and therefore part of the plan fingerprint.

Immediately before insert, while holding a deterministic advisory lock for the identity key, the executor recomputes the collision-state fingerprint. Any drift rejects execution.

This closes the race where two grants are issued against the same apparently-free identity and then race to create it.

## 11. Evidence assertion for creation

Artist creation requires immutable evidence.

The domain-general creation assertion records:

- future Artist UUID;
- proposed display name;
- normalized name;
- deterministic slug;
- source kind;
- source reference;
- source payload fingerprint;
- trust class;
- observed time;
- recorder principal;
- assertion fingerprint.

Provider/chart evidence may be `EXTERNAL_EVIDENCE`.

A human review/control decision may produce `INTERNAL_FACT` where appropriate.

`WEB_UNTRUSTED` or `USER_CONTENT` does not autonomously authorize creation.

The evidence recorder cannot accept arbitrary canonical Artist fields.

## 12. Chart-specific creation broker

Charts use the domain-general operation through a chart-specific broker; the operation itself does not know about Charts.

Introduce chart Registry actor:

`registry_chart_admission`

Kind:

`automation`

Executor transport:

PostgREST `authenticator`.

The actor is not MIZIZI and is not the human admin actor.

The chart broker may derive a creation assertion only from live chart authority, such as:

- run ID;
- candidate ID;
- exact parsed Artist token/display name;
- source/run provenance;
- source observation fingerprints;
- current review/commit context.

The caller cannot submit an arbitrary source payload and label it chart evidence.

## 13. Human authority for chart creation

The operation capability `create_registry_artist` is added to the existing canonical capability vocabulary.

The chart product path may use it only for roles already authorized to create/publish chart Registry materialization.

At implementation time, role grants must be explicit and minimal. The intended current role set is:

- `chart_editor_global`;
- `chart_editor_regional` where its current publish authority genuinely requires draft Artist creation;
- `registry_editor` for Registry-originated creation workflows;
- `administrator`;
- `super_admin`.

The implementation must verify the exact role/capability matrix before applying these grants and must not infer authority from role names alone.

A chart commit creation request must still require the chart publication capability appropriate to that action in addition to `create_registry_artist`.

A Registry-originated creation request may require `manage_registry` in addition to `create_registry_artist`.

The exact execution grant records the live user issuer. No standing System-Actor grant is required for this human-driven path.

## 14. Creation executor

The private executor performs only `registry.artist.create/v1`.

It must:

1. begin/consume the exact grant through the shared Registry operation journal;
2. prove actor, issuer, capability, TTL, operation version, row budget, exact target and plan fingerprint;
3. acquire the deterministic identity advisory lock;
4. prove the future UUID still does not exist;
5. recompute and compare collision-state fingerprint;
6. prove bound evidence is still admissible;
7. insert exactly one draft Artist with only the V1 identity nucleus;
8. create exact canonical write receipts for the created identity fields;
9. link receipts to the mutation operation;
10. leave verifier status pending.

No direct fallback insert exists.

## 15. Independent creation verifier

Verification occurs in a separate transaction.

It proves:

- operation identity/version;
- exact future Artist target;
- exactly one Artist now exists at that UUID;
- slug/display/normalized/sort values equal the bound plan;
- `artist_type='unknown'`;
- `status='draft'`;
- origin fields remain null;
- no biography/image/provider/genre/relationship/discography field was introduced by the operation;
- the expected canonical creation receipts exist and are linked;
- affected row count is exactly one;
- operation evidence matches the creation assertion.

Only then does verifier status become `passed`.

## 16. Idempotency and replay

A retry with the same immutable evidence, future UUID, operation version and identity plan must return the existing operation/result rather than create a second Artist.

A different future UUID for the same exact collision identity does not create a second Artist. It fails the collision policy.

A caller cannot force idempotency around a changed plan.

## 17. Existing-Artist chart origin admission

Existing Artist origin resolution reuses:

`registry.artist_origin.admit/v1`

It does **not** create version 2 merely to preserve legacy chart overwrite behavior.

The chart path uses actor:

`registry_chart_admission`

and a chart-specific evidence/gateway surface.

The public bridge requires:

- live `auth.uid()`;
- `manage_registry` for the explicit origin-resolution action;
- exact chart run/review authority;
- Artist still appears in the run origin-resolution queue;
- Artist still has missing origin;
- proposed ISO2 passes the canonical validator;
- exact evidence/run provenance;
- one Artist per exact grant;
- separate verifier transaction.

An established origin is an overwrite conflict and is rejected.

Correction/reconciliation of an established origin requires a future review/correction operation; it is not disguised as chart admission.

## 18. Chart-origin confidence semantics

Legacy confidence `1` is not provider confidence.

If the chart UI records an explicit human country confirmation, `1.0` may represent the confidence of that **human control decision**, provided the assertion clearly records:

- the chart run/review context;
- the human issuer;
- the selected ISO2;
- the source evidence presented;
- any divergence from the chart run target;
- a required rationale when the selected origin differs from the run target or evidence is conflicting.

Automated provider observation alone never becomes confidence `1` merely because a source qualified GREEN in the soak.

## 19. Governed composition for unresolved chart identities

The long-term composition is:

`chart observations`

→ immutable chart evidence

→ `registry.artist.create/v1` creates a draft identity

→ `registry.artist_origin.admit/v1` may admit origin if separately supported/confirmed

→ a later lifecycle operation may activate the Artist if independently justified.

Creation and origin admission are separate exact operations, even when the UI presents them as one guided workflow.

If creation succeeds but origin admission fails, the new draft Artist remains a valid journaled identity requiring later review. The system does not roll back cultural identity history merely to mimic the legacy shell transaction.

## 20. Existing chart commit can tolerate draft Artists

The current `findOrCreateRegistryArtist(...)` helper already creates Artists with `status='draft'` during chart commit/reingest and then uses those IDs/slugs for track credits/chart entries.

Therefore `chart_create_artist_origin_shell(...)` does not need to create or force Artists active for the chart product to function.

Any public Artist-page visibility implications of draft status remain lifecycle/product concerns; they are not a reason to collapse activation into creation.

## 21. Chart resolver credential convergence

This is a binding security requirement, not optional cleanup.

Current `chart-ingest-api` loads `SUPABASE_SERVICE_ROLE_KEY` globally.

Under the programme threat model, deleting visible Artist `.insert()`/RPC calls while leaving that credential in the same resolver would not close the authority bypass: compromised code could still issue direct service-role Registry DML.

Therefore #939 cannot close while `chart-ingest-api` retains ambient service-role Registry mutation authority.

### Target runtime

`chart-ingest-api` must use:

- `SUPABASE_URL`;
- `SUPABASE_ANON_KEY`;
- the live caller bearer JWT.

It must not load `SUPABASE_SERVICE_ROLE_KEY`.

Authentication and capability checks run under caller context.

## 22. Feasibility of caller-JWT chart operation

Production RLS audit proves the existing chart working tables already contain authenticated capability policies.

Current role implication also holds:

- every role with `manage_ingest` also has `manage_charts`;
- every role with `publish_charts` also has `manage_charts`;
- read-only chart roles can remain read-only.

This makes caller-context conversion feasible without inventing a new chart authorization vocabulary.

The implementation must still verify table-level grants and RLS together. A policy without a table grant is not effective authority.

## 23. Chart-domain write strategy

Do not solve service-role removal by granting authenticated users direct Registry DML.

For chart-domain working state:

- use existing authenticated RLS where table grants already align;
- retain the existing capability vocabulary;
- tighten any publication-table DML policy to the action capability actually intended, especially `publish_charts`;
- add only the minimum authenticated table grants needed by the server-orchestrated chart workflow;
- permanently verify that a role lacking the required capability cannot mutate those tables.

This is chart-domain authority, not Registry authority.

No new anonymous chart mutation is introduced.

## 24. Registry Track/credit materialization dependency

Removing service-role from `chart-ingest-api` exposes adjacent current Registry writes:

- `findOrCreateRegistryTrack(...)` may create a Registry Track or fill a missing preview URL;
- `ensureTrackArtistLink(...)` may create a Registry Track↔Artist credit.

Authenticated currently has Registry SELECT but no direct INSERT/UPDATE/DELETE on:

- `registry_artists`;
- `registry_tracks`;
- `registry_track_artists`.

That no-direct-DML boundary must remain intact.

#939 does **not** silently invent a universal Track primitive merely to finish Artist work.

Instead, implementation may introduce narrowly typed chart compatibility command functions for the exact existing Track materialization actions required by commit/reingest. Those functions must:

- require live caller auth;
- require the existing chart publication capability;
- accept only typed Track/credit inputs required by the chart path;
- enforce deterministic identity/collision behavior;
- expose no generic table/column/patch surface;
- preserve audit/provenance;
- be explicitly classified as remaining Slice 2 convergence debt toward future typed Track primitives.

No service-role credential remains in the Edge resolver merely to support Track creation.

If implementation audit proves a current governed Track command already satisfies these properties, reuse it instead of adding another surface.

## 25. Publication tables

The chart Edge function currently performs publication/commit work directly against `wk_chart_*` tables.

Where RLS policies exist but table-level authenticated DML grants are absent, implementation must make an explicit choice per table:

- grant the minimum authenticated DML only when RLS is tightened to the exact publication capability and database integrity gates already protect the domain invariant; or
- preserve a narrow `SECURITY DEFINER` chart command when direct table DML would bypass important commit invariants.

Do not bulk-grant all chart tables simply to make caller-JWT conversion compile.

## 26. Compatibility-function retirement

After real Preview acceptance proves the governed paths and dependency search proves no other callers:

- `chart_set_artist_origin_for_charts(...)` may be retired/revoked or converted into a fail-closed compatibility wrapper that enters the governed broker;
- `chart_create_artist_origin_shell(...)` may be retired/revoked or converted into a compatibility workflow that composes create + origin operations without activation.

Neither compatibility function may retain direct canonical DML.

Retirement happens only after proof. Historical audit rows are preserved.

## 27. No historical rewrite

This issue does not repair or reinterpret historical Artists that were:

- activated by chart shell resolution;
- assigned origin by the legacy setter;
- created with random collision suffixes;
- ambiguously matched by the existing helper.

Those rows remain historical facts of prior system behavior.

Any canonical correction requires separate evidence/reconciliation authority.

## 28. MIZIZI boundary

MIZIZI remains non-autonomous.

#939 does not:

- grant MIZIZI `create_registry_artist`;
- create a MIZIZI Artist-create standing grant;
- create a MIZIZI Artist-origin standing grant;
- give MIZIZI `manage_registry`;
- give the MIZIZI Mind service-role/postgres/arbitrary SQL;
- let MIZIZI invoke chart compatibility commands as a substitute for Registry primitives.

The new primitive is deliberately reusable by a future MIZIZI policy path, but only after an explicit bounded standing-capability decision in a later accepted step.

## 29. Required Preview acceptance

Preview acceptance must prove at minimum:

### Artist creation

- unauthenticated creation rejected;
- caller without `create_registry_artist` rejected;
- caller missing the required chart/Registry contextual capability rejected;
- exactly one draft Artist created on positive fixture;
- new Artist origin remains null after creation;
- no provider/bio/image/genre/relationship/discography field written;
- exact normalized-name collision rejected;
- exact slug collision rejected;
- stale collision-state fingerprint rejected;
- future UUID already existing rejected;
- ambiguous identity rejected rather than first-match selected;
- idempotent retry returns the same operation/Artist;
- disabled operation rejects execution;
- row/target budget cannot be widened;
- private executor/gateway cannot be called directly;
- independent verifier closes only after exact receipt/state proof.

### Chart origin

- real chart-origin review fixture enters `registry.artist_origin.admit/v1`;
- run/review/Artist binding is proved;
- overwrite attempt rejected;
- stale Artist state rejected;
- invalid ISO2 rejected;
- disabled operation rejected;
- exact-grant replay idempotent;
- separate verifier transaction required;
- wrong user/capability rejected;
- chart provenance remains queryable;
- no service-role fallback exists.

### Credential boundary

- deployed `chart-ingest-api` contains no `SUPABASE_SERVICE_ROLE_KEY` reference;
- deployed `chart-ingest-api` uses caller JWT/anon key;
- authenticated still has no direct Registry Artist/Track/credit DML;
- chart working writes succeed only under intended chart capabilities;
- publication writes fail for users without `publish_charts`;
- typed Registry compatibility commands reject arbitrary mutation shapes;
- direct legacy chart Artist DML paths are absent or fail closed.

### System invariants

- MIZIZI Artist-create standing grants: `0`;
- MIZIZI Artist-origin standing grants: `0`;
- no historical Artist rewrite;
- source soak evidence remains evidence only;
- scoring formula is unchanged by this issue.

## 30. Implementation boundaries

Keep the work to two serious internal boundaries under one #939 release train rather than proliferating speculative phases.

### Boundary A — primitive + credential foundation

- install `create_registry_artist` capability;
- install `registry.artist.create/v1` schema/evidence/grant/executor/verifier;
- add `registry_chart_admission` actor/binding;
- add chart-specific create/origin bridges;
- add permanent verifiers;
- convert chart-ingest authentication/database client to caller context;
- establish the minimum chart-domain grants/RLS corrections and narrow Registry Track/credit compatibility commands needed to remove service-role.

No legacy chart Artist writer is retired until this boundary passes Preview.

### Boundary B — product route convergence + retirement proof

- route chart commit Artist creation through `registry.artist.create/v1`;
- route chart origin review through `registry.artist_origin.admit/v1`;
- remove random-suffix/first-CI-match Artist creation fallback;
- prove chart commit/reingest with draft Artists;
- prove no service-role credential in chart resolver;
- adversarial acceptance;
- retire/fail-close legacy Artist setter/shell only after caller proof;
- replay seal;
- PR/protected CI;
- exact merged-main Production promotion;
- independent Production acceptance.

These are implementation boundaries, not independent programmes.

## 31. Non-goals

#939 does not:

- redesign chart scoring methodology;
- fix the source-count corroboration plumbing defect;
- rewrite historical chart origins;
- activate historical draft Artists;
- create a generic Artist patch operation;
- create a universal Track primitive unless separately justified by evidence;
- grant direct authenticated Registry DML;
- touch `scrape-artist-data`;
- begin Slice 3 retirement;
- enable autonomous MIZIZI execution.

## 32. Exit gate

#939 closes only when all of the following are true in Production:

- all chart-side canonical Artist creation flows enter `registry.artist.create/v1` or fail closed;
- all chart-side Artist-origin writes enter `registry.artist_origin.admit/v1` or fail closed;
- chart origin overwrite behavior is not reproduced;
- chart-origin shell no longer combines creation/origin/activation through direct DML;
- new Artists are draft-only under creation V1;
- chart resolver carries no service-role credential capable of bypassing Registry governance;
- authenticated retains no direct Registry Artist/Track/credit DML;
- chart provenance remains explicit/queryable;
- a real chart commit/create fixture and a real chart-origin fixture pass through the governed paths;
- stale/collision/replay/disabled/over-budget/wrong-cap/private-RPC/overwrite adversarial cases fail;
- MIZIZI remains non-autonomous;
- Production promotion comes from exact merged main and is independently verified.

Completion of #939 does not close Slice 2 as a whole.
