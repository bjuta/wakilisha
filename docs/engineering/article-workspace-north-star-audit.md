# Article Workspace North Star audit

Date: 21 July 2026

## Status

Product audit draft.

This document does not reopen Phase 2 architecture.

It evaluates whether the current Article Workspace is strong enough to guide the next five years of WAKILISHA product development.

## Executive verdict

The Article Workspace is not yet worthy of being the five-year North Star.

Its technical authority is strong.

Its product experience is not yet strong enough.

The workspace currently feels like a capable administration interface with important editorial powers. It does not yet feel like an exceptional place to write, review, prepare, publish, and preserve cultural work.

Phase 1 and Phase 2 are not wasted.

They created the reliable foundation required for a better product.

The next task is not another rebuild. It is a focused product-quality pass that makes the existing authority visible, coherent, calm, and useful.

## What is already strong

The following foundations should remain closed:

- durable drafts
- truthful autosave
- recovery
- optimistic concurrency
- immutable submitted versions
- requested changes
- approval
- version-bound publishing
- stable public publication snapshots
- exact public preview foundation
- lifecycle history
- revision history
- archive
- restore
- public stability after later draft changes

These capabilities are the concrete base for the North Star.

## Audit scope

This audit covers:

- visual hierarchy
- workspace layout
- writing experience
- editor capability
- mode architecture
- command hierarchy
- review experience
- publishing experience
- preview behaviour
- media handling
- metadata and taxonomy
- revision comparison
- recovery
- accessibility
- responsive behaviour
- collaboration readiness
- trust infrastructure readiness
- identity and credit presentation

## Verified desktop visual evidence

Production desktop evidence was captured on 21 July 2026.

The evidence covers:

- Write
- Media
- SEO and Social
- Review in multiple lifecycle states
- Publishing checklist
- History
- Recovery

The following evidence remains outstanding:

- exact public Preview
- compact desktop at approximately 1024 pixels
- mobile at approximately 390 pixels
- keyboard-only workflow
- focus and dialog behaviour
- screen-reader behaviour

### Verified finding: Write mode does not centre the Article

The Article is constrained by both the global admin navigation and a permanent support rail.

Title, excerpt, and body appear as separate form cards.

A long Article continues through several screen lengths while the support rail ends early. Large areas of the available workspace remain unused.

There is no visible document outline, section navigator, word count, reading time, or long-document orientation.

Classification: confirmed failure.

### Verified finding: command and state information repeat

Lifecycle state appears in:

- the page header
- the Workbench header
- the active mode
- mode-specific panels
- publication-gate notices

Save and review actions can appear in both the page header and the active mode.

Classification: confirmed failure.

### Verified finding: Review does not support the act of reviewing

Review displays state, actions, publication gates, and previous decisions.

It does not display the submitted Article as the central object.

It does not provide:

- submitted-version reading
- prior-version comparison
- inline comments
- section comments
- unresolved tasks
- requested-change resolution
- reviewer checklist

Classification: confirmed critical failure.

### Verified finding: lifecycle language requires technical interpretation

A published Article can also display later-draft warnings and approval gates.

The underlying distinction between the live snapshot and current draft is valid.

The interface does not explain that distinction clearly enough.

Classification: confirmed failure.

### Verified finding: Media is a hero-image form

Media currently centres hero-image URL management and access to the general media library.

It does not provide Article-specific media preparation, rights, credits, captions, alt text, focal points, or usage context.

Classification: confirmed failure.

### Verified finding: SEO contains competing quality scores

The SEO surface can present a low analysis score and a perfect preview score in the same mode.

The difference is technically explainable, but the hierarchy and consequences are not clear to the editor.

The page is long, checklist-heavy, and not prioritised around the next decision.

Classification: confirmed failure.

### Verified finding: History proves storage but not editorial understanding

History displays lifecycle, revision metadata, and stored Article content.

Legacy published content can show a completed lifecycle timeline while also reporting that no lifecycle events exist.

