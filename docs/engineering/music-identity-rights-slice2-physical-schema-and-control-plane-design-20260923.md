# Music Identity & Rights Foundation — Slice 2 Physical Schema and Control-Plane Design

Date: 23 September 2026

Status: **DESIGN AUTHORITY — NO PRODUCTION MUTATION AUTHORIZED**

Programme authority:

- issue #1039 — `Music Identity & Rights Foundation — UUID Charts, Works, Contributions, Rights`;
- `docs/engineering/wakilisha-music-data-standards-foundation.md`;
- `docs/engineering/music-identity-rights-slice1-production-closure-and-slice2-opening-20260923.md`;
- accepted main at design open: `d7133c904f4ea3411e39753053babf1c0d40274c`.

This document defines the proposed physical schema, control-plane integration, RLS/grant posture, verifier surface, Preview fixtures, and migration-replay plan for Slice 2.

It is deliberately narrower than a full implementation specification. A migration file must not be created until this design is accepted.

## 1. Governing decisions

Slice 2 introduces only the authorities already earned by the accepted foundation:

1. Musical Work;
2. Recording-to-Work;
3. Recording Contribution;
4. Work Contribution;
5. Rights Claim;
6. external identifier assertion authority.

The design reuses:

- `editorial.people`;
- `editorial.organizations`;
- `registry_artists`;
- `registry_tracks`;
- `registry_releases`;
- `registry_labels`;
- `registry_media_assets`;
- `platform_private.registry_evidence_assertions`;
- `platform_private.registry_operation_types`;
- `platform_private.registry_execution_grants`;
- `platform_private.registry_execution_grant_targets`;
- shared Registry review authority;
- `registry_canonical_write_events`;
- `registry_identity_lineage`.

It does not introduce a generic Party table or replace existing provider-link authority.

## 2. Proposed canonical tables

### 2.1 `public.registry_works`

Purpose: canonical Musical Work identity.

Proposed columns:

| Column | Type | Null | Meaning |
| --- | --- | --- | --- |
| `id` | uuid | no | WAKILISHA Work UUID, default `gen_random_uuid()` |
| `title` | text | no | canonical public/admin title |
| `normalized_title` | text | no | comparison/search form only |
| `status` | text | no | `draft | active | needs_review | archived` |
| `metadata` | jsonb | no | bounded extension payload, default `{}` |
| `created_at` | timestamptz | no | audit |
| `updated_at` | timestamptz | no | audit |

Constraints:

- PK on `id`;
- title must be non-blank;
- normalized title must be non-blank;
- status check;
- no ISWC column as primary identity;
- no title uniqueness constraint.

Rationale:

Two distinct Works may share a title. Work identity cannot be title identity.

### 2.2 `public.registry_track_work_links`

Purpose: canonical typed Recording-to-Work relation.

Proposed columns:

| Column | Type | Null | Meaning |
| --- | --- | --- | --- |
| `id` | uuid | no | relation UUID |
| `track_id` | uuid | no | FK to `registry_tracks(id)` |
| `work_id` | uuid | no | FK to `registry_works(id)` |
| `relationship_kind` | text | no | controlled relation vocabulary |
| `status` | text | no | `asserted | supported | verified | disputed | superseded | rejected` |
| `evidence_assertion_id` | uuid | yes | FK to private evidence assertion |
| `valid_from` | timestamptz | yes | effective truth |
| `valid_to` | timestamptz | yes | effective truth |
| `superseded_by_link_id` | uuid | yes | self-FK |
| `created_by` | uuid | yes | operator identity where available |
| `created_at` | timestamptz | no | audit |
| `updated_at` | timestamptz | no | audit |

Initial relationship vocabulary:

- `embodies`;
- `adaptation_of`;
- `medley_component`;
- `sampled_work`;
- `other_reviewed`.

Rules:

- no one-to-one uniqueness between Track and Work;
- active-equivalent duplicate exact pair may be prevented with a partial unique index when `status` is not superseded/rejected;
- `valid_to >= valid_from` when both exist;
- supersession is non-destructive.

