# Music Provenance — Cross-Stack Platform Impact Audit

Date: 29 September 2026

Related authority:

- Public Music Identity: #1068
- Public Music Identity Track actual-zero: #1094
- Music Identity & Rights foundation: #1039
- contributor operational gap:
  `docs/engineering/music-provenance-contributor-graph-operational-gap.md`
- multi-MainArtist route authority:
  `docs/engineering/public-music-identity-multi-main-artist-route-binding-authority.md`

Status: **FORWARD CROSS-STACK IMPACT CONTRACT — DOCUMENTED, NOT YET IMPLEMENTED**

## Purpose

Operational music provenance is not a local Registry-table feature.

Once WAKILISHA admits canonical Recording and Work Contributions, the resulting
graph changes the meaning and behavior of:

- canonical schema;
- public read models;
- Artist / Group / Track presentation;
- SEO and prerender output;
- Schema.org / JSON-LD;
- sitemap/canonical-route production;
- analytics and GA4 product instrumentation;
- Admin Registry review and editing;
- MIZIZI stewardship;
- CI and permanent regression tests;
- Production control-plane scopes and reviewed trigger variables;
- public search/discovery;
- evidence/trust presentation;
- Person / Organisation / Artist identity resolution.

The implementation must therefore be designed as one cross-stack programme.
It must not be delivered as unrelated schema, UI, SEO and analytics patches.

## Current architectural mismatch

Current WAKILISHA public music infrastructure is strongly oriented around:

```
Artist billing
+ Track
+ Release
+ Chart
```

The contributor foundation adds a second, richer graph:

```
Person / Organisation / Artist persona
        ↓
Recording Contribution
        ↓
Sound Recording

Person / Organisation / Artist persona
        ↓
Work Contribution
        ↓
Musical Work
```

Those graphs overlap but are not interchangeable.

The cross-stack contract must preserve that distinction everywhere.

## 1. Canonical schema and data model

### Existing authority to preserve

Reuse:

- `public.registry_track_contributions`;
- `public.registry_work_contributions`;
- `editorial.people`;
- `editorial.organizations`;
- `public.registry_artists`;
- evidence assertion authority;
- supersession and validity semantics;
- exact-grant / typed-operation governance.

Do not create a parallel contributor graph merely because the canonical tables
are currently empty.

### Required reconsideration

The schema programme must audit whether the existing foundation is sufficient
for:

- normalized role vocabulary governance;
- source role snapshots;
- instrument vocabulary and aliases;
- credited-name preservation;
- Person ↔ Artist persona relationships;
- Group ↔ Person membership with validity intervals;
- public-safe visibility state;
- contributor ordering;
- source/provenance display eligibility;
- contradiction/dispute state;
- provider/source-specific assertions;
- contribution supersession;
- contribution-to-rights separation.

A missing invariant should extend the accepted authority, not bypass it.

### Public projection requirement

Canonical/admin truth should not be exposed directly.

Introduce bounded public read projections capable of returning:

- public billing artists;
- Recording contributors;
- Work contributors;
- resolved public identities;
- unresolved credited names where public-safe;
- role and instrument;
- display/source order;
- public-safe provenance/trust fields.

## 2. Public Artist / Group / Track product

The public UI must stop treating artist strings as sufficient music provenance.

### Track detail

Track detail becomes the deepest Recording provenance page and should be able
to render structured:

- MainArtists;
- FeaturedArtists;
- performers;
- vocalists;
- instrumentalists and instruments;
- producers;
- recording/mixing/mastering engineers;
- linked Work;
- Work contributors;
- evidence/trust disclosure.

### Artist detail

The existing Artist Music tab currently organizes:

- Top Songs;
- Releases;
- Features & Appearances;
- Videos;
- Charts.

Forward presentation should derive additional role-based views from canonical
contributions, for example:

- Primary / Co-main;
- Featured;
- Produced;
- Written / Composed;
- Performed;
- Engineered;
- Mixed / Mastered;
- other reviewed roles.

These are relationship projections, not manually curated string categories.

### Group detail

Group presentation must distinguish:

- Group as public Artist persona;
- members as Persons / Artist personas;
- membership intervals;
- actual member participation on a Recording;
- contribution role on that Recording.

Membership alone must not create Recording Contributions.

### Person presentation

Where a Person is public-safe, the system should eventually support traversal
across:

- Artist personas;
- group memberships;
- Recording Contributions;
- Work Contributions;
- editorial/public biography authority.

This is a future public product decision, but the read model must not make it
impossible.

## 3. SEO / prerender authority

Current SEO infrastructure assumes the existing Artist/Track public model.

Relevant current authority includes:

- `scripts/seo/prerender-metadata.mjs`;
- `scripts/seo/build-public-sitemap-html.mjs`;
- `scripts/seo/audit-prerender-output.mjs`;
- `public/seo-prerender-routes.txt`;
- `seo-sitemap-admin` metadata authority;
- current Public Music Identity canonical-route checks.

### Required reconsideration

Prerender metadata must be able to express:

- multiple MainArtists without flattening to one fake owner;
- canonical versus alternate MainArtist Track route bindings;
- contributor-rich descriptions without creating keyword spam;
- Person versus MusicGroup identity;
- group/member relationships where public-safe;
- canonical Track provenance without duplicating pages for contributors;
- stable canonical URL from authoritative MainArtist sequence.

Prerender output must not generate a page merely because someone contributed to
a Track.

Contribution creates relationship/discovery authority, not automatic canonical
public-page authority.

### Build acceptance

The existing build chain already makes SEO/prerender part of Production
acceptance.

Contributor-provenance implementation must extend, not bypass:

- prerender generation;
- prerender audit;
- sitemap/current-route parity;
- no retired/noncanonical music URL generation.

## 4. Schema.org / JSON-LD

Current `src/components/seo/SchemaOrg.tsx` is materially narrower than the
forward provenance model.

Current limitations include:

- `MusicGroupSchema` is the only music-artist schema type;
- Artist detail currently emits `@type: MusicGroup` regardless of
  `artistType`;
- `MusicRecordingSchema.byArtist` accepts one `MusicGroup`;
- `MusicAlbumSchema.byArtist` accepts one `MusicGroup`;
- Person is available only in unrelated creator shapes, not as a first-class
  music-participant graph;
- contributor roles are not represented.

### Required redesign

The JSON-LD model must support the actual public ontology.

At minimum, review:

- MusicGroup versus Person for Artist presentation;
- multiple `byArtist` values where standards/schema support them;
- member/memberOf for public-safe groups/persons where appropriate;
- credited contributors where Schema.org has suitable vocabulary;
- producer/composer/lyricist semantics where support is reliable;
- canonical URL equality across alternate MainArtist routes.

Do not force DDEX role semantics into unsupported Schema.org properties.

Where Schema.org cannot faithfully express a WAKILISHA provenance relation,
preserve it in the product/API without inventing invalid JSON-LD.

## 5. SEO descriptions and discovery copy

Current public descriptions emphasize:

- songs;
- releases;
- charts;
- artists;
- stories.

Forward SEO can legitimately surface provenance value, but should not produce
mechanical credit dumps.

Example product vocabulary may include:

- credits;
- producers;
- songwriters;
- collaborators;
- recording personnel;
- group members.

The exact copy should be derived from public-safe verified data.

Unresolved/disputed contributor assertions must not be promoted into definitive
SEO statements.

## 6. GA4 and product analytics

Current GA4 infrastructure verifies core implementation and build-output
presence but does not define provenance interaction semantics.

Relevant authority includes:

- `scripts/analytics/audit-ga4-implementation.mjs`;
- `scripts/analytics/audit-ga4-build-output.mjs`;
- page-view and scroll-depth infrastructure;
- player events carrying page/entity/source-section context.

### New measurement questions

If provenance is a product moat, analytics must measure whether users actually
engage with it.

Candidate product events include:

- provenance section viewed;
- credits expanded;
- contributor identity opened;
- role filter selected;
- source/provenance disclosure opened;
- Track → contributor traversal;
- contributor → Track traversal;
- Artist → produced/written/performed section traversal;
- Group → member traversal.

### Analytics constraints

Do not send:

- internal evidence IDs;
- private review IDs;
- raw confidence;
- grant IDs;
- personally sensitive/private contributor data.

GA4 should receive stable public product dimensions, for example:

- entity type;
- public role class;
- source section;
- interaction type;
- public route context.

### Audit requirement

The GA4 implementation audit must evolve from merely verifying generic delivery
to also enforcing the provenance event contract once those interactions ship.

Build-output audit remains required.

## 7. Admin Registry UX

Current Admin Registry navigation exposes Artists, Tracks, Track Intake and
review surfaces, but no coherent contribution workspace.

Contributor provenance requires first-class Admin UX, not SQL/operator ceremony.

### Required lanes

Admin should support:

- contributor evidence queue;
- unresolved contributor identity;
- Person / Organisation / Artist persona matching;
- Recording-role review;
- Work-role review;
- instrument normalization;
- group-member participation review;
- conflicting provider evidence;
- supersession/retraction;
- public-safe provenance state.

### Track/Work editing

Track detail/review should expose:

- Artist billing separately;
- Recording Contributions separately;
- linked Musical Work;
- Work Contributions separately.

