# People, Contributor Identity, and Follow Schema and Command Design

Date: 11 August 2026

## Status

Design contract only.

No migration is authorized by this document.

No frontend implementation is authorized by this document.

This design implements the accepted authority decision in:

`docs/engineering/people-contributor-identity-follow-authority-audit.md`

The permanent product rule is:

> Follow a person, not a role.

## Problem layer

This is a shared identity, trust, community, and public-read problem.

It is not a Playlist-specific feature.

It is not an Article-author-page patch.

It is not an auth-table redesign.

The system must let one human accumulate public work and followers across roles while preserving the authority of:

- authenticated accounts;
- public account profiles;
- Registry Authors;
- external contributors;
- immutable Shared Credits;
- stable WAKILISHA Resources.

## Locked existing authorities

### Resource authority

`editorial.resources`

provides:

- stable UUID identity;
- resource kind;
- owner;
- visibility;
- lifecycle;
- current version pointers where adopted;
- immutable typed binding;
- stable route aliases.

The Resource identity and kind cannot be retargeted after creation.

### Public account identity

`public.user_profiles`

is the canonical public profile for an authenticated account.

`auth.users`

remains authentication and security-actor authority.

### Registry Author identity

`public.registry_authors`

remains the editorial Registry Author authority.

### External contributor identity

`editorial.external_contributors`

remains the governed identity for credited people outside account and Registry Author authority.

### Credit authority

`editorial.credits`

remains immutable.

Each Credit has exactly one credited party:

- `user_id`;
- `registry_author_id`;
- `external_contributor_id`.

Roles stay on Credits.

Roles do not become Person identities.

### Follow authority

`public.community_follows`

remains the durable Follow-state table.

Existing uniqueness:

`(user_id, target_type, target_id)`

remains valid.

Existing Artist Follow remains valid.

Existing self-only Follow reads remain private.

## Decision 1: Add Resource kind `person`

Add:

`person`

to:

`editorial.resource_kinds`

Person is a stable cross-domain identity.

The Person Resource UUID is the canonical Person UUID.

## Decision 2: Typed Person table

Create:

`editorial.people`

### Columns

- `resource_id uuid primary key`
- `resource_kind text not null default 'person'`
- `person_state text not null default 'active'`
- `identity_revision bigint not null default 1`
- `preferred_identity_link_id uuid`
- `merged_into_person_resource_id uuid`
- `created_by uuid`
- `updated_by uuid`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### Resource binding

`(resource_id, resource_kind)`

references:

`editorial.resources(id, resource_kind)`

with:

`resource_kind = 'person'`

The Resource binding is permanent.

### Person states

Initial values:

- `active`
- `merged`
- `archived`

### State rules

`identity_revision >= 1`

If:

`person_state = 'merged'`

then:

- `merged_into_person_resource_id` is required;
- it cannot equal `resource_id`.

If Person is not merged:

`merged_into_person_resource_id` must be null.

The merge target must be another Person Resource.

A merged Person remains durable.

It is not deleted.

## Decision 3: Extend Resource binding integrity

`editorial.assert_resource_binding_integrity()`

must gain:

`when 'person'`

and require exactly one row in:

`editorial.people`

for the Person Resource.

Do not weaken existing Article, Playlist, Playlist Item, Registry Artist, Media Asset, or Correction Case branches.

## Decision 4: Person identity links

Create:

`editorial.person_identity_links`

### Purpose

Link one stable Person to one or more existing typed identity authorities without replacing those authorities.

### Columns

- `id uuid primary key default gen_random_uuid()`
- `person_resource_id uuid not null`
- `person_resource_kind text not null default 'person'`
- `user_id uuid`
- `registry_author_id uuid`
- `external_contributor_id uuid`
- `link_state text not null default 'active'`
- `link_method text not null`
- `link_reason text not null`
- `supersedes_link_id uuid`
- `superseded_by_link_id uuid`
- `created_by uuid`
- `created_at timestamptz not null default now()`
- `retired_by uuid`
- `retired_at timestamptz`
- `retired_reason text`

### Typed source rule

Exactly one of:

- `user_id`
- `registry_author_id`
- `external_contributor_id`

must be non-null.

Do not use:

- `identity_type text`;
- `identity_id text`;
- arbitrary JSON identity pointers.

### Foreign keys

`person_resource_id`

binds to:

`editorial.people(resource_id)`

