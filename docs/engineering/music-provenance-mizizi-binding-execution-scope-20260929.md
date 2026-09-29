# Music Provenance and MIZIZI — Binding Execution Scope

Date: 29 September 2026

Baseline:

- protected `main`: `9c7410102f0c54263f5cdafaf51cb428f402e23e`
- Public Music Identity parent: #1068
- Public Music Identity current Track actual-zero slice: #1094
- Music Identity & Rights foundation: #1039
- superseded/open prerender branch requiring administrative closure: #776

Status: **BINDING FORWARD EXECUTION PLAN — DOCUMENTED, NOT YET IMPLEMENTED**

This document is the execution-scope authority for turning WAKILISHA's existing
music-identity/provenance foundation into a living contributor graph, a
creator-facing provenance product, and a materially more capable MIZIZI
Registry steward.

It does not replace the previously merged architecture documents. It binds
their implementation order, UX manifestation, rollback boundaries, reuse rules,
acceptance gates, and explicit non-goals.

Related authority:

- `docs/engineering/music-provenance-contributor-graph-operational-gap.md`
- `docs/engineering/music-provenance-cross-stack-platform-impact-audit.md`
- `docs/engineering/public-music-identity-multi-main-artist-route-binding-authority.md`
- `docs/engineering/wakilisha-music-data-dictionary-v1.md`
- `docs/registry/MIZIZI_CULTURAL_DATA_STEWARD.md`
- `docs/registry/REGISTRY_KNOWLEDGE_CONTRACT.md`

---

## 1. Programme objective

The programme objective is not "add credits."

It is:

> make WAKILISHA's evidence-backed music provenance graph operational from
> evidence acquisition through canonical admission, public presentation,
> creator participation, MIZIZI stewardship, SEO/discovery, analytics and
> continuous verification — while preserving Registry identity, security and
> zero-authority-at-rest guarantees.

The system must work for WAKILISHA's own catalogue first, but its contracts
must be strong enough that the same MIZIZI machinery could later audit,
resolve, enrich or reconcile an external catalogue without becoming dependent
on WAKILISHA Admin labour.

The long-term product thesis is:

> the Registry is canonical infrastructure; MIZIZI is the provenance and
> reconciliation product.

That thesis does not authorize speculative enterprise features in this
programme. It sets the quality bar for the machinery being built now.

---

## 2. Fresh baseline established before scope freeze

A read-only Production audit on 29 September 2026 established:

| Authority | Production rows |
| --- | ---: |
| `public.registry_tracks` | 2,453 |
| `public.registry_track_artists` | 4,338 |
| `public.registry_works` | 0 |
| `public.registry_track_work_links` | 0 |
| `public.registry_track_contributions` | 0 |
| `public.registry_work_contributions` | 0 |
| `editorial.people` | 33 |
| `editorial.organizations` | 1 |
| `public.artist_claim_requests` | 2 |
| `public.artist_representations` | 0 |
| `public.community_notifications` | 4 |

The contributor-capable schema exists, but the living canonical contributor
graph is empty.

The following typed Registry operation declarations already exist:

- `registry.work.create/v1`;
- `registry.track_work_link.admit/v1`;
- `registry.track_contribution.admit/v1`;
- `registry.work_contribution.admit/v1`.

All four are currently disabled.

The canonical Work/Contribution tables currently expose no direct INSERT
authority to:

- `anon`;
- `authenticated`;
- `service_role`.

That write boundary is correct and must remain correct.

The gap is therefore not "invent contributor storage." The gap is:

1. durable evidence/attestation semantics;
2. a small number of missing identity/relationship authorities;
3. reviewed runtime brokers/executors/verifiers for already-declared operation
   families;
4. public-safe projections and product surfaces;
5. MIZIZI stewardship over the new graph;
6. safe corpus activation.

---

## 3. Binding conceptual distinctions

The following distinctions are non-negotiable across schema, APIs, UI, SEO,
analytics, MIZIZI and Admin.

### 3.1 Billing is not contribution

```
Track <-> Artist billing
```

is not equivalent to:

```
Track <-> Recording Contribution
```

and neither is equivalent to:

```
Work <-> Work Contribution
```

`registry_track_artists` remains public Artist billing authority.

It must not be described architecturally as the complete Recording credit set.

### 3.2 Recording participation is not Work authorship

Recording-side roles and Work-side roles remain separate authorities.

A Person may legitimately appear in both.

### 3.3 Contribution is not rights ownership

No contribution role may automatically establish:

- ownership;
- publishing control;
- neighbouring-rights entitlement;
- royalty entitlement;
- split percentage;
- rights claim.

### 3.4 Group membership is not Recording participation

Being a member of a Group does not prove participation on any particular
Recording.

Recording participation requires Recording-specific evidence.

### 3.5 An assertion is not a canonical fact

A self-claim, provider field, ERN contributor, third-party database row,
collaborator confirmation or other observation enters as evidence.

Canonical admission is a separate governed act.

### 3.6 Permission over an attestation is not ownership of the underlying fact

A creator may control WAKILISHA's use of that creator's attestation.

That does not erase or prevent independent evidence from establishing the same
historical fact.

---

## 4. Reuse-first execution rule

This programme must extend accepted infrastructure wherever it already provides
the correct boundary.

### Reuse

Reuse:

