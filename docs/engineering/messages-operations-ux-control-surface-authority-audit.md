# Messages Operations UX & Control Surface Authority Audit

Status: **DESIGN / AUTHORITY AUDIT**

Issue: **#891 Messages Operations UX & Control Surface Convergence**

Base authority:

```text
main=3b3cea1447a38d6ef5b6cd0ef0d545aa3ae9cbc6
phase_8b5=CLOSED_IN_PRODUCTION
phase_8b6_issue=872
```

## Purpose

Recompose `/admin/messages` into a serious WAKILISHA Messages Operations workspace without weakening or duplicating the Messages, Safety, Legal, Media, System Actor, command/job, authorization, or audit authority already accepted in Production.

This slice is primarily a product architecture and interaction-system correction. It is not permission to redesign the backend state machines that Phase 8B.5 just proved.

## Non-negotiable product doctrine

### 1. No browser-native workflow chrome

Admin workflows must not depend on native browser controls where a WAKILISHA product control is appropriate.

This includes replacing workflow-facing uses of:

- native `<select>` dropdown UI;
- native date/time picker UI;
- raw checkbox presentation;
- browser-looking confirmation flows;
- popup-dependent navigation/download flows;
- raw database identifiers as normal operator input.

The implementation may still use semantic HTML internally for accessibility where appropriate. The visible and interactive product chrome must be WAKILISHA-owned.

### 2. Pickers instead of identifier entry

Operators pick canonical entities through searchable, contextual product controls.

Routine typing/pasting of UUIDs for users, Messages, Conversations, Media, Resources, cases, or System Actors is not acceptable UX.

Picker results must show enough safe context to distinguish entities without ambiently exposing private content.

### 3. Multi-step authority becomes guided workflow

Legal, Safety, appeals/recovery, and comparable multi-step processes must expose:

- current stage;
- completed stages;
- prerequisites;
- blocked transitions;
- next valid action(s);
- exceptional/recovery actions;
- contextual audit history.

The operator must not have to reconstruct a backend state machine from scattered buttons.

### 4. Control state belongs in Controls

Runtime Audience and Private Content Boundary are authority/control concepts. They must not consume permanent dashboard space as passive data cards.

They belong in a dedicated **Controls** workspace with deliberate mutation surfaces, current state, effect explanation, revision/history, and appropriate confirmation.

### 5. System Actors are managed as actors

System Actor messaging authority needs a dedicated workspace, not a single enable/disable row embedded in Overview.

The operator should be able to inspect:

- actor identity and purpose;
- messaging enabled state;
- permitted recipient scope;
- permitted purposes;
- human-reply policy;
- accountable domain authority boundary;
- latest activity;
- suspension/recovery state where supported;
- relevant audit history.

Messages controls must never silently grant or revoke the actor's unrelated domain authority.

### 6. Agent Reviews & Updates are an operational queue

Agent-originated proposals, updates, escalations, failures, and requests for human approval require their own operational workspace.

They must not be mixed into System Actor identity management or broad Messages overview counts.

### 7. Super Administration is deliberate

Privileged platform-wide tools must be visibly separated from ordinary operational actions. Dangerous actions require stronger WAKILISHA confirmation and visible authority context.

### 8. Private content remains non-ambient

Normal case/conversation/admin views show safe metadata. Sensitive content is revealed only through an explicit inspection surface with purpose, scope, authority, and audit context.

The private-content boundary must remain a server-enforced authority, not a CSS convention.

## Current repository authority

### Current `/admin/messages` composition

`src/pages/admin/messages/page.tsx` currently owns:

- page title and top-level Super Admin framing;
- six operational count cards;
- Runtime Audience card;
- Private-content boundary card;
- System Actors in Messages block;
- `MessagesSafetyPanel`;
- `MessagesLegalPanel`.

This confirms the present information architecture is one long vertically stacked page rather than a workspace with product-level sections.

The current page also directly binds System Actor enable/disable mutation into the overview surface.

### Existing WAKILISHA primitives already available

The design-system primitive directory already contains reusable foundations including:

```text
Button.tsx
Modal.tsx
PageHero.tsx
PageShell.tsx
SearchableSelect.tsx
Sheet.tsx
Surface.tsx
Tag.tsx
WakilishaToggle.tsx
```

This is important: #891 must **compound** these primitives rather than start a second admin design system.

`SearchableSelect.tsx` already proves the repository has a custom searchable dropdown interaction with:

- WAKILISHA-rendered trigger;
- WAKILISHA-rendered option surface;
- keyboard ArrowUp/ArrowDown/Enter support;
- Escape close;
- outside-click close;
- selection state;
- filtered option search.

It is not yet sufficient as the universal entity picker because its option model is only `{ value, label }` and its empty-state copy is currently domain-specific (`No countries found`). It should be generalized rather than discarded.

### Current Legal authority