`user_id`

binds to:

`public.user_profiles(user_id)`

with deletion restricted until the Person link is governed.

`registry_author_id`

binds to:

`public.registry_authors(id)`

with deletion restricted.

`external_contributor_id`

binds to:

`editorial.external_contributors(id)`

with deletion restricted.

### Link states

Initial values:

- `active`
- `disputed`
- `superseded`
- `retired`

### Link methods

Initial controlled values:

- `migration_seed`
- `account_provisioning`
- `registry_author_provisioning`
- `external_contributor_provisioning`
- `admin_reconciliation`
- `claim_approved`
- `person_merge`
- `person_split`

Do not use email matching as a link method.

### Active-link uniqueness

One source identity can belong to only one active Person.

Use partial unique indexes for active:

- `user_id`
- `registry_author_id`
- `external_contributor_id`

A Person may have at most one active account identity.

A Person may have at most one active Registry Author identity.

A Person may have more than one active external-contributor identity after explicit reconciliation.

### Preferred public identity

`people.preferred_identity_link_id`

must reference an active identity link belonging to the same Person.

Use a composite deferred foreign-key or deferred integrity trigger.

The preferred link selects the first presentation authority.

It does not copy every source profile field into `editorial.people`.

## Decision 5: Public eligibility is derived

Person visibility must not be decided from staff role or subscriber role.

Backend access and public membership both create accounts.

Person public eligibility is based on active linked identity authorities.

Create internal helper:

`editorial.refresh_person_visibility(uuid)`

### Public eligibility

A Person is public when:

- Person state is `active`; and
- at least one active identity link is publicly eligible.

### Account identity eligibility

A linked account is publicly eligible when:

- `user_profiles.status = 'active'`; and
- `user_profiles.is_public = true`.

### Registry Author eligibility

A linked Registry Author is publicly eligible when the Registry Author exists and remains eligible for the existing public Author surface.

Do not derive this from an authenticated role assignment.

### External contributor eligibility

A linked external contributor is publicly eligible only when:

- `contributor_state = 'active'`;
- `public_safe = true`;
- `consent_status in ('granted', 'not_required')`.

### Resource projection

If eligible:

- Person Resource visibility becomes `public`;
- Person Resource lifecycle becomes `active`.

If no linked identity is publicly eligible:

- Resource visibility becomes `internal`.

If Person is archived:

- Resource lifecycle becomes `archived`;
- visibility becomes `internal`.

If Person is merged:

- source Person visibility becomes `internal`;
- public resolution uses the merge target.

## Decision 6: Person presentation resolution

Create internal resolver:

`editorial.resolve_person_presentation(uuid)`

The resolver returns presentation data without exposing internal identity-link governance.

### Source precedence

1. active preferred identity link;
2. active Registry Author link;
3. active account link;
4. active public-safe external-contributor link.

The precedence is deterministic fallback only.

A trusted command may change preferred identity.

### Registry Author presentation

May supply:

- display name;
- bio;
- avatar;
- cover;
- location;
- public social links;
- Registry Author slug.

### Account presentation

May supply:

- display name;
- username;
- bio;
- avatar;
- cover;
- city;
- country.

Do not expose account email.

### External contributor presentation

May supply only public-safe fields:

- display name;
- public role;
- public URL;
- location.

Never expose:

- contact email;
- contact phone;
- internal notes.

## Decision 7: Canonical Person route

Canonical public namespace:

`/people/:slug`

This route is role-neutral.

It can represent:

- ordinary public members;
- writers;
- curators;
- researchers;
- contributors;
- editors;
- other credited people.

Do not use `/authors/:slug` as the permanent cross-role namespace.

Do not use `/u/:username` as the permanent cross-role namespace.

Those remain compatibility routes.

### Canonical route creation

At Person creation, create one canonical:

`editorial.resource_aliases`

path:

`/people/<slug>`

The slug seed comes from:

1. Registry Author slug when creating from Registry Author;
2. username when creating from account;
3. normalized display name for external contributor.

If the canonical path already belongs to another Resource, append a deterministic short suffix derived from the Person Resource UUID.

Do not silently steal a path from another Resource.

### Route stability

A username change does not change Person identity.

A Registry Author slug change does not change Person identity.

The canonical `/people/` route does not need to change automatically when a source identity handle changes.

A future governed alias command may change Person canonical route while preserving retired aliases.

