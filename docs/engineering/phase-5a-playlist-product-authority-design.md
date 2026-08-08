# Phase 5A: Playlist Product and Canonical Authority

Date: 8 August 2026

## Status

Phase 5A authority and product contract.

Implementation has not started.

Starting repository authority:

`ceb944a9b432e352ecbad52f157009573aebec35`

Phase 4B is closed.

## Programme authority

The WAKILISHA Editorial Production System and Inquiry Mode Project Plan remains
the authority for Phase 5.

Phase 5 is not being reduced or replaced by this design.

The programme requires:

### PR 5A: Canonical Playlist authority

- independent Playlist domain
- list and editor routes
- metadata
- cover assets
- atomic ordering
- item identity
- Registry and provider matching
- external pending tracks
- duplicate detection
- notes
- versions
- credits
- capabilities

Phase 5A exit gate:

- a Playlist can be created and reviewed without Institute involvement
- concurrent ordering cannot corrupt positions

### PR 5B: Public Playlist product

- public collection and detail routes
- responsive playback
- citations
- provenance
- corrections
- scheduling
- SEO
- cached read model
- migration of useful existing drafts

Phase 5B exit gate:

- one real Playlist is reviewed and published end to end

The wider canonical Playlist contract also requires:

- title
- slug
- description
- cover
- curator
- credits
- Registry track selection
- Registry release and artist links
- provider normalization
- Registry identity matching
- external-only pending items
- missing-record suggestions
- atomic drag-and-drop ordering
- duplicate detection
- per-track notes
- per-track sources and citations
- curatorial argument
- exact preview
- immutable review and publication versions
- scheduling
- publishing
- archiving
- restoration
- public corrections
- missing-track suggestions
- mobile and desktop playback
- public SEO
- sharing metadata

This design changes how those capabilities are experienced.

It does not remove them.

## Product north star

WAKILISHA Playlists are first-class editorial music publications built around
selection, sequence, and listening.

They must be exceptionally fast and enjoyable to create.

They must be beautiful and immediate to consume.

They must also be capable of carrying the institutional depth of WAKILISHA
when that depth adds value.

Registry matching, provider intelligence, notes, Sources, Citations, Credits,
Review, versions, Provenance, and Corrections are capabilities of the Playlist
system.

They are not obligations imposed on every track.

The interface reveals complexity progressively.

The underlying authority remains rigorous regardless of how simple the
experience feels.

## Core product principle

**Full capability, progressive interaction.**

A feature being supported by the Playlist domain does not mean an editor must
complete it for every track.

The product must distinguish between:

1. information needed to make the Playlist work
2. information WAKILISHA can resolve automatically
3. optional editorial depth
4. governance required only when the Playlist reaches review or publication

The Playlist is the primary cultural object.

Tracks are the ordered musical composition of that object.

## User-centred hierarchy

A person creating a Playlist should primarily think about:

- what the Playlist is
- what music belongs in it
- what order the music belongs in
- how the Playlist should look
- whether it is ready to be reviewed

A person opening a public Playlist should primarily understand:

- what this Playlist is
- why they may want to listen
- who curated it
- what tracks are in it
- how to start listening

Everything else supports those goals.

The product must not make users navigate WAKILISHA's institutional architecture
to accomplish ordinary Playlist work.

## Playlist identity

Playlist is a canonical WAKILISHA domain.

It does not belong to Institute.

Institute may later create or attach Playlist work through Inquiry Mode, but
that relationship is context and provenance.

It is not Playlist authority.

Playlist receives:

- one stable Playlist ID
- one stable WAKILISHA Resource ID
- one canonical slug and route identity
- ownership
- visibility
- lifecycle state
- version authority

## Existing fake Playlist data

The current production database contains:

- 2 Playlist rows
- 4 Playlist items
- 1 Playlist Resource binding
- 0 published Playlists

The product owner has confirmed that both Playlist rows and all four items are
fake test content with no cultural value.