- `public.registry_tracks`;
- `public.registry_track_artists`;
- `public.registry_works`;
- `public.registry_track_work_links`;
- `public.registry_track_contributions`;
- `public.registry_work_contributions`;
- `editorial.people`;
- `editorial.organizations`;
- evidence assertion authority;
- canonical event/write history;
- exact-grant/JIT Registry transport;
- Artist claim/evidence/representation infrastructure;
- `community_notifications`;
- `/people/:slug`;
- public Track and Artist page shells;
- `public-content-read`;
- existing OpenAPI ownership;
- Admin Registry review command center;
- dedicated MIZIZI Admin workspace;
- existing GA4/analytics bridge;
- current SEO/prerender/sitemap chain;
- current Preview replay/schema/type-seal workflow;
- existing design-system primitives.

### Do not duplicate

Do not create:

- a second contributor store;
- a universal new Party model;
- a second Person system;
- a second Artist-claim system;
- a second notification inbox;
- a parallel provenance Admin;
- a second analytics pipeline;
- a parallel public-search engine;
- a second MIZIZI agent.

A new authority is allowed only where the audit established a real missing
invariant.

---

## 5. Genuinely missing durable authorities

The repo audit identified only a small number of structural authorities that
do not already exist.

### 5.1 First-party contribution attestation

Existing Artist claim evidence is scoped to Artist identity/representation.
It must not be overloaded into Recording/Work contribution evidence.

The provenance programme requires a first-party attestation authority capable
of preserving contribution-specific semantics.

The physical implementation may reuse existing evidence assertion primitives,
but must preserve the fields in section 6.

### 5.2 Person ↔ Artist persona bridge

There is no accepted Person↔Registry Artist identity authority.

A matching display name is not sufficient.

The new authority should mirror the governance style already used for
Organisation↔Registry Label linking rather than inventing a generalized
identity abstraction.

### 5.3 Group ↔ Person membership

No typed Group membership authority currently exists.

The generic Registry relationship graph must not be used merely because it has
generic temporal/review columns.

Membership must support:

- Group Artist;
- Person/member identity;
- role where applicable;
- `valid_from`;
- `valid_to`;
- evidence;
- review status;
- supersession/history.

### 5.4 Multi-MainArtist public route binding

The normative route-binding architecture is documented but not yet physically
implemented.

The binding invariant remains:

> every `(MainArtist UUID, semanticTrackSlug)` public route binding resolves
> to exactly one Track UUID; one Track may own more than one such binding when
> authoritative Artist roles establish multiple MainArtists.

---

## 6. First-party attestation contract

Slice 1 must capture the irreversible semantics now even though the intelligence
engines that consume them come later.

At minimum, an attestation must be able to preserve:

### Subject

- Sound Recording / Track;
- Musical Work;
- proposed contributor;
- proposed role;
- optional instrument;
- optional bounded detail.

### Actor

- asserting user;
- resolved Person where known;
- resolved Artist persona where relevant;
- stated relationship to the subject/creator;
- inviter where applicable.

### Elicitation method

The system must distinguish at minimum:

- `open_response`;
- `self_claim`;
- `suggested_confirmation`;
- `counterparty_confirmation`;
- `imported_source`.

The exact stored vocabulary may be refined during schema design, but the
semantic distinction is binding.

### Prompt provenance

Preserve:

- prompt/version;
- whether a candidate was shown before the answer;
- candidate shown, when applicable.

An unprompted answer that independently matches existing evidence is not the
same evidence as tapping "Yes" on a suggestion.

### Human lineage

Preserve enough context to later identify related evidence camps:

- who invited whom;
- who attested;
- who confirmed;
- stated relationship;
- invitation/attestation chain;
- relevant organisation/representation context where known.

The lineage resolver itself is not Slice 1 work.

### State

Support at minimum:

- asserted;
- corroborated;
- confirmed;
- disputed;
- withdrawn;
- superseded.

History must remain non-destructive.

### Permission / sharing scope

A first-party attestation must support scoped permission rather than one
`consented=true` flag.

The model must be capable of representing:

- public display;
- sharing with specified CMO/rights contexts;
- sharing with approved partners;
- third-party commercial reuse.

Preserve:

- policy/version;
- timestamp;
- actor;
- changes;
- withdrawal.

The public copy may use friendlier language such as "Sharing permissions."

---

## 7. Evidence lineage and source-use contract

Every evidence source should eventually be reasoned over as:

```
source
× claim type
× identifier agreement
× lineage independence
× recency
× permission/reuse basis
```

rather than one provider-level confidence score.

Slice 1 must capture enough evidence metadata for later reasoning, including
where applicable:

- originator;
- acquisition source;
- upstream source;
- source lineage;
- parent assertion;
- independence/lineage hints;
- attestation actor;
- verification method;
- source-use/reuse basis.

Slice 1 does not need to compute full independence graphs.

Slice 3 does.

---

## 8. Source acquisition policy

External data is bootstrap/corroboration evidence, not WAKILISHA truth.

Potential evidence classes include:

- DDEX ERN;
- future RIN/PIE-compatible inputs;
- provider metadata already retained by WAKILISHA;
- MusicBrainz;
- MLC/rights datasets where access and use terms permit;
- direct label/distributor/studio feeds;
- first-party creator attestations.

No provider gets a universal trust score.

Trust is claim-family-specific.

The programme must preserve the reuse/legal basis of source evidence.

Jaxsta is not an implementation dependency.

No commercial provider dependency may become necessary for the canonical
architecture to function.

---

## 9. Product-surface inventory

The final UX is extension-heavy.

### New route-level product surfaces

