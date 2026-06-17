# WAKILISHA Magazine Issue UI Experience Plan

Status: planned
Owner surface: `/magazine`, `/magazine/:slug`, magazine modules, search, social share previews
Related engine: `src/services/magazineIssueEngine`

## Core decision

The current issue UI is too PDF-like.

It has polish, but the main interaction model still feels like a designed document that the reader scrolls through. WAKILISHA should feel more alive than that.

The new direction is the **Issue Experience System**.

Its job is to make every issue feel like a cultural object with its own motion, rhythm, and reason to exist.

A listening issue should not behave like a systems issue.

A memory issue should not move like a scene issue.

An image issue should not read like a policy issue.

## Product posture

The current UI says:

```text
Here is a designed issue. Scroll through it.
```

The target UI says:

```text
You just entered a living cultural object. Touch it. Follow the signals. Open the rooms. Hear the thing.
```

This is not decorative. The interaction should reveal why the issue matters.

## Three-layer model

Every issue experience should have three layers.

### 1. The entrance

Not a static cover. An opening moment.

Examples:

```text
Listening issue: cover reacts like a listening deck with pulsing story cards.
Scene issue: cover opens as a route, room, or city signal.
Systems issue: cover opens as claims, receipts, and signals.
Memory issue: cover opens as fragments, quotes, names, and dates.
Image issue: cover opens cinematic and full bleed.
```

### 2. The path

Not a table of contents. A reading route.

The path should answer:

```text
Where do I start?
What should I open next?
Which article carries the issue?
Which thread should I follow?
Where do I leave the issue?
```

### 3. The play

Microinteractions reveal meaning.

Examples:

```text
Hover over a story card and see why that story belongs in the issue.
Click Start Here and the issue builds a path.
Hover a section and the issue signal changes.
Open a sound story and related tracks or releases pulse nearby.
Open a systems story and claims connect to receipts.
Open a scene story and related rooms, places, or routes come forward.
```

## Architecture

Create:

```text
src/components/magazine/issueExperience/
  IssueExperienceShell.tsx
  IssueOpening.tsx
  IssuePath.tsx
  IssueSignalBoard.tsx
  IssueBackMatter.tsx
  ListeningIssueExperience.tsx
  SceneIssueExperience.tsx
  MemoryIssueExperience.tsx
  SystemsIssueExperience.tsx
  FieldGuideIssueExperience.tsx
  ArgumentIssueExperience.tsx
  ImageIssueExperience.tsx
  MixedIssueExperience.tsx
  ThinIssueExperience.tsx
```

The issue page should not manually decide every layout.

It should do this:

```tsx
<IssueExperienceShell issue={issue} experience={experience} />
```

The shell chooses the right archetype component based on `experience.archetype`.

## Archetype UI behavior

### Listening issue

For songs, releases, artists, reviews, playlists, and sound-led stories.

Visual behavior:

```text
pulsing sound cards
listening path
small rhythm or waveform motion
track and release links that feel playable
Start with the sound CTA
```

Microinteractions:

```text
story cards pulse softly on hover
a listening rail follows the reader
a related track or release appears without forcing navigation
```

### Scene issue

For cities, rooms, venues, festivals, routes, and cultural movement.

Visual behavior:

```text
route dots
room cards
location trails
clustered people and place cards
Enter the room CTA
```

Microinteractions:

```text
hovering a place card reveals who and what is connected to it
scrolling advances the route
related rooms light up as the reader moves
```

### Systems issue

For rights, money, platforms, ownership, policy, AI, and infrastructure.

Visual behavior:

```text
signal board
claim cards
receipt cards
connected context chips
Open the argument CTA
```

Microinteractions:

```text
click a claim to expand supporting stories
hover a signal and related articles draw a visible link
admin-like words never appear publicly
```

### Memory issue

For language, books, old stories, oral culture, and archival recovery.

Visual behavior:

```text
slow reveal fragments
quote cards
layered text and image moments
names and dates surfacing softly
```

Microinteractions:

```text
hover reveals a note, quote, or remembered detail
scroll feels quieter and more deliberate
related memory threads appear as fragments, not badges
```

