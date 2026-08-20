# WAKILISHA Documentation Authority Map

Status date: 20 August 2026

## Why this exists

WAKILISHA has several generations of planning and migration documents. They are useful for different reasons, but some reuse the same phase numbers for different programmes.

This map explains what each document is authoritative for.

## 1. Current programme status

Read first:

- `docs/institute/PROGRAMME_STATUS.md`
- `docs/roadmap/wakilisha-master-programme-map.md`

These answer:

- Where are we now?
- Which numbered phases are complete?
- What is the next numbered phase?
- What substantial work happened between numbered phases?

## 2. Long-form programme architecture and doctrine

Read:

- `docs/institute/two-workspace-pilot-audit-and-build-plan.md`

Despite its historical filename, its document title is **WAKILISHA Editorial Production System and Inquiry Mode Project Plan**.

It remains authoritative for:

- the Phase 0 through Phase 12 programme structure
- five-year durability goals
- cultural output doctrine
- canonical domain boundaries
- shared platform-kernel design
- editor-completion standards
- phase scopes and exit gates
- engineering and delivery principles
- Inquiry Mode sequencing
- production freeze sequencing

Its current-status paragraphs were last reconciled before the full Phase 5B acceptance sequence. For current phase and completion status, use `docs/institute/PROGRAMME_STATUS.md`.

## 3. Phase-specific contracts and acceptance records

Examples include:

- `docs/engineering/phase-5a-playlist-product-authority-design.md`
- `docs/engineering/phase-5b-public-playlist-product-design.md`
- implementation audits
- permanent SQL verifiers
- focused contract tests

These define the detailed contract inside a phase or milestone.

They do not replace the global programme map.

## 4. Post-Phase-5 Interlude

Read:

- `docs/roadmap/post-phase-5-interlude-ledger.md`

This records Community, onboarding, Personal Playlist, identity, Organization, and reliability work completed after Phase 5.

The interlude is part of WAKILISHA's baseline. It is separated in the map only so the long-running numbered programme remains legible.

## 5. Historical WordPress-to-React parity programme

Read:

- `docs/parity/`

These documents preserve:

- WordPress behavior and route requirements
- React parity decisions
- migration matrices
- API parity work
- historical route coverage

Their Phase 5 and Phase 6 labels belong to the earlier parity programme. They do not describe the current Editorial Production System programme phase.

See `docs/parity/README.md` before using those phase numbers for planning.

## 6. Repository README

`README.md` should orient a new reader to the current project and point to the programme map.

The original data-repair material remains important project history and Registry context, but it is no longer the current implementation phase.

## 7. Chats, terminal transcripts, PR bodies, and deployment receipts

These are operational evidence.

They are often the best record for:

- exact production acceptance
- deployment hashes
- rollback paths
- why a design changed
- which runtime behavior was visually accepted
- stopped or partially completed deploys

When they materially change roadmap status, reconcile that fact into the current programme status and roadmap documents.

## Reconciliation habit

The project does not need perfect ceremony after every change.

It does need periodic reconciliation when the codebase and the written map drift apart.

A useful reconciliation pass should answer:

1. What actually shipped?
2. What became a permanent baseline?
3. Which original assumptions are now stale?
4. Which phase exit gates have actually been met?
5. Where does the numbered programme continue now?

That is the purpose of the roadmap documents in this directory.