There are exactly two genuinely new route-level surfaces in this programme.

#### 9.1 Your Credits

One authenticated creator workspace.

The exact URL may follow existing authenticated route conventions during
implementation, but the product surface is fixed.

It owns:

- contribution requests needing the user's answer;
- the user's canonical and pending contribution activity;
- self-claims;
- confirmation requests;
- disputes;
- withdrawal of the user's own assertion;
- collaborator invitations;
- sharing permissions;
- provenance receipt inspection;
- links to public Person portfolio.

Do not call this surface "Studio." Artist Studio already has a specific
meaning.

#### 9.2 Credit invite landing

One minimal tokenized invitation route for a person who may not yet have a
WAKILISHA account.

It must:

- be reachable only through a valid invite;
- establish the inviter and subject context;
- avoid exposing private evidence;
- support minimal account/identity establishment;
- collect the invited person's answer;
- preserve the answer's elicitation type and invitation lineage;
- expire/revoke safely.

WAKILISHA does not cold-message people merely because their name appears in
metadata.

The existing creator shares the invitation through their own chosen channel.

---

## 10. Existing product surfaces to extend

### 10.1 Track detail

Track detail becomes the deepest public Recording provenance surface.

It should distinguish:

#### Artists

Public billing:

- MainArtist;
- co-main artists;
- FeaturedArtist.

#### Recording Credits

Examples:

- Produced by;
- Recorded by;
- Mixed by;
- Mastered by;
- Vocals;
- Guitar;
- Keyboards;
- other accepted Recording roles.

#### Songwriting / Work credits

Examples:

- Written by;
- Composed by;
- Lyrics by;
- Arranged by;
- other accepted Work roles.

Public surfaces show canonical/public-safe contributions only.

Pending claims never appear publicly.

#### Empty state

Most current Tracks have no canonical contribution rows.

The empty state must therefore be compact and useful.

Product intent:

> Credits for this recording have not been confirmed yet.

with an authenticated creator entry point such as:

> I worked on this

Final copy requires language/tone review.

The absence of credits must not dominate the Track page.

### 10.2 Artist → Music

Keep the existing Artist page shell.

Do not add another top-level Artist tab merely for provenance.

The Music tab becomes relationship-driven and may expose, where data exists:

- Top Songs;
- Releases;
- Appears On;
- Produced;
- Written;
- Performed On;
- Videos;
- Charts.

Sections render only when non-empty.

"Appears On" remains the preferred existing product language for featured/
appearance presentation.

### 10.3 Person detail

`/people/:slug` becomes the main public contributor portfolio.

Add a Music Credits experience beside existing Person work.

It should support role-based filtering such as:

- All;
- Producer;
- Writer;
- Performer;
- Engineer;
- other accepted role groups as the graph grows.

This is the creator payoff.

Do not create `/contributors/:slug`.

### 10.4 Group Artist pages

Extend Group pages after typed membership authority contains real data.

Expose:

- current/historical members where public-safe;
- validity dates where useful;
- links to Person/Artist identities.

Never infer that every member performed on every Group Recording.

### 10.5 Artist claim

Reuse the existing Artist claim/representation infrastructure.

Extend it only as needed to establish the governed chain:

```
User
→ Person
→ Artist persona
```

Do not build a second "Is this you?" identity system.

### 10.6 Notifications

Reuse `/notifications` and `community_notifications`.

Signed-in users receive provenance-related action requests there.

Do not build a provenance inbox.

---

## 11. Domain components and design-system reuse

No new base design-system primitive is required by this programme.

Reuse:

- `Sheet`;
- `Modal`;
- `SearchableSelect`;
- `WkTabs`;
- `WkButton`;
- `WkIcon`;
- existing surfaces;
- existing design tokens;
- existing Artist claim-sheet interaction patterns.

Build provenance-specific domain components on top.

Expected domain components:

### `CreditRow`

Represents:

- canonical role label;
- contributor identity;
- optional instrument/detail;
- navigation to Person/Artist identity.

### `PersonCreditChip`

Structured identity chip that knows whether a resolved identity should link to:

- `/people/:slug`;
- `/artists/:slug`;
- both through a proven persona relationship.

This replaces string parsing as identity presentation.

### `ProvenanceSheet`

Public "How we know this" receipt.

Public language only.

Never expose:

- internal evidence IDs;
- exact-grant IDs;
- rule IDs;
- raw confidence;
- internal MIZIZI taxonomy.

On mobile, use the accepted `Sheet` primitive and respect the persistent
player viewport.

### `ClaimComposer`

Default behavior asks an open question first.

Example:

> Who produced this recording?

Only after the user requests help may a suggested answer be shown.

Suggested-answer confirmations are intentionally weaker evidence than
independent open responses.

### `ConfirmationCard`

Supports responses such as:

- confirm;
- that's not right;
- I don't know.

Exact copy requires product/language review.

### `SharingPermissionsControl`

Creator-facing control for attestation sharing/use scopes.

Do not expose legal/internal field names directly.

### `ProvenanceStatus`

Private/creator/Admin status presentation.

Public canonical credits generally do not need a repeated "Confirmed" badge.

---

## 12. Scoped Person lookup

The current public Registry search contract intentionally owns five discovery
domains.

This programme does not expand it immediately.

Creator tooling may use a bounded authenticated Person/identity lookup built on
`SearchableSelect`.

This endpoint must be:

- scoped to contribution/identity workflows;
- permission-aware;
- bounded/paginated;
- non-enumerable where privacy requires;
- separate from public global search ranking.

Person may become a global search domain only after the canonical contributor
graph has sufficient depth and a separate search decision is made.

---

## 13. Public routing contract

Slice 2 must physically implement the already-merged multi-MainArtist route
binding authority.

Required invariant:

```
(MainArtist UUID, semanticTrackSlug)
→ exactly one Track UUID
```

One Track:

- one immutable Registry Track UUID;
- one semantic Track slug;
- multiple legitimate MainArtist-scoped bindings where billing authority proves
  multiple MainArtists.

One authoritative MainArtist sequence determines the canonical SEO URL.

Other co-main routes:

- resolve directly to the same Track UUID;
- are valid first-class presentations;
- are not redirects;
- emit canonical metadata to the authoritative sequence-one route.

FeaturedArtist does not gain MainArtist route ownership by being featured.

Profile membership derives from Track↔Artist role authority, not URL ownership.

Route collision review is namespace-specific per MainArtist.

---

## 14. Public read/API target

Evolve existing `public-content-read`.

Do not create a second provenance API family.

Conceptual Track shape:

```
track:
  billingArtists[]
  recordingContributions[]
  work:
    contributions[]
```

Public contribution fields should be bounded and public-safe, for example:

- creditedName;
- resolvedEntity;
- public role label;
- instrument;
- display order;
- public-safe provenance summary;
- verification/presentation state where appropriate.

Internal evidence/governance fields remain private.

Artist, Group and Person projections must derive from the same canonical graph.

The OpenAPI contract is updated in the same slice as implementation.

---

## 15. Public trust presentation

Canonical public presence already implies a contribution passed admission.

Do not clutter every row with a "Confirmed" badge.

Use a provenance affordance such as:

> How we know this

and a receipt that may express, where evidence supports it:

- confirmed by people involved;
- supported by release/provider metadata;
- source category;
- last checked date;
- disputed/historical state where product review approves public disclosure.

Exact terminology must follow WAKILISHA language/tone authority.

"MIZIZI found..." is not public-facing creator copy.

MIZIZI remains the underlying steward, not the public narrator.

---

## 16. Creator interaction rules

### 16.1 Open response first

Where feasible, ask the creator openly.

Example:

> Who produced this recording?

MIZIZI may already hold a hypothesis privately.

The user should not see that hypothesis before answering unless they explicitly
ask for help.

### 16.2 Suggested response second

If assistance is requested, a candidate may be shown.

That answer is stored as a weaker `suggested_confirmation` evidence mode.

### 16.3 Counterparty confirmation

An invited contributor may be shown the claim being made about them because
the invitation itself is the context being verified.

Their answer is stored as a distinct evidence type.

### 16.4 No cold automated outreach

Early non-user confirmation is inviter-mediated.

MIZIZI may generate the invite action and private link.

WAKILISHA does not autonomously contact a stranger because metadata names them.

### 16.5 Public safety

Never show:

- pending self-claims;
- pending counterparty claims;
- unresolved identity candidates;
- review-only contribution assertions

on public Track/Artist/Person pages.

---

## 17. MIZIZI product model

MIZIZI is the Registry-owned steward of this graph.

Admin is the exception handler.

MIZIZI should ultimately:

- discover evidence;
- preserve evidence lineage;
- identify candidate contributor/Work relationships;
- resolve identities;
- detect contradictions;
- seek additional evidence;
- route creator confirmations;
- assess independence;
- promote eligible facts through bounded Registry operations;
- independently verify post-write state;
- continuously detect drift.

The programme must not create a human metadata sweatshop.

Routine deterministic/corroborated work should not require Admin.

---

## 18. Earned autonomy model

Do not implement one global "MIZIZI autonomous" switch.

Autonomy is granted claim-family by claim-family.

Each family requires:

- accepted evidence classes;
- minimum identity proof;
- lineage/independence requirements;
- contradiction policy;
- exact allowed operation;
- target-row ceiling;
- verifier;
- supersession/rollback path;
- benchmark evidence;
- Production blast-radius limit.

Examples:

| Claim family | Initial direction |
| --- | --- |
| strongly bound identifier reconciliation | candidate for early autonomy after benchmark |
| independently confirmed contributor identity/role | candidate after real creator cohort |
| raw provider composer string | review/research |
| same-name Person merge | no automatic promotion |
| Group membership ⇒ Recording participation | forbidden inference |
| contribution ⇒ rights ownership | forbidden inference |

MIZIZI earns write authority.

It does not receive blanket permission merely because it can produce a
confidence score.

---

## 19. Human evidence independence

Source independence is not enough.

MIZIZI must eventually reason about human evidence camps.

For example:

```
artist
artist's manager
artist's label employee
```

may not be three independent witnesses.

Whereas:

```
studio-originated evidence
producer attestation
independent Work registration
```

may be materially more independent.

Slice 1 captures lineage.

Slice 3 builds the resolver.

---

## 20. Admin role

Extend the existing Registry/MIZIZI review infrastructure.

Admin should receive exceptions such as:

- unresolved Person identity;
- two plausible Artist personas;
- contradictory authoritative evidence;
- disputed canonical contribution;
- Work-vs-Recording role conflict;
- ambiguous group-member participation;
- unusual permission/reuse conflict;
- material source-lineage ambiguity blocking promotion.

Admin must not receive routine:

- exact deterministic matches;
- straightforward counterparty confirmations;
- clean self-claims already independently corroborated;
- ordinary notification work.

Contribution decisions use typed reviewed RPCs.

They must not fall through the generic browser-side decision fallback that
writes review/decision rows directly.

---

# 21. Slice 1 — Provenance Authority and Attestation Foundation

Slice 1 is the durable schema/governance boundary.

Public product behavior remains materially unchanged except where necessary for
safe internal testing.

## 21.1 Scope

Implement:

1. first-party attestation authority;
2. evidence elicitation-method storage;
3. prompt/candidate provenance;
4. human invitation/relationship lineage;
5. dispute/withdrawal/supersession;
6. source lineage/reuse metadata needed later;
7. creator attestation sharing permissions;
8. Person↔Artist persona authority;
9. typed Group↔Person membership authority;
10. bounded read-only candidate extraction;
11. reviewed Admin context for contributor/Work decisions;
12. runtime broker/executor/verifier for:
    - `registry.work.create/v1`;
    - `registry.track_work_link.admit/v1`;
    - `registry.track_contribution.admit/v1`;
    - `registry.work_contribution.admit/v1`;
13. canonical event/audit evidence;
14. zero-authority-at-rest verification;
15. generated type/schema baseline updates.

## 21.2 Explicitly not in Slice 1

Do not build yet:

- full lineage-independence resolver;
- broad autonomous promotion policy engine;
- automated non-user outreach;
- large-scale identifier enrichment;
- mass corpus backfill;
- global Person search;
- full public contribution UI;
- enterprise exports;
- split sheets/financial tooling.

## 21.3 Migration discipline

Any new migration filename must be generated by the accepted Supabase CLI
version.

Current accepted version:

`supabase@2.107.0`

Do not invent migration timestamps manually.

Run schema work first in an isolated Preview/disposable replay environment.

Do not mutate Production business rows during schema deployment.

## 21.4 Slice 1 acceptance

Fresh acceptance must prove at minimum:

- one reviewed Recording Contribution completes evidence → canonical admission;
- one reviewed Work Contribution completes evidence → Work → link → canonical
  admission as needed;
- unresolved credited name can remain unresolved without fake Person creation;
- Person↔Artist link requires reviewed evidence;
- Group membership does not create a Recording Contribution;
- contribution does not create a Rights Claim;
- self-claim alone is not silently treated as canonical;
- open-response and suggested-confirmation evidence remain distinguishable;
- dispute preserves history;
- withdrawal preserves history;
- sharing permission changes preserve history;
- contribution operation authority is disabled at rest;
- no active standing MIZIZI grant remains;
- no unconsumed exact grant remains;
- anon/authenticated clients cannot mutate canonical contribution authorities;
- service-role direct table mutation remains unavailable where the accepted
  Registry control plane requires exact-grant authority;
- migration replay passes;
- live schema/type equality passes;
- generated types are regenerated rather than hand-edited;
- Critical passes;
- relevant MIZIZI verifier tests pass.

---

# 22. Slice 2 — Creator Evidence Loop, Public Provenance UX and Route Correctness

Slice 2 turns the authority into a product.

## 22.1 New creator surfaces

Implement:

- Your Credits authenticated workspace;
- credit invite landing.

Reuse:

- existing Artist claim flow;
- existing Notifications;
- existing auth/account creation;
- existing design primitives.

## 22.2 Your Credits

At minimum support:

### Needs you

- open questions;
- confirmation requests;
- disputes needing response;
- invitations awaiting action.

### Your work

- canonical contribution;
- pending assertion;
- under-review assertion;
- disputed contribution;
- withdrawn assertion.

### Activity

- assertion submitted;
- collaborator invited;
- confirmation received;
- dispute recorded;
- canonical admission;
- supersession/withdrawal.

### Sharing permissions

Manage first-party attestation use scopes.

## 22.3 Claim flow

Use `ClaimComposer`.

Default:

- open response.

Fallback:

- suggested candidate.

Support:

- Person picker;
- "not on WAKILISHA yet" invite;
- self-claim;
- counterparty selection where allowed.

## 22.4 Invite flow

MIZIZI prepares the invitation context.

The signed-in creator shares the link.

The invite route records:

- inviter;
- invitee context;
- Track/Work context;
- role being queried;
- invite token lifecycle;
- account/user resolution if completed;
- response mode;
- response.

## 22.5 Person portfolio

Extend `/people/:slug` with canonical public music credits.

This is the principal creator-facing value proposition.

## 22.6 Track provenance

Add:

- billing artists;
- Recording Credits;
- Work/Songwriting Credits;
- compact empty state;
- "I worked on this" entry point;
- public provenance receipt.

## 22.7 Artist/Group projection

Artist Music becomes relationship-derived.

Group member presentation ships only when membership authority has accepted data.

## 22.8 Multi-MainArtist route implementation

Physically implement artist-scoped route bindings and use them consistently
across:

- Track resolution;
- Artist profile links;
- player links;
- charts;
- public API;
- share links;
- Release tracklists;
- canonical metadata;
- sitemap;
- prerender;
- related content.

No new Track/Release redirect layer.

## 22.9 Slice 2 creator cohort

Before broad public rollout, use a small real cohort:

- roughly 5–10 known Artists/producers;
- their real Tracks;
- selected collaborators.

Exercise:

- self-claim;
- open answer;
- invited confirmation;
- dispute;
- withdrawal;
- Person resolution;
- Artist persona resolution;
- Work contribution;
- Recording contribution;
- sharing permissions.

