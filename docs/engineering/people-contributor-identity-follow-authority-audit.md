# People, Contributor Identity, and Follow Authority Audit

Date: 11 August 2026

## Status

Authority audit only.

No schema migration is approved by this document.

No frontend implementation is approved by this document.

This audit begins after PR #599, `Add Playlist Art and published update review continuity`, was squash-merged and live-product accepted.

The immediate product trigger is real public account creation on WAKILISHA before the account experience is mature. This is a product signal, not an authority shortcut.

Backend/editorial users also have WAKILISHA accounts. Therefore raw `auth.users` counts must never be treated as organic public-user counts.

## Product problem

WAKILISHA now has first-class editorial work whose public presentation carries credited human identity:

- Articles have authors and Credits.
- Playlists have curators and Credits.
- Shared Credits already support researcher, contributor, editor, interviewer, producer, host, photographer, reviewer, fact checker, and other roles.
- Guides and future resource kinds need the same human attribution model.

However, WAKILISHA does not yet expose one coherent public body of work for a person across those roles and resource types.

Following is similarly fragmented:

- the Community Follow table is generic;
- Artist following is already in product use;
- public users can have stable handles and profiles;
- credited editorial people may not have authenticated accounts;
- the current Follow command accepts arbitrary target strings rather than a canonical person target.

The desired product is:

> A reader follows a person, not a role.

The same human may be a curator on one work, an author on another, a researcher on a Guide, and a contributor elsewhere.

## Existing identity authorities

### 1. Authenticated account authority

`auth.users`

Purpose:

- authentication
- login identity
- security actor identity

This is not public cultural/person identity.

It includes public members and people with backend/editorial access.

It must not become the canonical credited-person table.

### 2. Canonical public account profile

`public.user_profiles`

This is the canonical public identity for an authenticated WAKILISHA account.

Existing username contract explicitly establishes:

- `username`
- `username_normalized`
- public profile fields
- handle history
- stable public handle semantics

The existing account migration explicitly treats legacy `community_profiles` hydration as compatibility and states that `community_profiles` is not the canonical identity table.

Therefore:

- account public identity belongs to `user_profiles`;
- `community_profiles` must not be promoted to canonical person identity.

### 3. Community projection

`public.community_profiles`

Purpose:

- community reputation/activity projection
- comment/contribution counts
- trust level
- role-label presentation
- community-specific profile reads

It is not the canonical authenticated-account identity.

It currently exists for only a subset of `user_profiles`.

### 4. Editorial credited-person authority

`public.registry_authors`

Purpose:

- durable editorial person identity
- public author/contributor slug
- name, bio, location, imagery, social links
- identity usable without requiring a WAKILISHA login

This remains valid and necessary.

A credited person may never create a WAKILISHA account.

### 5. External contributor authority

`editorial.external_contributors`

Purpose:

- credited people who are neither Registry Authors nor authenticated WAKILISHA users
- explicit public-safety and consent governance
- durable identity for external credited parties

This remains valid and necessary.

External contributor identity must not be silently converted into account identity.

## Existing Shared Credit identity model

`editorial.credits` already enforces exactly one credited-party identity path:

- `registry_author_id`
- `user_id`
- `external_contributor_id`

The public-facing snapshots preserve:

- display name
- Registry Author slug
- user username
- role label

This is strong evidence that Shared Credits was intentionally designed to support multiple legitimate human-identity authorities.

The new people layer must consume that design rather than replace it.

## Current production evidence

At audit start, production contains:

- authenticated/user-profile records;
- Registry Author records;
- community profile projections;
- Community Follow rows;
- Shared Credit rows of all three supported identity kinds;
- an external contributor record.

Do not interpret raw authenticated-account totals as organic public adoption because backend/editorial users also create accounts.

The product owner has independently observed approximately five unprovoked public-user account creations. Treat that as the product signal; do not derive it from raw staff-inclusive auth counts.

Top 50 Kenyan Songs Of 2025 demonstrates the credited editorial-person path:

- Playlist curator: Hafare Segelan
- Credit role: `curator`
- credited party: `registry_author_id`
- public-safe Shared Credit
- Registry Author slug: `hafare-segelan`

That credit is correctly not represented as an authenticated-user credit merely because a public profile product exists.

## Current profile-product gap

`/authors/:slug` is currently article-centric.

Its body of work is assembled from Articles instead of Shared Credits across public Resources.

`/u/:username` is an authenticated-account/community profile.

It currently presents community identity and activity rather than a complete cross-format editorial body of work.

These are not interchangeable routes or authorities.

The desired public experience may converge visually, but the underlying identity sources must remain explicit.

