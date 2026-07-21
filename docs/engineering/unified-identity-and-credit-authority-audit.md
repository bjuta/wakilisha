# Unified identity and credit authority audit

Date: 21 July 2026

## Status

Architecture decision draft.

No new user system is authorized by this document.

## Executive verdict

WAKILISHA should not create a separate credit-person system beside admin users, public users, and Registry Authors.

The platform already has one underlying authentication identity.

The fragmentation exists in profile representation, public author identity, ownership matching, and Article bylines.

The right response is consolidation, not another contributor silo.

## Current identity layers

### Authentication identity

`auth.users`

This owns:

- login
- session
- email identity
- authentication provider identity

### WAKILISHA account profile

`user_profiles`

This owns:

- display name
- avatar
- bio
- public account information
- account status
- account metadata

### Access authority

`user_role_assignments`

`user_access_scopes`

`role_capabilities`

These own:

- admin access
- editorial access
- review permissions
- publishing permissions
- Registry permissions
- public membership capabilities

### Public editorial identity

`registry_authors`

This currently owns:

- author name
- public slug
- biography
- avatar
- cover
- public role
- location
- social links
- public author page

### Article byline and ownership representation

The Article currently stores an author string.

Ownership checks partly depend on comparing that string with an authenticated user’s display name.

Public Author ownership separately attempts email matching.

This is the weak link.

## The current fragmentation

The system does not truly have three authentication systems.

It has one authentication system and several identity representations that are not linked strongly enough.

Current problems include:

- Article ownership depends on text comparison
- Article bylines can be unstructured custom strings
- Registry Authors may not link directly to authenticated users
- public profile and public author profile can represent the same person separately
- role names can be confused with contribution credits
- a future photographer or researcher could be represented differently in each feature
- external contributors risk becoming another parallel person system

## Visual identity evidence from the Article Workspace

The production workspace exposes several identity representations at the same time:

- authenticated Administrator badge
- Article Owner label
- editable Author field
- public byline
- actor email in review decisions

These representations are not presented as parts of one identity system.

The visible interface confirms that the current distinction between account identity, draft ownership, public identity, and publication credit is not clear enough.

### Confirmed requirement

The future workspace must distinguish:

- signed-in account
- access role
- draft owner
- credited person
- contribution role
- public byline
- lifecycle actor

These concepts must share identity authority where appropriate without being collapsed into one label.

### Confirmed rejection

Phase 3A must not add another contributor identity picker beside the current Author picker.

The Article Workspace should eventually assign credits through one canonical person authority.

## Responsive identity evidence

The responsive workspace separates identity information across distant locations.

At the top of the Article, the editor sees:

- account role
- lifecycle state
- Article owner

After the full Article body, the editor reaches:

- Author
- Categories
- Tags
- related-content context

On mobile, the Article Author can be many screen lengths away from the Owner and authenticated account identity.

This reinforces the false impression that these are unrelated systems.

### Confirmed responsive requirement

The future command bar and Trust sidecar must keep the following concepts understandable without requiring long-distance scrolling:

- signed-in account
- access role
- Article owner
- credited person
- contribution role
- public byline

The interface must not solve identity fragmentation by adding more distant cards.

## Core decision

Use one account identity and one canonical creditable-person identity.

Do not create separate identity authorities for:

- researchers
- photographers
- interviewers
- editors
- fact checkers
- translators
- external contributors

These are contribution roles, not person types.

## Proposed unified model

### One authentication identity

`auth.users`

Every signed-in person uses the same identity.

An administrator is not a different kind of authenticated person from a public member.

### One account profile

`user_profiles`

Every account has one profile.

Admin and public interfaces should read the same core account identity.

Admin tools may enrich it with permissions.

Public interfaces may enrich it with public preferences and community information.

### One canonical creditable person

The existing `registry_authors` authority should be evaluated as the likely foundation.

It may be evolved into a broader contributor or person authority if the term Author becomes too narrow.

A creditable person can:

- link to one authenticated user
- exist without an account
- have a public profile
- remain private or unlisted
- receive credits on many resources
- later claim or connect an existing public identity

An external contributor is therefore a person without an account link.

It is not a separate identity species.

### One explicit account-to-person link

The canonical person record needs a durable link to `auth.users`.

The final design may use:

- a nullable unique `auth_user_id` on the person record
- or a dedicated account-to-person link table

The decision must support:

- one account linked to one canonical person by default
- carefully governed exceptions
- linking an existing contributor after account creation
- unlinking without destroying historical credits
- merge and duplicate resolution

### Access roles remain separate

Access roles answer:

What may this account do?

Examples:

- Administrator
- Editor
- Reviewer
- Writer
- Subscriber
- Registry Editor
- Media Editor

