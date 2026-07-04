# Inquiry Court Sprint Addendum: Learned Adjustments, Documented Judgment, and Plan Evolution

Status: Approved in principle by JB, 2026-07-04
Applies from: PR 2 onward
Companion to: docs/institute/INQUIRY_COURT_INSPECTION_NOTE.md and the Fable 5 Inquiry Court sprint brief

The original brief is the source of direction. It defines the product intent, the doctrine, the user expectation, the safety rules, and the desired destination. However, the plan is allowed to evolve when repo inspection, schema inspection, production reality, or implementation evidence proves that a better path exists.

Fable is allowed to make learned adjustments to the sprint plan, but only under the rules below.

## 1. The Brief Is Doctrine, Not a Blind Script

The brief should not be followed mechanically when the real codebase proves that a different path is safer, cleaner, or more faithful to the Institute. If the brief assumed something that repo inspection disproves, Fable should say so plainly.

Examples:

- The brief assumed a table does not exist, but the migration already created it.
- The brief assumed a feature needs schema work, but the schema already supports it.
- The brief assumed one PR sequence, but a different sequence reduces risk.
- The brief described a surface as missing, but the app already has a partial version that should be reused, removed, or corrected.
- The brief named a technical approach, but the existing architecture has a safer house pattern.

In those cases, Fable should not blindly execute the old plan. Fable should document the finding and propose the adjustment.

## 2. No Silent Changes to the Plan

Fable may adjust the plan, but never silently. Every learned adjustment must be documented in the inspection note, PR plan, or PR body before implementation begins.

A learned adjustment must include:

- Original plan: what the brief said or implied.
- New finding: what repo, schema, production, or doctrine inspection revealed.
- Decision: what Fable is changing.
- Logic: why the new path is better.
- Risk: what could break or become more complicated.
- Approval level: whether JB must approve before implementation.
- Rollback path: how to undo or retreat if the adjustment proves wrong.

No undocumented adjustment should reach production.

## 3. What Fable Can Adjust Without Waiting

Fable may proceed without asking JB first when the adjustment is low risk and clearly improves safety, accuracy, or maintainability.

Allowed without waiting:

- Reordering PRs when the dependency chain is clearer after inspection.
- Removing duplicate work when the schema or UI already exists.
- Splitting an oversized PR into smaller safer PRs.
- Renaming a branch, file, or internal helper for clarity, as long as no public product language changes silently.
- Using an existing house pattern instead of inventing a new one.
- Adding inspection notes, docs, comments, or verification queries.
- Tightening tests, grep checks, and build checks.
- Reducing scope to protect production.

Even when approval is not required, the decision must still be documented.

## 4. What Requires JB Approval First

Fable must pause and ask for approval before making adjustments that affect product direction, data shape, production risk, or user-facing behavior.

Approval is required for:

- Adding new tables.
- Changing existing production tables in a way that affects stored data.
- Backfilling or mutating production data.
- Changing RLS policies.
- Adding or changing Supabase Edge Functions.
- Adding LLM calls, model providers, prompts, or server-side AI behavior.
- Changing public copy, public routes, or public feature behavior.
- Removing an existing feature or route.
- Changing the meaning of Institute doctrine.
- Collapsing two planned concepts into one product surface.
- Expanding scope beyond the sprint.
- Shipping anything that changes what users or contributors can do.

If unsure, Fable must treat the adjustment as approval-required.

## 5. Learned Adjustment Format

Whenever Fable changes the plan, use this format.

```md
## Learned Adjustment

Original plan:
[What the brief expected.]

Finding:
[What inspection revealed. Include file paths, table names, screenshots, logs, or SQL results where relevant.]

Decision:
[What will change in the plan.]

Logic:
[Why this path is safer, more faithful, or more efficient.]

Risk:
[What could go wrong.]

Approval:
[No approval needed / JB approval needed before implementation.]

Rollback:
[How we undo this if needed.]
```

This format should appear in the inspection note, PR description, or a dedicated addendum note before the work proceeds.

## 6. PR Sequence May Evolve

The PR sequence in the brief is a recommended starting map. It is not a prison. Fable may collapse, split, reorder, or rename PRs if inspection proves the revised sequence is better.

However, every PR still needs:

- A clear scope.
- A reason for existing.
- A tested behavior.
- A deployment checklist.
- A rollback path.
- A note on whether it changes SQL, Supabase Edge Functions, frontend, Readdy, or production data.

PRs should stay small enough to review and reverse. A better sequence is allowed. A vague sequence is not.

## 7. Schema Reality Beats Assumption

If the database already has stronger foundations than the brief expected, Fable should build on them rather than recreate them.

For example, if inquiry runs, assistant suggestions, events, snapshots, or question states already exist in schema, Fable should treat those as the current source of truth after verifying:

- table structure;
- RLS;
- existing writes;
- missing writes;
- app usage;
- production rows;
- compatibility with the doctrine.

Do not duplicate existing structures unless there is a documented reason.

## 8. UI Reality Beats Assumption

If a UI surface already exists, Fable must inspect it before replacing it. The decision should be one of:

- keep and extend;
- keep but redesign;
- remove and rebuild;
- retire as stale artifact;
- leave untouched because it belongs to another system.

Do not build a second version of a feature without documenting why the existing one is insufficient.

## 9. Doctrine Beats Convenience

A learned adjustment is only valid if it still serves the Institute doctrine. The adjustment must preserve:

- inquiry as a disciplined process, not a content shortcut;
- evidence before claims;
- claims as testable, reviewable objects;
- relationships as cultural logic, not decorative links;
- corrections as honesty infrastructure;
- human approval before publication;
- the registry as source of truth;
- assistant output as suggestion, not authority;
- memory, lineage, and learning as first-class records.

Speed is welcome. Shortcuts that weaken the doctrine are not.

## 10. Fable Must Explain Tradeoffs in Human Language

When Fable proposes a learned adjustment, it should not hide behind technical language. Use plain language.

Bad: "We should refactor toward a task-backed orchestration layer because the enum already exists."

Good: "The database already has places to store assistant runs and suggestions. That means we do not need to invent the logbook first. The missing piece is the engine that writes to it."

The goal is for JB to understand what changed, why it changed, and whether to trust the next move.

## 11. Current Learned Adjustment From First Run

Fable's first inspection found that the schema is ahead of the UI. That is a valid learned adjustment.

The brief assumed more run infrastructure needed to be built. Inspection found that the database already includes:

- `institute_assistant_runs`;
- `institute_assistant_suggestions`;
- `institute_events`;
- question version assessment states;
- anchor context snapshots;
- evidence and review packet foundations.

The correct adjustment is to stop treating PR 2 as "create the whole run infrastructure" and instead treat it as the assistant engine and review bridge.

This adjustment is approved in principle, subject to the normal rules:

- no product code before the inspection note is reviewed;
- no Edge Function deploy without explicit deployment checklist;
- no LLM provider secrets exposed;
- no Assistant output can auto-approve anything;
- every suggestion must remain reviewable;
- every run must be logged;
- every schema change must come with verification SQL;
- every PR must explain what changed from the original plan.

## 12. Non-Negotiable Final Rule

Fable is allowed to learn from the codebase. Fable is allowed to improve the plan. Fable is allowed to tell JB that the original sequence is no longer the smartest path.

But Fable is not allowed to quietly change direction.

Every adjustment must leave a trail: what changed, why it changed, what risk it creates, and how we reverse it if needed.

That is how the plan stays alive without becoming chaos.
