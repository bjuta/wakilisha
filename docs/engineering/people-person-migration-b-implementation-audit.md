# People Migration B Implementation Audit

Date: 11 August 2026

## Status

Implementation audit only.

No SQL migration is approved by this document.

No frontend implementation is approved by this document.

This audit begins after PR #600, `Add Person identity foundation`, was squash-merged and independently live-accepted.

Migration A is closed.

The accepted merged base is:

`b43b5f3da84f678acb7e4f3da12412763260557a`

Production migration drift is zero at audit start.

## Locked Migration B boundary

Migration B is:

Person reconciliation plus current-public Shared Credit body of work.

Migration B adds:

- People identity capabilities;
- durable Person identity command types;
- identity link command authority;
- identity unlink command authority;
- Person merge command authority;
- merge Follow-transfer history;
- split-history support required for future conservative split;
- Credit-to-Person resolution;
- Article current-public body-of-work resolution;
- Playlist current-public body-of-work resolution;
- paginated public Person work read;
- current-public Credit role summary support for public Person presentation.

Migration B does not add:

- validated Person Follow creation;
- Person follower count;
- viewer Follow-state read;
- broad Person source backfill;
- automatic account Person provisioning;
- frontend Person pages;
- `/authors/` cutover;
- `/u/` cutover;
- Feed or Following product;
- Guide body of work.

Those remain later boundaries.

## Permanent identity rule

Follow a person, not a role.

Roles remain on immutable Shared Credits.

Person identity links reconcile legitimate identity authorities without replacing them.

Email equality is discovery evidence only.

Email is never permanent reconciliation authority.

## Current live Person foundation

Migration A established three active public Person Resources.

### Account-backed proof

Canonical path:

`/people/dad`

Identity kind:

authenticated account through `public.user_profiles`.

### Registry Author-backed proof

Canonical path:

`/people/hafare-segelan`

Person Resource:

`d87022ed-5e25-4301-bb89-b059ca39cf0f`

Registry Author:

`c318a8c5-3ad8-4adc-9991-953ab24e7da6`

Identity revision at B audit start:

`1`

### External-contributor-backed proof

Canonical path:

`/people/muiruri-beautah`

Person Resource:

`75100f5b-0e76-47c4-91b8-d5f5557212c0`

External contributor:

`9c2d46a6-97f3-4d71-bb76-40211abce2e3`

Identity revision at B audit start:

`1`

These are production facts used for acceptance only.

They are not evidence that similarly named, emailed, or related source identities are the same human.

No cross-source identity merge is inferred from this proof set.

## Pre-B authority absence

At audit start production has none of the following capabilities:

- `view_people_identity`;
- `manage_people_identity`;
- `merge_people_identity`.

At audit start production has none of the following command types:

- `person.identity_link`;
- `person.identity_unlink`;
- `person.merge`;
- `person.split`.

At audit start:

- `editorial.person_follow_merge_transfers` does not exist;
- `editorial.resolve_credit_person(uuid)` does not exist;
- `public.list_public_person_work(uuid,integer,timestamptz,uuid)` does not exist.

Migration B therefore starts from a clean authority boundary.

## Existing command platform

The existing durable command platform already provides:

- `platform_private.command_types`;
- `platform_private.command_receipts`;
- `platform_private.outbox_events`;
- authenticated principal identity;
- request fingerprinting;
- idempotency-key replay;
- resource-bound command receipts;
- success/rejection completion primitives.

Playlist commands demonstrate the accepted synchronous command pattern:

1. register controlled command type;
2. authenticate actor;
3. validate capability;
4. begin resource command receipt;
5. lock current mutable authority;
6. compare expected revision;
7. execute mutation atomically;
8. append domain history;
9. complete or reject durable receipt;
10. return durable result.

Migration B should reuse that pattern.

Do not create a second Person-specific command receipt table.

Do not create an unrelated job platform.

## People capabilities

The merged design requires:

- `view_people_identity`;
- `manage_people_identity`;
- `merge_people_identity`.

Initial role grants remain:

Administrator:

- view;
- manage;
- merge.

Editor:

- view only.

Registry Editor:

- view only.

Do not infer public contributor roles from these RBAC capabilities.

These are backend authority only.

## B command vocabulary under audit

Required implemented commands:

- `person.identity_link`;
- `person.identity_unlink`;
- `person.merge`.

`person.split` is a locked future command contract, but the merged implementation sequence says split implementation is not required in Migration B.

Migration B must create enough immutable merge/link/Follow-transfer history that a later conservative split can be implemented without guessing.

Before migration preparation, explicitly decide whether:

- `person.split` is not registered at all in B; or
- it is registered disabled as reserved vocabulary.

Do not expose an executable split command without split semantics.

## Identity link command

The link command must accept:

- Person Resource UUID;
- expected identity revision;
- exactly one typed source identity;
- link method;
- reason;
- idempotency key.

It must require:

`manage_people_identity`

or administrator authority.

It must reject:

- malformed source shape;
- linking one source identity actively to two People;
- a second active account identity on the same Person;
- a second active Registry Author identity on the same Person;
- link methods that imply automatic email/name matching;
- stale identity revision;
- merged/archived target Person where not explicitly supported.

A successful mutation must:

- create one immutable typed link row;
- increment Person identity revision exactly once;
- append `identity_linked`;
- refresh Person visibility and ownership;
- complete one durable command receipt.

Historical Credits must not change.

## Identity unlink command

The unlink command must accept:

- Person Resource UUID;
- expected identity revision;
- identity-link UUID;
- reason;
- idempotency key.

It must require:

`manage_people_identity`

or administrator authority.

It must reject:

- link not belonging to Person;
- link already non-active unless idempotent replay resolves through command receipt;
- stale identity revision;
- retirement of a preferred identity without a valid replacement or presentation transition;
- an operation that leaves a public Person publicly visible without a valid public presentation.

A successful unlink must:

- retire the exact link;
- preserve link history;
- increment identity revision exactly once;
- append `identity_unlinked`;
- refresh Person visibility and ownership;
- complete the durable receipt.

Historical Credits must not change.

## Person merge command

Command:

`person.merge`

Required capability:

`merge_people_identity`

Inputs:

- source Person Resource UUID;
- target Person Resource UUID;
- expected source revision;
- expected target revision;
- reason;
- idempotency key.

The source Person is the command Resource for durable receipt authority unless implementation audit proves another existing convention is safer.

The command must reject:

- source equals target;
- either Person missing;
- either Person not active;
- stale source revision;
- stale target revision;
- merge cycle;
- conflicting active account identities;
- conflicting active Registry Author identities;
- any identity-link uniqueness conflict that would make the survivor invalid.

### Merge link transfer

For each active source identity:

- create a new active target link with `link_method = 'person_merge'`;
- preserve the source link row;
- mark source link superseded;
- cross-reference old and replacement links.

Do not rewrite Credits.

The target Person receives the linked work at read time because Credits resolve through active identity links.

### Merge state

Source:

- `person_state = 'merged'`;
- `merged_into_person_resource_id = target`;
- Resource becomes internal.

Target:

- remains active;
- identity revision increments exactly once for the merge;
- source identity revision increments exactly once for the merge.

Append merge governance events with one correlation id.

### Merge route authority

Source aliases remain owned by source Resource.

Do not retarget source Resource aliases.

The existing public Person reader follows the merge pointer and returns target canonical route as redirect authority.

## Merge Follow-transfer authority

Migration B must support safe movement of existing:

`community_follows.target_type = 'person'`

rows even though validated public Person Follow creation does not arrive until Migration C.

This protects future merge semantics.

Create private append-only:

`editorial.person_follow_merge_transfers`

with enough evidence to distinguish:

- moved Follow;
- deduplicated Follow because target was already followed.

Migration B must not:

- change Artist follows;
- weaken the generic self-only Follow read;
- authorize arbitrary public Person Follow writes.

Current production has zero Person Follow rows at B audit start.

Therefore live merge acceptance must use controlled fixtures and must not merge real production People merely to manufacture Follow evidence.

## Existing Shared Credit authority

Shared Credits remain immutable.

Each Credit has exactly one typed credited party:

- user;
- Registry Author;
- external contributor.

Public Credit eligibility already requires:

- attachment public-safe;
- Credit governance public-safe;
- Credit governance state active;
- external contributor active/public-safe/consent eligible where applicable.

Migration B must reuse these rules.

Do not create a Person-specific shadow Credit table.

## Credit-to-Person resolver

Add internal:

`editorial.resolve_credit_person(uuid)`

Input:

Credit UUID.

Resolution:

- `credits.user_id` through active `person_identity_links.user_id`;
- `credits.registry_author_id` through active `person_identity_links.registry_author_id`;
- `credits.external_contributor_id` through active `person_identity_links.external_contributor_id`.

Return no Person when the Credit party has no active Person link.

Do not:

- mutate Credit;
- inspect email;
- infer from display name;
- use Credit snapshots as link authority.

## Current-public body-of-work rule

Person body of work comes only from a public-safe Credit attached to the exact current published version of a public Resource.

Historical versions and stale Credit attachments must not appear.

Initial supported Resource kinds:

- Article;
- Playlist.

Guide remains deferred.

## Article branch authority

Current Article public Trust already resolves:

- public Article Resource;
- exact `editorial.resources.current_published_version_id`;
- exact `article_version` Credit attachments;
- public-safe attachment;
- active/public-safe Credit governance;
- public-safe external-contributor governance.

Migration B must mirror that current-public boundary.

Do not enumerate all Article versions.

Do not infer body of work from mutable Article author fields.

## Playlist branch authority

Playlist publication already resolves:

- public Playlist Resource;
- `editorial.playlist_resources.current_published_version_id`;
- immutable published Playlist versions;
- exact `playlist_version` Credit attachments copied into publication;
- public-safe Credit governance;
- cached publication snapshot presentation.

Migration B must use the current published Playlist version only.

Do not use mutable `curator_label` as identity authority.

## Live body-of-work proof already available

Migration B does not need to modify production identity links to prove both resource kinds.

### Playlist proof

Person:

`/people/hafare-segelan`

Current public work:

`Top 50 Kenyan Songs Of 2025`

Canonical Playlist slug:

`top-50-kenyan-songs-of-2025`

Credit role:

`curator`

Credit is attached to the exact current published Playlist version and resolves through Hafare's active Registry Author Person link.

### Article proof

Person:

`/people/muiruri-beautah`

Current public work:

`Why I Keep Postponing My Hair Appointment`

Canonical Article slug:

`why-i-keep-postponing-my-hair-appointment`

Credit role:

`author`

Credit is attached to the exact current published Article version and resolves through the active external-contributor Person link.

This means B acceptance can prove both body-of-work branches without changing historical Credits or real production identity reconciliation.

## Public Person work read

Add:

`public.list_public_person_work(uuid, integer, timestamptz, uuid)`

It must be:

- public;
- narrow;
- paginated;
- stable-order;
- current-public only.

Each Resource appears once.

If one Person has multiple eligible roles on one current public Resource:

- aggregate roles into one work row;
- preserve role key;
- preserve role label snapshot;
- preserve display order;
- preserve primary-credit state.

Initial output:

- `resource_id`;
- `resource_kind`;
- `canonical_path`;
- `title`;
- `summary` where public-safe;
- `image_url` where public-safe;
- `published_at`;
- `roles`;
- `is_primary`.

No internal review state.

No contributor contact information.

No historical attachment details.

## Public role summary

Migration A intentionally omitted `public_roles`.

Migration B may extend:

`public.get_public_person(text)`

to derive public role summary from distinct roles represented in current-public Person work.

Public roles are Shared Credit roles.

They are not:

- administrator;
- editor;
- subscriber;
- writer;
- any other RBAC role unless that role independently appears as a public Shared Credit role.

Migration B still must not expose:

- follower count;
- Follow state;
- follower identities.

Those remain Migration C.

## Pagination audit questions

Before writing Migration B SQL, inspect exact existing Article and Playlist public presentation fields and choose one stable common ordering.

Preferred ordering candidate:

1. `published_at desc`;
2. `resource_id desc`.