### Field guide issue

For guides, routes, cultural utility, and things to do or notice.

Visual behavior:

```text
route builder
checklist interactions
saveable paths
Keep this close CTA
```

Microinteractions:

```text
reader can mark a path step as opened
cards reveal practical next steps
back matter suggests what to do next
```

### Argument issue

For criticism, conflict, form, public debate, and friction.

Visual behavior:

```text
split panels
quote collisions
counterpoint cards
raised-eyebrow energy
```

Microinteractions:

```text
hover reveals counterpoints
click opens the strongest argument first
related pieces sit in tension, not a flat list
```

### Image issue

For photography, fashion, film, visual culture, design, and screen-led stories.

Visual behavior:

```text
cinematic opening
full-bleed image moments
gallery transitions
minimal copy when the image is strong
```

Microinteractions:

```text
image cards respond with depth
caption fragments appear on hover
reader can move through the issue visually first
```

### Mixed culture issue

For balanced issues with no single dominant archetype.

Visual behavior:

```text
signal collage
balanced story clusters
choose-your-door navigation
```

Microinteractions:

```text
reader picks sound, place, image, memory, or argument as the path
issue rearranges around the chosen door
```

### Thin issue

For issues with limited data or weak clustering.

Visual behavior:

```text
simple, honest layout
short intro
clear article list
no fake drama
```

Microinteractions:

```text
small hover context only
no overbuilt motion
no fake signals
```

## What must leave public UI

Remove or hide these from reader-facing issue pages:

```text
source window
cover variant
stale or review-flagged pieces
magazine engine
field evidence as a generic label
source range
layout treatment
route treatment
page number cosplay unless it serves interaction
admin-only design rationale
```

Readers should never see the scaffolding.

## What can stay

Keep the useful foundations:

```text
mood system
sticky issue navigation
reading progress
full-bleed hero thinking
scroll reveal
responsive issue cards
```

But these need to become more expressive. They should perform the issue archetype, not just decorate it.

## Interaction principles

1. Motion must reveal meaning.
2. Hover states must explain why something belongs.
3. Cards should not all behave the same way.
4. The issue path should feel alive, not like a table of contents.
5. Use less motion for memory and thin issues.
6. Use more signal and connection motion for systems issues.
7. Use richer image treatment for image issues.
8. Use route and room behavior for scene issues.
9. Use sound-led cues for listening issues.
10. Respect reduced motion settings.

## Accessibility and performance rules

The experience can be bold without becoming hostile.

Rules:

```text
Respect prefers-reduced-motion.
Keep keyboard focus states visible.
Do not hide core reading paths behind hover only.
Avoid large blocking animation bundles.
Keep issue pages readable without JavaScript-only tricks.
Use progressive enhancement for delight.
```

## Build order

1. Keep current magazine issue page working.
2. Build `IssueExperienceShell` around the existing page data.
3. Create shared primitives: opening, path, signal board, back matter.
4. Build first three archetype experiences:

```text
ListeningIssueExperience
SceneIssueExperience
SystemsIssueExperience
```

5. Wire them behind the Magazine Issue Engine archetype output.
6. Add memory, guide, argument, image, mixed, and thin experiences.
7. Remove public source-window and admin-note language.
8. Replace PDF-like contents with issue paths.
9. Add microinteractions that explain meaning.
10. Add visual QA snapshots for the main archetypes.

## Acceptance criteria

The UI work is done when:

1. The issue page no longer feels like a PDF you scroll.
2. The issue experience changes behavior based on archetype.
3. Listening, scene, systems, memory, guide, argument, image, mixed, and thin issues feel visibly different.
4. Public UI does not expose source windows, cover variants, stale content notes, or layout rationale.
5. Issue cards have meaningful hover or focus states.
6. Story cards explain why they belong to the issue.
7. The reading path replaces table-of-contents thinking.
8. Microinteractions reveal context, not just decoration.
9. Reduced motion is respected.
10. The experience feels culture-forward, not exported.

## Final principle

The engine decides the issue identity.

The UI performs it.

The reader should feel like they entered something WAKILISHA made on purpose.
