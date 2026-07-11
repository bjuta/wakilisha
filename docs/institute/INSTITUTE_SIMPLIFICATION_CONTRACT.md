# WAKILISHA Institute Simplification Contract

Status: PR0 gate
Date: 2026-07-11

## Purpose

The Institute is being simplified so the work remains difficult where it should be difficult, in the question, evidence, judgment and record, while the tool becomes obvious enough to disappear.

This contract freezes the product direction before any refactor begins.

## Permanent product model

The Institute has one central object: the Inquiry.

Every enduring capability must belong to one of these five sections:

1. Overview
2. Material
3. Notes and findings
4. Work
5. History

Top-level Institute navigation will eventually contain only:

- Inquiries
- Review
- Work

## Permanent institutional rules

- The original question is never silently overwritten.
- Material is not automatically a finding.
- Assistant output is never canonical without a human decision.
- Unknown, disputed and unresolved are valid outcomes.
- Corrections preserve what changed, why, when and by whom.
- Public work always remains traceable to its inquiry and source material.
- No existing Institute data is deleted as part of a UI simplification.
- Every destructive migration requires a preview, backup path and verification query.
- Every inquiry must remain exportable independently of the current frontend or AI provider.

## Vocabulary

Use durable research language in the interface:

- Inquiry
- Question
- Material
- Note
- Finding
- Work
- Review
- Publication
- History
- Correction

Do not create new product rooms or navigation around implementation concepts such as assistant jobs, readers, mappers, boards, queues or readiness systems.

## Freeze rules

Until the new Inquiry shell is live, do not add:

- new Institute screens
- new assistant job types
- new evidence formats
- new workspaces
- new status vocabularies
- new output-specific review packet branches
- new Institute tables unless required to prevent data loss or security failure
- disabled future navigation
- placeholder public features

Existing production bugs may still be fixed narrowly.

## Keep

- institute_inquiries
- institute_question_versions
- institute_evidence_items, temporarily presented as Material
- institute_assistant_runs and institute_assistant_suggestions as audit infrastructure
- institute_events
- institute_review_packets during transition
- institute_work_product_links
- institute_relationships
- article and playlist work products
- capability and RLS protections

## Collapse

- Question Clinic into the Question section
- Anchor Brief into Overview and Material
- Evidence Reader into contextual Material actions
- Claims into Notes and findings
- Relationships into contextual connection actions
- How This Learned into History
- product-specific workspaces into the Work section

## Do not build as separate screens

- Inquiry Summary
- Lineage and Forks
- Contributor Memory
- Corrections
- Public Preview
- Learning Board
- AI Readiness

Their valid functions will be placed as follows:

- Inquiry Summary becomes the Inquiry Overview.
- Lineage becomes lightweight links between inquiries.
- Contributor Memory becomes a Material type and public contribution path.
- Corrections become institution-wide correction cases attached to the affected record or work.
- Public Preview belongs to each work product.

## Target lifecycle

The visible inquiry lifecycle should be small and truthful:

- Open
- In review
- Published
- Paused
- Closed

Visibility, maturity and publication state may remain separate internally where they describe different facts. They must not become competing user-facing state machines.

## Migration method

Every phase follows this order:

1. inventory current behavior and data
2. introduce a compatibility read layer
3. render existing data in the new structure
4. verify production parity
5. move writes to the new structure
6. remove old navigation and screens
7. observe one stable production cycle
8. clean up deprecated schema separately

## PR rule

Every Institute PR must answer:

> Does this reduce the amount of Institute machinery the worker must understand while preserving or improving the integrity of the cultural record?

If the answer is no, the PR should not proceed.

## Validation rule

Do not run the full `npm run build` by default for docs-only, SQL-only or isolated non-runtime PRs.

Use the narrowest relevant validation:

- `git diff --check`
- targeted tests for touched behavior
- static SQL review or read-only verification queries
- browser checks only when UI behavior changes

Run the full build only when shared runtime code, routing, bundling, generated SEO output or production compilation risk makes it necessary.
