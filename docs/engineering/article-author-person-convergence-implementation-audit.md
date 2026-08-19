# Article Author → Person Convergence Implementation Audit

Date: 19 August 2026

## Status

Implementation audit and milestone boundary.

No production SQL is approved by this document.

No production account deletion is approved by this document.

No frontend deployment is approved by this document.

The milestone begins from accepted merged main:

`1caf1cdf79c396fbbab86e18cc3bdbc4d50e6a70`

## Product decisions locked by the owner

1. `/u/:username` remains a first-class public account route.
2. `/people/:slug` is the canonical cross-role public human identity route.
3. `/authors/:slug` is deprecated as an independent public profile product.
4. Existing `/authors/:slug` URLs become compatibility redirects to canonical Person routes.
5. `public.registry_authors` remains a valid typed editorial identity authority underneath Person.
6. `WAKILISHA Staff` is not a Person.
7. Institutional authorship will be handled in a later institutional/Organization Credit milestone.
8. The canonical Person for Muiruri Beautah is `/people/beautah`.
9. `beautahj` was a throwaway account and may be deleted after dependency proof.

## Canonical Beautah survivor

Surviving Person Resource:

`891bbfed-1d67-42a5-93d2-984e3f4ffe9f`

Canonical path:

`/people/beautah`

Existing account identity:

`97040153-3e7f-4491-b680-73769d5c1a47`

Username:

`beautah`

## Reviewed Muiruri identities to merge into Beautah

External-contributor-backed Person:

`75100f5b-0e76-47c4-91b8-d5f5557212c0`

Current canonical path:

`/people/muiruri-beautah`

Registry-Author-backed Person:

`e0fa2ef4-8ec4-49f5-8fff-4b4230a9a65a`

Current canonical path:

`/people/muiruri-beautah-e0fa2ef4`

Registry Author:

`9262021a-6b53-422f-96ae-d970004e04a9`

Both source People must be merged through the governed Person merge authority.

Historical Credits must not be rewritten.

After merge, existing legacy routes remain compatibility inputs and resolve to `/people/beautah`.

## Throwaway beautahj account

User:

`7ea8fb65-287b-409e-9bb9-a81bc74e4e75`

Username:

`beautahj`

Person Resource:

`12604a1a-3b9a-44ca-8c11-9f5805d7137e`

Current path:

`/people/beautahj`

Measured production footprint before implementation:

- 0 Shared Credits
- 0 Posts
- 0 Comments
- 0 received Notifications
- 0 actor Notifications
- 4 Follow rows owned by the throwaway user
- 0 Person-target Follow rows pointing at the throwaway Person
- 0 Community contributions
- 0 moderation/review records
- 0 SEO authority rows
- 0 Media upload sessions
- 1 Person Resource
- 1 Person identity link
- 1 append-only Person identity event
- 1 Person alias

Because Person identity events are append-only, the Person audit tombstone must not be physically erased merely to delete the throwaway account.

Required cleanup shape:

1. retire the account-backed Person identity link;
2. clear preferred identity if required by integrity;
3. make the throwaway Person non-public and archived;
4. retire `/people/beautahj` from public canonical routing;
5. remove the throwaway account and its account-owned Follow state;
6. preserve append-only Person identity history.

The account is deleted. The Person audit tombstone is retained as non-public governance history.

## Current Article authority

Production currently contains:

- 207 current public Article Resources;
- 25 current public Articles already carrying a primary public-safe Author Credit;
- 24 Hafare Segelan Articles already reconciled;
- 1 Muiruri Beautah Article already credited through an external-contributor identity;
- 79 current public Articles attributable to 11 other unambiguous Registry Authors but not yet credited;
- 30 additional current public Muiruri Beautah Articles not yet credited;
- 73 current public Articles with legacy byline `Wakilisha Staff`.

The 134 current public Articles attributed to named humans are the Person-convergence set.

The 73 `Wakilisha Staff` Articles remain outside Person.

## Article migration rule

For named human authors:

- Shared Credit is canonical attribution authority;
- Credit resolves to canonical Person through active typed Person identity links;
- Credit attachment binds to the exact current published Article version;
- legacy `wk_articles.author` remains a historical/display snapshot;
- immutable `article_versions.author_display` remains a historical/display snapshot;
- no migration rewrites historical author display merely to change identity authority.

For `Wakilisha Staff`:

- preserve existing byline;
- do not create a fake Person;
- do not include Staff Articles in Person body of work;
- defer canonical institutional attribution to the Organization/Institutional Credit milestone.

## `/authors` deprecation contract

Current route:

`/authors/:slug`

must cease rendering the independent `AuthorProfilePage`.

Compatibility resolution must:

1. resolve Registry Author slug to the active linked Person;
2. follow Person merge chains to the final active public survivor;
3. obtain the server-authoritative canonical Person path;
4. redirect to that path;
5. never infer Person identity from Article byline text;
6. never rebuild Person paths from display names in the browser.

Public author-link producers must stop constructing `/authors/<slug>` and use canonical Person paths.

SEO/prerender authority must stop treating `/authors/:slug` as a canonical independent page.

`/u/:username` remains unchanged.

Admin Registry Author routes remain unchanged.

## Milestone implementation sequence

### Gate A — Authority and compatibility audit

- enumerate every public `/authors/` producer;
- enumerate SEO/prerender author-route authority;
- prove Registry Author → Person resolver path;
- prove merge command behavior and exact revisions;
- prove throwaway-account deletion dependencies;
- prove current Article Credit cardinality.

No mutation.

### Gate B — Disposable preview

Fresh preview must replay the full accepted migration baseline before milestone SQL is tested.

### Gate C — Person reconciliation and account cleanup rehearsal

In preview only:

- merge external Muiruri Person → Beautah;
- merge Registry Author Muiruri Person → Beautah;
- verify all source routes resolve to Beautah;
- verify historical Credits resolve to Beautah without mutation;
- retire beautahj Person identity and route;
- delete beautahj account;
- verify no unrelated account or Person changed.

### Gate D — Human Article Credit backfill

Backfill the exact current published versions for the reviewed named-human set.

Acceptance:

- all 134 current public human-authored Articles have one primary public-safe Author Credit;
- all 134 resolve to a canonical Person;
- 73 Staff Articles remain outside Person;
- no historical byline text changes.

### Gate E — Public route convergence

- `/authors/:slug` becomes compatibility redirect only;
- public Magazine author links use canonical Person paths;
- `/people/:slug` remains canonical human profile;
- `/u/:username` remains first-class account profile;
- admin Registry Author surfaces remain.

### Gate F — Production promotion

Only after fresh-preview proof, permanent verifier, critical tests, protected CI, and exact migration-history parity.

## Explicit non-goals

This milestone does not:

- create Organization Resource authority;
- migrate `Wakilisha Staff`;
- remove `registry_authors`;
- remove `/u/:username`;
- rewrite historical Article versions;
- infer identity from names or email;
- merge any Person not explicitly approved in this audit.

## Gate A findings

### Public Author route inventory

The current public Author product is broadly referenced.

The inventory includes:

- the `/authors/:slug` public route;
- lazy loading of `AuthorProfilePage`;
- Magazine home and section components;
- desktop and mobile Article bylines;
- editorial StoryCard and MagazineCard components;
- About-page contributor links;
- Playlist credit presentation tests;
- SEO prerender metadata;
- public API specification;
- analytics page-view classification;
- Institute record-search routing.

Admin `/admin/registry/authors/...` routes are separate and remain.

### Existing Person public read authority

`public.get_public_person(p_slug text)` already:

- resolves a Person Resource alias;
- follows a Person merge chain;
- requires the final Person to be active;
- requires final Resource visibility `public`;
- requires final Resource lifecycle `active`;
- returns the server-authoritative canonical Person path;
- exposes `redirect_to` for legacy Person aliases.

It does not resolve Registry Author slugs directly.

Therefore the milestone needs a narrow Registry Author → Person compatibility resolver rather than a second public profile model.

### Human Article manifest lock

Current public human-authored Article rows:

`134`

Already carrying accepted primary public-safe Author Credits:

`25`

Missing primary public-safe Author Credits:

`109`

Locked full-human manifest SHA-256:

`676c3a87f7e016715408d4f4f0f50699105a804fae7cfb11f540a2f216312ff0`

Locked missing-credit manifest SHA-256:

`1ff5ff3b56890cc9cf0d5004f899b679eef2225e19989d5fbd9bfdec424ee220`

The manifest digest is calculated over the ordered tuple:

`article_id | resource_id | current_published_version_id | slug | legacy_author | registry_author_id | registry_author_slug | active_registry_author_person_id`