`MessagesLegalPanel.tsx` already owns the accepted Candidate C workflow and must remain bound to existing service/command authority:

- open Legal Request Case;
- start review;
- add/release scope;
- materialize/release preservation;
- classify exact held object;
- inspect exact evidence;
- prepare package;
- approve/revoke package/elevated approval;
- submit generation;
- release/void package;
- purpose-audited delivery;
- close case.

#891 may recompose how these commands are presented. It must not replace their authority with client-side state.

## Current UX problems proven by Production canary

The Phase 8B.5 Candidate C Production canary exposed the following product problems without invalidating backend authority:

1. **Vertical workflow sprawl**
   - Legal case list, case detail, scope, held objects, packages, package detail, and case history expand into a long document.
   - Operator context is lost through scrolling.

2. **Weak action hierarchy**
   - technically valid next actions exist, but the operator must locate them among many cards and buttons;
   - terminal/destructive/exception actions can visually compete with ordinary progression.

3. **Native browser controls**
   - Legal forms expose browser-native dropdown/date interactions instead of WAKILISHA-owned pickers and date/time controls.

4. **Raw UUID workflow input**
   - Legal exact-object targeting and review assignment can require pasted UUIDs;
   - this is implementation-shaped and error-prone.

5. **Control concepts shown as passive dashboard facts**
   - Runtime Audience and Private Content Boundary occupy Overview real estate even when the operator is not controlling them.

6. **System Actor control is under-modeled in UI**
   - the current Overview row exposes a single enable/disable action even though actor purpose, recipient scope, reply policy, accountability, and activity are richer operational concepts.

7. **Audit dominates work canvas**
   - history is valuable but should be contextual/on-demand rather than forcing the primary workflow to compete with an ever-growing event list.

8. **Dense machine detail is surfaced too early**
   - raw hashes, fingerprints, manifests, UUIDs, and payloads are useful for advanced inspection but should not dominate normal progression.

9. **Manual refresh / asynchronous progression friction**
   - worker-backed stages such as disclosure generation should progress through controlled polling/state refresh rather than require the operator to guess when to press Refresh.

10. **Responsive composition is incidental**
   - stacked desktop cards are not a deliberate mobile workflow.

## Target information architecture

`/admin/messages` becomes **Messages Operations** with internal product navigation:

```text
Overview · Conversations · Safety · Legal · Agents · System Actors · Controls
```

### Overview

Purpose: operational orientation and actionable work, not authority configuration.

Show:

- meaningful queue counts;
- alerts/failures requiring action;
- compact health summary;
- shortcuts to active work.

Do not show:

- full Legal/Safety workspaces;
- persistent Runtime Audience card;
- persistent Private Content Boundary card;
- full System Actor management.

### Conversations

Purpose: operational mailbox/routing surface.

Owns:

- conversation/request/spam review;
- mailbox/routing state;
- delivery state;
- user-level intervention where existing authority permits;
- safe identity/context inspection.

### Safety

Purpose: Safety Case operations.

Preserve Candidate A/B authority exactly while recomposing around:

- queue/list;
- focused case workspace;
- explicit evidence inspector;
- disposition/enforcement progression;
- recovery/appeal context;
- contextual audit.

### Legal

Purpose: serious Legal Request Case management.

Use a guided workflow rail:

```text
Request → Review → Scope → Evidence → Disclosure → Approval → Generation → Release → Delivery → Closure
```

The rail is a projection of existing backend state, not a new source of truth.

Recommended desktop composition:

- left: case queue/list with compact filters;
- center: active stage/workbench;
- right or contextual sheet: metadata, audit, advanced inspection;
- persistent compact workflow rail above center workbench.

Recommended narrow/mobile composition:

- case list → case workspace navigation;
- workflow rail becomes compact horizontal/step disclosure;
- inspectors/audit use full-height sheets;
- one primary action region remains visible without excessive scrolling.

### Agents

Purpose: Agent Reviews & Updates.

Owns:

- proposals awaiting human review;
- accepted/rejected/returned updates;
- escalations;
- failed operations requiring attention;
- accountability and originating actor context.

This is distinct from System Actor identity/configuration.

### System Actors

Purpose: manage accountable machine actors as actors.

Use a list/detail workspace with actor identity, policy, capabilities, messaging controls, recipient scope, purpose, latest activity, and history.

### Controls

Purpose: privileged Messages authority/configuration.

Owns:

- Runtime Audience;
- Private Content Boundary explanation/control surfaces;
- platform-wide messaging switches/policy controls where existing authority supports them;
- revisions/history;
- advanced Super Administration tools.

## Interaction primitive convergence

### Reuse and generalize

#### SearchableSelect → WAKILISHA picker foundation

Generalize the existing custom component to support:

- generic empty-state copy;
- richer option rendering;
- secondary metadata;
- icons/avatars/status;
- disabled options with reason;
- loading state;
- async search;
- keyboard active-descendant semantics;
- clear/reset where appropriate;
- compact and full picker variants.

Do not replace it with a native `<select>`.

#### Modal / Sheet

Retain as structural foundations, but introduce a consistent command/inspection composition:

- command title and impact;
- authority/context summary;
- required human reason where applicable;
- primary/secondary/destructive hierarchy;
- busy and success progression;
- predictable focus management.

#### WakilishaToggle

Use for true binary control state. Do not substitute raw checkboxes for visible product controls.

### New reusable primitives required

Names may change, but the capabilities are required:

1. **EntityPicker**
   - searchable canonical identity selection;
   - context-rich rows;
   - safe metadata only by default;
   - single/multi-select variants.

2. **DateTimePicker**
   - fully WAKILISHA-rendered calendar/time selection;
   - keyboard accessible;
   - timezone/status clarity;
   - no browser-native date picker chrome.

3. **WorkflowRail**
   - current/completed/blocked/future stages;
   - reason/tooltips for blocked stages;
   - responsive variant;
   - backend-state projection only.

4. **CommandSheet**
   - consistent governed-action surface;
   - reason, impact, affected entity, authority, confirmation.

5. **Inspector**
   - deliberate reveal surface for evidence/manifests/hashes/raw payloads;
   - safe summary first;
   - advanced machine detail on demand.

6. **AuditTimeline**
   - contextual event history;
   - actor/time/event summary;
   - expandable metadata rather than raw JSON by default.

7. **Status / StateBadge**
   - consistent semantic hierarchy for active, blocked, queued, generated, released, closed, failed, etc.

## Backend authority impact

### Must remain unchanged by default

```text
Messages canonical tables and commands
Safety Case schema and commands
Legal Case schema and commands
Media delivery/preservation authority
Legal disclosure worker
media-upload-api Legal delivery authority
command receipts / jobs / retries / outbox
immutable audit events
role/capability enforcement
```

### Potential narrow read-projection gaps

Entity pickers may reveal missing **safe search/read projections** for canonical entities.

If a picker cannot be implemented from an existing authorized read surface, the implementation must first prove that gap. Any new server read projection must:

- expose safe metadata only;
- enforce the same capability/role authority server-side;
- avoid ambient private content;
- reuse canonical entity identity;
- remain read-only;
- not create a parallel search/index authority unless independently justified.

Do not add SQL merely because the UI currently accepts a UUID.

## Smallest serious implementation shape

This work should be delivered as one serious slice with contained internal gates, not a proliferation of phases.

### Gate A — Shared interaction foundations

- generalize SearchableSelect into reusable picker foundation;
- custom DateTimePicker;
- WorkflowRail;
- CommandSheet;
- Inspector/AuditTimeline convergence;
- focused accessibility/keyboard tests.

No Messages business semantics change in this gate.

### Gate B — Messages Operations shell

- product-level internal navigation;
- Overview recomposition;
- move Runtime Audience and Private Content Boundary to Controls;
- create dedicated Agents and System Actors workspaces;
- preserve existing service calls and server authority.

### Gate C — Legal workflow convergence

- case list/workbench architecture;
- guided workflow rail;
- entity pickers instead of routine UUID entry;
- contextual package/evidence/audit inspection;
- controlled worker-status refresh/polling;
- preserve exact Candidate C commands and transitions.

### Gate D — Safety convergence

- apply the same workspace/inspection/action patterns to Safety;
- preserve Candidate A/B commands and authority.

### Gate E — Responsive and adversarial UX acceptance

- desktop;
- narrow/mobile;
- keyboard-only;
- focus restoration;
- picker search/no-result/loading/error;
- stale revision/conflict;
- permission denial;
- worker queued/success/failure/retry states;
- no private evidence ambient rendering;
- no raw UUID required for representative operator flows;
- no browser-native workflow chrome;
- Production smoke.

## Explicitly out of scope

- changing Candidate C legal semantics;
- changing Safety disposition semantics;
- broad public Messages audience expansion;
- Community moderation redesign;
- Registry redesign;
- replacing server authority with client workflow state;
- introducing another UI framework/design system;
- adding schema before a proven read-authority gap exists.

## Deployment classification

Expected default deployment shape for #891:

```text
SQL migration needed: NO by default; only if a proven safe picker-read projection is missing
Supabase Edge Function deploy needed: NO by default
Media receiver deploy needed: NO
Legal worker deploy needed: NO
Frontend deploy needed: YES
PR needed: YES per accepted gate
```

Any deviation requires a fresh authority proof before implementation.

## First implementation gate

Start with **Gate A: Shared interaction foundations** plus the Messages Operations shell skeleton.

Do not begin by rewriting the Legal backend or by visually restyling the existing giant page in place. The information architecture and reusable interaction layer must be corrected first.
