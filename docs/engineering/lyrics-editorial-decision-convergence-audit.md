# Lyrics Editorial Decision Convergence Audit

Status: implementation boundary locked

Base: `7c22559cadb4572dea826568a2eac159831282d3`

## Product problem

The current Track Lyrics admin surface is inside-out. `/admin/content/lyrics` starts from a Registry Track picker and only reveals listener submissions after an editor already knows which Track to open. A real submitted contribution can therefore exist without appearing anywhere as actionable work.

Production inspection on 2026-08-23 proved this is not hypothetical. A submitted Track Lyrics contribution exists for `Valle` by `DJames, Matata`, but the current Lyrics picker searches only Track title and slug and does not expose artist identity. The contribution itself is not discoverable until the exact Track is selected.

The generic Community contribution system also exposes a `lyrics_correction` contribution type. Production contains a legacy `lyrics_correction` row attached to an Article, proving that this generic option is not the governed Track Lyrics authority. Track Lyrics submissions live separately in `editorial.track_lyrics_contributions` and are governed by Track Lyrics RPCs.

## Primitive audit

The fix must compound existing WAKILISHA editorial primitives rather than create a Lyrics-specific moderation UI.

### Existing canonical primitives to reuse

- `AdminCollectionHeader`: collection identity and actions.
- `AdminRecordActions`: truthful governed record actions.
- `AdminSaveState`: moving vs immutable record state.
- `EditorialMetadataWorkspace`: version-bound Discovery authority where relevant.
- base `Modal` / `Sheet`: accessible overlay mechanics.

### Existing candidates that Lyrics will make cross-domain

#### `EditorialWorkflowRail`

Current proven consumer: Audio.

Lyrics needs the same semantic workspace navigation for:

- Inbox
- Library / Add Lyrics
- Review
- History

Once Lyrics consumes it, this primitive must be promoted to canonical rather than copied.

#### `AdminWorkspaceSection`

Current proven consumer: Audio.

Lyrics needs the same governed workspace section framing for Inbox, review provenance, editor, and history. Once Lyrics consumes it, promote it to canonical.

### Missing shared primitive: editorial lifecycle decisions

Article, Playlist, and Audio already implement the same editorial lifecycle decision grammar, but they do so independently.

Common decisions already proven across domains:

- Submit for Review
- Start Review
- Request Changes
- Approve
- Publish

Common semantics already proven:

- actions depend on exact lifecycle state and capabilities;
- Request Changes requires an explanatory note;
- Approve may carry an optional note;
- decisions target an immutable submitted version;
- publication is separate from review approval;
- history preserves the decision event.

Current duplication:

- Article owns local review-action modal state and note validation.
- Playlist owns local `reviewNote` state and independently constructs header actions.
- Audio owns local `reviewNote` state, independently renders decision buttons in `AdminRecordHeader`, and separately renders a decision-note textarea inside `AudioReviewWorkspace`.

This is a proven cross-domain concept and should be extracted as a canonical consumer-owned primitive rather than implemented again for Lyrics.

### New canonical primitive: `EditorialDecisionWorkspace`

The primitive owns interaction grammar only. It must not import domain services or Supabase.

Inputs:

- lifecycle status / label;
- exact target-version label when applicable;
- decision note value and callback;
- available decision descriptors supplied by the consumer;
- busy state;
- optional recent decision events;
- domain-specific supporting review content as children.

It owns:

- consistent decision action presentation;
- required-note enforcement metadata/presentation;
- decision-note editor placement;
- lifecycle target explanation;
- consistent decision history presentation;
- semantic `Request Changes`, `Approve`, `Start Review`, `Submit for Review`, and `Publish` affordance grammar.

It does not own:

- Article, Playlist, Audio, or Lyrics RPCs;
- capability calculation;
- target-version selection;
- mutation or publication authority.

Article, Playlist, Audio, and Lyrics remain authority owners and pass callbacks into the primitive.

### Missing shared primitive: editorial text diff

Article Revision History contains the only useful word-level before/after diff implementation. It is page-local even though the concept is not Article-specific.

Lyrics review needs exactly the same concept to compare:

- immutable listener submission;
- WAKILISHA editorial revision.

Extract the diff algorithm and presentation into a canonical consumer-owned `EditorialTextDiff` primitive and migrate Article Revision History to consume it. Lyrics then becomes the second domain consumer. Do not implement another Lyrics-specific diff.

## Lyrics information architecture

`/admin/content/lyrics` becomes one Lyrics operations hub.

### Inbox

Default view.

Shows submitted Track Lyrics work without requiring Track selection first.

Each row exposes:

- Track title;
- artists;
- contributor public identity;
- contribution type (`Submission` or `Correction` based on whether published Lyrics already existed at submission/review context);
- submitted time;
- status.

Search matches Track title, Track slug, and artist names.

Selecting a row opens the exact contribution review workspace directly.

### Library / Add Lyrics

Secondary mode for editorial creation when no listener contribution is driving the work.