This table is canonical. `registry_entity_relationships` may project it later but cannot replace its FK authority.

## 3. Contribution tables

### 3.1 Why two physical contribution tables

Recording and Work contributions share some lifecycle semantics but currently differ materially in:

- subject;
- role vocabulary;
- Artist-persona relevance;
- performance/instrument detail;
- authorship semantics.

A universal polymorphic Contribution row is therefore premature.

### 3.2 `public.registry_track_contributions`

Purpose: Recording-side contribution authority beyond public Artist billing.

Proposed columns:

| Column | Type | Null | Meaning |
| --- | --- | --- | --- |
| `id` | uuid | no | contribution UUID |
| `track_id` | uuid | no | FK to Registry Track |
| `person_resource_id` | uuid | yes | FK to `editorial.people(resource_id)` |
| `organization_resource_id` | uuid | yes | FK to `editorial.organizations(resource_id)` |
| `artist_id` | uuid | yes | optional credited Artist persona FK |
| `credited_as` | text | yes | source/public credit snapshot |
| `role_key` | text | no | controlled recording role |
| `instrument_key` | text | yes | normalized instrument/detail token |
| `detail_text` | text | yes | bounded reviewed detail |
| `credit_order` | integer | yes | display/source order where meaningful |
| `status` | text | no | assertion/review lifecycle |
| `evidence_assertion_id` | uuid | yes | FK to private evidence assertion |
| `valid_from` | timestamptz | yes | temporal truth |
| `valid_to` | timestamptz | yes | temporal truth |
| `superseded_by_contribution_id` | uuid | yes | self-FK |
| `created_at` | timestamptz | no | audit |
| `updated_at` | timestamptz | no | audit |

Contributor identity rule:

At least one of:

- Person;
- Organisation;
- Artist persona;
- `credited_as`

must be present.

If Person or Organisation is known, Artist persona does not replace it.

Person and Organisation are mutually exclusive for one contribution row.

Initial recording role vocabulary:

- `primary_performer`;
- `featured_performer`;
- `performer`;
- `producer`;
- `recording_engineer`;
- `mixing_engineer`;
- `mastering_engineer`;
- `session_musician`;
- `conductor`;
- `vocalist`;
- `instrumentalist`;
- `other_reviewed`.

This vocabulary may be revised before migration, but uncontrolled free-text roles must not become canonical.

### 3.3 `public.registry_work_contributions`

Purpose: Work-side authorship/contribution authority.

Proposed columns:

| Column | Type | Null | Meaning |
| --- | --- | --- | --- |
| `id` | uuid | no | contribution UUID |
| `work_id` | uuid | no | FK to Registry Work |
| `person_resource_id` | uuid | yes | FK to Person |
| `organization_resource_id` | uuid | yes | FK to Organisation |
| `artist_id` | uuid | yes | optional credited Artist persona |
| `credited_as` | text | yes | source/public credit snapshot |
| `role_key` | text | no | controlled Work role |
| `credit_order` | integer | yes | source/display order |
| `status` | text | no | assertion/review lifecycle |
| `evidence_assertion_id` | uuid | yes | evidence FK |
| `valid_from` | timestamptz | yes | temporal truth |
| `valid_to` | timestamptz | yes | temporal truth |
| `superseded_by_contribution_id` | uuid | yes | self-FK |
| `created_at` | timestamptz | no | audit |
| `updated_at` | timestamptz | no | audit |

Initial Work role vocabulary:

- `composer`;
- `lyricist`;
- `songwriter`;
- `arranger`;
- `adaptor`;
- `translator`;
- `publisher_representative`;
- `other_reviewed`.

Same contributor identity rules as Recording Contribution apply.

## 4. Rights Claim authority

### 4.1 Physical model

Do not use one row with a polymorphic `subject_type + subject_id`.

Use one claim row with typed nullable FKs and database checks enforcing exactly one subject and exactly one claimant.

Proposed table:

`public.registry_rights_claims`