Do not put every participant into `registry_track_artists`.

### Decision UX

A human reviewer should see:

- source credit;
- proposed canonical identity;
- proposed normalized role;
- evidence source;
- conflicts;
- affected public presentation;
- existing canonical contribution if any;
- exact consequence of approval.

The UI should invoke bounded product commands. It should not expose grant/JIT
machinery.

## 8. Admin search and navigation

`src/data/adminSearchIndex.ts` currently has no contributor-provenance Registry
surface.

Forward Admin navigation should make contributor work discoverable under the
Music Registry rather than hiding it behind generic Tracks.

Search should support:

- credited name;
- Person;
- Artist persona;
- Track;
- Work;
- role;
- unresolved contributor candidate.

## 9. Registry knowledge contract

`docs/registry/REGISTRY_KNOWLEDGE_CONTRACT.md` currently lists:

```
Track credits -> registry_track_artists
```

That wording is now too broad.

It must be revised to distinguish:

- Track public Artist billing -> `registry_track_artists`;
- Recording Contributions -> `registry_track_contributions`;
- Work Contributions -> `registry_work_contributions`;
- Release Artist billing -> `registry_release_artists`.

This terminology matters because MIZIZI, Admin and future product work consume
the knowledge contract as architectural authority.

## 10. MIZIZI stewardship model

Current MIZIZI Track tests are heavily focused on:

- slug identity;
- Artist billing;
- featured-credit evidence gaps;
- recording-identity collisions.

Those remain valid but are not sufficient for contributor provenance.

### New finding families

MIZIZI should eventually detect:

- provider contributor evidence without canonical Contribution;
- canonical Contribution without active evidence;
- contradictory contributor roles;
- conflicting Person / Artist resolution;
- duplicate probable contributors;
- invalid role vocabulary;
- invalid instrument vocabulary;
- group membership incorrectly expanded into participation;
- Work contribution attached to Recording authority or vice versa;
- public contribution projection drift;
- public provenance statement without canonical authority;
- canonical contributor identity with stale public route/reference.

### Critical semantic change

MIZIZI must stop using “credit” as an ambiguous synonym.

Tests, rule names and docs should explicitly distinguish:

- Artist billing credit;
- Recording Contribution;
- Work Contribution;
- editorial credit.

## 11. MIZIZI tests

At minimum, extend existing permanent contracts rather than creating an
unbounded new test family.

Relevant existing suites include:

- `test/registry/mizizi-cultural-data-steward.test.ts`;
- `test/registry/mizizi-admin-workspace.test.ts`;
- `test/registry/mizizi-url-identity-production-control-plane.test.ts`;
- Music Identity & Rights authority verifiers.

Required adversarial fixtures should cover:

1. MainArtist who is also a vocalist;
2. MainArtist who is not the producer;
3. producer with no Artist persona;
4. songwriter attached to Work, not Recording;
5. one Person with a stage-name Artist persona;
6. unresolved credited name;
7. group member with proven participation on one Track only;
8. group member with no evidence of participation on another Track;
9. conflicting provider roles;
10. role supersession;
11. instrument normalization;
12. rights claim absent despite contribution;
13. public contribution projection drift;
14. contributor evidence that must remain review-only.

## 12. CI and Critical Control Plane

Contributor provenance will affect several existing acceptance surfaces.

CI must prove, where relevant:

- migration replay;
- schema/type equality;
- Registry writer inventory;
- no browser direct canonical DML;
- contribution operation exact-grant containment;
- public read/API contract;
- Admin route/build-output integrity;
- public route/build-output integrity;
- GA4 implementation/build-output;
- SEO/prerender/sitemap integrity;
- MIZIZI regression;
- Production authority zero at rest.

Do not add a parallel “contributors CI universe” if current Critical/MIZIZI
contracts can own the invariants.

## 13. Production control planes and variables

Current URL-identity control-plane workflow contains programme-specific scopes,
trigger files and confirmation variables such as:

- `PUBLIC_MUSIC_IDENTITY_BATCH_A_APPLY`;
- `MIZIZI_TRIGGER_FILE`;
- reviewed JSON trigger manifests;
- fixed accepted corpus snapshots/counts.

Contributor provenance must not be jammed into those URL-identity scopes merely
because Tracks are involved.

### Correct boundary

Contribution admission is a distinct semantic operation family:

- `registry.track_contribution.admit/v1`;
- `registry.work_contribution.admit/v1`.

It may reuse the existing Stage C JIT/exact-grant transport and zero-authority
envelope, but it needs its own reviewed scope, candidate freeze and verifier.

### Control-plane audit

Before enabling contribution admission, audit:

- operation key/version;
- capability key;
- actor;
- reviewed trigger shape;
- candidate fingerprint semantics;
- target row ceilings;
- evidence fingerprint;
- exact-grant expiry;
- replay/idempotency;
- independent verification;
- post-run authority close;
- partial-resume behavior;
- public projection handoff.

Do not use hard-coded “expected count” snapshots as permanent ontology.
Counts are programme-state evidence, not contributor identity semantics.

## 14. Public API / read contracts

Current public music APIs already expose structured Track Artist roles in some
Track-detail paths but Artist surfaces still flatten several relationships to
strings.

Forward API contracts must expose structured provenance.

Recommended conceptual shape:

```
track:
  billingArtists[]
  recordingContributions[]
  work:
    contributions[]
```

Each public contribution should have only public-safe fields, e.g.:

```
creditedName
resolvedEntity
role
instrument
displayOrder
provenanceSummary
verificationState
```

Internal evidence and grant machinery stays private.

## 15. Search and discovery

Once canonical contributions exist, search should eventually understand that a
query for a producer/songwriter may be satisfied by contributor relationships,
not only Artist billing.

This must not silently make every contributor an Artist.

Search result types should retain entity semantics:

- Artist;
- Person;
- Organisation;
- Track;
- Work;
- Release.

Discovery ranking may use contribution edges only after those edges are
canonical/public-safe.

## 16. Caching and prerender invalidation

Contribution changes can alter:

- Track credit presentation;
- Artist role sections;
- Group member participation;
- Person repertoire;
- SEO descriptions;
- JSON-LD;
- search documents.

Therefore a verified contribution write requires a deterministic downstream
invalidation/projection contract.

Do not rely on unrelated Track `updated_at` changes to accidentally refresh
all dependent surfaces.

## 17. Canonical write events and observability

Contribution operations should emit canonical write/event evidence sufficient
to answer:

- which contribution changed;
- old/new canonical state;
- underlying subject;
- evidence assertion;
- affected public entities;
- verifier receipt.

Operational metrics should distinguish:

- candidate observations;
- reviews;
- admitted contributions;
- superseded contributions;
- rejected/unresolved candidates;
- projection failures.

## 18. Migration and rollout discipline

The safe implementation order is:

1. audit existing foundation and retained evidence;
2. freeze controlled vocabularies and public-safe projection contract;
3. build read-only candidate extraction;
4. build Admin review context;
5. build one Recording Contribution admission path + verifier;
6. accept with bounded fixtures/real reviewed evidence;
7. build Work Contribution admission path + verifier;
8. add public API projections;
9. add Track presentation;
10. add Artist/Group/Person projections;
11. extend SEO/JSON-LD/prerender;
12. add analytics instrumentation;
13. add MIZIZI drift detection;
14. run whole-stack antifragile acceptance.

This sequence is not permission to turn the work into fourteen separate phases.
It is dependency order inside one coherent programme and should be collapsed
into the smallest safe number of implementation/rollback slices.

## 19. Non-goals / prohibited shortcuts

Do not:

- parse artist strings into canonical contributors;
- treat every contributor as an Artist;
- infer Person identity from name equality;
- infer group-member participation from membership alone;
- create rights claims from contribution roles;
- build a second contributor schema;
- expose canonical tables directly to public clients;
- add ungoverned direct Admin DML;
- create a parallel Production mutation framework;
- overload URL-identity control-plane scopes with contribution semantics;
- publish unresolved/disputed assertions as definitive SEO facts;
- let GA4 receive private evidence/governance identifiers.

## 20. Programme exit condition

Contributor provenance is cross-stack complete only when one reviewed canonical
Contribution can travel the entire path:

```
evidence
→ reviewed identity/role
→ exact governed admission
→ canonical Contribution
→ independent verification
→ public-safe projection
→ Track/Artist/Group presentation
→ SEO/JSON-LD where applicable
→ search/discovery where applicable
→ analytics instrumentation
→ MIZIZI drift verification
→ zero mutation authority at rest
```

and the system proves the same path cannot:

- manufacture identity;
- leak private evidence;
- duplicate Track identity;
- conflate billing with contribution;
- conflate Recording with Work authorship;
- infer rights ownership;
- bypass existing Registry governance.

## Decision summary

Contributor provenance changes the meaning of multiple existing platform
contracts.

Therefore schema, public reads, SEO/prerender, JSON-LD, GA4, Admin UX, CI,
control-plane scopes and MIZIZI must be reviewed together.

The implementation objective is not “add credits.”

It is:

> make WAKILISHA's evidence-backed music provenance graph a first-class,
> governed public product without weakening the existing Registry, identity,
> route, analytics, SEO or Production-control-plane guarantees.