Track search must use governed Registry search and include artist names. It must not directly query `registry_tracks` from the browser or filter only title/slug.

### Review

Review keeps the original contribution immutable.

The editor starts from the submitted Lyrics but works on a separate WAKILISHA revision buffer.

Decision paths:

1. **Accept as submitted**
   - create a governed working Lyrics version from the exact contribution;
   - preserve contributor provenance;
   - mark the contribution accepted as submitted.

2. **Accept with revisions**
   - editor may change Lyrics before acceptance;
   - show `EditorialTextDiff` between immutable submission and WAKILISHA revision;
   - create the governed working Lyrics version from the revised text;
   - preserve a structural link to the original contribution;
   - mark that WAKILISHA Community revisions were accepted.

3. **Reject**
   - requires a review note;
   - preserves the submission and decision history.

Acceptance creates a working Lyrics version. Publication remains a separate governed action.

### History

Shows accepted/rejected contribution decisions and Lyrics publication/version history in one Lyrics workspace. It does not merge unrelated generic Community moderation history into Track Lyrics authority.

## Provenance authority

The current Lyrics version model is too shallow for revised community submissions. `source_kind = contributor` and a free-text `rights_note` cannot structurally prove which contribution produced a version or whether WAKILISHA revised it.

The authority extension must preserve:

- exact source contribution ID;
- exact source contributor account ID;
- public-safe contributor label snapshot or governed public identity reference;
- acceptance mode: `as_submitted` or `with_revisions`;
- reviewer ID and decision time on the contribution;
- accepted Lyrics version ID;
- original contribution text remains immutable.

Public Lyrics read authority should expose only public-safe provenance needed for attribution.

Public rendering policy:

- accepted as submitted: credit the original contributor;
- accepted with revisions: state that the original Lyrics were submitted by the contributor and that WAKILISHA Community revisions were accepted.

The public copy is derived from structured provenance. It is not stored as an arbitrary UI disclaimer.

## Capability correction

Current Track Lyrics SQL uses `save_content` as an edit/review capability. In WAKILISHA, `save_content` is the public Save/bookmark capability and is assigned to subscriber/member/customer roles. It is not editorial write authority.

Track Lyrics must instead compose existing editorial capabilities:

- view workspace: `view_audio` or relevant review authority;
- edit/create Lyrics working versions: `edit_own_audio` / `edit_others_audio` according to domain authority;
- review contribution decisions: `manage_review_queue`;
- publish Lyrics: `publish_audio`.

The sidebar Lyrics entry currently uses `edit_own_articles`; replace that with the Audio/Lyrics editorial capability boundary.

## Generic Community `lyrics_correction`

The generic Community correction sheet must stop creating new `lyrics_correction` records. Track Lyrics already has one dedicated contribution route which serves both initial submission and correction of published Lyrics.

Existing legacy generic rows remain historical Community records. They are not migrated into Track Lyrics unless they can be proven to target a Registry Track. The current Article-attached legacy row is not Track Lyrics authority and must not be surfaced as a Lyrics moderation item.

## Audio convergence

Audio already has the richest domain-specific review workspace: exact submitted version, audio transport, waveform, time/range anchors, rich comments, replies, and thread status.

What Audio lacks is the shared editorial decision primitive inside the Review workspace.

Move/compose Audio lifecycle decisions into `EditorialDecisionWorkspace` while retaining domain-specific Audio review children:

- submitted-version listening;
- waveform/timeline;
- anchored comments;
- review threads.

The record header may keep high-level non-review record actions such as Save, Archive, Restore, and public View. Review decisions belong in the Review workspace so the decision is made alongside the evidence and feedback it governs.

## Article and Playlist convergence

The new primitive is not allowed to be Lyrics/Audio-only.

- Article review decisions must use the same canonical decision interaction rather than its page-local review modal grammar.
- Playlist review decisions must use the same primitive rather than independently constructing review-note and decision controls.
- Existing domain RPCs remain unchanged unless a domain authority gap is proven.

This is an interaction convergence, not a lifecycle rewrite.

## Acceptance invariants

- Lyrics Inbox is the default admin entry, not Track search.
- A submitted contribution is discoverable without knowing its Track in advance.
- Registry Track search matches artist identity as well as Track identity.
- Original listener submission is immutable.
- Editorial revision is editable before acceptance.
- Before/after revision diff reuses the shared editorial diff primitive.
- Accept as submitted and accept with revisions are distinct durable provenance states.
- Publication remains separate from contribution acceptance.
- Public attribution is derived from structured provenance.
- `save_content` grants no Track Lyrics editorial authority.
- No new generic `lyrics_correction` submissions are created.
- Article, Playlist, Audio, and Lyrics share one editorial decision interaction primitive.
- Audio review decisions appear with the Audio review evidence, not as a disconnected header-only action set.
- Existing domain mutation RPCs remain domain-owned.
- No Edge Function is introduced for this work.