Proposed columns:

| Column | Type | Null | Meaning |
| --- | --- | --- | --- |
| `id` | uuid | no | claim UUID |
| `track_id` | uuid | yes | Recording-side subject |
| `work_id` | uuid | yes | Work-side subject |
| `claimant_person_resource_id` | uuid | yes | Person claimant |
| `claimant_organization_resource_id` | uuid | yes | Organisation claimant |
| `rights_domain` | text | no | `recording | work` |
| `right_type` | text | no | controlled right/share vocabulary |
| `control_type` | text | no | owner/controller/administrator/etc. |
| `territory_scope` | text | no | `worldwide | explicit | unknown` |
| `territory_iso2` | text[] | no | explicit country set, default empty |
| `usage_scope` | text[] | no | controlled usages, default empty |
| `valid_from` | date | yes | effective date |
| `valid_to` | date | yes | effective end |
| `share_state` | text | no | `known | unknown | disputed | not_applicable` |
| `share_percentage` | numeric(9,6) | yes | percentage only when known |
| `claim_status` | text | no | `asserted | supported | verified | disputed | superseded | rejected` |
| `evidence_assertion_id` | uuid | yes | evidence FK |
| `superseded_by_claim_id` | uuid | yes | self-FK |
| `created_at` | timestamptz | no | audit |
| `updated_at` | timestamptz | no | audit |

Database-enforced subject check:

- exactly one of `track_id`, `work_id` is non-null;
- `rights_domain='recording'` iff `track_id` is non-null;
- `rights_domain='work'` iff `work_id` is non-null.

Database-enforced claimant check:

Exactly one of:

- `claimant_person_resource_id`;
- `claimant_organization_resource_id`

is non-null.

Share semantics:

- `share_state='known'` requires non-null `share_percentage`;
- all other share states require NULL percentage;
- percentage range when known: `0 <= share_percentage <= 100`;
- zero is valid;
- no cross-row constraint that total claims must be <=100;
- no uniqueness rule that prevents conflicting claims.

Precision rationale:

`numeric(9,6)` preserves six decimal places without implying a financial ledger. It allows accurate fractional rights assertions while keeping a bounded domain.

Territory semantics:

The current database has no canonical territory table. Do not invent one in this slice.

Initial representation:

- `worldwide` with empty `territory_iso2`;
- `explicit` with one or more ISO 3166-1 alpha-2 codes;
- `unknown` with empty `territory_iso2`.

A future richer territory-set authority may be earned independently.

## 5. External identifier assertion authority

### 5.1 Decision

Create a narrow assertion ledger rather than overloading provider operational bindings.

Proposed table:

`public.registry_external_identifier_assertions`

Purpose:

Represent accepted, candidate, disputed, rejected, historical, and superseded external identifier assignments without replacing current provider links or canonical UUID identity.

### 5.2 Typed subject columns

Avoid one unrestricted subject tuple.

Proposed subject FKs:

- `artist_id`;
- `track_id`;
- `release_id`;
- `work_id`;
- `person_resource_id`;
- `organization_resource_id`.

Exactly one must be non-null.

No Label subject in v1 unless a concrete external identifier use case is proven before migration.

### 5.3 Proposed fields

| Column | Type | Null | Meaning |
| --- | --- | --- | --- |
| `id` | uuid | no | assertion UUID |
| typed subject FKs | uuid | one required | canonical WAKILISHA subject |
| `scheme_key` | text | no | controlled identifier scheme |
| `source_value` | text | no | exact observed value |
| `comparison_value` | text | no | scheme-normalized comparison form |
| `issuer_namespace` | text | yes | issuer/namespace where applicable |
| `assertion_status` | text | no | candidate/accepted/disputed/rejected/superseded |
| `verification_method` | text | yes | how accepted/disputed status was established |
| `verified_by` | uuid | yes | human actor where applicable |
| `verified_at` | timestamptz | yes | verification time |
| `valid_from` | timestamptz | yes | known validity start |
| `valid_to` | timestamptz | yes | known validity end |
| `evidence_assertion_id` | uuid | yes | source evidence |
| `superseded_by_assertion_id` | uuid | yes | non-destructive lineage |
| `created_at` | timestamptz | no | audit |
| `updated_at` | timestamptz | no | audit |