## Decision 8: Compatibility routes

Existing routes remain valid during migration:

- `/authors/:slug`
- `/u/:username`

When those source identities resolve to a Person, the frontend may redirect or render through the canonical Person read.

Do not remove existing routes in the foundation migration.

Do not bulk rewrite inbound links in the foundation migration.

## Decision 9: Public Person read

Create:

`public.get_public_person(text)`

Input:

canonical Person slug or canonical `/people/` path segment.

### Output

Return a narrow JSON object containing:

- `person_id`
- `canonical_path`
- `display_name`
- `bio`
- `avatar_url`
- `cover_url`
- `location`
- `username` when public and linked
- `registry_author_slug` when linked
- `public_roles`
- `follower_count`

Do not return:

- auth email;
- contact email;
- contact phone;
- internal notes;
- link-method evidence;
- admin actors;
- private identity conflicts.

### Merged Person resolution

If the requested Person is merged:

- follow `merged_into_person_resource_id`;
- stop at an active final Person;
- return the final Person canonical path;
- return a redirect indicator to the caller.

Set a strict maximum merge-chain depth.

Reject cycles.

The old Resource alias remains owned by the old Person Resource.

Do not retarget Resource identity.

## Decision 10: Append-only Person identity events

Create:

`editorial.person_identity_events`

### Columns

- `id uuid primary key default gen_random_uuid()`
- `person_resource_id uuid not null`
- `actor_id uuid`
- `event_type text not null`
- `identity_link_id uuid`
- `related_person_resource_id uuid`
- `prior_identity_revision bigint`
- `resulting_identity_revision bigint`
- `reason text`
- `correlation_id uuid`
- `created_at timestamptz not null default now()`

### Initial events

- `person_created`
- `identity_linked`
- `identity_disputed`
- `identity_unlinked`
- `preferred_identity_changed`
- `person_merged`
- `person_split`
- `person_archived`
- `person_restored`

Events are append-only.

Every successful governed Person identity mutation increments `identity_revision` exactly once.

Rejected or no-op commands do not increment it.

## Decision 11: Capabilities

Add:

- `view_people_identity`
- `manage_people_identity`
- `merge_people_identity`

Initial least-privilege grants:

### Administrator

- all three.

### Editor

- `view_people_identity`

### Registry Editor

- `view_people_identity`

Do not grant merge authority broadly in the first release.

## Decision 12: Automatic one-source Person provisioning

Create internal helpers:

- `editorial.ensure_person_for_user(uuid)`
- `editorial.ensure_person_for_registry_author(uuid)`
- `editorial.ensure_person_for_external_contributor(uuid)`

### Critical rule

These helpers only deduplicate the exact same typed source identity.

They do not attempt to decide whether two different source identities are the same human.

Examples:

A user profile and Registry Author with the same email must not auto-merge.

A similar display name must not auto-merge.

A matching social URL must not auto-merge.

### User provisioning

A new account profile may receive its own Person automatically.

This includes people with backend access.

Staff status does not disqualify a human from Person identity.

Product analytics must separately classify staff/backend and public adoption.

### Registry Author provisioning

A Registry Author may receive its own Person automatically.

### External contributor provisioning

An external contributor may receive an internal Person automatically.

Public visibility remains governed by contributor consent and public-safety state.

## Decision 13: Existing-source backfill

Do not perform a blind broad backfill in the first foundation migration.

### Foundation proof set

Prove exactly:

1. Hafare Segelan as a Registry Author-backed Person;
2. one existing account-backed Person;
3. one external-contributor-backed Person if the contributor passes public-safety requirements.

### Acceptance

Verify:

- three stable Person Resource identities;
- exact typed links;
- no automatic cross-source merge;
- canonical `/people/` alias creation;
- public visibility derived correctly;
- private/sensitive fields excluded.

Only after proof acceptance should the adoption migration backfill other eligible source identities.

## Decision 14: Shared Credit to Person resolution

Create internal resolver:

`editorial.resolve_credit_person(uuid)`

Input:

`credit_id`

Resolution uses the Credit's one immutable party identity.

### User Credit

Resolve:

`credits.user_id`

through active:

`person_identity_links.user_id`

### Registry Author Credit

Resolve:

`credits.registry_author_id`

through active:

`person_identity_links.registry_author_id`

### External contributor Credit

Resolve:

`credits.external_contributor_id`

through active:

`person_identity_links.external_contributor_id`

Historical Credit snapshots remain unchanged.

The Person relationship is a read-time identity resolution.

Do not rewrite historical Credits during Person reconciliation.

## Decision 15: Public body of work

Create paginated public function:

`public.list_public_person_work(uuid, integer, timestamptz, uuid)`

Inputs:

- Person Resource UUID;
- limit;
- optional publication-date cursor;
- optional Resource UUID cursor.

### Supported first resource kinds

- `article`
- `playlist`

Guide is explicitly deferred until Guide has canonical Resource and publication-version authority.

### Current-public rule

A work appears only when the matching public-safe Credit is attached to the exact current published version.

Do not enumerate historical Credit attachments.

### Article branch

Require:

- Article Resource is public and published;
- Resource current published version exists;
- Credit attachment targets that exact Article version;
- Credit attachment is public-safe;
- Credit governance is public-safe and active;
- external contributor governance passes when applicable;
- Credit resolves through an active identity link to the requested Person.

Use immutable Article-version fields for title and publication presentation where available.

Use canonical Resource alias for route.

### Playlist branch

Require:

- Playlist Resource is public and published;
- current published Playlist version exists;
- Credit attachment targets that exact Playlist version;
- Credit attachment is public-safe;
- Credit governance is public-safe and active;
- external contributor governance passes when applicable;
- Credit resolves through an active identity link to the requested Person.

Use the public Playlist publication snapshot or exact current published version for public presentation.

Use canonical Resource alias for route.

### Multiple roles on one work

Return one work row per Resource.

Aggregate all public-safe roles for that Person on the exact current public version.

Preserve:

- role key;
- role label snapshot;
- display order;
- primary-credit status.

One Person can therefore be Author and Researcher on the same work without duplicate cards.

### Body-of-work output

Each row should expose:

- `resource_id`
- `resource_kind`
- `canonical_path`
- `title`
- `summary` where public-safe
- `image_url` where public-safe
- `published_at`
- `roles`
- `is_primary`

No internal review state is exposed.

## Decision 16: Public role summary

`get_public_person(...)`

may derive `public_roles` from distinct roles present in current-public body-of-work Credits.

Do not use account RBAC roles such as:

- administrator;
- editor;
- subscriber;
- writer;

as public creative-role labels merely because those roles are assigned to the account.

Public contributor roles come from Shared Credits.

## Decision 17: Validated Person Follow authority

Permanent Follow representation:

- `target_type = 'person'`
- `target_id = person_resource_id::text`

### Existing generic Follow function

`community_set_follow_state(...)`

must not remain an arbitrary bypass for Person targets.

When:

`p_target_type = 'person'`

the function must:

1. parse `p_target_id` as UUID;
2. resolve merged Person identities to the active final Person;
3. require active Person typed binding;
4. require public Person eligibility;
5. reject malformed IDs;
6. reject archived People;
7. reject a self-follow when the viewer has an active account link to that Person;
8. derive canonical target slug/path server-side;
9. write the final active Person Resource UUID.

Do not trust caller-supplied Person slug.

Existing non-Person Follow behaviour remains unchanged unless a separate defect is found.

### Toggle function

`community_follow_target(...)`

inherits the same Person validation through:

`community_set_follow_state(...)`

Do not create a second uncontrolled Person Follow write path.

## Decision 18: Person Follow viewer state

Create authenticated narrow read:

`public.community_get_person_follow_state(uuid)`

It returns only the signed-in viewer's state for one Person.

Output:

- `person_id`
- `followed`

It must not expose another user's private Follow state.

## Decision 19: Public follower count

Create public narrow read:

`public.get_public_person_social_summary(uuid)`

Initial output:

- `person_id`
- `follower_count`

Do not expose follower identities in the first release.

Do not expose public Following lists in the first release.

Do not weaken:

`community_get_user_follows(uuid)`

which remains self-only.

## Decision 20: Account privacy synchronization

When an account profile changes:

- `is_public`;
- `status`;

refresh every linked Person visibility.

Do not tie Person visibility to account RBAC roles.

Username and presentation-field updates should become visible through Person presentation resolution when that account is the preferred identity.

Canonical `/people/` route stays stable unless changed through a separate governed alias command.

## Decision 21: External contributor governance synchronization

When an external contributor changes:

- `contributor_state`;
- `public_safe`;
- `consent_status`;