The interface should explain imported baseline history rather than presenting an apparent contradiction.

Revision content is presented as fields and large text blocks rather than an editorial comparison.

Classification: confirmed failure.

### Verified finding: Recovery duplicates History

Recovery adds useful restore guidance.

Its record view substantially repeats the revision information already available in History.

Classification: confirmed information-architecture failure.

### Verified finding: the publication checklist is incomplete as a trust gate

The current checklist covers basic completeness and search metadata.

It does not yet verify:

- exact approved version
- unresolved review work
- source completeness
- citation completeness
- credit completeness
- accessibility
- image alt text
- link health
- sensitive-source exposure
- exact public Preview agreement

Classification: confirmed Phase 3A readiness gap.

### Verified finding: visual consistency is stronger than visual hierarchy

The workspace uses a consistent design system.

The repeated rounded cards, uppercase micro-labels, pale status pills, and low-contrast supporting copy create visual sameness.

Important editorial actions and secondary metadata often receive similar weight.

Classification: confirmed quality gap.

## Provisional North Star scorecard

| Area | Score | Finding |
|---|---:|---|
| Writing focus | 2 | Functional, but the Article does not dominate |
| Information architecture | 1 | Controls compress, clip, or move far away |
| Command hierarchy | 1 | Actions repeat and disappear during long scrolling |
| Editor capability | 3 | Capable toolbar, weak document architecture |
| Review quality | 1 | Controls exist, reviewing does not |
| Publishing clarity | 2 | Useful controls, unclear governed version |
| Preview accuracy | Not proven | Exact public Preview remains uncaptured |
| History and comparison | 2 | Durable record, weak editorial explanation |
| Media workflow | 2 | Hero-image management, not media preparation |
| Trust readiness | 1 | No coherent trust workspace exists |
| Accessibility | Not proven | Interaction audit remains outstanding |
| Responsive behaviour | 1 | Compressed desktop and stacked mobile form |
| Large-document usability | 1 | Long mobile work has no outline or persistent commands |
| Identity clarity | 2 | Account, owner, author, and byline remain disconnected |
| Visual coherence | 2 | Consistent components, poor adaptive hierarchy |

The Article Workspace does not pass the North Star gate.

No required scored area currently reaches four or five.

## Current interface structure

The current workspace contains:

1. Article header
2. lifecycle status
3. ownership and permission badges
4. global action cluster
5. keyboard and autosave notice
6. Article Workbench summary
7. save-state summary
8. seven mode tabs
9. title card
10. summary card
11. rich-text editor card
12. support rail in Write mode
13. dedicated mode surfaces for Media, SEO and Social, Review, Publishing, History, and Recovery

This is structurally functional.

It is visually and cognitively too layered.

## Failure 1: the story is not the dominant object

The writer must pass several interface layers before reaching the Article.

Title, summary, and body are separated into independent cards.

The result feels like completing a content form rather than shaping one document.

### North Star requirement

Title, summary, and body should feel like one editorial canvas.

The Article should dominate the screen.

Supporting controls should recede until needed.

## Failure 2: Write mode still depends on a permanent support rail

Write mode uses a two-column layout with a fixed metadata rail.

Author, categories, tags, and other support fields remain visually present while the editor is trying to write.

### North Star requirement

The writing canvas must support full-width composition.

The support rail must be collapsible, contextual, and preference-aware.

A distraction-free writing state must be possible without leaving the workspace.

## Failure 3: the mode hierarchy is too flat

The current modes are:

- Write
- Media
- SEO and Social
- Review
- Publishing
- History
- Recovery

All seven receive similar weight.

They do not represent activities of equal frequency or urgency.

Write is continuous.

Recovery is exceptional.

History is a record.

Publishing is a controlled transition.

### North Star requirement

The workspace should communicate a clearer hierarchy:

- Compose
- Prepare
- Review
- Publish
- Record

The existing modes may remain internally, but their presentation should reflect how editors actually work.

## Failure 4: commands are duplicated

Save, Preview, review actions, publication state, and lifecycle messages appear in more than one place.