These remain part of account authorization.

### Credit roles belong to each work

Credit roles answer:

What did this person contribute to this work?

Examples:

- Author
- Editor
- Researcher
- Interviewer
- Photographer
- Translator
- Fact Checker
- Producer
- Curator
- Illustrator
- Data Researcher

A person can hold different credit roles on different resources.

Credit roles must not automatically grant admin access.

## Proposed credit assignment shape

A future structured credit should conceptually contain:

- resource identity
- resource version identity where required
- canonical person identity
- credit role
- display order
- optional public note
- optional internal note
- public visibility
- credited name snapshot where historical reconstruction requires it
- created by
- created at

The credit should not point separately to:

- a user
- a Registry Author
- an external contributor

It should point to one canonical person identity.

## Article migration direction

### Current Article author field

The current author string remains temporarily for compatibility.

It should not remain the final ownership or credit authority.

### Structured Author credit

Where an Article author can be mapped confidently to a canonical person:

- create an Author credit
- preserve the existing public byline
- preserve historical publication reconstruction
- stop using display-name matching for ownership

### Ambiguous author strings

Do not guess.

Ambiguous bylines should enter a review queue for manual mapping.

### Custom bylines

A custom byline may still be valid presentation.

It must not silently create a new identity.

The editor should clearly distinguish:

- linked person
- public display byline
- unlinked legacy text requiring review

## Ownership direction

Article ownership and Article credit are related but not identical.

Ownership answers:

Who may control this draft?

Credit answers:

Who contributed to the published work?

An editor may own the draft without being the Author.

An Author may be credited without having an account.

The final Article authority should use explicit authenticated ownership fields and structured credits separately.

## Public profile direction

A signed-in contributor should not maintain unrelated copies of the same name, avatar, and biography across multiple profile systems.

The system must define which fields come from:

- account profile
- public contributor profile
- resource-specific credit

Recommended direction:

- account profile controls account identity and private settings
- canonical person controls public editorial identity
- credit assignment controls resource-specific contribution
- public byline presentation derives from the structured credit plus approved display rules

## External contributor flow

A contributor without an account should be created once as a canonical person.

Later, when they create an account:

1. verify identity
2. link the account to the existing person
3. preserve all historical credits
4. avoid duplicate public profiles
5. grant access roles separately when required

## Technical-bloat rules

The following would count as unacceptable bloat:

- creating a separate external contributor table without proving the canonical person model cannot support it
- creating role-specific person tables
- storing credit people as repeated free-text names
- linking credits directly to several competing identity tables
- making contribution roles part of account authorization
- creating Article-only credit identity
- creating Institute-only contributor identity
- duplicating profile fields without an ownership contract
- continuing display-name or substring ownership matching
- automatically creating public identities from every custom byline

## Required identity audit before schema

Before Phase 3A schema begins, inspect:

- `auth.users`
- `user_profiles`
- `user_role_assignments`
- `user_access_scopes`
- `registry_authors`
- Article author fields
- author ownership services
- public profile pages
- public Author pages
- admin user management
- Registry Author management
- community identity presentation
- imported WordPress author data
- duplicate Author records
- unlinked public users
- unlinked Registry Authors

## Required data counts

The implementation design must establish:

- authenticated user count
- user profile count
- active role assignment count
- Registry Author count
- Registry Authors with emails
- Registry Authors linked to accounts
- duplicate emails
- duplicate normalized names
- duplicate slugs
- Articles with known Registry Author matches
- Articles with ambiguous author strings
- Articles using staff or generic bylines
- public users who appear to match Registry Authors

No destructive migration should begin without these counts.

## Proposed Phase 3A identity boundary

Phase 3A may:

- define the canonical creditable-person contract
- link person identity to accounts
- define structured resource credits
- migrate clearly matched Article Authors
- preserve legacy bylines
- provide manual resolution for ambiguous identities
- expose credit assignment inside the Article Workspace

Phase 3A must not:

- redesign the entire public account experience
- remove legacy fields before compatibility proof
- merge people automatically from name similarity
- grant access through credit roles
- create separate researcher, photographer, or interviewer identity systems
- create a second authentication path
- make Registry identity depend on Article identity
- make Article ownership depend on a byline

## Exit gate

The identity and credit model is ready when:

- admin and public access use one authentication identity
- one account has one account profile
- one canonical person can exist with or without an account
- an existing contributor can later link an account without losing credits
- Article ownership no longer depends on display-name comparison
- Article credits reference one person authority
- contribution roles do not grant access
- access roles do not imply publication credit
- legacy bylines remain reconstructable
- ambiguous mappings require review
- no new parallel user or contributor system is introduced