## 22.10 Slice 2 acceptance

Fresh acceptance must prove:

- pending claims are never publicly rendered;
- canonical Recording/Work contributions render from structured authority;
- Track page does not reconstruct credits from display strings;
- Artist Top Songs no longer relies on string parsing as canonical identity;
- Person Music Credits derive from canonical contribution authority;
- creator confirmation request reaches existing users through Notifications;
- non-user invite flow requires valid invitation context;
- no cold automated outreach;
- mobile provenance sheets do not collide with the persistent player;
- public Artist pages use role-derived sections;
- multi-MainArtist Track routes resolve one UUID safely;
- alternate co-main route emits correct canonical SEO URL;
- FeaturedArtist does not gain MainArtist route entitlement;
- same Artist namespace collision fails closed;
- Cross-Artist same slug remains valid;
- no new redirect rows;
- public route performance budgets remain green;
- browser interaction acceptance passes.

---

# 23. Slice 3 — MIZIZI Earned Autonomy and Cross-Stack Convergence

Slice 3 gives MIZIZI the intelligence to reduce human work safely.

## 23.1 Lineage resolver

Use Slice 1 evidence to detect:

- copied/downstream source echoes;
- probable common provider origin;
- related human evidence camps;
- independent corroboration;
- material contradictions.

Do not count database rows as independent votes.

## 23.2 Claim-family autonomy

Introduce explicit policy per claim family.

No policy ships without benchmark evidence.

Autonomous canonical writes remain bounded by existing Registry operation
authority and independent verification.

## 23.3 MIZIZI entity scope

Current MIZIZI runtime is Track/Release/Chart-oriented.

Extend it deliberately to reason over:

- Work;
- Recording Contribution;
- Work Contribution;
- Person identity candidates;
- membership/provenance drift.

Do not create a second agent.

## 23.4 MIZIZI findings

Add finding families capable of detecting:

- source contributor evidence without canonical contribution;
- canonical contribution with missing/stale evidence;
- conflicting roles;
- probable duplicate Person identities;
- invalid role/instrument vocabulary;
- Group membership incorrectly treated as Recording participation;
- Work contribution attached to Recording authority or vice versa;
- public projection drift;
- public provenance statement with no canonical authority;
- stale/superseded contribution still exposed publicly;
- use/reuse state inconsistent with presentation.

## 23.5 Admin exception lanes

Extend the current MIZIZI workspace.

Admin handles exceptions only.

## 23.6 Public API convergence

Update `public-content-read` and OpenAPI.

Retire flattened contributor-like presentation where structured authority exists.

Do not introduce a second public API family.

## 23.7 SEO / Schema.org

Correct current ontology assumptions:

- solo Artist may be `Person`;
- group/band may be `MusicGroup`;
- multiple MainArtists where Schema.org supports the structure;
- canonical URL follows route-binding authority;
- supported producer/composer semantics only where valid.

Do not force DDEX/WAKILISHA semantics into unsupported Schema.org fields.

## 23.8 Prerender and sitemap

Make all Track URL generation route-binding-aware.

Current one-Artist selector assumptions must be removed.

PR #776 must not be resurrected/rebased.

Extract still-valid tests/acceptance ideas against current main and close #776 as
superseded.

## 23.9 Analytics

Use existing analytics infrastructure.

Add bounded product events such as:

- `credits_section_viewed`;
- `credits_expanded`;
- `contributor_opened`;
- `provenance_opened`;
- `credit_claim_started`;
- `credit_confirmation_completed`;
- `credit_disputed`.

Never send:

- evidence IDs;
- review IDs;
- grant IDs;
- raw confidence;
- private permission values;
- financial information.

Extend existing GA4 implementation/build-output audits.

## 23.10 Cache/invalidation

A contribution write may affect:

- Track page;
- Person page;
- Artist page;
- Group page;
- public API projection;
- SEO metadata;
- prerender;
- future search documents.

Define deterministic downstream invalidation.

Do not rely on accidental Track `updated_at` mutation.

## 23.11 Registry terminology

Amend the Registry knowledge contract so "Track credits" no longer means
`registry_track_artists`.

Required vocabulary:

- Track Artist billing → `registry_track_artists`;
- Release Artist billing → `registry_release_artists`;
- Recording Contributions → `registry_track_contributions`;
- Work Contributions → `registry_work_contributions`.

MIZIZI tests/docs should also stop using ambiguous "credit" where a more
specific term is available.

## 23.12 Production control plane

Do not overload the URL-identity control-plane scope.

Contribution admission receives its own reviewed trigger scope/candidate freeze.

It may reuse:

- Stage C JIT transport;
- exact grants;
- zero-authority-at-rest envelope;
- canonical events;
- independent verifier patterns.

Audit/freeze:

- operation key/version;
- capability;
- actor;
- candidate fingerprint;
- evidence fingerprint;
- target row ceiling;
- grant expiry;
- idempotency/replay;
- partial-resume behavior;
- post-run authority close;
- verifier;
- downstream projection handoff.

## 23.13 Slice 3 acceptance

Fresh acceptance must prove:

- lineage resolver does not count known source echoes as independent;
- related human evidence can be grouped without erasing dissent;
- at least one benchmarked claim family may operate autonomously only through
  its bounded policy;