Initial scheme vocabulary:

- `isrc`;
- `iswc`;
- `isni`;
- `ipi`;
- `ipn`;
- `gtin`;
- `upc`;
- `ean`;
- `apple_music`;
- `spotify`;
- `youtube`;
- `soundcloud`;
- `ddex_party_id`;
- `other_reviewed`.

Provider schemes remain useful here as evidence/history, but current provider-link tables remain the operational binding authority.

### 5.4 Uniqueness

Do not create:

- `unique(scheme_key, comparison_value)`.

That would make incorrect or duplicate external assignments impossible to preserve.

Allowed uniqueness:

- assertion fingerprint / exact duplicate suppression;
- at most one current accepted assertion for the same subject + scheme + comparison value;
- provider-link tables may retain their stronger operational uniqueness independently.

Potential partial index:

`(subject identity, scheme_key, comparison_value) where assertion_status='accepted' and valid_to is null`.

No cross-subject uniqueness.

## 6. Existing direct hot-path identifier columns

Keep for compatibility and read performance:

- `registry_tracks.isrc`;
- `registry_releases.upc`;
- current provider-link identifier fields.

They become projections/cacheable canonical fields, not the historical assertion ledger.

A later convergence migration may prove synchronization semantics. Slice 2 must not remove these fields.

## 7. Evidence subject vocabulary extension

Current exact vocabulary:

- `artist`;
- `track`;
- `release`;
- `registry_relationship`;
- `track_artist_credit`;
- `release_track_membership`;
- `release_artist_credit`.

Proposed additions:

- `work`;
- `track_work_link`;
- `track_contribution`;
- `work_contribution`;
- `rights_claim`;
- `external_identifier_assertion`.

The same additions must be applied consistently to:

- `registry_evidence_assertions.subject_type`;
- `registry_execution_grant_targets.subject_type`;
- `registry_review_cases.subject_type`.

No unrestricted fallback such as `other`.

## 8. Registry operation catalogue additions

Existing Registry operations use typed subject allowlists, bounded targets/rows, 300-second TTLs, human approval, and independent verifier requirements.

Proposed operations:

### 8.1 Work

`registry.work.create@v1`

- capability: `create_registry_work`;
- risk: medium;
- subject: `work`;
- requires existing target: false;
- max targets: 1;
- max rows: 1;
- TTL: 300 seconds;
- human approval: yes;
- verifier: yes.

`registry.work.reviewed_profile.admit@v1`

- capability: `manage_registry` or a dedicated capability only if existing capability taxonomy requires it;
- risk: medium;
- existing Work target: yes;
- max rows: 1;
- TTL: 300;
- human approval + verifier: yes.

### 8.2 Track-to-Work

`registry.track_work_link.admit@v1`

- medium;
- subject: `track_work_link`;
- future relation target allowed;
- one row;
- 300-second TTL;
- human approval;
- verifier required.

`registry.track_work_link.reviewed_reconcile@v1`

- high;
- subject: `track` or `track_work_link` depending on accepted exact-set semantics;
- existing target required;
- bounded row ceiling;
- human approval;
- verifier required.

### 8.3 Contributions

`registry.track_contribution.admit@v1`

`registry.work_contribution.admit@v1`

Both:

- medium;
- one contribution;
- human approval;
- verifier required;
- no browser direct DML.

Set replacement/reconciliation operations should not be introduced until a real admin workflow requires exact-set mutation.

### 8.4 Rights

`registry.rights_claim.admit@v1`

- high risk because it records legal/rights assertions;
- one claim;
- 300-second TTL;
- human approval;
- verifier required.

`registry.rights_claim.reviewed_reconcile@v1`

- high;
- existing claim/subject;
- exact expected current state;
- non-destructive status/supersession only;
- verifier required.

