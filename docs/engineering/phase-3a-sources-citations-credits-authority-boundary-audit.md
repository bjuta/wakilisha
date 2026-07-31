# Phase 3A Sources, Citations, and Credits Authority Boundary Audit

Date: 31 July 2026

## Status

Authority boundary locked for Phase 3A schema design.

This audit completes the required pre-implementation review defined by:

- `docs/institute/two-workspace-pilot-audit-and-build-plan.md`
- `docs/engineering/phase-3-trust-infrastructure-kickoff.md`
- `docs/engineering/article-workspace-north-star-audit.md`

Phase 3A schema implementation may proceed only within the boundaries recorded here.

## Objective

Build one shared trust layer that can support Articles first and later support:

- Registry changes
- Playlist and track notes
- Audio publications
- Video publications
- Chart methodology and interpretation
- Inquiry Findings

The trust layer must not become:

- an Article-only evidence feature
- an Institute-only evidence authority
- a replacement for canonical output ownership
- a replacement for Registry identity
- a replacement for Media authority
- another publication lifecycle authority

## Existing authorities

### Stable cultural-resource identity

Authority:

- `editorial.resources`
- typed resource bindings such as `editorial.article_resources`
- immutable Article versions in `editorial.article_versions`

Decision:

Every trust attachment to a canonical output must use `editorial.resources.id`.

Where the target output supports immutable versions, the trust attachment must also identify the exact target version.

For Articles, the exact target version is `editorial.article_versions.id`.

### Authenticated account identity

Authority:

- `auth.users`
- `public.user_profiles`

Purpose:

- authentication
- account display
- permissions
- ownership
- internal actor identity

Decision:

Authenticated account identity is not automatically public editorial authorship.

A Credit may reference an authenticated user, but public display must use a stored credit snapshot rather than reading mutable account profile data at render time.

### Canonical public author identity

Authority:

- `public.registry_authors`

Purpose:

- public editorial author pages
- biography
- public author image
- public role
- public social links
- public Article byline enrichment

Verified limitation:

`public.registry_authors` has no canonical foreign key to `auth.users` or `public.user_profiles`.

Decision:

A Credit may reference a Registry author directly.

Phase 3A must not infer a Registry author from a user display name, email address, Article byline string, or generated slug.

A future explicit identity mapping may connect authenticated users and Registry authors, but that mapping is not required for the first Phase 3A schema proof.

### Contributor intake identity

Authority:

- `public.contributors`
- `public.contributor_submissions`

Current purpose:

- contributor participation
- community or Registry intake
- submission attribution
- trust-level and status metadata

Verified limitations:

- contributor records may reference an authenticated user
- contributor records do not reference Registry authors
- no public contributor profile contract was found
- no verified public-read policy was found
- contributor status and trust level are internal intake concepts

Decision:

`public.contributors` must not automatically become the public external-contributor authority.

Phase 3A will introduce a separate external-contributor authority for named creditable people who are neither authenticated-account credits nor Registry-author credits.

Existing contributor records may be linked or migrated later only through reviewed mapping.

### Article byline

Current authority:

- mutable Article `author` field
- immutable `article_versions.author_display`
- publication snapshot `author`
- text-based enrichment through `registry_authors`
- generated author metadata where no Registry author matches

Decision:

The Article byline remains a legacy public display field during Phase 3A.

It must not be treated as canonical ownership or canonical credit identity.

Phase 3A Credits will coexist with the legacy byline until Article integration explicitly adopts the shared credit authority.

No automatic conversion from Article byline text to Registry author or external contributor is allowed.

### Media authority

Authority:

- `public.registry_media_assets`

Purpose:

- stored files
- media metadata
- technical classification
- rights status
- existing credit text
- internal notes

Decision:

A Source may optionally reference a Media asset.

The Source remains authoritative for:

- source type
- source creator or author
- publisher or custodian
- archive identity
- capture and retrieval dates
- source language and place
- source consent
- source sensitivity
- source review state
- source withdrawal
- source public-safety state

Media rights metadata must not automatically make a Source public-safe.

Source withdrawal must not delete the referenced Media asset.

### Existing evidence authorities

Existing systems include:

- `public.evidence_items`
- `public.evidence_review_events`
- `public.registry_relationship_evidence`
- `public.institute_evidence_items`
- `public.registry_provenance_links`
- chart ingestion and scoring source records

Verified limitations:

- existing evidence rows are mutable
- existing evidence rows have no immutable source-version identity
- source description and editorial assessment are mixed
- existing evidence locators are not typed
- existing evidence records are tied to Institute or Registry workflows
- chart sources are ingestion inputs, not reusable editorial Sources
- Registry provenance records preserve operational history, not shared editorial Source authority

Decision:

No existing evidence table becomes the Phase 3A Source authority.

PR 3A establishes a new shared authority.

Existing evidence may later point to or migrate into shared Sources through explicit reviewed bridge records.

No bulk automatic migration is part of the initial Phase 3A implementation.

## Canonical Source contract

A Source is a reusable trust record representing material used in cultural work.

A Source has:

- stable identity
- one current working state
- immutable versions
- source type
- title
- creator or author
- publisher or custodian
- source URL where appropriate
- optional Media asset
- archive identifier
- publication date
- capture date
- retrieval date
- language
- country and place
- rights status
- consent status
- sensitivity
- reliability note
- credit line
- internal notes
- review status
- public-safety state
- withdrawal state
- created and reviewed actors
- timestamps

Supported source types must include:

- interview
- book
- article
- archive_document
- photograph
- audio_recording
- video_recording
- registry_record
- community_memory
- institutional_document
- social_post
- dataset
- website
- physical_artefact
- other

Source type values are canonical machine values.

Public display labels may change without changing stored source identity.

## Source versions

Each Source version is immutable.

A Source version stores the exact source metadata available when it was created.

A Citation must reference an exact Source version.

Later Source edits must not rewrite historical Citation meaning.

Withdrawal does not delete:

- Source identity
- Source versions
- historical Citations
- published trust history

Withdrawal prevents new public use according to policy and records:

- withdrawal state
- withdrawal reason
- withdrawal actor
- withdrawal timestamp

Sensitive withdrawal reasons remain internal unless explicitly approved for public display.

## Source review and public safety

Review state and public safety are separate.

Recommended review states:

- draft
- ready_for_review
- in_review
- changes_requested
- approved
- rejected

Recommended source states:

- active
- withdrawn
- archived

A Source may be approved but not public-safe.

A Source may be usable internally while its identity, URL, locator, quotation, Media link, or contributor identity remains private.

Public safety must be explicit and reviewed.

Public presentation must never infer safety from:

- a non-null URL
- an active Media asset
- an approved Registry record
- authenticated visibility
- an Article being published

## Source privacy classes

Each Source must have an explicit exposure class.

Recommended classes:

- public
- public_redacted
- internal
- restricted
- confidential

Meaning:

### public

Approved public source metadata and public-safe Citations may be shown.

### public_redacted

A public source reference may be shown, but selected identity, URL, locator, quotation, or Media fields remain hidden.

### internal

The Source may support internal editorial work but is not shown publicly.

### restricted

Access is limited to authorised trust reviewers or administrators.

### confidential

The Source identity and content require the strictest internal handling and are excluded from ordinary public and authenticated read models.

Public views must be allowlists.

They must not expose internal Source rows and then attempt to hide unsafe columns in the frontend.

## Registry links

A Source may link to Registry entities for trust context.

Phase 3A must use explicit typed links rather than unverified free-text slugs.

The first schema may support links to the existing canonical Registry entity index where the underlying authority is known.

Registry links are contextual relationships.

They do not turn a Registry record into the Source itself unless the Source type is `registry_record` and the exact Registry authority is explicitly referenced.

A Source linked to a Registry entity remains independently versioned and reviewed.

## Canonical Citation contract

A Citation identifies the exact portion of one Source version used by one target.

Each Citation must identify:

- stable Citation identity
- Source identity
- exact Source version
- target resource identity
- exact target version where supported
- Citation purpose
- typed locator
- optional target anchor
- optional quotation
- optional editor note
- public-safety state
- created actor
- created timestamp

For Articles, every Citation must reference:

- `editorial.resources.id`
- `editorial.article_versions.id`

