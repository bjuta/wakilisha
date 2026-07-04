# PR 2 Plan: Assistant Engine and Review Bridge

Status: Proposal awaiting JB approval on the items in section 8. No code written yet.
Branch: feat/inquiry-court-system
Follows: docs/institute/INQUIRY_COURT_INSPECTION_NOTE.md and docs/institute/INQUIRY_COURT_SPRINT_ADDENDUM.md

## 1. What this PR is, in plain language

The database already has places to store assistant runs and suggestions. That means we do not need to invent the logbook first. The missing piece is the engine that writes to it: a server-side function that takes a job request, calls the model with the inquiry's context, logs the run, and files the output as suggestions a human can accept, edit, or reject. This PR builds that engine plus the review surface, and nothing else. No suggestion becomes canonical without a human decision; the engine physically cannot write to inquiries, evidence, relationships, or claims tables.

## 2. Learned Adjustments

## Learned Adjustment 1: PR 2 is the engine, not the infrastructure

Original plan:
The brief's PR 2 was "Assistant run infrastructure, provider registry, structured output pattern, and run logging."

Finding:
`institute_assistant_runs` and `institute_assistant_suggestions` already exist (supabase/migrations/202607020001, lines 163-202) with provider, model, prompt_version, status, review_status, cost fields, and human decision statuses. Nothing in src/ writes to them.

Decision:
PR 2 builds the execution engine (edge function + job registry in code + frontend service + review UI) against the existing tables. The only schema change is extending the task check constraint.

Logic:
Building a second run infrastructure would duplicate live schema and violate addendum section 7.

Risk:
The existing tables were designed before the ten-job list; if a job later needs a field the table lacks, we add a column then, not now.

Approval:
Approved in principle by addendum section 11. Concrete pieces still need section 8 sign-off.

Rollback:
The engine is additive. Remove the edge function and the UI entry points; the tables return to dormant.

## Learned Adjustment 2: Extend the existing task enum instead of a new job table

Original plan:
The brief implies a job system with its own definitions ("Define assistant job types and lifecycle... provider registry shape").

Finding:
The run table's `task` check constraint already enumerates seven tasks. The brief defines ten job types with different names.

Decision:
One additive migration extends the constraint to accept the ten new job types alongside the original seven. The job registry (input shape, output schema, prompt version, provider path per job) lives in code, in one module, not in a database table.

Logic:
A registry table is premature: jobs change with prompts, and prompt iteration should not require migrations. The check constraint stays as the database-level guard on what counts as a valid task. Old seven names stay valid so historical rows and any future reuse remain consistent.

Risk:
Two naming generations coexist in the enum (for example question_clinic_help and question_clinic). Mitigated by the registry only exposing the new ten; the old names are legacy-read-only.

Approval:
JB approval needed (changes a production table constraint).

Rollback:
Constraint changes are additive; rolling back is re-tightening the constraint after confirming no rows use the new values.

## Learned Adjustment 3: Ship two jobs first, not ten

Original plan:
Section 11 of the brief lists ten job types for the sprint.

Finding:
Each job needs a prompt, an output schema, a review UI mapping, and tests. Ten at once is one giant speculative PR, which the brief itself forbids.

Decision:
PR 2 ships the engine with exactly two jobs: `question_clinic` (feeds PR 3, the first surface) and `next_step_recommender` (small, useful everywhere, exercises the suggestion pipeline). The other eight land in their surface PRs (evidence_reader in PR 4, relationship_mapper in PR 5, and so on), where their output has a home.

Logic:
Scope reduction to protect production; every later PR gets a proven engine instead of eight untested prompts.

Risk:
None beyond schedule; the enum migration already admits all ten so later PRs need no further schema change for job types.

Approval:
No approval needed per addendum section 3 (scope reduction, PR splitting). Documented here.

Rollback:
Not applicable; this is sequencing.

## 3. Scope

In: one edge function, one additive migration, one job registry module, one frontend service, run log and suggestion review UI inside the existing inquiry interface, tests, docs.

Out: all other surfaces (clinic UI is PR 3), any write path from suggestion to canonical record, embeddings, queues, transcription, document parsing, web capture, public anything.

## 4. Design

### Edge function: `institute-assistant`

- Follows the house pattern in supabase/functions (shared block style, corsRestricted, verifyJwt, requireCap).
- Capability: `institute_assistant_use` (already defined and role-mapped).
- Request: `{ inquiryId, jobType, input }` where input is job-specific and validated against the registry's input schema version.
- Flow: insert run row (status running) -> gather context server-side (inquiry, current question version, anchor snapshot, accepted evidence summaries as the job requires) -> call provider -> validate structured output -> update run row (output_json, status succeeded, latency, cost fields) -> insert suggestion rows (status suggested) -> return run id and suggestions.
- Failure: run row updated with status failed and error_message; the UI shows a human-language error, never the raw message.
- The function has no write access path to institute_inquiries, institute_evidence_items, or any canonical table. Suggestions are its only output.

### Provider