The header and mode surfaces compete to be the command centre.

This weakens the primary-action hierarchy.

### North Star requirement

Use one persistent command bar containing:

- Article identity
- current lifecycle state
- current version context
- save state
- exact Preview
- one clear next action
- a restrained overflow menu

Archive or Delete must not appear as an unlabeled daily action beside Save and Publish.

## Failure 5: Review is a control panel, not a review workspace

Current Review mode shows:

- current review state
- available actions
- recent review decisions
- publication gate

It does not place the submitted Article at the centre of the review.

It does not provide:

- submitted-version reading
- previous-version comparison
- inline comments
- section comments
- unresolved review tasks
- reviewer checklist
- clear change summary
- structured requested-change resolution

### North Star requirement

Review must let a reviewer read, inspect, compare, comment, and decide without changing modes.

The reviewed immutable version must be unmistakable.

## Failure 6: Publishing exposes lifecycle as settings

Current Publishing mode still resembles a traditional CMS publish box.

It includes editable status controls alongside visibility, scheduling, preview, and publishing.

The interface risks teaching users that lifecycle governance is a dropdown rather than a controlled sequence.

### North Star requirement

Publishing must answer:

1. Which immutable version will publish?
2. Has that version been approved?
3. Which checks remain unresolved?
4. When will it publish?
5. Who can see it?
6. What will the exact public result look like?

Then it should present one deliberate Publish or Schedule action.

## Failure 7: Preview has competing meanings

The workspace currently supports both an internal preview modal and an exact public-route preview.

An editor should never need to know which Preview is authoritative.

### North Star requirement

Preview must mean the exact public rendering.

Any local editing preview should have a different name, such as Reading View.

## Failure 8: the rich-text editor is powerful but not coherent

The editor currently provides many toolbar controls, multiple views, media insertion, Registry object insertion, and raw HTML editing.

The controls wrap into a large toolbar.

Registry embeds are represented through shortcode text rather than meaningful editable blocks.

The editor does not yet provide:

- document outline
- heading navigator
- structured block navigator
- inline citations
- footnotes
- editorial comments
- review annotations
- reusable cultural-record blocks
- accessibility checks
- link health checks
- visible word count
- visible reading time
- reliable structured embeds
- distraction-free mode

### North Star requirement

The editor should favour direct manipulation and structured blocks.

An Artist, Track, Release, Source, Citation, or media object should look and behave like that object inside the editor.

## Failure 9: some existing features are unfinished

Current implementation evidence includes:

- word count is calculated but not presented
- character count is calculated but not presented
- Find and Replace logic exists without a clear visible entry point
- read-only state does not clearly govern the full rich-text editor
- autosave information appears in more than one place
- public and internal preview paths are not clearly differentiated

### North Star requirement

Existing partial features must be completed, removed, or deliberately deferred.

No hidden half-feature should remain in the benchmark workspace.

## Failure 10: revision comparison speaks engineering, not editorial

Revision comparison currently combines many fields into one text representation and performs a word-level comparison.

This proves difference.

It does not explain editorial change well.

### North Star requirement

Comparison should separate:

- title changes
- summary changes
- body changes
- structure changes
- media changes
- taxonomy changes
- SEO changes
- credit changes
- citation changes
- lifecycle changes

It should show who changed the version, why it exists, and which version became submitted, approved, or published.

## Failure 11: accessibility is not yet benchmark quality

The workspace contains complex custom tabs, modals, toolbars, popovers, editors, and horizontal scrolling.

The audit must verify:

- keyboard navigation
- focus trapping
- focus return
- Escape behaviour
- tab semantics
- visible focus states
- screen-reader labels
- editor semantics
- contrast
- touch targets
- zoom behaviour
- reduced-motion behaviour
- narrow-screen behaviour

### North Star requirement

Accessibility cannot be a later polish pass.

The benchmark workspace must include accessibility in its completion gate.

## Failure 12: the workspace has no clear large-document strategy

