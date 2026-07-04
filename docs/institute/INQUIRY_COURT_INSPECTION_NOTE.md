# Inquiry Court Inspection Note

Status: PR 1 deliverable, no product code changed
Branch: feat/inquiry-court-system (created from main at 1218c5d, clean tree confirmed)
Date: 2026-07-04
Author: Fable 5, for JB

This note answers the ten required inspection questions from the Inquiry Court sprint brief. It was written after reading the tone bible, How To Work With JB, the Institute V2 product contract, the BOOK4 build brief, and the constitutions library on the docs/wakilisha-library branch, and after inspecting the current main branch. Everything below was verified against the working tree, not assumed from the attached chat.

## 1. What already exists

More exists than the brief's inspection leads suggest. The July 2 foundation migrations built a serious schema, and the schema is ahead of the UI.

Schema, in five migrations dated 202607020001 to 202607020005:

- `institute_inquiries`: code sequence (INQ-0001 style), raw_question and current_question both preserved, status enum (draft, framing, active, needs_review, public_safe, published, paused, archived), separate maturity enum, separate visibility enum, soft delete. This already follows the product contract rule against one overloaded status field.
- `institute_question_versions`: versioned question history with version_type (raw, working, clinic_refinement, fork_source, review_revision) and an assessment_state enum that already carries most of the BOOK4 Question Clinic taxonomy (too_broad, too_narrow, loaded, false_assumption, too_speculative, not_answerable_yet, already_answered, different_question, should_fork, should_merge, should_pause, raw_but_promising, ready). Unique version numbers per inquiry. BOOK4.1's core demand, no silent question overwrite, is structurally in place and the service layer respects it.
- `institute_inquiry_anchors`: category-first anchors tied to the registry (artist, track, release, label, genre, scene, place, contributor_memory, claim, correction), one primary active anchor enforced by partial unique index. Anchors are rich records, not text tags, as the doctrine requires.
- `institute_anchor_context_snapshots`: knowns, unknowns, relationship_leads, evidence_gaps, related_entities, thin_data_notes, source_references. Thin data is visible by design.
- `institute_workbench_setup`: scope edges, care defaults, consent default, review standard.
- `institute_assistant_runs`: task enum of seven tasks (anchor_context_lift, question_clinic_help, workbench_setup_suggestions, evidence_search_plan, relationship_suggestions, risk_and_doubt_check, next_inquiry_suggestions), model_provider, model_name, prompt_version, input_context, output_json, source_references, status, review_status, latency, cost estimate.
- `institute_assistant_suggestions`: typed suggestions with human decision statuses (suggested, accepted, edited_and_accepted, rejected, saved_as_doubt, forked, converted_to_*), reviewed_by, reviewed_at.
- `institute_events`: a generic event log with actor, before_value, after_value.
- `institute_evidence_items`: human-language evidence kinds ("WAKILISHA record", "Personal note", "Chart data"...) and human-language review states ("Accepted for internal memory", "Kept as doubt", "Rejected with reason"). Copy doctrine is already inside the check constraints.
- `institute_review_packets`: versioned review submissions with editor decision and notes.
- `institute_work_product_links`: inquiry to article links (product_type only allows 'article' today), plus an article draft RPC.

Capabilities and RLS: institute_read, institute_write, institute_review, institute_assistant_use, institute_public_safe, institute_admin are defined, mapped to roles, and enforced with RLS on every institute table. Reviewer-only update policy on suggestions matches "AI creates candidates, humans create the record."

UI: one admin surface at /admin/institute/inquiry-interface driven by a ?screen= param. Live screens: home, workbench, anchorBrief, evidence, claims, review. The in-page nav already lists the sprint's remaining surfaces as disabled placeholders: relationships, summary, clinic, lineage, memory, corrections, learned, each rendering a LockedScreen. AdminShell exposes six Institute nav entries.

Services: `inquiryService.ts` (list, create with automatic question version 1 and anchor snapshot, update with new question version on edit), `instituteReviewDeskService.ts` (packets), `instituteArticleBridgeService.ts` (article draft creation and review submission), `institutePublicationSyncService.ts`. All direct Supabase client calls under RLS; no institute edge function exists.

Provider and secret infrastructure: no LLM integration exists anywhere in the repo. The pattern to add one exists: edge functions read secrets from env or the `admin_settings_secrets` table via a shared readCred helper, admin-save-credentials manages provider keys server-side (Spotify, Apple Music, ACRCloud, YouTube, Airplay today), and verifyJwt plus requireCap gate capability-checked endpoints. No queue or background job infrastructure exists; long jobs today are synchronous edge functions.

Tests: vitest is configured with real suites under test/scoring and test/security. There is no test/institute.

## 2. Pages that exist but need simplification, extension, or replacement