## Existing Follow authority

`public.community_follows` stores:

- `user_id`
- `target_type`
- `target_id`
- `target_slug`
- `created_at`

Unique state is keyed by:

`(user_id, target_type, target_id)`

`public.community_set_follow_state(...)` is idempotent and authenticated.

`public.community_get_user_follows(...)` is intentionally self-only.

These are useful foundations.

### Current Follow problems

The write command currently accepts arbitrary target strings and does not validate a target against a canonical target registry.

That is acceptable for the existing bounded usages only because the caller conventions provide the identity.

It is not sufficient for a durable people graph.

Public follower counts and public follower/following views do not yet have narrow read authorities.

The existing self-only follow reader must not simply be opened to anonymous/public access.

## Required permanent model

### Principle 1: Follow a person, not a role

A Follow relationship must survive role changes and cross-format work.

Examples:

- Hafare as Playlist curator
- Hafare as Article author
- Hafare as Guide researcher
- Hafare as contributor to another publication

All should resolve to one followable human identity when WAKILISHA knows they are the same person.

### Principle 2: Do not collapse identity authorities

The permanent model must preserve:

- authenticated account identity;
- public account-profile identity;
- Registry Author identity;
- external-contributor identity;
- historical Credit snapshots.

A new canonical person layer may link these authorities, but must not erase or overwrite them.

### Principle 3: Identity linking must be explicit

Email equality is discovery evidence only.

It must not become permanent person-link authority.

The current Author ownership helper uses email comparison as a temporary ownership heuristic and explicitly anticipates future explicit account linking.

Permanent person linking requires:

- explicit durable link records;
- link provenance;
- link actor;
- link timestamp;
- link state;
- conflict handling;
- unlink/repair path;
- protection against two canonical people being silently merged.

### Principle 4: External credited people remain first-class

A person must be able to:

- appear in public body-of-work output;
- receive a stable public identity;
- be followed where public-safety policy permits;

without first creating a WAKILISHA account.

If that person later creates or claims an account, existing public identity and follower relationships must survive the link.

### Principle 5: Account creation must add value without becoming a prerequisite for cultural identity

WAKILISHA membership should make the reader's relationship with culture accumulate:

- people followed;
- Artists followed;
- Playlists or other entities followed/saved where appropriate;
- saved work;
- comments;
- contributions;
- reputation/community history;
- later, a Following/My Feed experience.

But editorial credit must never require registration.

## Candidate architecture

The next design step should evaluate a stable `person` authority rather than prematurely selecting an existing table.

A viable person authority would need:

- stable person UUID;
- public lifecycle/exposure state;
- canonical public slug or alias support;
- preferred public presentation identity;
- links to zero or one current Registry Author identity;
- links to zero or one authenticated account identity;
- links to zero or more reconciled external-contributor identities where governance permits;
- explicit merge/split/reconciliation history;
- no direct replacement of `registry_authors`, `user_profiles`, or `external_contributors`.

The audit must determine whether this should be:

1. a new `editorial.people` / shared-platform table;
2. a typed Resource-backed person domain;
3. another narrow identity registry compatible with existing Resource authority.

Do not choose until the Resource-kernel implications are reviewed.

## Body-of-work read model

The public body of work should be generated from immutable/public Shared Credits, not inferred from mutable author foreign keys.

A person-body-of-work read model should be able to return:

- public resource identity;
- resource kind;
- public route;
- title;
- image/cover where public-safe;
- publication date;
- credited role on that exact public version;
- primary/secondary credit;
- role label;
- public status.

It should initially support resource kinds that have canonical Resource + public publication authority.

Current Resource kinds include Article and Playlist.

Guide support must wait until Guide itself has canonical Resource/publication authority rather than inventing a parallel person-work join.

## Follow target design

Do not use raw Registry Author IDs, user IDs, or external-contributor IDs as three separate public person-follow namespaces if those identities may later reconcile to one human.

Preferred direction:

`community_follows.target_type = 'person'`

with `target_id` identifying the stable canonical person identity.

Existing Artist follows remain Artist follows.

Entity following and person following are separate valid graph edges.

## Public follower read model

New narrow authorities are required for:

- follower count for a public person;
- following count for a public account, subject to privacy policy;
- whether the current signed-in viewer follows a given public person;
- paginated public followers/following only if product policy explicitly allows it.

Do not expose the raw `community_follows` table.

Do not weaken the existing self-only private follow reader.

## Claim/link lifecycle

Future contributor account claiming/linking should support:

1. authenticated user requests link to a public credited person;
2. evidence is collected;
3. privileged review approves/rejects;
4. explicit link is written;
5. public person identity remains stable;
6. existing followers remain attached to the person;
7. account profile gains ownership/management affordances;
8. historical Credit snapshots remain unchanged.

This must not be implemented as automatic email matching.

## Product order

Recommended implementation order:

1. person/identity authority design;
2. explicit identity-link authority;
3. public person read model;
4. cross-format body-of-work read model from Shared Credits;
5. validated person Follow target;
6. public follower-count/viewer-state read models;
7. Contributor/Person profile product;
8. link Playlist curator and Article/other Credits to that profile;
9. Follow UI on contributor/person surfaces;
10. Following experience / feed consequences;
11. account-claim flow for credited people.

## Explicit non-goals for the first implementation slice

Do not build yet:

- recommendation ranking;
- engagement-maximizing feed algorithms;
- direct messages;
- vanity follower leaderboards;
- auto-linking by email;
- account-required editorial credit;
- Guide-specific shadow identity;
- migration of every legacy author surface in one PR.

## Immediate next question

Before schema design, inspect the existing Resource kernel and decide whether a canonical Person should itself be a WAKILISHA Resource.

That decision determines:

- alias/slug authority;
- correction/provenance support;
- future citations/credits to people;
- public lifecycle;
- relationship to Registry Author identity.

No migration should be written until that boundary is explicit.

## Resource-kernel decision: Person is a Resource

Decision status: accepted for schema design.

Canonical Person must be a first-class WAKILISHA Resource.

This is not a decision to turn all human-related records into one universal table.

It is a decision to give one human identity the stable cross-domain identity guarantees already provided by the Resource kernel while preserving typed domain authorities.

### Why Person qualifies as a Resource

Person requires:

- one stable UUID that Follow can target;
- durable route and alias identity;
- cross-format body-of-work relationships;
- account claiming without changing the public identity;
- Registry Author reconciliation without changing the public identity;
- external-contributor reconciliation without changing the public identity;
- future correction and provenance targeting;
- future command, job, and outbox aggregation where people-governance workflows require it.

Those are Resource-kernel responsibilities.

They are not ordinary profile-row responsibilities.

### Typed Person authority

Add future Resource kind:

`person`

The canonical typed Person table should be:

`editorial.people`

Preferred identity shape:

- `resource_id uuid primary key`
- `resource_kind text not null default 'person'`

`resource_id` should also be the stable Person UUID.

Do not introduce a second unrelated Person UUID unless implementation rehearsal proves a concrete need.

The Person row is the typed binding for the Resource, following the same direct-resource-identity pattern already used by Correction Case authority.

The generic deferred Resource binding invariant must gain an explicit `person` branch.

### What Person owns

Person authority should own only cross-source human identity and reconciliation state.

Candidate Person-owned facts:

- stable Person identity;
- public lifecycle/exposure state where more specific governance is required;
- preferred display identity selection;
- identity reconciliation state;
- merge/split state;
- claim/link state summary;
- timestamps and trusted actors for identity-governance changes.

Person must not become a duplicate authority for every profile field.

### What existing authorities continue to own

`auth.users` continues to own:

- authentication;
- login actor identity;
- security session identity.

`public.user_profiles` continues to own:

- authenticated account public handle;
- account profile fields;
- username history;
- account public/private preference.

`public.registry_authors` continues to own:

- Registry Author editorial profile data;
- editorial contributor slug;
- editorial bio and imagery;
- existing author-profile compatibility.

`editorial.external_contributors` continues to own:

- external credited-party identity;
- consent status;
- public-safety state;
- external contact/governance metadata.

`editorial.credits` continues to own:

- immutable credited-party snapshots;
- role on the work;
- exact credited identity path;
- historical attribution.

The Person layer links these authorities.

It does not overwrite them.

### Explicit identity links

Person linking must use durable typed foreign keys.

A future identity-link authority may use one table with three nullable typed foreign-key columns, provided it enforces exactly one source identity per row:

- `registry_author_id`
- `user_id`
- `external_contributor_id`

or equivalent separate typed link tables.

Do not use:

- `identity_type text + identity_id text`;
- arbitrary JSON identity pointers;
- email as the durable link;
- display-name equality as the durable link.

Required link governance includes:

- link state;
- link provenance/evidence;
- linked by;
- linked at;
- reviewed by where applicable;
- reviewed at where applicable;
- unlink/supersede reason;
- conflict protection;
- uniqueness preventing one source identity from being actively linked to multiple People.

### Follow target

Permanent person-follow target:

`community_follows.target_type = 'person'`