The cursor contract must be deterministic across Article and Playlist branches.

Do not use mutable title or route as the pagination cursor.

## Merge revision audit questions

Before writing Migration B SQL, settle:

- whether source and target revision increments use one shared correlation id;
- which Person Resource owns the durable command receipt;
- exact no-op replay result shape;
- how preferred identity is selected on the target after transferred links;
- whether source preferred link remains its historical preferred link after source becomes merged;
- whether target presentation priority changes only when explicitly requested or when current preferred link becomes invalid.

Do not silently change preferred presentation merely because a merge added a new identity source.

## Split-support audit questions

Migration B needs enough history for future `person.split`.

It does not need to expose working split mutation in B.

Required history includes:

- superseded source identity links;
- replacement target identity links;
- cross-reference between them;
- merge event/correlation;
- Follow transfer evidence;
- source Person durable aliases;
- source merge pointer.

Do not guess future Follow restoration during B.

## Live acceptance B

After rehearsal and production apply, verify:

1. Hafare Person body of work includes Top 50 exactly once as Curator.
2. External-contributor-backed Person body of work includes the current public Article exactly once as Author.
3. historical/non-current Credit attachments do not appear.
4. public role summary comes from current-public Shared Credits only.
5. public Person output still excludes follower count.
6. command capabilities are least-privilege.
7. link/unlink command idempotency and stale-revision rejection pass in controlled fixtures.
8. merge command preserves source route resolution to target in controlled fixtures.
9. merge Follow transfer records moved and deduplicated fixtures correctly.
10. merge does not mutate historical Credits.
11. generic private Follow reader remains self-only.
12. production migration drift returns to zero.

Do not merge real production People merely to prove merge semantics.

Use rollback-only or isolated current-schema fixtures where possible.

## Immediate implementation audit

Before preparing Migration B SQL, inspect:

- current capability insertion/grant conventions;
- current synchronous resource-command receipt helpers;
- current command completion/rejection helpers;
- current Article version presentation fields;
- current Playlist publication snapshot fields;
- exact Credit and attachment uniqueness/cardinality;
- exact `community_follows` key/id columns needed for merge transfer;
- exact command receipt/outbox result patterns;
- whether a dedicated Person merge function should be internal with one narrow authenticated public RPC or directly exposed through a governed public command function.

No Migration B SQL should be written until these concrete contracts are recorded.

## Concrete Migration B implementation contract

Status:

accepted for Migration B SQL preparation.

This section records the exact contracts found in the merged repository and current production schema before any Migration B SQL is written.

It narrows implementation details without changing the permanent People model.

## Concrete finding 1: reuse the existing synchronous Resource command platform

Migration B must reuse:

- `platform_private.command_types`;
- `platform_private.command_receipts`;
- `platform_private.outbox_events`;
- `platform_private.begin_authenticated_resource_command(...)`;
- `platform_private.read_authenticated_resource_command_result(...)`;
- `platform_private.complete_resource_command(...)`;
- `platform_private.reject_resource_command(...)`.

Do not create:

- a Person-specific receipt table;
- a Person-specific outbox;
- a second idempotency registry;
- a second command principal model.

The accepted synchronous pattern is:

1. validate structural input;
2. require authenticated capability;
3. resolve and lock the mutable Resource authority;
4. build the complete request payload and correlation id;
5. begin the durable Resource command;
6. return the prior durable result immediately on idempotent replay;
7. validate mutable state and expected revision after the receipt exists;
8. durably reject stale or conflicting mutable state;
9. mutate atomically;
10. append Person identity history;
11. complete the durable receipt;
12. read and return the durable result.

This sequencing matters for merge replay.

A successful `person.merge` changes the source Person from active to merged.

Therefore a replay of the same successful merge must be allowed to return the completed receipt even though the source is no longer active.

Do not reject mutable Person state before checking durable idempotent replay.

## Concrete finding 2: command privilege surface follows existing authenticated Resource commands

Person mutation RPCs should follow the existing Playlist command ACL convention:

- `SECURITY DEFINER`;
- explicit narrow `search_path`;
- revoke execution from `public` and `anon`;
- grant execution to `authenticated` and `service_role`;
- still require authenticated actor/capability semantics through the shared command platform.

No anonymous Person identity mutation is authorized.

Migration B does not create a service-role-only shadow mutation path.

## Concrete finding 3: People capabilities use existing capability tables

Add exactly:

- `view_people_identity`;
- `manage_people_identity`;
- `merge_people_identity`.

Use:

`domain = 'content'`

for these initial capability definitions.

Reason:

Person reconciliation in this slice governs editorial contributor identity and immutable Shared Credit interpretation.

It is not account administration.

Do not put these capabilities under `users`, because `manage_users` governs account/RBAC administration rather than credited cultural identity.

Initial grants:

Administrator:

- `view_people_identity`;
- `manage_people_identity`;
- `merge_people_identity`.

Editor:

- `view_people_identity`.

Registry Editor:

- `view_people_identity`.

Do not grant manage or merge authority to Editor or Registry Editor in Migration B.

Do not infer public contributor roles from these capabilities.

The TypeScript `Capability` union does not need to change in Migration B because no frontend People admin surface is being introduced.

A later frontend/admin slice must add typed client capability awareness before consuming these capabilities directly.

## Concrete finding 4: register only executable Migration B command types

Register exactly:

- `person.identity_link`;
- `person.identity_unlink`;
- `person.merge`.

Each uses the existing synchronous command vocabulary:

- `<command>.sync`;
- `<command>.accepted`;
- `<command>.succeeded`;
- `<command>.failed`;
- `<command>.retry_scheduled`.

Do not register `person.split` in Migration B.

The event vocabulary already contains `person_split`, but that does not authorize an executable split command.

Migration B preserves enough merge history for a future conservative split.

It does not expose split semantics that do not yet exist.

## Concrete finding 5: public link command is narrower than the storage link-method vocabulary

The storage table supports multiple controlled link methods because the permanent model includes provisioning, claims, merge, and split.

The Migration B public reconciliation command must not expose all of them.

Public command:

`person.identity_link`