No operation may "normalize" competing claims by deleting rows or forcing totals to 100.

### 8.5 External identifiers

`registry.external_identifier_assertion.admit@v1`

- medium;
- one assertion;
- human approval;
- verifier required.

`registry.external_identifier_assertion.reviewed_reconcile@v1`

- high when it changes accepted canonical projection;
- exact target/current-state binding;
- verifier required.

Provider-link admission remains separate and does not collapse into this operation.

## 9. RLS and grants

Supabase current guidance requires RLS on every table in an exposed schema and explicit grants.

All new `public` tables must:

1. enable RLS;
2. revoke ambient write privileges from `anon` and `authenticated`;
3. have no direct INSERT/UPDATE/DELETE policy for browser roles;
4. expose SELECT only where product requirements justify public or authenticated read;
5. otherwise remain unreadable through the Data API and be accessed through governed RPC/read projections.

Opening default:

- `registry_works`: no anon/authenticated writes; public SELECT may be added only for active/public projection requirements;
- `registry_track_work_links`: no direct writes; public SELECT only for verified/public-safe rows if required;
- contribution tables: no direct writes; public projection should be narrower than canonical private/admin truth;
- rights claims: no broad public SELECT in v1; canonical table should default private-to-admin/control-plane even if stored in `public` for FK convenience;
- external identifier assertions: no broad public SELECT in v1; public identifiers should continue to flow through deliberate public projections.

If a table does not need browser/Data API access, consider whether `platform_private` is the better physical schema before migration. Cross-schema FKs are already established in WAKILISHA, so schema choice must follow access semantics rather than convenience.

Security-definer mutation functions must remain in a non-exposed schema, set a safe `search_path`, enforce exact caller/grant authority, and revoke default PUBLIC execute.

## 10. Canonical write events and lineage

New canonical entities/actions should extend existing event authority rather than introduce a new audit log.

Proposed canonical write event entity types:

- `work`;
- `track_work_link`;
- `track_contribution`;
- `work_contribution`;
- `rights_claim`;
- `external_identifier_assertion`.

Proposed actions where actually used:

- `create_identity`;
- `record_assertion`;
- `record_review_decision`;
- `supersede_assertion`;
- `replace_exact_set` only where an exact-set operation is truly implemented.

Identity lineage should extend to Work only if Work merge/split/supersede is implemented in this slice.

Contribution, rights, and identifier assertion correction should primarily use row supersession/history, not pretend every assertion is an identity lineage event.

## 11. Person / Organisation / Artist composition

Existing WAKILISHA already permits real FKs into `editorial.people` and `editorial.organizations`.

Use those directly.

Do not route music contributions through:

- `editorial.credits`;
- `editorial.external_contributors`;
- `editorial.person_identity_links`

as canonical music identity.

`person_identity_links` remains useful for its existing account/author/external-contributor composition purpose. It currently has no Registry Artist target and must not be stretched into one without a separate reviewed design.

If Artist-to-Person/Organisation identity composition is needed later, design a typed governed relationship explicitly.

## 12. Migration structure

The first implementation candidate should be one coherent migration unless replay or rollback analysis proves independent migration boundaries are safer.

Expected migration responsibilities:

1. create Work table;
2. create typed Track-to-Work table;
3. create Track Contribution table;
4. create Work Contribution table;
5. create Rights Claim table;
6. create External Identifier Assertion table;
7. extend evidence/grant/review subject constraints;
8. insert disabled operation-catalogue definitions first;
9. create indexes/constraints;
10. enable RLS;
11. revoke ambient access;
12. grant only required read/control-plane roles;
13. create permanent read-only verifier;
14. enable operation rows only after all structural verifier conditions pass within the migration.

No data backfill in this migration.

No provider metadata promotion in this migration.

## 13. Permanent verifier contract

A permanent SQL verifier should fail unless all of the following are true:

- all six tables exist with expected PK/FKs;
- no generic Party table was introduced;
- Work PK is UUID;
- no external identifier is a PK;
- Rights Claim exactly-one-subject and exactly-one-claimant constraints exist;
- share-state/percentage semantics are enforced;
- no <=100 cross-row rights constraint exists;
- Track-to-Work allows multiple Works per Track;
- contribution tables reference Person/Organisation directly;
- public Artist billing tables remain unchanged;
- editorial credit tables remain unchanged;
- evidence/grant/review subject vocabularies contain the exact old + new sets;
- all new public tables have RLS enabled;
- anon/authenticated have no direct write privilege;
- operation catalogue rows have expected risk/TTL/approval/verifier values;
- current Chart UUID functions/contracts remain present;
- current provider-link unique constraints remain present.

The verifier must be read-only.

## 14. Preview fixtures

Preview proof should use synthetic/disposable rows only.

Minimum fixture set:

1. one Work with no ISWC;
2. one Track linked to one Work;
3. one Track linked to two Works to prove non-1:1 support;
4. one Person Recording contribution;
5. one Artist-persona-only unresolved public credit contribution;
6. one Person Work contribution;
7. one Organisation Work contribution;
8. one Recording rights claim with known 50.000000 share;
9. one competing Recording rights claim creating >100% total;
10. one Rights Claim with unknown share and NULL percentage;
11. two disputed ISRC assertions against different Track UUIDs;
12. two historical identifier assertions against one Track;
13. one accepted ISWC assertion against the Work;
14. one superseded identifier assertion.

Negative tests must prove:

- unknown share + numeric percentage is rejected;
- known share + NULL is rejected;
- dual Track+Work subject on one claim is rejected;
- zero claimant is rejected;
- dual Person+Organisation claimant is rejected;
- identifier row with more than one canonical subject is rejected;
- direct anon/authenticated writes are rejected;
- invalid subject type cannot enter evidence/grant/review authority.

All fixture data must be cleaned before Preview retirement.

## 15. Replay and deployment plan

Implementation sequence:

1. exact clean branch from accepted main;
2. create migration using `supabase migration new`;
3. add permanent verifier;
4. focused static/schema tests only where they defend invariants not already owned by SQL verifier;
5. one disposable Preview;
6. full baseline migration replay;
7. candidate apply;
8. run verifier;
9. run fixture positive/negative acceptance;
10. generate schema types from Preview;
11. seal replay proof;
12. CI consolidation review;
13. commit/push/PR;
14. protected CI;
15. merge;
16. separate Production SQL promotion;
17. Production migration-history proof;
18. Production permanent verifier;
19. no Edge deployment unless runtime broker code changes in the implementation PR;
20. no frontend deployment unless UI code changes;
21. cleanup fixtures/Preview;
22. closure record.

## 16. What this design deliberately does not do

Not part of Slice 2 implementation:

- provider/network backfill;
- Release label canonicalization;
- automatic composer matching;
- Artist Studio UI;
- royalty math;
- settlements;
- payments;
- DDEX production exchange;
- CWR export;
- ISWC/ISNI/IPI/IPN registration workflows;
- fuzzy identity resolution;
- automatic rights adjudication;
- destructive identifier correction;
- automatic 100% normalization;
- generic Party abstraction;
- universal Contribution table;
- universal Relationship table;
- direct browser mutation.

## 17. Design exit gate

This design is ready for migration implementation only when review confirms:

- every new authority has an earned value loop;
- no existing canonical authority is duplicated;
- the exact schema can represent unknown, disputed, conflicting, and historical truth;
- typed FKs preserve domain meaning;
- external standards remain interoperability boundaries;
- the Registry exact-operation/evidence/review control plane remains the only mutation authority;
- the proposed RLS/grant posture fails closed;
- Preview proof can demonstrate all invariants without Production mutation.

## 18. Deployment classification

For this design document:

- SQL migration needed: **No**
- Supabase Edge Function deploy needed: **No**
- Production Finish update needed: **No**
- frontend deploy needed: **No**
- Production data mutation: **No**

This document authorizes design review only.