- `NativeInstituteInquiryInterface.tsx` is a 2,822-line monolith holding six screens plus nav, state, and locked-screen logic. It works, but every new surface added inside it makes it worse. Extend by extracting screens into files as they are built or touched; do not rewrite it in one pass.
- `InstituteClaimsWorkspace.tsx` (585 lines) has a real claim-shaping UI (claim text, use, confidence, caveat, evidence attachment, strength derivation) but persists claims as evidence items with `metadata.workspaceFormat: "Claim"`. The UI is worth keeping; the persistence is a shim that must be replaced by a real claims model, with an audited migration of existing shim rows.
- The review desk screen is a reasonable calm decision space and should be extended, not replaced.
- `src/pages/admin/relationships/viewer/page.tsx` renders from an empty `mockRelationships` array. It is a dead stub, registry-side rather than institute-side. Do not extend it; the Relationship Mapper should be built inside the inquiry interface, and this stub cleaned up or pointed at real data later.

## 3. Tables that already exist

Listed in section 1. Summary: inquiries, question versions, anchors, anchor context snapshots, workbench setup, assistant runs, assistant suggestions, events, evidence items, review packets, work product links. All with RLS, capability grants, and updated_at triggers.

## 4. Assistant and provider infrastructure that already exists

The logbook exists; the engine does not. `institute_assistant_runs` and `institute_assistant_suggestions` are complete enough to log runs with provider, model, prompt version, cost, review state, and traceable source references. Nothing in src/ reads or writes either table today. There is no edge function that executes an assistant task, no LLM provider key in the secrets registry, no provider registry table, no structured output versioning in code, and no queue. The run table's task check constraint has seven tasks; the sprint defines ten job types, so the constraint needs a migration to extend.

## 5. What is missing

- Assistant execution: an institute-assistant edge function (JWT + institute_assistant_use capability, secrets server-side), a job registry mapping job type to prompt version and output schema version, and a frontend service that creates runs, polls status, and renders suggestions for review.
- Job types: question_clinic, evidence_reader, relationship_mapper, claim_docket_builder, inquiry_summary_builder, how_this_learned_builder, learning_board_curator, lineage_fork_analyzer, correction_impact_analyst, next_step_recommender. Existing enum covers rough equivalents of three of these.
- Relationships: no institute relationship tables. Suggestion rows can carry relationship_lead payloads, but there is no reviewable relationship record with source entity, target entity, type, plain-language reason, evidence links, and confidence, and no accepted-relationship store.
- Claims: no claims table, no claim verdict enum, no claim-to-evidence role links (supports, contradicts, complicates, context, duplicate, irrelevant, low quality). Current claims are evidence rows with metadata.
- Lineage and forks: question_versions has fork_source and should_fork markers, but there is no institute_inquiry_forks table, no parent-child inquiry links, no fork reason or merge state, and no fork UI.
- Inquiry summary: no storage for a refreshable, stale-aware Current Understanding object.
- Learning events: institute_events exists but nothing writes to it, so How This Learned has no data source yet. Services must start emitting events as decisions happen.
- Learning Board, Correction Impact, next-step recommendations, and the AI readiness console: no surfaces, no queries.
- Corrections: there is no institute correction object; the anchor enum reserves 'correction' as a type but nothing produces one.
- Evidence Reader: no reviewed-extraction storage distinct from raw evidence (suggestions table can hold extraction candidates; accepted extractions need a home, likely evidence item metadata plus suggestion status, or a small table).
- Tests: no institute test suite.

## 6. What can be built without schema changes

- Question Clinic v1: the assessment_state enum, version_type clinic_refinement, and version history already support the full compare-accept-edit-reject flow. UI plus service work only. Fork action can be recorded as should_fork until the fork table lands.
- Learning event emission: services can start writing institute_events on question changes, evidence review decisions, packet decisions. This unblocks How This Learned later without waiting on new tables.
- How This Learned v1 and a read-only Learning Board v1 can be assembled from existing tables (versions, evidence review states, packets, events once emitted), though the curator job and correction impacts need more.
- Assistant run plumbing for the seven existing task types, including the run log UI and suggestion review UI, since both tables exist with the right review states.
- UI extraction and UX cleanup of the monolith, empty states, locked-state teaching copy, mobile checks.
- AI Ops readiness console, read-only: an edge function reporting which prerequisites exist (it needs a function deploy but no schema).

## 7. What needs migration work