refresh every linked Person visibility.

A consent withdrawal can make an external-only Person non-public without deleting the Person or historical Credits.

## Decision 22: Person merge

A merge means:

source Person is the same real human as target Person.

Merge is a high-risk identity command.

Command type:

`person.merge`

### Required capability

`merge_people_identity`

### Inputs

- source Person Resource UUID;
- target Person Resource UUID;
- expected source revision;
- expected target revision;
- reason;
- idempotency key.

### Preconditions

- source and target are distinct active People;
- neither is already merged;
- both expected revisions match;
- active account-link cardinality will remain valid;
- active Registry Author-link cardinality will remain valid;
- no merge cycle is possible.

If both People have different active account identities, reject.

If both People have different active Registry Author identities, reject.

The operator must resolve those conflicts explicitly before merge.

### Link transfer

For every active source identity link:

- create a new target Person link with `link_method = 'person_merge'`;
- retain the old source link as history;
- mark old source link superseded;
- cross-reference superseding links.

Historical Credits do not change.

Body-of-work resolves through the new active target links.

### Source Person state

Set:

`person_state = 'merged'`

and:

`merged_into_person_resource_id = target`

Source Resource becomes internal.

Source Resource identity and aliases remain intact.

### Route behaviour

Old source `/people/` route resolves source Person, sees merge pointer, and redirects to target canonical Person route.

Do not move or retarget the source Resource alias.

### Follow transfer

Followers of source Person must not disappear.

Update source-only Follow rows from source Person ID to target Person ID.

If the same user already follows target, preserve one target Follow row and record that the source row was deduplicated.

Do not change Artist follows or unrelated entity follows.

## Decision 23: Follow-transfer history for merge safety

Create private append-only:

`editorial.person_follow_merge_transfers`

### Columns

- `id uuid primary key default gen_random_uuid()`
- `merge_event_id uuid not null`
- `user_id uuid not null`
- `source_person_resource_id uuid not null`
- `target_person_resource_id uuid not null`
- `source_follow_id uuid`
- `target_follow_id uuid`
- `transfer_mode text not null`
- `source_follow_created_at timestamptz`
- `target_follow_preexisted boolean not null`
- `created_at timestamptz not null default now()`

Transfer modes:

- `moved`
- `deduplicated`

This table is not public.

It exists so future split logic can distinguish transferred Follow intent from target Follow intent.

## Decision 24: Person split

Command type:

`person.split`

Split implementation is not required in the first migration, but its contract is locked now.

A split reverses one reviewed merge when identity reconciliation was wrong.

### Split principles

- source Person Resource is reactivated;
- original source identity links can be restored from preserved link history;
- merge-created target links are superseded;
- old source Resource aliases already remain attached to source, so route identity naturally returns;
- Follow transfer history is used conservatively.

### Follow restoration

For a `moved` Follow:

restore it to source only if the exact transferred Follow row still exists and has not been replaced by later user action.

For a `deduplicated` Follow:

restore source Follow only when the pre-existing target Follow still exists and current evidence does not show the user explicitly withdrew the merged relationship.

Do not resurrect a Follow after the user has explicitly unfollowed.

If intent is ambiguous, preserve current user state and require manual resolution rather than guessing.

## Decision 25: Identity link and unlink commands

Command types:

- `person.identity_link`
- `person.identity_unlink`
- `person.merge`
- `person.split`

These commands use durable command receipts.

They are synchronous unless later evidence proves a background job is needed.

The command platform may still record a completed durable job/outbox event according to existing platform conventions.

### Link command

Inputs:

- Person Resource UUID;
- expected identity revision;
- exactly one typed identity ID;
- link method;
- reason;
- idempotency key.

### Unlink command

Inputs:

- Person Resource UUID;
- expected identity revision;
- identity-link UUID;
- reason;
- idempotency key.

Unlink must reject an operation that would leave a public Person with no valid public presentation unless the command also makes the Person internal or archived.

## Decision 26: Account deletion boundary

A live Person identity link must not disappear through an unmanaged account deletion cascade.

The Person account link should therefore restrict deletion until a governed unlink/account-removal workflow runs.

That workflow may:

- retire the account identity link;
- preserve the Person if another legitimate public identity remains;
- archive/internalize a user-only Person where appropriate;
- preserve historical Credits;
- preserve non-account cultural attribution when independently justified.