`community_follows.target_id` should carry the stable Person Resource UUID as text for compatibility with the existing Follow table.

The write command must validate that:

- the target parses as UUID;
- the Person Resource exists;
- the Person typed binding exists;
- the Person is eligible for public following;
- a user cannot create a malformed or arbitrary `person` target.

Existing Artist Follow remains separate.

Do not migrate Artist follows into Person follows.

### Route and alias authority

Person needs one canonical public route eventually.

The exact namespace is intentionally not selected by this audit.

Candidates include a dedicated Person or Contributor namespace.

Existing routes must remain compatibility inputs:

- `/authors/:slug`
- `/u/:username`

When a Registry Author and an account are explicitly reconciled to one Person:

- their old public routes may become Resource aliases;
- the stable Person Resource remains unchanged;
- username changes must not change Person identity;
- author-slug changes must not change Person identity;
- retired paths must not be silently reused for another Person.

The existing Resource alias contract is therefore materially useful to Person identity.

### Public Resource index

When Person receives a canonical public route, `public.wk_resource_index` must gain a typed `person` branch.

Do not expose internal Person reconciliation tables directly.

The public index should continue exposing only narrow stable resource-reference data.

### Account ownership

A Person may exist without an authenticated account.

Therefore `editorial.resources.owner_id` must remain nullable for Person.

If a credited Person later claims or links an account, account ownership may be reflected in Resource ownership only after the explicit identity-link/claim contract is approved.

Do not set Resource ownership from email matching.

Do not require `owner_id` for a public Person.

### Body-of-work authority

A Person's public body of work must be derived from Shared Credits attached to the current public version of each Resource.

The read model must not enumerate every historical attachment.

For versioned Resources, include a work only when:

- the Resource is publicly eligible;
- the Credit attachment targets the Resource's current published version;
- the attachment is public-safe;
- Credit governance is public-safe and active;
- external-contributor governance passes where applicable;
- the Credit's typed party identity resolves through an active Person identity link.

The body-of-work row should preserve the role from the exact public Credit.

Therefore one Person can appear as:

- Author on an Article;
- Curator on a Playlist;
- Researcher on a future Guide;
- Contributor on another work;

without creating separate follow identities.

### Resources without canonical publication authority

Do not invent a shadow body-of-work path for a domain that does not yet have canonical Resource/publication authority.

Article and Playlist are valid first adopters.

Guide joins only after Guide has canonical Resource identity and public-version authority.

### Corrections and identity disputes

Person being a Resource makes it eligible for stable cross-resource references and future correction/provenance integration.

However the current Correction target model is exact-version oriented.

The first Person migration must not pretend that existing Correction commands already support Person profile corrections.

Person versioning or a dedicated identity-dispute workflow must be designed explicitly before direct Person correction application is enabled.

Resource identity provides the stable target.

It does not silently grant unsupported correction semantics.

### Merge and split requirement

Because no automatic email merge is permitted, duplicate real-world humans may temporarily exist as separate Person identities.

Before public account claiming can reconcile two existing public People, the platform needs explicit merge/split governance.

A merge must preserve:

- the surviving Person Resource UUID;
- Follow edges;
- route aliases;
- body-of-work links;
- source identity links;
- historical Credit snapshots;
- merge provenance.

A split must be possible when an identity reconciliation was wrong.

Do not implement destructive Person-row deletion as reconciliation.

### Existing account creation

Backend/editorial access and public membership both create authenticated accounts.

This does not alter Person authority.

Every authenticated account may eventually have a Person identity where its public-profile policy permits.

Staff status, subscriber status, editorial role, or backend capability must not determine whether the underlying human can have stable Person identity.

Product analytics must still distinguish public-user adoption from backend/staff account creation separately.

### First implementation boundary after schema design

The first implementation should prove Person authority with a narrow vertical slice.

Preferred proofs:

1. one Registry Author-backed Person, using Hafare Segelan;
2. one authenticated-account-backed Person;
3. one external-contributor-backed Person where public-safety governance permits.

The proof must demonstrate:

- stable Person Resource creation;
- exact typed identity links;
- no automatic cross-identity merge;
- one public Person read contract;
- body-of-work resolution from current published Credits;
- validated Person Follow state;
- no weakening of existing private Follow reads.

Do not implement feed ranking in this slice.

## Resource decision conclusion

Person is a WAKILISHA Resource.

The stable Person UUID is the Person Resource UUID.

Existing identity authorities remain intact and are reconciled through explicit typed links.

Follow targets Person Resource identity.

Public body of work is derived from exact current-public Shared Credits.

The next task is schema and command design.

No migration is authorized until that design is reviewed.