- forbidden inference families cannot execute;
- ambiguous Person merge cannot auto-promote;
- MIZIZI creates Admin work only when a material decision is required;
- Admin provenance decisions use typed RPCs;
- public API structured projection matches canonical contribution authority;
- SEO/prerender/sitemap route binding parity passes;
- Person vs MusicGroup JSON-LD is correct for tested entities;
- GA4 provenance events are present and privacy-safe;
- cache/invalidation acceptance proves dependent pages refresh;
- Critical passes;
- MIZIZI permanent tests pass.

---

# 24. Slice 4 — Corpus Backfill, Benchmark and Programme Closure

Slice 4 scales only what the first three slices have proven.

## 24.1 External-source ingestion

Add/enable source adapters only where:

- source access is lawful/contractually acceptable;
- reuse basis is captured;
- source maps to evidence rather than canonical DML;
- matching quality is measured on WAKILISHA catalogue.

Likely early lanes:

- existing retained Apple composer evidence;
- MusicBrainz;
- DDEX ERN;
- direct partner/label/provider evidence.

Other commercial or rights datasets are optional evidence sources, not
architecture dependencies.

## 24.2 Creator-backed gold set

Use verified first-party evidence to create a real African provenance gold set.

The first goal is quality, not volume.

## 24.3 MIZIZI Provenance Benchmark

Measure at minimum:

- autonomous canonical-write precision;
- recovered provenance/recall;
- false Person merge rate;
- false Person split rate;
- contribution-role accuracy;
- Work↔Recording linkage accuracy;
- contradiction-detection rate;
- correct abstention rate;
- human-exception rate;
- effective independent evidence count;
- correction stability after later evidence;
- processing cost/time per 1,000 Recordings.

Optimize first for precision.

MIZIZI must be excellent at knowing when not to decide.

## 24.4 Controlled backfill

Backfill progressively.

Do not begin with a blind mass import.

Every promoted row travels through the same canonical operation path as a
first-party claim.

## 24.5 Public search decision

Global Person/contributor search is not part of initial slices.

After enough canonical data exists, run a separate search/product review.

Do not weaken the existing five-domain Registry search contract incidentally.

## 24.6 Enterprise readiness

Enterprise/API productization may begin only after WAKILISHA can demonstrate:

- provenance receipts;
- measurable identity-resolution quality;
- bounded autonomy;
- source-use permissions;
- reproducible outputs;
- correction/supersession history.

Potential future MIZIZI product modes:

- Resolve;
- Enrich;
- Audit;
- Reconcile;
- Watch.

These are future product directions, not required Slice 4 UI.

## 24.7 Final Production acceptance

Programme closure requires fresh whole-stack proof of:

- canonical contribution graph non-zero and evidence-backed;
- unresolved names supported without fabricated Persons;
- no pending claims public;
- no contribution-derived Rights Claims;
- route-binding parity;
- public API parity;
- Track/Artist/Group/Person presentation parity;
- SEO/JSON-LD/prerender/sitemap parity;
- GA4 audit;
- cache/invalidation correctness;
- MIZIZI drift detection;
- schema replay;
- schema/type equality;
- RLS/ACL;
- no browser canonical DML;
- no standing operation authority;
- no active unconsumed exact grants;
- MIZIZI Production preflight;
- protected Critical Control Plane;
- representative real-browser acceptance.

---

## 25. Separate low-cost experiments

Two experiments should run alongside implementation but must not block schema or
creator UX.

### 25.1 MusicBrainz coverage audit

Evaluate the current Track corpus.

Measure:

- exact ISRC match rate;
- Recording relationship coverage;
- linked Work coverage;
- contributor-role coverage.

The result determines MusicBrainz's objective value as bootstrap evidence.

It does not determine Registry truth.

### 25.2 Ten-statement hand test

Acquire ten real distributor statements and inspect them manually.

No statement-audit product code is required for the test.

The purpose is to learn whether a statement-audit workflow creates a strong
creator-acquisition wedge.

Statements remain:

```
evidence of economic activity
≠
proof of authorship or Recording participation
```

Financial tooling/split sheets are outside this programme unless a separate
product decision is made.

---

## 26. Product copy rules

Contributor/provenance UX must follow WAKILISHA language and tone authority.

Rules:

- prefer plain-language role labels;
- do not expose internal Registry taxonomy verbatim;
- do not expose MIZIZI rule IDs;
- do not expose raw confidence scores;
- do not describe unverified claims as facts;
- do not imply legal ownership from contribution;
- do not imply independence merely because multiple sources agree;
- keep empty-state copy compact;
- use "Appears On" for the existing featured/appearance product concept;
- treat any new public badge/status term as governed vocabulary.

---

## 27. Mobile and player constraints

The audio player never disappears.

All provenance sheets, claim flows and confirmation UI must respect:

- persistent player height;
- viewport-safe action areas;
- keyboard viewport;
- touch target requirements;
- existing overlay/Sheet primitives;
- scroll containment;
- back-button semantics.

Do not create one-off fixed overlays.

Use accepted design-system primitives.

---

## 28. Security and privacy boundaries

At minimum:

- invite tokens are single-purpose and revocable/expiring;
- scoped Person lookup must not become unrestricted personal-data enumeration;
- private evidence is not exposed in public provenance receipts;
- private sharing permissions are not emitted to analytics;
- contributor evidence does not weaken existing RLS;
- canonical contribution mutation remains Registry-governed;
- browser clients never receive generic canonical table write authority;
- non-user outreach is inviter-mediated during this programme;
- private contact information is never exposed as provenance.

---

## 29. Branch, PR and deployment discipline