Do not solve legal/account deletion by retaining private profile data in Person.

## Decision 27: Person ownership

A Person can exist with no account.

Therefore Resource `owner_id` is nullable.

For a Person with exactly one active account identity:

Resource `owner_id` may be set to that account user ID.

For a Person with no account link:

`owner_id` remains null.

Do not infer ownership by email.

## Decision 28: Public account provisioning path

After foundation proof acceptance, the adoption migration should integrate:

`community_ensure_user_account(...)`

with:

`editorial.ensure_person_for_user(...)`

The integration must be idempotent.

Existing account creation continues to work if Person provisioning already exists.

A backend/editor account and a public subscriber account use the same Person identity rules.

Product analytics remain responsible for distinguishing account cohorts.

## Decision 29: Public Author and account profile migration

Frontend migration order:

1. add canonical `/people/:slug` page;
2. make Playlist curator identity link to canonical Person;
3. make current Article author/contributor identity link to canonical Person where resolved;
4. make `/authors/:slug` resolve to Person where available, with legacy fallback during transition;
5. make `/u/:username` resolve to Person where available, with legacy fallback during transition;
6. preserve owner/edit controls through explicit account and Registry identity links.

Do not delete the existing Author or Public Profile implementations until parity is proven.

## Decision 30: Person profile product composition

The canonical Person page should eventually contain:

- public identity;
- Follow action;
- follower count;
- role summary from Credits;
- body of work across formats;
- community activity when an account identity exists and the account permits it.

Community activity and editorial work are separate sections.

Do not fabricate community history for non-account People.

Do not hide editorial work merely because the Person has no account.

## Decision 31: First database implementation sequence

### Migration A: Person identity foundation

Create:

- `person` Resource kind;
- `editorial.people`;
- `editorial.person_identity_links`;
- `editorial.person_identity_events`;
- Person Resource binding integrity;
- Person presentation resolver;
- Person visibility resolver;
- `/people/` canonical alias helper;
- narrow public Person read;
- three pinned proof People only.

Do not bulk backfill.

Do not touch frontend.

### Live acceptance A

Verify:

- Hafare Registry Author proof;
- account proof;
- external-contributor proof when eligible;
- exact typed links;
- no automatic cross-source merge;
- correct visibility;
- canonical routes;
- sensitive fields absent;
- zero migration drift.

### Migration B: Person reconciliation and body of work

Add:

- command capabilities;
- durable command types;
- identity link/unlink command authority;
- merge command authority;
- merge Follow-transfer history;
- split contract support required by merge history;
- Credit-to-Person resolution;
- Article body-of-work branch;
- Playlist body-of-work branch;
- paginated public Person work read.

### Live acceptance B

Prove:

- Hafare resolves Top 50 as Curator;
- one Article author resolves current-public Article work where current public Credit exists;
- historical non-current Credit attachments do not leak into body of work;
- merge preserves public route resolution and Follow state in controlled fixtures;
- no historical Credit mutation occurs.

### Migration C: Follow validation and source adoption

Patch:

- `community_set_follow_state(...)` Person validation;
- `community_follow_target(...)` through the validated setter;
- one-Person viewer Follow-state read;
- public follower-count read;
- account-profile visibility synchronization;
- external-contributor visibility synchronization;
- idempotent automatic Person provisioning;
- reviewed bulk backfill of eligible account, Registry Author, and external-contributor identities.

### Live acceptance C

Prove:

- valid Person Follow succeeds;
- invalid arbitrary Person target fails;
- self-follow fails;
- merged Person target resolves to survivor;
- unfollow succeeds;
- private Person cannot gain new followers;
- existing Artist Follow behaviour remains intact;
- self-only generic Follow reader remains protected.

## Decision 32: Frontend implementation sequence

Only after database acceptance A, B, and C:

1. Person service contract;
2. `/people/:slug`;
3. shared Follow control;
4. Playlist curator link and Follow affordance;
5. Article contributor links;
6. public account profile convergence;
7. body-of-work cards for Article and Playlist;
8. community activity section when account-linked;
9. browser/live acceptance.

Do not start feed ranking in this slice.

## Decision 33: Tests required before implementation PR

### SQL verifier

Must prove:

- Person kind registered;
- exactly one Person typed binding per Person Resource;
- exactly one typed source per identity link;
- active source identity cannot bind to two People;
- account and Registry cardinality per Person;
- preferred link belongs to same Person;
- merge pointer only targets Person;
- merge cycles are rejected;
- Person public read hides private fields;
- body-of-work uses current published versions;
- Person Follow validates canonical target;
- generic private Follow reader remains self-only.

### Application tests

Must prove:

- Person service parses public read;
- Playlist curator maps to Person;
- Article Credit maps to Person;
- ordinary user profile maps to Person;
- Follow login boundary;
- Follow optimistic UI rolls back on database rejection;
- merged route redirects;
- public/private Person state;
- body-of-work role labels.

### Regression tests

Must prove no regression to:

- Artist Follow;
- Playlist publication;
- Article trust reads;
- Registry Author public pages before cutover;
- `/u/:username` before cutover;
- account profile privacy;
- Shared Credit immutability.

## Decision 34: Explicit first-slice non-goals

Do not build in the first people implementation:

- recommendation ranking;
- popularity leaderboards;
- public follower lists;
- public Following lists;
- direct messages;
- creator monetization;
- feed engagement scoring;
- automatic email identity merge;
- automatic name-based identity merge;
- Guide shadow Credits;
- destructive Person deletion.

## Implementation approval boundary

This document authorizes preparation of Migration A only after this design is reviewed and accepted.

Migration A must remain narrow:

- identity foundation;
- exact proof People;
- public Person read;
- no broad backfill;
- no frontend.

Do not write Migration B, Migration C, or frontend code before Migration A is locally verified and its live acceptance plan is ready.

## Conclusion

The permanent model is:

`Person Resource`
+
`typed identity links`
+
`Shared Credits`
+
`validated Follow`

A Person remains stable while roles, usernames, source identities, and account ownership evolve.

Historical Credits remain immutable.

Existing account, Registry Author, and external-contributor authorities remain intact.

Follow targets the final active Person Resource identity.

Public body of work comes only from exact current-public, public-safe Credits.

## Implementation-review sequencing corrections

These corrections were identified during the final live-schema review before Migration A was written.

They narrow sequencing without changing the accepted permanent model.

### Correction 1: Migration A public Person read is identity-only

Migration A `public.get_public_person(text)` must expose only public Person identity and route presentation.

Migration A must not expose:

- `public_roles`;
- `follower_count`;
- follower identities;
- Following state.

Reason:

- `public_roles` depends on the current-public Shared Credit body-of-work authority introduced in Migration B;
- `follower_count` depends on validated Person Follow authority introduced in Migration C;
- the current generic Follow setter accepts arbitrary target strings and must not become implicit Person authority.

Migration B extends Person reads with current-public Credit role summaries.

Migration C adds validated Person Follow and the public follower-count read.

### Correction 2: privacy and consent synchronization belongs in Migration A

Migration A makes Person identity publicly routable.

Therefore it must also make Person Resource visibility react immediately to:

- `user_profiles.status`;
- `user_profiles.is_public`;
- external-contributor `contributor_state`;
- external-contributor `public_safe`;
- external-contributor `consent_status`;
- Person identity-link state.

This synchronization cannot wait for Migration C.

Reason:

A public Person route must never continue presenting an account after that account becomes private, or an external contributor after public-safety or consent eligibility is withdrawn.

Migration C still owns:

- automatic broad Person provisioning;
- validated Person Follow writes;
- viewer Follow state;
- public follower count;
- reviewed broad identity backfill.

### Correction 3: Migration A does not authorize Person Follow

After Migration A:

- Person Resource identity exists;
- `/people/` public identity reads exist;
- no Person Follow UI exists;
- no follower count is exposed.

Migration C is the first accepted Person Follow product boundary.

The existing generic Follow functions are not treated as Person authority merely because a `person` Resource kind exists.

## Migration A implementation hardening

The exact pre-apply review added three implementation constraints without changing the permanent model.

1. Preferred identity integrity is enforced from both sides. A Person cannot keep a preferred link after that link becomes non-active.
2. One-source Person creation uses transaction-scoped advisory locks for the source identity and canonical path seed. Sequential and concurrent provisioning must converge instead of racing.
3. Migration A keeps `ensure_person_for_*` provisioning helpers private. Runtime `service_role` execution is deferred to Migration C, when reviewed broad provisioning is explicitly authorized.

The durable verifier must inspect the private presentation resolver as well as the public wrapper so private account or external-contributor contact fields cannot enter the public Person projection indirectly.