The migration must reconstruct the reviewed manifest and refuse mutation if either digest moves.

### Named-human Article counts

- Frank Njugi: 21 missing
- gatwiri_c: 1 missing
- Hafare Segelan: 24 already accepted
- Kambura Matiri: 14 missing
- Kiuta Faith: 1 missing
- Mary Gathoni: 1 missing
- Michael Mburu: 5 missing
- Muiruri Beautah: 31 total, 1 already accepted, 30 missing
- Sarah Wambi: 1 missing
- Shalom Kendi Mbae: 20 missing
- Timothy Muiruri: 1 missing
- Victor Muia: 10 missing
- Wangari Karume: 4 missing

Total missing human Author Credit attachments:

`109`

`Wakilisha Staff` remains 73 current public Articles and is excluded from this manifest.

### Beautah merge state

Canonical survivor:

`891bbfed-1d67-42a5-93d2-984e3f4ffe9f`

Current identity revision:

`1`

External-contributor-backed source:

`75100f5b-0e76-47c4-91b8-d5f5557212c0`

Current identity revision:

`1`

Registry-Author-backed source:

`e0fa2ef4-8ec4-49f5-8fff-4b4230a9a65a`

Current identity revision:

`1`

There are currently zero Person Follow rows targeting either source or the survivor.

The migration can therefore refuse to run if Person Follow state appears before promotion rather than silently inventing a second follow-transfer implementation.

### Throwaway account state

`beautahj` has no cultural work and no non-cascade operational authority rows.

The Person Resource has one append-only identity event.

Therefore the account may be deleted, but the Person audit tombstone must be archived instead of physically deleted.


## Gate A correction after command and FK audit

This section supersedes the earlier tentative mutation shape where it conflicts.

### Existing Person merge command is authoritative

Production already has the governed command:

`public.merge_people(uuid, uuid, bigint, bigint, text, text, uuid)`

It implements:

- `person.merge` durable command receipts;
- authenticated capability enforcement through `merge_people_identity`;
- source and target revision checks;
- conflict checks;
- immutable source-link supersession and replacement target links;
- one source revision increment;
- one target revision increment;
- merge correlation events;
- Person Follow transfer/deduplication evidence;
- source merge state;
- visibility refresh;
- idempotent replay.

Therefore this milestone must not reproduce Person merge internals in a data migration.

The two approved Muiruri → Beautah reconciliations are separate governed command executions after fixture hydration and before the permanent convergence verifier.

Expected revision sequence from the reviewed production boundary:

1. external-contributor Muiruri source revision 1 → Beautah target revision 1;
2. Registry Author Muiruri source revision 1 → Beautah target revision 2.

The second command must expect target revision 2 because the first merge increments Beautah exactly once.

### beautahj hard deletion requires its own identity-retirement authority

The exact `beautahj` `person_created` event references the exact account-backed Person identity link.

Current schema has:

- `person_identity_events.identity_link_id` → `person_identity_links.id` with `ON DELETE RESTRICT`;
- `person_identity_links.user_id` → `user_profiles.user_id` with `ON DELETE RESTRICT`;
- `user_profiles.user_id` → `auth.users.id` with `ON DELETE CASCADE`;
- Person identity events are append-only;
- Person identity-link source fields are protected against retargeting.

Therefore deleting the identity link would violate durable audit history, while deleting the Auth user would cascade toward a `user_profiles` row still protected by the historical identity link.

The Article/Person convergence migration must not weaken or bypass those constraints.

`beautahj` account deletion is moved to a dedicated account-identity retirement gate that can preserve the historical link/event while severing live Auth dependency in a governed, reusable way.

The owner-approved intent to delete the throwaway account remains locked.

It is deferred from the Article migration, not abandoned.

### Core migration boundary after correction

The SQL migration now does only:

1. exact locked 109 current-version human Article Author Credit backfill;
2. narrow public Registry Author → canonical Person compatibility resolver;
3. preflight requiring the existing governed Person merge command.

The separate controlled preview sequence is:

1. hydrate reviewed authority fixtures;
2. apply SQL candidate;
3. execute external Muiruri → Beautah through `public.merge_people`;
4. execute Registry Author Muiruri → Beautah through `public.merge_people`;
5. run the permanent read-only convergence verifier;
6. prove historical Credits were not mutated.

Frontend `/authors` convergence remains a later frontend gate in this same milestone.