They are not migration heritage.

They are not useful existing drafts.

They must not receive baseline canonical versions or be preserved as historical
Playlist publications.

The first implementation migration may delete them only under exact guarded
preconditions.

The migration must stop rather than delete unexpected Playlist data.

After guarded cleanup, Phase 5 begins with zero canonical production Playlists.

## Existing schema is reference material, not sacred architecture

Current tables include:

- `public.wk_playlists`
- `public.wk_playlist_items`
- `editorial.playlist_resources`

Useful existing field semantics may be retained.

The implementation may alter the schema where the permanent Playlist contract
requires it.

Historical migrations are never rewritten.

The existing Institute Playlist bridge is compatibility evidence only.

It is not the target Playlist service.

## One authority per object

Playlist owns:

- Playlist metadata
- Playlist composition
- item order
- Playlist-specific notes
- Playlist versions
- Playlist lifecycle commands

Registry owns:

- canonical artist identity
- canonical release identity
- canonical track identity
- provider relationships attached to Registry records

Media owns:

- cover assets
- immutable files
- derivatives
- delivery

Shared Trust owns:

- Sources
- Citations
- Credits
- Review
- Provenance
- Corrections

Publishing owns operational coordination.

Inquiry owns questions, Findings, interpretation history, and relationships to
work.

No Playlist-specific duplicate implementation of these shared systems is
permitted.

## Playlist metadata

The primary Playlist metadata is intentionally understandable:

- title
- slug
- description
- curator presentation
- cover Media asset
- ownership
- visibility
- lifecycle state
- publication dates where applicable

Additional bounded metadata may exist where useful.

JSON must not replace durable relationships that belong in Registry, Media,
Credits, Sources, Citations, or Resource identity.

## Curatorial argument

A Playlist may make an editorial or curatorial argument.

That argument belongs primarily to the Playlist as a whole.

The title, description, selection, and sequence may be enough.

A Playlist must not require an explanatory essay for every included track.

Per-track notes remain available where a particular selection deserves
additional context.

## Playlist item identity

Every Playlist item receives a stable item identity.

A Playlist item is independently targetable because it may need:

- correction
- review context
- Citation attachment
- note history
- duplicate resolution
- future Inquiry relationship

Playlist item identity must not depend on its current position.

Moving a track does not create a different item.

## Global Resource identity for Playlist items

The permanent platform kernel identifies `playlist item` as a Resource kind.

Phase 5A therefore establishes a typed Resource binding for Playlist items.

This permits shared systems to address a Playlist item without polymorphic text
guesses.

Playlist item Resource identity exists for platform integrity.

It does not mean the ordinary Playlist interface must expose Resource machinery
to the editor.

## Track representation

A Playlist item may resolve through one of several identity states.

### Registry matched

Preferred state.

The item identifies a canonical Registry track.

Artist, release, provider identities, artwork, and related information should
normally be resolved from Registry and provider authority rather than manually
re-entered by the Playlist editor.

### Provider identified

The track has a supported provider identity but has not yet been confidently
matched to Registry.

The Playlist remains editable.

WAKILISHA may suggest or resolve the Registry match later.

### External pending

The track has enough information to belong to the Playlist but does not yet
have canonical Registry or provider identity.

The editor may continue working.

The system must not force creation of a low-quality Registry record merely to
complete a Playlist.

## Metadata acquisition principle

**Resolve rather than require.**

Where WAKILISHA can obtain track metadata from Registry or a provider, it should
do so.

The Playlist editor should not ask the curator to repeatedly enter:

- artist
- release
- ISRC
- artwork
- provider IDs
- provider metadata

when those facts already exist in an authority WAKILISHA trusts.

Automatically resolved metadata may be cached for presentation or immutable
version snapshots where needed.

Cached presentation data is not a second cultural authority.

## Adding tracks

Track addition must optimise for speed.

Primary paths should include:

- search WAKILISHA Registry
- select a track
- paste or enter a supported provider track URL or identity
- add an unresolved external track when necessary

Phase 5A does not require a speculative universal streaming-service import
engine.

Provider integrations should be added where they directly improve the required
Playlist workflow.

## Missing-record suggestions

When a track cannot be matched to Registry, WAKILISHA may suggest:

- likely Registry matches
- that a Registry record may be missing
- that review is needed

This is assistance.

It must not become a blocking workflow unless publication policy genuinely
requires resolution.

## Duplicate detection

Possible duplicates are detected using available identity evidence such as:

1. identical Registry track identity
2. identical provider identity
3. lower-confidence normalized title and artist signals

Duplicate detection is advisory.

It must explain the suspected duplicate.

It must not prohibit intentional repetition.

Editors may knowingly retain repeated tracks.

## Per-track notes

Per-track notes are fully supported.

They are optional.

A normal track does not require a note.

The interface should make adding a note easy when the curator has something
worth saying.

Tracks without notes should remain visually clean.

## Per-track Sources and Citations

The Playlist domain must support Sources and Citations at item level as required
by the programme.

They reuse the shared Trust authority.

They are used when a track note, historical statement, factual assertion, or
curatorial claim warrants evidence.

They are not mandatory bibliography fields for every track.

Phase 5A must make the editor capable of attaching this depth.

Phase 5B owns the appropriate compact public presentation.

## Cover assets

Playlist covers use the canonical Media authority.

The Playlist stores or binds Media asset identity.

New Playlist work must not make a mutable storage URL the canonical cover
authority.

Media selection should use the shared Media Library experience.

## Credits

Playlist uses shared Credits.

The Playlist may credit roles including:

- curator
- editor
- researcher
- contributor
- reviewer
- other supported explicit roles

Credits are attached through Resource identity.

Do not build a second Playlist-specific Credits table.

## Current working state

The Playlist editor needs a fast mutable working state.

Editors should not experience every ordinary action as a formal archival event.

Working state supports:

- metadata edits
- track additions
- track removal
- ordering
- notes
- matching decisions
- cover selection

The working record remains concurrency protected.

## Immutable versions

Playlist follows the platform doctrine of:

- fast editable current state
- immutable submitted version
- immutable approved version
- immutable published version

A submitted Playlist snapshot must reconstruct:

- Playlist metadata
- cover identity
- exact ordered item composition
- item identity
- track identity state
- relevant notes
- evidence relationships required for review
- Credits required for review

A published Playlist must be reconstructable exactly as published.

An ordinary drag operation does not need to create a permanent historical
version merely because it changed working state.

## Optimistic concurrency

Playlist commands use the shared expected-version concurrency model.

A stale editor must not silently overwrite newer Playlist state.

The UI should explain stale state in product language and recover safely.

The user should not need to understand database revisions.

## Atomic ordering

Ordering is a canonical Playlist capability.

The existing browser implementation performs multiple independent writes and
is not the target architecture.

Reordering must occur through one transactional command.

The command accepts:

- Playlist identity
- expected working revision
- complete intended ordered Playlist item IDs
- idempotency key
- audit context

The command verifies that:

- every supplied item belongs to the Playlist
- no current item is missing
- no foreign item is present
- no item is supplied twice
- the expected Playlist revision is current

The complete reorder is applied transactionally.

Final positions are a continuous `1..N` sequence.

Two competing reorders based on the same expected revision cannot both succeed.

This is required by the Phase 5A exit gate and is not speculative
collaboration infrastructure.

## Governed command authority

Important Playlist writes use the shared command substrate established in
Phase 1B.

Commands must support:

- authenticated actor
- capability context
- expected current version or revision
- idempotency key
- command payload
- audit context
- correlation ID
- command receipt

At minimum Phase 5A requires governed commands for:

- create Playlist
- save Playlist metadata
- add Playlist item
- update Playlist item
- remove Playlist item
- reorder Playlist items
- save item note
- resolve or change item match
- submit Playlist for review
- record Playlist review decision

Browser code must not orchestrate important state transitions through several
independent table writes.

## Capabilities

Playlist receives domain capabilities independent of Institute.

The permanent capability vocabulary must cover:

- viewing internal Playlist work
- creating and editing owned Playlists
- editing Playlists owned by others where authorized
- review
- publication
- deletion or destructive administration where authorized

Reuse generic Review, Credits, Media, Sources, Citations, Corrections, and
Publishing capabilities where those authorities already exist.

Do not use Institute capability as Playlist authorization.

## Review

A Playlist can enter Review without an Inquiry.

Submission identifies one exact immutable Playlist version.

Later working edits cannot mutate the submitted version.

Review actions use shared Review authority.

Requested changes return the working Playlist to further editorial work without
rewriting the submitted snapshot.

Approval identifies the exact version approved.

Publication may only publish an appropriately approved version.

## Corrections and Provenance

Playlist and Playlist items participate in the shared Corrections and
Provenance systems.

Corrections do not silently mutate a published Playlist.

A material correction results in a new reviewed version and appropriate
Provenance.

Public correction presentation belongs to PR 5B.

## Archive and restoration

Playlist participates in the shared lifecycle.

Archiving must not destroy versions or identity.

Restoration must preserve history.

## Exact preview

Editors must be able to preview the exact review or publication candidate.

Preview is version-bound.

The editor must not imply that unsaved or later working changes are part of an
already submitted or approved snapshot.

## Phase 5A Playlist Editor product standard

The editor must feel like a music product, not a database form.

The primary experience should emphasise:

- cover
- title
- description
- curator
- ordered track composition
- fast track addition
- drag-and-drop ordering
- clear review readiness

Healthy track rows remain visually quiet.

A normal row should prioritise:

- position
- artwork where available
- track title
- artist
- useful lightweight playback or duration information where available

Secondary information appears progressively when useful:

- Registry match
- provider state
- duplicate warning
- note
- Source or Citation
- matching review

The editor should avoid persistent visual noise from healthy internal metadata.

## Interaction quality

Routine editorial actions should avoid full-page reloads.

The editor should provide clear states for:

- loading
- empty Playlist
- saving
- saved
- matching
- unresolved track
- duplicate warning
- stale edit
- submission
- review state
- recoverable failure

Drag-and-drop must feel immediate while still respecting the transactional
ordering authority.

Beautiful UI means:

- strong hierarchy
- excellent typography
- purposeful artwork
- deliberate spacing
- responsive interaction
- subtle motion where useful
- high information density only where the task requires it

Beauty must not depend on showing more information than the user needs.

## Playlist list route

Phase 5A builds an independent Playlist collection in Admin.

It must support finding and continuing Playlist work without Institute.

The list should make useful operational state visible without becoming a
spreadsheet by default.

At minimum users need to understand:

- Playlist identity
- cover
- title
- curator
- lifecycle/review state
- track count
- useful date
- next action where applicable

Search and filtering should be designed for eventual scale using the platform's
maintained search and pagination principles.

Do not introduce broad unindexed scans as the permanent contract.

## Institute compatibility

Institute is frozen as a standalone product.

Phase 5A must not extend Institute Playlist architecture.

Any remaining Institute Playlist route or bridge is legacy compatibility.

If a future Inquiry action creates Playlist work, it must call canonical
Playlist authority.

Inquiry Mode later enhances the Playlist Editor.

It does not replace it.

## PR 5B public product handoff

PR 5A must leave a clean authority for PR 5B.

PR 5B builds the public experience around:

1. cover
2. title
3. curator
4. description or curatorial proposition
5. listening
6. ordered tracklist

Supporting WAKILISHA depth includes:

- matched Registry links
- contributor Credits
- meaningful dates
- compact Sources and Citations
- compact Provenance
- Corrections
- sharing
- SEO
- scheduling
- cached public read model