may accept only:

`admin_reconciliation`

as a caller-selected link method in Migration B.

Do not permit callers to select:

- `migration_seed`;
- `account_provisioning`;
- `registry_author_provisioning`;
- `external_contributor_provisioning`;
- `person_merge`;
- `person_split`.

Do not permit `claim_approved` before a real claim-review workflow exists.

Merge-created links use `person_merge` internally inside the governed merge command.

Migration C provisioning may use the provisioning methods through its own bounded authority.

## Concrete finding 6: exact link command contract

Prepare public RPC:

`public.link_person_identity(...)`

Inputs:

- `p_person_resource_id uuid`;
- `p_expected_identity_revision bigint`;
- `p_user_id uuid`;
- `p_registry_author_id uuid`;
- `p_external_contributor_id uuid`;
- `p_link_method text`;
- `p_reason text`;
- `p_idempotency_key text`;
- optional `p_correlation_id uuid`.

Exactly one typed source id is required.

Required authority:

- administrator; or
- `manage_people_identity`.

The command Resource is the target Person Resource.

The command must reuse the same source advisory-lock namespace created in Migration A:

- `person-source|user|<uuid>`;
- `person-source|registry-author|<uuid>`;
- `person-source|external-contributor|<uuid>`.

This prevents two concurrent reconciliation commands from actively attaching the same source identity to different People.

After durable receipt creation, reject when:

- Person is missing;
- Person is not active;
- expected identity revision is stale;
- source identity does not exist;
- the source identity is actively linked to another Person;
- the Person already has a different active account identity and a user link is requested;
- the Person already has a different active Registry Author identity and a Registry Author link is requested;
- link method is not `admin_reconciliation`.

If the exact source identity is already actively linked to the same Person:

- complete successfully with `changed = false`;
- return the existing identity-link id;
- do not increment identity revision;
- do not append a new identity event.

On a real link mutation:

- insert one new active typed identity link;
- preserve the existing preferred identity when it is valid;
- if the Person has no preferred identity, set the new link as preferred;
- increment Person identity revision exactly once;
- append one `identity_linked` event;
- use the command correlation id;
- refresh Person visibility and Resource owner;
- complete one durable command receipt.

Do not mutate historical Credits.

## Concrete finding 7: exact unlink command contract

Prepare public RPC:

`public.unlink_person_identity(...)`

Inputs:

- `p_person_resource_id uuid`;
- `p_expected_identity_revision bigint`;
- `p_identity_link_id uuid`;
- `p_reason text`;
- `p_idempotency_key text`;
- optional `p_correlation_id uuid`.

Required authority:

- administrator; or
- `manage_people_identity`.

After durable receipt creation, reject when:

- Person is missing;
- Person is not active;
- expected revision is stale;
- identity link does not belong to the Person;
- identity link is not active.

The same idempotency key replays the prior durable result before these mutable-state checks.

A real unlink:

- retires the exact link;
- does not delete the link row;
- records actor, time, and reason;
- clears `preferred_identity_link_id` first when unlinking the preferred identity;
- does not silently select a different preferred identity;
- increments Person identity revision exactly once;
- appends one `identity_unlinked` event;
- refreshes Person visibility and owner;
- completes one durable command receipt.

If another eligible identity remains, presentation fallback continues deterministically.

If no eligible public identity remains, `refresh_person_visibility(...)` makes the Person internal.

Historical Credits remain unchanged.

## Concrete finding 8: merge command Resource and replay authority

Prepare public RPC:

`public.merge_people(...)`

Command type:

`person.merge`

Durable command Resource:

the source Person Resource.

Required authority:

- administrator; or
- `merge_people_identity`.

Inputs:

- source Person Resource UUID;
- target Person Resource UUID;
- expected source identity revision;
- expected target identity revision;
- reason;
- idempotency key;
- optional correlation id.

Lock source and target `editorial.people` rows in deterministic UUID order.

This prevents opposite-direction concurrent merge requests from deadlocking unpredictably.

The durable receipt is created against the source Person.

On idempotent replay:

return the prior durable result before requiring source state to still be active.

## Concrete finding 9: merge mutable preconditions

For a new merge receipt, durably reject when:

- source equals target;
- source Person is missing;
- target Person is missing;
- source is not active;
- target is not active;
- source expected revision is stale;
- target expected revision is stale;
- the merge would create a cycle;
- source and target both have different active account identities;
- source and target both have different active Registry Author identities;
- any remaining typed-link uniqueness conflict would make the survivor invalid.

External contributor identities may be multiple on one Person after explicit reconciliation.

Do not infer merge eligibility from:

- email;
- name;
- social URL;
- account role;
- Credit display snapshot.

## Concrete finding 10: add schema-level merge cycle protection

Migration A added the merge pointer and a defensive public-read chain-depth limit.

Migration B is the first migration that authorizes governed merge mutation.

Add a deferred Person merge-integrity constraint trigger that rejects a merge-pointer cycle.

The constraint must protect the table even if a privileged internal mutation bypasses the public merge RPC.

Do not rely only on application/RPC checks for cycle safety.

The merge command itself still requires the target to be active at the moment of merge.

## Concrete finding 11: exact merge identity-link transfer order

Migration A makes identity-link source targets immutable.

Therefore merge does not retarget source link rows.

For every active source identity link:

1. generate the replacement target-link UUID;
2. clear source `preferred_identity_link_id` before superseding the preferred source link;
3. mark the old source link `superseded`;
4. record retirement actor, time, and reason on the source link;
5. set `superseded_by_link_id` to the generated replacement id;
6. create the new target link with:
   - same typed source identity;
   - `link_method = 'person_merge'`;
   - `supersedes_link_id = old source link id`;
   - merge reason;
   - merge actor.

The existing deferrable supersession foreign keys permit this ordering.

This ordering is also required by the immediate active-source unique indexes.

Do not update the typed source identity on an existing link.

Do not mutate Credit party ids.

## Concrete finding 12: preferred identity behavior during merge

Preserve the target Person's valid preferred identity exactly.

Do not automatically make a transferred source identity preferred merely because it arrived through merge.

For the source Person:

set:

`preferred_identity_link_id = null`

before its active links become superseded.

Reason:

Migration A's deferred preferred-identity integrity requires a preferred link to remain active and attached to the same Person.

A merged source Person no longer needs its own public presentation because its durable `/people/` route resolves through the merge pointer to the survivor.

## Concrete finding 13: merge revisions and events

One successful merge is one governed identity mutation per affected Person.

Increment:

- source identity revision exactly once;
- target identity revision exactly once.

Do not increment once per transferred identity link.

Use one shared correlation id for the complete merge.

Append two `person_merged` identity events:

Source event:

- belongs to source Person;
- related Person is target;
- records source prior and resulting revision.

Target event:

- belongs to target Person;
- related Person is source;
- records target prior and resulting revision.

The source Person event is the canonical `merge_event_id` used by Follow-transfer history.

Do not append synthetic `identity_linked` events for each merge-created target link.

The superseded/new link rows already preserve that transfer detail.

## Concrete finding 14: merge state and route authority

After link and Follow transfer succeeds:

Source Person:

- `person_state = 'merged'`;
- `merged_into_person_resource_id = target`;
- Resource visibility becomes internal through existing Migration A synchronization.

Target Person:

- remains active;
- receives transferred identity links;
- visibility and owner are recalculated.

Call `editorial.refresh_person_visibility(...)` for both at final merge state.

Do not move or retarget the source Person Resource aliases.

Migration A's `public.get_public_person(...)` already follows the source merge pointer and returns the target canonical path as `redirect_to`.

The source Person Resource remains durable history.

## Concrete finding 15: current Follow table shape

`public.community_follows` currently stores:

- `id uuid`;
- `user_id uuid`;
- `target_type text`;
- `target_id text`;
- `target_slug text`;
- `created_at timestamptz`.

Uniqueness is:

`(user_id, target_type, target_id)`.

Current production contains:

- two Artist Follow rows;
- one Article Follow row;
- zero Person Follow rows.

Migration B must not alter these existing non-Person rows.

Migration B still does not authorize public Person Follow creation.

## Concrete finding 16: Person merge Follow target-slug convention

Existing Follow rows store a plain target slug, not a full public path.

Therefore permanent Person Follow rows use:

- `target_type = 'person'`;
- `target_id = final_person_resource_id::text`;
- `target_slug = canonical Person path segment`.

Example:

canonical Person path:

`/people/hafare-segelan`

Follow `target_slug`:

`hafare-segelan`

Do not store `/people/hafare-segelan` in `target_slug`.

Migration C's validated Person Follow setter must derive the same convention server-side.

## Concrete finding 17: private append-only merge Follow-transfer history

Create private:

`editorial.person_follow_merge_transfers`.

Required fields remain:

- `id uuid primary key`;
- `merge_event_id uuid not null`;
- `user_id uuid not null`;
- `source_person_resource_id uuid not null`;
- `target_person_resource_id uuid not null`;
- `source_follow_id uuid`;
- `target_follow_id uuid`;
- `transfer_mode text not null`;
- `source_follow_created_at timestamptz`;
- `target_follow_preexisted boolean not null`;
- `created_at timestamptz not null`.

Transfer modes:

- `moved`;
- `deduplicated`.

Add foreign keys from:

- `merge_event_id` to `editorial.person_identity_events(id)`;
- source Person id to `editorial.people(resource_id)`;
- target Person id to `editorial.people(resource_id)`.

Do not add foreign keys from:

- `source_follow_id`;
- `target_follow_id`

to `community_follows`.

Those Follow rows are allowed to disappear later through explicit user action.

Do not add a restrictive auth-user foreign key from historical `user_id` that could block future account deletion.

The transfer table is private governance history, not a public follower table.

Add an append-only update/delete protection trigger.

Add uniqueness sufficient to allow only one transfer record per merge event and source-follow intent.

## Concrete finding 18: exact Follow transfer algorithm

For each existing Person Follow row whose:

`target_id = source_person_resource_id::text`

and:

`target_type = 'person'`

perform one of two modes.

### Moved

When the same user does not already follow target Person:

update the existing source Follow row in place:

- preserve Follow row `id`;
- preserve original `created_at`;
- replace `target_id` with target Person UUID text;
- replace `target_slug` with target canonical Person slug.

Record transfer:

- `transfer_mode = 'moved'`;
- `source_follow_id = preserved Follow id`;
- `target_follow_id = preserved Follow id`;
- `target_follow_preexisted = false`;
- preserve original source Follow created time.

Keeping the same row id is important for future conservative split semantics.

### Deduplicated

When the same user already follows target Person:

- preserve the existing target Follow row untouched;
- record source Follow id;
- record target Follow id;
- record source Follow created time;
- set `transfer_mode = 'deduplicated'`;
- set `target_follow_preexisted = true`;
- delete only the duplicate source Follow row.

Do not touch Artist Follow or Article Follow rows.

## Concrete finding 19: future split evidence, not split behavior

Migration B does not guess how to restore Follow state after a future split.

It only preserves evidence.

Future split can restore a moved Follow only if the exact transferred row id still exists and user action has not replaced it.

For a deduplicated Follow, future split can use the exact pre-existing target Follow row id as evidence.

If the user later unfollows or replaces that relationship, split must not resurrect old intent automatically.

This is why Follow row ids are preserved or recorded.

## Concrete finding 20: Credit-to-Person resolver

Add private:

`editorial.resolve_credit_person(uuid)`.

Return:

the active Person Resource UUID for the Credit's immutable typed party identity.

Resolution:

User Credit:

`credits.user_id`
to active `person_identity_links.user_id`.

Registry Author Credit:

`credits.registry_author_id`
to active `person_identity_links.registry_author_id`.

External contributor Credit:

`credits.external_contributor_id`
to active `person_identity_links.external_contributor_id`.

Require the resolved Person itself to be active.

Return null when there is no active Person link.

Do not:

- mutate the Credit;
- inspect email;
- inspect display name;
- inspect Credit snapshot slugs as identity authority;
- resolve from RBAC role.

Historical Credits remain immutable.