The Article Workspace must remain usable for:

- short news articles
- long essays
- interviews
- multi-section investigations
- image-heavy features
- source-heavy research
- work containing many citations
- work containing many embedded Registry entities

### North Star requirement

The workspace needs:

- document outline
- quick section navigation
- stable editor performance
- block-level structure
- collapsible supporting context
- clear long-document save state
- safe recovery for large work

## Benchmark architecture

The target Article Workspace should use four layers.

### Layer 1: command bar

A compact persistent command bar containing:

- back navigation
- Article identity
- lifecycle state
- current version
- save state
- Preview
- one primary next action
- overflow actions

### Layer 2: editorial canvas

One calm document surface containing:

- title
- summary
- body
- structured media
- Registry embeds
- citations
- document outline
- word count
- reading time

### Layer 3: contextual sidecar

A collapsible sidecar containing:

- Details
- Structure
- Media
- Trust
- Checks

The sidecar should disappear during focused writing.

### Layer 4: workflow surfaces

Dedicated full workspace surfaces for:

- Review
- Publish
- Record

Record contains history, lifecycle, recovery, and archive context.

## Required features before the workspace becomes the North Star

### Must complete before Phase 3A Article integration

- simplify the top-level visual hierarchy
- establish one command centre
- make the Article the dominant surface
- provide a full-width writing state
- make the support rail collapsible
- unify exact Preview behaviour
- complete read-only behaviour
- expose word count and reading time
- provide a document outline
- define the structured editor extension contract
- define where Sources, Citations, and Credits live in the workspace
- remove lifecycle status editing as a generic dropdown
- make Review centre the submitted Article version
- verify accessibility of every primary interaction

### Strongly recommended

- inline review comments
- review tasks
- field-level revision comparison
- content-level rendered comparison
- structured Registry embed blocks
- link health checks
- accessibility checks
- keyboard command palette
- workspace preference persistence

### May follow after the North Star gate

- real-time multi-user presence
- live collaborative cursors
- advanced tracked changes
- AI-assisted editorial tools
- reusable Article templates
- complex workflow automation

## Visual evidence matrix

The audit is not complete until the following production or local views are captured.

### Desktop

Capture at approximately 1440 pixels wide:

- Write
- Media
- SEO and Social
- Review
- Publishing
- History
- Recovery
- exact public Preview
- review decision modal
- publish checklist
- conflict modal
- recovery modal
- read-only Article

### Compact desktop or tablet

Capture at approximately 1024 pixels wide:

- Write with support rail
- every mode tab
- editor toolbar
- Publishing
- Review
- History comparison

### Mobile

Capture at approximately 390 pixels wide:

- command hierarchy
- workbench navigation
- title and summary
- editor toolbar
- support metadata
- Review
- Publishing
- History
- modal behaviour

## Verified compact and mobile evidence

Compact desktop and mobile production evidence was captured on 21 July 2026.

The captured evidence covers:

- compact Write
- compact Review
- compact Publishing
- compact History
- mobile Write
- mobile Publishing
- mobile History
- mobile pre-publish checklist

Exact public Preview and keyboard interaction evidence remain outstanding.

Those gaps do not block the North Star verdict because the captured responsive failures are already decisive.

### Verified finding: compact desktop compresses rather than adapts

At the compact desktop width, the global navigation remains open and consumes a substantial fixed column.

The main workspace responds by narrowing:

- the Article title truncates
- slug and ownership information wrap
- header actions compete for limited width
- the Article canvas becomes narrower
- support controls lose useful proximity to the work

Classification: confirmed responsive failure.

### Verified finding: compact Write postpones context until after the Article

Write mode moves Author, Categories, Tags, internal links, and Registry Search below the Article body.

For a long Article, those controls are several screen lengths away from the title and editor.

This avoids a narrow side rail but does not create a usable compact workflow.

Classification: confirmed information-architecture failure.

### Verified finding: mobile Write is not an editorial workspace

The mobile Write capture spans eleven pages for one Article.