The public Playlist must not expose draft or rejected work.

The public interface must not read complex editorial joins directly from the
browser.

## Responsive playback

PR 5B owns the public playback experience.

Playback must work on desktop and mobile.

Provider availability should enhance playback without making an external
provider the canonical Playlist authority.

A WAKILISHA Playlist must remain a coherent cultural record even if a provider
identity changes or becomes unavailable.

## Public depth principle

The public page shows institutional depth in proportion to its usefulness.

A source or Citation supporting an important curatorial claim may be valuable.

A wall of internal metadata is not.

The programme requirement for compact Provenance and source presentation is
intentional.

## What Phase 5 does not become

Phase 5 does not become:

- a Spotify clone
- a generic database editor
- a research dossier for every track
- a mandatory essay-writing workflow
- a second Registry
- a second Media Library
- a second Sources or Citations system
- a second Credits system
- a second Review system
- a speculative collaboration platform
- a speculative microservice architecture
- a universal streaming ingestion project
- Inquiry rebuilt under another name

## Architecture stance

WAKILISHA remains a modular monolith unless operational evidence requires
greater separation.

Playlist is a strict internal domain within that platform.

Boundaries must exist in:

- schema ownership
- commands
- TypeScript services
- permissions
- tests
- public read models

Do not create speculative infrastructure merely because a future product might
one day need it.

Do build the permanent kernel contracts already required by the programme.

## Phase 5A acceptance

Phase 5A may close only when production proves:

1. the two known fake Playlists and four fake items were removed through guarded
   migration preconditions
2. production begins canonical Playlist operation without inherited fake content
3. a real Playlist can be created outside Institute
4. the Playlist receives stable Resource identity
5. Playlist items receive stable item identity
6. Playlist item Resource identity works
7. metadata can be edited through canonical Playlist authority
8. a canonical Media asset can be selected as cover
9. Registry tracks can be added quickly
10. provider-identified tracks can be added
11. external pending tracks can be retained without fabricating Registry data
12. likely missing Registry records can be surfaced as suggestions
13. duplicate candidates are detected without prohibiting intentional repetition
14. per-track notes work without being mandatory
15. optional Source and Citation attachment works through shared Trust authority
16. Credits work through shared Credit authority
17. stale Playlist mutation is rejected safely
18. drag-and-drop ordering is atomic
19. concurrent ordering cannot corrupt positions
20. ordering ends as an exact continuous `1..N` sequence
21. one exact Playlist version can be submitted for review
22. later working changes do not mutate that submitted version
23. Review can request changes
24. Review can approve the exact submitted version
25. the Playlist Editor operates independently of Institute
26. the Playlist Editor passes desktop and responsive interaction acceptance
27. Article, Media, Trust, Review, and platform-kernel verification remain green

## Phase 5B acceptance

Phase 5B may close only when production proves:

1. `/playlists` is a stable public collection route
2. `/playlists/:slug` is a stable public detail route
3. draft and rejected Playlist work is not publicly exposed
4. one real editorial Playlist completes review and publication
5. the public page is served from the exact published Playlist version
6. later working edits do not silently alter the published Playlist
7. desktop playback works
8. mobile playback works
9. matched Registry tracks link correctly
10. Credits present correctly
11. Sources and Citations present compactly where relevant
12. meaningful publication and material-update dates are correct
13. Provenance is available without overwhelming the Playlist
14. public Corrections preserve history
15. scheduling works
16. archive and restoration preserve public history
17. SEO metadata is correct
18. sharing metadata is correct
19. the public read model is cacheable and version-stable
20. the published Playlist is culturally real and worthy of WAKILISHA

## Final product test

The final question is not whether every capability is visible on every screen.

The test is whether WAKILISHA can publish a genuinely excellent Playlist,
prove its integrity, maintain it over time, and make someone want to listen to
it.