A Citation attached only to an Article resource is insufficient because the Article can later change.

## Typed Citation locators

Citation locators must use structured fields.

Supported locator types must include:

- page
- page_range
- paragraph
- quotation
- timestamp
- timestamp_range
- chapter
- image_frame
- spreadsheet_row
- spreadsheet_cell
- archive_identifier
- transcript_range
- section_heading
- whole_source
- other

Locator storage must preserve machine-readable values.

Examples:

- page number
- start and end page
- timestamp in milliseconds
- start and end timestamp
- spreadsheet sheet, row, and column
- transcript start and end
- archive reference
- section heading

Rendered citation text is derived presentation.

Changing punctuation, label wording, locale, or citation style must not change Citation identity.

## Target anchors

A Citation may optionally identify an exact location inside the target version.

For Articles, the first supported anchor forms may include:

- block ID
- heading ID
- paragraph ID
- character range
- structured editor node reference
- whole Article version

The first Article proof may use whole-version attachment where a stable inline anchor does not yet exist.

Phase 3A must not invent fragile anchors from rendered HTML indexes without a durable editor contract.

## Canonical Credit contract

A Credit records a public or internal contribution to a resource or exact version.

Supported roles include:

- author
- editor
- curator
- researcher
- interviewer
- producer
- host
- guest
- camera
- audio
- translator
- photographer
- contributor
- reviewer
- fact_checker
- other

Role values are canonical machine values.

Display labels may change without changing Credit identity.

## Creditable-person identity contract

Every Credit must use exactly one credited-party authority:

1. authenticated user
2. Registry author
3. external contributor

Exactly one of these fields must be present:

- `user_id`
- `registry_author_id`
- `external_contributor_id`

A Credit must never resolve identity through:

- display-name comparison
- email comparison
- Article byline comparison
- slug generation
- fuzzy matching
- frontend fallback logic

### Authenticated-user Credit

Used when the contribution belongs to a known WAKILISHA account.

The Credit stores a display snapshot.

Later changes to `user_profiles.display_name` must not rewrite historical publication Credits.

### Registry-author Credit

Used when the contributor has a canonical public editorial author profile.

The Credit stores a display snapshot and may link publicly to the Registry author route.

Later edits to the Registry author profile must not rewrite the historical Credit display snapshot.

### External-contributor Credit

Used for a named contributor who does not have an authenticated-user Credit or Registry-author Credit.

The external contributor authority must support:

- stable identity
- display name
- optional public role or description
- optional public URL
- optional location
- optional contact metadata kept internal
- consent state
- public-safety state
- active, withdrawn, or archived state
- internal notes
- created and updated actors
- timestamps

External contributor contact details must never be exposed by default public reads.

## Credit version binding

Credits may attach to:

- a stable resource
- an exact resource version
- both

For versioned outputs such as Articles, publication Credits must bind to the exact immutable version.

Resource-level Credits may represent durable roles that apply across versions.

Version-level Credits represent the exact credited contribution for that version.

The Article publication snapshot can derive public Credits from its immutable `version_id`.

PR 3A should not duplicate Credit JSON into the publication snapshot unless public-read performance or snapshot independence proves that duplication is required.

## Ownership, byline, and Credit separation

These concepts remain distinct:

### Ownership

Authority:

- `editorial.resources.owner_id`

Meaning:

The authenticated account responsible for canonical resource authority and permissions.

### Article byline

Authority during transition:

- Article author display fields
- immutable Article version author display
- publication snapshot author display

Meaning:

Legacy primary public author text.

### Credit

Authority:

- shared Phase 3A Credit records

Meaning:

A reviewed, typed contribution made by an authenticated user, Registry author, or external contributor.

No one concept may be used as a fallback authority for another.

## Permission boundary

The shared trust layer must not depend only on Article, Registry, or Institute permissions.

Phase 3A should introduce narrow shared capabilities.

Recommended capabilities:

- `view_trust_records`
- `manage_sources`
- `review_sources`
- `withdraw_sources`
- `manage_citations`
- `manage_credits`

Administrators retain full authority.

Initial role allocation should be conservative:

- administrator: all trust capabilities
- editor: view, manage Sources, manage Citations, manage Credits
- reviewer: view and review Sources
- registry editor: view and manage Sources and Citations where Registry workflows adopt the shared layer
- author: no global Source management authority by default

Article attachment commands must also verify permission to edit the target Article resource.

Trust permission alone must not grant permission to alter another domain's canonical resource.

## Mutation boundary

Client code must not directly orchestrate multi-table trust transitions.

Transactional commands are required for operations such as:

- create Source and first Source version
- create a new Source version
- approve or reject a Source version
- withdraw a Source
- attach a Citation to an Article version
- replace Article-version Citation attachments
- attach or reorder version Credits

Commands must validate:

- actor permissions
- Source state
- Source version identity
- target resource identity
- target version identity
- public-safety rules
- exactly-one credited-party identity
- optimistic concurrency where mutable working rows are involved

## Public read boundary

Public trust presentation must use narrow allowlisted views or functions.

Public reads may expose only:

- approved public-safe Source display fields
- approved public-safe Citation display fields
- approved public Credits
- public-safe external contributor fields
- public Registry author links where applicable

Public reads must not expose:

- internal notes
- private contact details
- confidential Source identity
- restricted URLs
- private Media links
- consent details not intended for publication
- sensitive withdrawal reasons
- reviewer-only reliability notes
- unpublished target resources or versions

Security must be enforced in SQL.

Frontend filtering is not a security boundary.

## Migration strategy

PR 3A does not automatically migrate existing source-like or contributor-like records.

Initial treatment:

- `evidence_items`: legacy shared evidence, eligible for later reviewed Source mapping
- `institute_evidence_items`: Inquiry-specific legacy evidence, no automatic migration
- `registry_relationship_evidence`: remains linked to legacy evidence until a reviewed bridge is implemented
- `registry_provenance_links`: remains operational provenance history
- chart source records: remain ingestion and scoring evidence
- `contributors`: remain participation and intake identities
- `registry_authors`: remain canonical public editorial author profiles
- Article bylines: remain legacy display data

A later migration must record:

- legacy table
- legacy record ID
- new Source or external contributor ID
- mapping decision
- mapping actor
- mapping reason
- mapping timestamp

## First narrow Article proof

The first production proof for Phase 3A must demonstrate:

1. Create one reusable Source.
2. Create an immutable approved Source version.
3. Attach one typed Citation to one immutable Article version.
4. Attach at least three Credits representing:
   - one authenticated user
   - one Registry author
   - one external contributor
5. Publish or preview the exact Article version.
6. Verify that public presentation exposes only approved public-safe fields.
7. Edit the Source working record and create a newer Source version.
8. Verify that the existing Citation still points to the original Source version.
9. Change a user or Registry author display profile.
10. Verify that the published Credit display snapshot does not change.
11. Withdraw the Source.
12. Verify that historical Citation identity remains intact and that new public use is blocked according to policy.

## Immediate non-goals

PR 3A must not implement:

- Article lifecycle redesign
- Publishing lifecycle authority
- Playlist authority
- Audio authority
- Video authority
- Media platform redesign
- Inquiry Mode
- correction cases
- general provenance events
- automatic migration of all evidence
- automatic conversion of Article bylines
- fuzzy person matching
- public Article visual redesign
- generic public-content-read replacement

## Schema implementation sequence

Recommended sequence:

1. shared trust capability definitions
2. Source identity and mutable working record
3. immutable Source versions
4. Source Registry links
5. typed Citations
6. external contributors
7. Credits
8. Article-version Citation attachments
9. Article-version Credit attachments
10. transactional commands
11. authenticated internal read models
12. narrow public-safe read models
13. generated database types
14. live-schema verification
15. regression tests
16. one narrow Article integration proof

## Exit condition

The Phase 3A authority boundary is satisfied when:

- Sources are reusable and independently versioned
- Citations bind exact Source and target versions
- Credits use explicit credited-party identity
- ownership, byline, and Credits remain separate
- private Source material cannot leak through public reads
- historical published trust records do not drift when profiles or working Source data change
- no existing Institute, Registry, Chart, Media, contributor, or Article field is silently promoted into a conflicting authority