Each implementation slice is its own merge/rollback boundary.

Use:

- protected `main`;
- isolated worktree/branch;
- existing tests extended where practical;
- Preview replay before Production schema promotion;
- generated schema/types;
- protected checks before merge;
- exact-main deployment runners;
- post-deploy verification.

Do not combine all four slices into one long-lived mega-branch.

Do not create gratuitous micro-PR phases either.

Four slices are the intended programme boundaries.

---

## 30. Test strategy

Prefer extending existing permanent contracts.

New tests are justified where they defend durable provenance invariants.

Required adversarial coverage includes at minimum:

1. MainArtist who is also vocalist;
2. MainArtist who is not producer;
3. producer with no Artist persona;
4. songwriter attached to Work, not Recording;
5. Person with stage-name Artist persona;
6. unresolved credited name;
7. Group member proven on one Recording only;
8. Group member not inferred onto another Recording;
9. conflicting provider roles;
10. role supersession;
11. instrument normalization;
12. contribution with no Rights Claim;
13. public projection drift;
14. open response matching hidden hypothesis;
15. suggested confirmation recorded as weaker mode;
16. withdrawn attestation;
17. disputed contribution;
18. related human evidence camp;
19. copied source echo;
20. multi-MainArtist route binding same UUID;
21. FeaturedArtist no MainArtist route;
22. public pending claim absence;
23. invite token expiry/revocation;
24. provenance sheet public-safe field filtering;
25. mobile Sheet/player coexistence.

---

## 31. Stale branch / PR handling

PR #776 is historical architecture evidence, not a merge candidate.

It is materially behind current main and non-mergeable.

Action during Slice 3:

1. inspect still-valid prerender/sitemap acceptance ideas;
2. port only current-main-relevant tests/behavior;
3. document supersession;
4. close #776.

Do not rebase/revive it.

Unrelated historical branches must not contaminate this programme.

---

## 32. Interaction with #1068 / #1094

This programme does not excuse incomplete Public Music Identity closure.

It changes the architectural baseline against which remaining Track identity
work must be completed.

#1094 must not assume:

- exactly one MainArtist per Track;
- Artist URL ownership determines profile membership;
- feature-bearing title text proves featured-role authority;
- contributor graph is equivalent to billing graph.

The final #1068 whole-corpus acceptance should run after relevant Slice 2/3 route
convergence so closure proves the forward route model, not the superseded
single-owner assumption.

---

## 33. Explicit non-goals

This programme does not build:

- `contributors_v2`;
- `/contributors/:slug`;
- a new universal Party layer;
- another global search system;
- a second notification system;
- a second Artist claim platform;
- a parallel Admin application;
- a parallel MIZIZI;
- a second analytics pipeline;
- automatic Person creation from raw names;
- automated cold outreach to non-users;
- Group membership → participation inference;
- contribution → rights inference;
- public pending claims;
- raw confidence UI;
- blanket MIZIZI autonomy;
- split-sheet/royalty accounting;
- Statement Audit product code before the hand test;
- enterprise licensing UI;
- a Jaxsta dependency;
- resurrection of #776.

---

## 34. Programme exit definition

The programme is complete only when a real contribution can safely complete:

```
creator/source evidence
        ↓
identity resolution
        ↓
lineage + permission preserved
        ↓
MIZIZI assessment
        ↓
governed canonical admission
        ↓
independent verification
        ↓
Track presentation
        ↓
Person portfolio
        ↓
Artist/Group projection
        ↓
SEO/public API where appropriate
        ↓
analytics
        ↓
continuous MIZIZI stewardship
```

while fresh acceptance proves:

```
no fabricated identity
no pending claim exposed publicly
no rights inferred
no cold unsolicited outreach
no false source-independence counting
no browser canonical DML
no standing mutation authority
no duplicate provenance subsystem
```

---

## 35. Final four-slice authority

For execution and rollback, the programme is frozen as:

### Slice 1 — Authority

Evidence + attestations + permissions + Person↔Artist + Group membership +
governed Work/Contribution writers.

### Slice 2 — Participation and Public Product

Your Credits + invite flow + Person portfolio + Track credits + Artist/Group
extensions + multi-MainArtist route correctness.

### Slice 3 — Stewardship and Platform Convergence

MIZIZI lineage/earned autonomy + Admin exceptions + structured public API +
SEO/prerender + Schema.org + GA4 + cache/invalidation + CI/control planes.

### Slice 4 — Corpus and Closure

Real creator cohort + measured external backfill + African gold set + benchmark
+ controlled corpus rollout + whole-stack antifragile Production acceptance.

Four slices are the programme boundaries.

Fewer would merge materially different rollback risks.

More would mostly add ceremony rather than safety.

---

## 36. Immediate next action after this documentation merges

Do not start with public UI.

Do not start with backfill.

Do not start with a new MIZIZI automation engine.

The first implementation branch begins Slice 1 from exact protected `main`.

Before writing SQL:

1. inventory existing evidence-assertion fields against section 6/7;
2. prove which semantics require new columns/tables rather than metadata;
3. freeze Person↔Artist and Group-membership physical schemas;
4. verify v1 Work/Contribution operation payloads can express accepted writes;
5. generate any required migration filename with `supabase@2.107.0`;
6. implement/replay in Preview;
7. add permanent tests for the durable invariants only;
8. leave Production business rows unchanged until reviewed execution authority is
   accepted.

That is the authorized start of implementation.