## Concrete finding 21: current-public Credit attachment authority

`editorial.resource_credits` currently guarantees:

- one Credit attachment identity per target version, Resource, and Credit;
- one display-order slot per target version and Resource;
- public-safe attachment state;
- exact typed target version.

Initial body-of-work kinds remain:

- `article`;
- `playlist`.

Explicitly exclude:

`playlist_item`

from Person work rows even though Playlist Item Credits share the attachment table.

A Playlist Item Credit is not a separate public work card.

## Concrete finding 22: Article current-public pointer

Article current-public authority uses:

`editorial.resources.current_published_version_id`.

Do not use:

`editorial.article_resources`

as though it carries its own current published pointer.

For a Person Article work row require:

- Person active/public;
- Article Resource visibility public;
- Article Resource lifecycle published;
- `resources.current_published_version_id` not null;
- exact `editorial.article_versions.id` equals that pointer;
- Credit attachment `resource_kind = 'article'`;
- Credit attachment `target_version_type = 'article_version'`;
- Credit attachment target version equals exact current published version;
- attachment public-safe;
- Credit governance public-safe and active;
- external-contributor governance passes where applicable;
- Credit resolves to requested Person.

Use current published Article version fields for presentation:

- `title`;
- `excerpt`;
- `hero_image_url`;
- `published_at`;
- `slug`.

All currently public Article Resources have a current published version pointer.

Do not enumerate historical Article versions.

## Concrete finding 23: Playlist current-public pointer

Playlist current-public authority uses:

`editorial.playlist_resources.current_published_version_id`.

Do not use `editorial.resources.current_published_version_id` for Playlist.

The shared Resource pointer foreign key is Article-version authority.

For a Person Playlist work row require:

- Person active/public;
- Playlist Resource visibility public;
- Playlist Resource lifecycle published;
- exact current published Playlist version from typed Playlist binding;
- exact matching `editorial.playlist_publication_snapshots.version_id`;
- Credit attachment `resource_kind = 'playlist'`;
- Credit attachment `target_version_type = 'playlist_version'`;
- Credit target version equals exact current published Playlist version;
- attachment public-safe;
- Credit governance public-safe and active;
- external-contributor governance passes where applicable;
- Credit resolves to requested Person.

Use current publication snapshot fields for presentation:

- `title`;
- `description`;
- `cover_url`;
- `published_at`;
- `slug`.

Do not use mutable `curator_label` as Person identity authority.

## Concrete finding 24: historical Playlist Credit leak proof is already present

Hafare's curator Credit currently appears on eight Playlist version attachments for Top 50.

Exactly:

- one attachment targets the current published Playlist version;
- seven attachments target historical or non-current Playlist versions.

Those historical attachments are still public-safe and their Credit governance remains active.

Therefore Migration B acceptance can prove the current-version filter is real.

The expected Hafare body of work contains Top 50 exactly once.

A query that enumerates all public-safe Credit attachments without checking the current published pointer would fail acceptance.

## Concrete finding 25: current Article proof is already present

The external-contributor-backed Person:

`/people/muiruri-beautah`

already has one eligible current-public Article Credit.

Work:

`Why I Keep Postponing My Hair Appointment`

Role:

`author`

The Credit is attached to the exact current published Article version.

Migration B does not need to reconcile a real production identity merely to obtain an Article proof.

## Concrete finding 26: Resource alias adoption is not complete enough for B route reads

The merged design preferred canonical Resource aliases for body-of-work routes.

Current production evidence shows:

Article Resources:

- 216 total;
- 207 public;
- only 1 Article Resource has an active canonical Resource alias.

Playlist Resources:

- 2 total;
- 1 public;
- 0 Playlist Resources have an active canonical Resource alias.

The exact Article and Playlist proof Resources used by Migration B have no Resource alias rows.

A strict Resource-alias join would therefore produce null routes for the B acceptance proofs and almost every current public Article.

This is existing Resource-alias adoption debt.

It is not a reason to bulk-backfill all Article and Playlist aliases inside Migration B.

## Sequencing correction 1: body-of-work route resolution uses alias-or-domain fallback

Migration B `canonical_path` presentation resolves as:

1. active canonical `editorial.resource_aliases.path`, when one exists;
2. otherwise exact current-public domain route.

Article fallback:

`/magazine/` + exact current published Article-version slug.

Playlist fallback:

`/playlists/` + exact current Playlist publication-snapshot slug.

These fallbacks match the currently shipped public router.

The fallback is a read-time presentation rule.

It does not create a second persistent Resource alias authority.

When a governed canonical Resource alias exists later, that alias wins automatically.

Do not bulk insert 207 Article aliases or the current Playlist alias as an incidental side effect of Person body-of-work work.

A future Resource-alias adoption slice may close that debt separately.

## Concrete finding 27: shared current-public work helper

To prevent role summary and body-of-work pagination from implementing different eligibility rules, Migration B should create one private current-public work resolver:

`editorial.list_current_public_person_work(uuid)`.

It returns one row per eligible current-public Resource for one active public Person.

Initial columns:

- `resource_id uuid`;
- `resource_kind text`;
- `canonical_path text`;
- `title text`;
- `summary text`;
- `image_url text`;
- `published_at timestamptz`;
- `roles jsonb`;
- `is_primary boolean`.

The Article and Playlist branches union into this internal authority.

Revoke browser execution on the internal helper.

The public paginated function wraps this helper.

The public Person role summary derives from the same helper.

Do not duplicate current-public eligibility logic in three separate public functions.

## Concrete finding 28: one Resource row, multiple Person roles

Each current-public Resource appears at most once in the Person work result.

If multiple eligible Credits for the same Person exist on the same current public Resource:

aggregate them into `roles`.

Each role item preserves:

- `role` from `credit.credit_role`;
- `role_label` from nonblank `role_label_snapshot`, else role key;
- Credit attachment `display_order`;
- Credit attachment `is_primary`.

Order role entries by:

1. display order ascending;
2. Credit id ascending as deterministic tie-break.

Top-level:

`is_primary = bool_or(attachment.is_primary)`

for that Person on the Resource.

Do not duplicate the work card merely because the Person has more than one role.