- Anthropic, via the official SDK (npm:@anthropic-ai/sdk in Deno).
- Model: `claude-opus-4-8` as the engine default, stored per-run in model_name so the log is honest. Model key configurable via admin settings, not hardcoded in prompts.
- Structured outputs via `output_config.format` with a JSON schema per job; schema version recorded on the run (input_context.schema_version and output payload version).
- Adaptive thinking on; no sampling parameters.
- API key: server-side only, via the existing readCred pattern - env `ANTHROPIC_API_KEY` first, then `admin_settings_secrets` key `anthropic_api_key` managed through admin-save-credentials. Never in the frontend bundle, never in responses.

### Job registry (code module)

`supabase/functions/institute-assistant/jobs.ts`: for each job type - prompt version, system prompt, input schema, output JSON schema, suggestion mapping (which output fields become which suggestion_type rows), max_tokens. PR 2 registers question_clinic and next_step_recommender only.

### Frontend

- `src/services/institute/assistantRunService.ts`: invoke the function, list runs for an inquiry, list suggestions, and record human decisions (update suggestion status to accepted / edited_and_accepted / rejected / saved_as_doubt with reviewed_by, reviewed_at) under existing RLS.
- Review UI: a panel in the inquiry interface showing suggestions as cards - body, reason, confidence as a human-readable band (never a numeric cultural score), source references as links, and the decision actions. A run log drawer (job, model, when, status) for transparency; copy per the tone bible, no provider jargon on screen.
- Accepting a question_clinic suggestion does not change the question in this PR; it marks the suggestion accepted. Wiring accepted refinements into question versions is PR 3, where the clinic surface owns that flow.

### Migration (draft for approval, with verification)

```sql
-- 2026070X0001_institute_assistant_task_expansion.sql
alter table public.institute_assistant_runs
  drop constraint if exists institute_assistant_runs_task_check;

alter table public.institute_assistant_runs
  add constraint institute_assistant_runs_task_check check (task in (
    -- original seven, kept for existing rows and continuity
    'anchor_context_lift', 'question_clinic_help', 'workbench_setup_suggestions',
    'evidence_search_plan', 'relationship_suggestions', 'risk_and_doubt_check',
    'next_inquiry_suggestions',
    -- Inquiry Court job types
    'question_clinic', 'evidence_reader', 'relationship_mapper',
    'claim_docket_builder', 'inquiry_summary_builder', 'how_this_learned_builder',
    'learning_board_curator', 'lineage_fork_analyzer', 'correction_impact_analyst',
    'next_step_recommender'
  ));
```

Verification queries to run after applying:

```sql
-- 1. No existing rows violate the new constraint (expect 0)
select count(*) from public.institute_assistant_runs
where task not in ('anchor_context_lift','question_clinic_help','workbench_setup_suggestions',
'evidence_search_plan','relationship_suggestions','risk_and_doubt_check','next_inquiry_suggestions',
'question_clinic','evidence_reader','relationship_mapper','claim_docket_builder',
'inquiry_summary_builder','how_this_learned_builder','learning_board_curator',
'lineage_fork_analyzer','correction_impact_analyst','next_step_recommender');

-- 2. Constraint present and enforced (expect error)
-- insert into public.institute_assistant_runs (task) values ('bogus_task');

-- 3. Row counts unchanged before vs after
select count(*) from public.institute_assistant_runs;
```

No RLS change, no grants change, no data mutation.

## 5. Tests

- Registry unit tests: each registered job has a prompt version, valid input and output schemas, and a suggestion mapping.
- Service tests (vitest, new test/institute/): suggestion decision updates set reviewed_by and reviewed_at; no service function writes canonical tables.
- Static guardrail test: grep that `ANTHROPIC` appears nowhere under src/.
- Failure-state test: a failed run renders the human-language error state.
- Existing suites still pass; npm run build passes.

## 6. Deployment checklist

- SQL migration needed: Yes (task enum expansion above, with verification queries).
- Supabase Edge Function deploy needed: Yes (institute-assistant, new). Deploy only after JB review, only this function.
- Readdy Finish update needed: No.
- Frontend deploy needed: Yes (service + review UI).
- PR needed now: Yes, after approvals in section 8.
- Next test: create a test inquiry, run question_clinic, confirm the run row, review and reject a suggestion, confirm nothing else changed.

## 7. Risk and rollback

Risk level: medium. New external dependency (Anthropic API) and a constraint change on a production table.

What could break: the inquiry interface if the review panel regresses shared state (mitigated: panel is additive, feature-scoped); runaway cost (mitigated: max_tokens per job, cost fields logged per run, no loops); constraint change (additive only, verified).

Rollback: remove the edge function and the UI panel; re-tighten the constraint after verifying no new-type rows; runs and suggestions rows are inert data protected by RLS either way.

## 8. Approvals requested from JB before implementation

1. The task enum migration in section 4 (adds ten values, keeps seven, no data change).
2. Creating and deploying the `institute-assistant` edge function as designed.
3. Anthropic as the LLM provider, default model `claude-opus-4-8`, key stored server-side via admin_settings_secrets under `anthropic_api_key` (JB supplies the key through the existing admin credentials screen or as a function env var; Fable never handles the key value).
4. The two-jobs-first scope (Learned Adjustment 3) - documented as no-approval-needed, flagged here anyway since it re-times the brief's job list.