1. Extend `institute_assistant_runs.task` check constraint to the ten job types (keep the old seven for log continuity).
2. `institute_relationships` plus `institute_relationship_candidates` (or candidate-as-suggestion with an accepted-relationships table; decide in PR 5 design, lean small).
3. `institute_claims`, `institute_claim_evidence_links` (evidence role enum), claim verdict enum including supported, weakly_supported, contested, contradicted, unresolved, needs_more_evidence, superseded, rejected. Plus an audited backfill of the existing claims-as-evidence shim rows with verification SQL, preserving the originals.
4. `institute_inquiry_forks`: source inquiry, child inquiry, source object type and id, reason, fork state (draft, investigating, proposed_merge, merged, rejected, archived), reviewer, evidence copy or move choices.
5. `institute_inquiry_summaries`: versioned Current Understanding with stale detection fields and source references.
6. Correction impact needs a small correction record or can anchor on evidence review state changes at first; decide at PR 9 with JB rather than inventing a corrections system now.
7. Possibly extend `institute_work_product_links.product_type` beyond 'article' later; out of this sprint unless a surface demands it.

## 8. Risks that could break current Institute flows

- The monolith: every screen shares state.ts and the drafts loading path in NativeInstituteInquiryInterface. Extracting screens or changing shared state risks breaking the working workbench, evidence, and review flows. Mitigate with small PRs and a smoke pass of all six live screens per PR.
- Claims shim migration: real inquiries in production already store claims as evidence rows (INQ codes visible in recent screenshots). Migrating them into a claims table without audit SQL breaks the brief's own law. Keep originals, mark them migrated, verify counts.
- Check constraint changes on a table with production rows must be additive only.
- The review desk and article bridge write review packets that feed publication sync; changes to packet statuses ripple into article workflows.
- RLS: new tables must copy the existing capability policy pattern exactly; a missed grant breaks screens silently for non-admin roles.
- Provider secrets: the assistant edge function must use the readCred pattern and never return key material; the frontend must only ever see run rows.
- The public preview surface must not change; work product links and publication sync touch article publishing, so claim and summary work must not push anything toward public routes.

## 9. Stale branches and artifacts that must not be copied forward

- `backup/main-before-institute-reset-20260630` is an archive by contract rule 16. Reference only, never merge.
- The many pre-reset institute branches (build/institute-v2-foundation and older feat/institute-*) predate the July 2 foundation; do not resurrect their schema or routes.
- `src/pages/admin/relationships/viewer/page.tsx` with mockRelationships is a dead stub; do not build the Relationship Mapper on it.
- Readdy: the repo has a chore branch removing Readdy references; no new Readdy coupling. Deployment notes still answer the Readdy question with No.
- The V8 prototype zips in Downloads are design references, not code sources.

## 10. Recommended PR sequence

The brief's ten-PR sequence collapses because PR 2's schema half already exists. Recommended:

- PR 1 (this): inspection note. No product code.
- PR 2: assistant engine. Edge function institute-assistant (JWT, capability check, secrets via readCred, structured output with schema versions), job registry in code, extend task enum migration, frontend assistantRunService, run log and suggestion review UI. Ship with question_clinic and next_step_recommender jobs only, behind the existing institute_assistant_use capability. Providers: Anthropic first, key stored server-side.
- PR 3: Question Clinic surface. Unlock the clinic screen: raw versus refined compare, taxonomy, accept, edit, reject, fork-note, decision persistence, learning events emitted. Works with or without the assistant (manual refinement first, assistant candidates when available).
- PR 4: Evidence Reader. evidence_reader job, reviewed extraction states, accept, edit, reject, duplicate, weak source, context-only actions, extraction kept separate from claims.
- PR 5: Relationship Mapper. Relationship tables migration, relationship_mapper job, candidate review queue with evidence links and plain-language reasons, manual creation second.
- PR 6: Lineage and forks. Fork table migration, fork flows from clinic, evidence, relationship, claim; parent-child visibility; lineage panel.
- PR 7: Claim Docket. Claims tables migration plus audited shim backfill, claim_docket_builder job, docket UI with the full human decision set, verdicts, evidence roles.
- PR 8: Inquiry Summary and How This Learned. Summaries table, inquiry_summary_builder and how_this_learned_builder jobs, stale detection, refresh, timeline view over institute_events.
- PR 9: Learning Board, correction impact hooks, next-step surfacing across screens. Correction storage decision made with JB here.
- PR 10: UX pass, mobile checks, empty and error states, copy audit against the tone bible, safety checks, sprint proof package.

Each PR: git status --short, git diff --check, npm run build, institute smoke pass, PR body per the brief's template. Deployment notes will say SQL migration Yes only for PRs 2, 5, 6, 7, 8; Edge Function deploy Yes for PR 2 and any job additions; Readdy No throughout; public preview untouched throughout.

## The one next honest move

PR 2. The schema's logbook is waiting for an engine, and every later surface depends on runs and suggestions flowing through human review. Question Clinic (PR 3) is the first surface that proves the method to a user.