The mode strip clips horizontally.

The rich-text toolbar occupies several rows.

The Article body becomes an extremely long continuous editing surface.

Author, Categories, Tags, internal links, and Registry Search appear only after the entire Article.

There is no persistent:

- save state
- primary action
- document outline
- section navigation
- metadata access
- route back to the top

Classification: confirmed critical responsive failure.

### Verified finding: mobile mode navigation can hide the active mode

In mobile History, the active mode is outside the visible tab area.

Only a small fragment of the active control is visible at the edge.

In mobile Publishing, earlier modes are outside the visible area.

A user cannot rely on the mode navigation to understand the current workspace location.

Classification: confirmed critical navigation failure.

### Verified finding: mobile command hierarchy disappears during long work

The page-level Preview, Save, and lifecycle action controls are available only near the top.

After the editor scrolls into a long Article, no persistent command surface remains.

Classification: confirmed command-hierarchy failure.

### Verified finding: the mobile checklist behaves like another long page

The pre-publish checklist extends beyond one viewport.

Close is available at the top.

Cancel and Publish Anyway are available only at the bottom.

The modal does not visually preserve decision controls while the editor reviews the checks.

Optional search suggestions and future trust-critical gates are not yet separated strongly enough.

Classification: confirmed publication-workflow failure.

### Verified finding: mobile typography prioritises reading over editing efficiency

The Article body uses large mobile reading typography inside the editing workspace.

This improves legibility but greatly increases navigation distance and reduces editing density.

The editor needs a mobile editing treatment rather than directly reproducing a public reading scale.

Classification: confirmed product-quality gap.

### Verified finding: responsive behaviour is based on stacking

The current responsive strategy is primarily:

- hide the global sidebar
- stack cards
- horizontally scroll navigation
- move support controls after the body
- allow long modal scrolling

It does not redefine the workflow for the available space.

Classification: confirmed architectural gap.

## Final responsive score

Responsive behaviour scores one out of five.

Large-document usability scores one out of five.

Information architecture and command hierarchy each score one out of five after responsive evidence.

The Article Workspace does not meet the minimum responsive standard required of the WAKILISHA North Star.

## North Star scoring rubric

Score each area from zero to five.

- zero: missing or unusable
- one: present but unreliable
- two: functional with major friction
- three: competent production quality
- four: excellent and reusable
- five: benchmark quality

Required areas:

- writing focus
- information architecture
- command hierarchy
- editor capability
- review quality
- publishing clarity
- preview accuracy
- history and comparison
- media workflow
- trust readiness
- accessibility
- responsive behaviour
- large-document usability
- identity clarity
- visual coherence

The workspace cannot become the North Star while any required area scores below four.

Writing focus, review quality, publishing clarity, accessibility, and trust readiness must score five.

## Proposed delivery boundary

This should be a focused Article Workspace quality pass.

It is not a Phase 2 reopening.

It must not alter the proven Article lifecycle unless the audit identifies a verified defect.

The pass should be split into no more than two implementation PRs:

### Quality PR 1: Composition and workspace hierarchy

- command bar
- simplified workspace header
- editorial canvas
- collapsible sidecar
- document outline
- word count and reading time
- exact Preview
- completed read-only state
- responsive writing layout

### Quality PR 2: Review, publishing, and record quality

- submitted-version review canvas
- review context and tasks
- controlled publishing summary
- improved version comparison
- accessibility completion
- History and Recovery integration under Record
- Phase 3A trust insertion points

## Exit gate

The Article Workspace becomes the WAKILISHA North Star only when:

- writing feels like writing, not form completion
- the Article dominates the screen
- the primary next action is always clear
- Preview always shows the exact public result
- Review can be completed without leaving Review
- Publish clearly identifies the approved version
- later draft changes cannot confuse public state
- History explains changes in editorial language
- Sources, Citations, and Credits have a coherent home
- every primary workflow passes keyboard and narrow-screen checks
- one short Article and one long source-heavy Article can be completed without interface breakdown