## Concrete finding 29: stable public Person-work pagination

Public RPC:

`public.list_public_person_work(uuid, integer, timestamptz, uuid)`.

Interpret parameters as:

- Person Resource UUID;
- limit;
- before published-at cursor;
- before Resource UUID cursor.

Use stable order:

1. `published_at desc`;
2. `resource_id desc`.

Cursor comparison:

`(published_at, resource_id) < (before_published_at, before_resource_id)`.

When a publication timestamp is supplied without Resource UUID, use the maximum UUID sentinel as the tie-break cursor.

Default limit:

`24`.

Clamp:

minimum `1`;
maximum `50`.

Do not use:

- title;
- slug;
- Resource kind;
- publication snapshot id

as the cross-format cursor.

## Concrete finding 30: public work reader security

`public.list_public_person_work(...)` is a narrow public read.

Use:

- `STABLE`;
- `SECURITY DEFINER`;
- explicit `search_path`;
- revoke PUBLIC;
- grant execute to `anon`, `authenticated`, and `service_role`.

The reader must return no work for:

- missing Person;
- archived Person;
- merged source Person when called directly by source UUID;
- internal/private Person.

The canonical Person route flow resolves a merged source to the survivor before requesting the survivor's work.

No private identity-link governance is exposed.

## Concrete finding 31: public role summary shape

Migration A deliberately omitted `public_roles`.

Migration B may extend:

`public.get_public_person(text)`

with:

`public_roles`.

Derive `public_roles` only from roles present in the shared current-public Person-work resolver.

Initial shape:

array of distinct objects:

- `role`;
- `label`.

Label:

nonblank current-public `role_label_snapshot`, else Credit role key.

Order deterministically by:

1. minimum current-public Credit display order for that role;
2. role key.

Do not expose:

- administrator;
- editor;
- subscriber;
- writer;
- Registry Editor;
- any other RBAC role

unless that text independently exists as a current-public Shared Credit role.

Migration B still does not add:

- `follower_count`;
- Follow state;
- follower identities.

Those remain Migration C.

## Concrete finding 32: B public route proof uses current shipped paths

Current shipped Article route:

`/magazine/:slug`.

Current shipped Playlist route:

`/playlists/:slug`.

Current compatibility identity routes remain:

- `/u/:username`;
- `/authors/:slug`.

Migration B does not change frontend routing.

The body-of-work API only returns the route strings needed by the later frontend Person slice.

## Concrete finding 33: no real production merge is required for B acceptance

Production currently contains zero Person Follow rows.

Production already contains:

- the Hafare current-public Playlist proof;
- the external-contributor current-public Article proof;
- seven historical Hafare Playlist attachments that must not leak.

Therefore:

- body-of-work acceptance may read real production data;
- link/unlink mutation acceptance uses isolated or rollback-only fixtures;
- merge acceptance uses isolated or rollback-only fixtures;
- Follow-transfer acceptance uses synthetic Person Follow fixtures;
- no real production Person is merged merely to prove the command.

## Concrete finding 34: exact command result shapes

`public.link_person_identity(...)` should return:

- `command_receipt_id`;
- `receipt_status`;
- `person_resource_id`;
- `identity_revision`;
- `identity_link_id`;
- `result_payload`;
- `idempotent_replay`.

`public.unlink_person_identity(...)` should return:

- `command_receipt_id`;
- `receipt_status`;
- `person_resource_id`;
- `identity_revision`;
- `identity_link_id`;
- `result_payload`;
- `idempotent_replay`.

`public.merge_people(...)` should return:

- `command_receipt_id`;
- `receipt_status`;
- `source_person_resource_id`;
- `target_person_resource_id`;
- `source_identity_revision`;
- `target_identity_revision`;
- `merge_event_id`;
- `result_payload`;
- `idempotent_replay`.

This follows the existing synchronous Resource-command result convention.

## Concrete finding 35: rejected/no-op revision semantics

A durable rejection does not change Person revision.

An idempotent replay does not change Person revision.

A successful no-op link where the exact source is already linked to the same Person:

- completes successfully;
- sets `changed = false`;
- does not change Person revision;
- does not append identity history.

A successful real link:

increments that Person exactly once.

A successful unlink:

increments that Person exactly once.

A successful merge:

increments source exactly once and target exactly once.

No command increments once per internal row touched.

## Concrete finding 36: public/private read boundary remains narrow

Internal tables remain private:

- `editorial.people`;
- `editorial.person_identity_links`;
- `editorial.person_identity_events`;
- `editorial.person_follow_merge_transfers`.

Do not expose raw link provenance or Follow-transfer history publicly.

Public B reads are limited to:

- existing narrow Person identity read, extended only with current-public Credit roles;
- paginated current-public Person work.

The existing:

`public.community_get_user_follows(uuid)`

remains authenticated and self-only.

Migration B must not weaken it.

## Migration B SQL preparation boundary

Migration B SQL preparation is now authorized only if it conforms to this concrete contract.

Expected Migration B implementation scope is still database-first:

- one SQL migration;
- one durable SQL verifier;
- this audit document;
- generated public schema types/baseline only after production apply, as required by repository CI.

No frontend implementation is authorized yet.

No Edge Function is expected.

No Readdy Finish update is expected.

Do not start Migration C inside Migration B.

## Migration B acceptance targets

The Migration B verifier and rehearsal must prove at minimum:

1. exactly three new People capabilities with least-privilege role grants;
2. exactly three executable Person command types and no `person.split` command;
3. link command durable idempotency;
4. link same-source concurrency cannot create two active Person bindings;
5. stale link revision is durably rejected;
6. unlink preserves historical link row and Credit rows;
7. merge stale source or target revision is durably rejected;
8. merge cycle is rejected by schema authority;
9. merge preserves target preferred identity;
10. merge clears source preferred identity before source links supersede;
11. source and target revisions each increment once;
12. merge-created links cross-reference superseded source links;
13. source `/people/` route resolves to target after merge;
14. moved Follow preserves exact Follow row id and created time;
15. deduplicated Follow preserves pre-existing target Follow row;
16. Follow transfer history records moved and deduplicated modes;
17. non-Person Follow rows are untouched;
18. historical Credits are byte-for-byte unchanged by reconciliation;
19. `resolve_credit_person(...)` resolves all three typed Credit identity kinds in fixtures;
20. Hafare body of work contains Top 50 exactly once as Curator;
21. Hafare's seven non-current Playlist Credit attachments do not leak;
22. `/people/muiruri-beautah` body of work contains the current Article exactly once as Author;
23. body-of-work route fallback returns `/magazine/...` and `/playlists/...` when Resource alias is absent;
24. public role summary comes only from current-public Shared Credits;
25. public Person read still has no follower count;
26. Person work pagination is deterministic across Article and Playlist;
27. private Follow reader remains self-only;
28. production drift returns to zero after apply.

Do not write the migration until the implementation script can statically prove these boundaries are represented.


## SQL preparation review corrections

Status:

accepted before Migration B rehearsal.

The first locally prepared Migration B SQL/verifier pair passed scope checks but exposed two implementation-review defects before any database apply.

### Correction 1: public role items do not expose Credit ids

The locked public work contract exposes:

- role;
- role label;
- display order;
- primary-credit state.

It does not expose internal Shared Credit UUIDs.

Therefore the public `roles` JSON produced by the current-public Person work helper must not include a `credit_id` key.

Credit UUIDs remain internal trust/governance authority.

### Correction 2: the durable verifier must remain clean-room compatible

The accepted rehearsal model is a schema-only clone of current linked production.

No production row data is restored into that clone.

Therefore the durable Migration B verifier must not require Hafare, Top 50, the live external-contributor Article, or any production Administrator row to exist before it can exercise Migration B.

The durable verifier must create rollback-only synthetic authority for:

- its authenticated Administrator actor;
- user, Registry Author, and external-contributor Credit resolution;
- one current-public Article work row;
- one current-public Playlist work row;
- one non-current historical Playlist Credit attachment;
- link, unlink, merge, Follow-transfer, route, pagination, and cycle acceptance.

The synthetic Playlist Credit must begin on the source Person identity and resolve to the target Person after merge without mutating the Credit row.

The synthetic Article Credit must remain on the target Person account identity.

The durable verifier remains transactionally rolled back.

### Independent live proof remains required after production apply

Removing hard-coded production rows from the durable verifier does not weaken production acceptance.

After Migration B is applied, independent live verification must still prove:

- Hafare resolves Top 50 exactly once as Curator from the exact current published Playlist version;
- the known non-current Hafare Playlist Credit attachments do not leak;
- `/people/muiruri-beautah` resolves the current public Article exactly once as Author;
- alias-first route fallback returns the shipped `/playlists/` and `/magazine/` routes where Resource aliases are absent;
- public Person roles come only from current-public Shared Credits;
- follower count remains absent.

Those are live acceptance facts, not schema-only clone prerequisites.

No production data is copied into the rehearsal clone to manufacture these proofs.

## Pre-rehearsal review correction 4: schema-qualify deferred merge constraint

The repaired durable verifier initially invoked the Migration B deferred merge-cycle constraint by unqualified name.

The constraint belongs to the `editorial` schema.

This repository already encountered the same PostgreSQL `SET CONSTRAINTS` name-resolution hazard during Migration A rehearsal.

Therefore the Migration B verifier must use:

`editorial.people_merge_cycle_integrity`

for both the immediate negative check and restoration to deferred mode.

This is a verifier-only correction.

It does not change Migration B schema or runtime command semantics.

## Pre-rehearsal review correction 5: synthetic publication fixtures must satisfy typed parent authority

The clean-room verifier creates synthetic Article and Playlist publication evidence.

Those version and snapshot tables do not stand alone.

Current schema foreign-key authority requires:

- `editorial.article_versions.article_id` to reference `public.wk_articles`;
- Article Resources to have an `editorial.article_resources` typed binding;
- `editorial.playlist_resources.playlist_id` to reference `public.wk_playlists`;
- `editorial.playlist_resources.current_published_version_id` to resolve to an exact `editorial.playlist_versions` row;
- `editorial.playlist_publication_snapshots.version_id` to resolve to that exact Playlist version;
- Playlist publication snapshots to reference a durable command receipt.

Therefore the rollback-only verifier must create the minimal typed Article and Playlist parents, both current and historical Playlist version rows, and one synthetic `playlist.publish` command receipt before inserting the publication snapshot.

These fixtures are verifier-only and roll back completely.

They do not weaken or bypass current publication authority.

## Current-schema rehearsal correction 6: no replication-role bypass in durable verification

The first current-schema rehearsal reached the durable verifier and stopped when the rollback-only fixture attempted to change `session_replication_role` from inside its PL/pgSQL acceptance block.

That stop occurred after:

- the exact Migration B runtime SQL applied successfully to the schema-only clone;
- Migration B added schema/control-plane authority without Person, Credit, or Follow content mutation;
- the verifier established its synthetic users and Administrator authority.

The failure was therefore a verifier-fixture privilege defect, not a Migration B runtime-SQL failure.

The durable verifier must not depend on replication-role bypasses.

The corrected fixture instead uses current authority:

- the normal `auth.users` signup trigger creates its baseline public profile and Subscriber role;
- the verifier upserts only its rollback-only profile presentation fields;
- required Credit role vocabulary is seeded transactionally and rolls back;
- the synthetic Registry Author Person receives an active preferred identity link before deferred integrity is forced;
- the synthetic external-contributor Playlist Credit uses the ordinary `contributor` role rather than impersonating governed Curator authority;
- Playlist Trust begins on a synthetic working version;
- the same immutable Credit is copied through working -> submitted -> approved -> published using `platform_private.begin_playlist_trust_copy_authorization(...)`;
- the approved, submitted, and working attachments remain non-current history;
- only the exact current published Playlist version may appear in Person body of work.

This is stronger than disabling triggers because the verifier now exercises the existing Playlist immutable-Trust authority rather than bypassing it.

No `session_replication_role` mutation is permitted in the durable Migration B verifier.

Migration B runtime SQL remains unchanged by this correction.
