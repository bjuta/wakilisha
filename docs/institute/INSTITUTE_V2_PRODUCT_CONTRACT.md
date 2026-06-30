# WAKILISHA Institute V2 Product Contract

Status: PR0 draft
Scope: Product doctrine only
Code changes: None
Database changes: None
Public route changes: None

## 1. Why This Contract Exists

WAKILISHA Institute V2 is being rebuilt from a clean foundation because the previous Institute build became too large, too CRUD-like, and too far ahead of the human experience of inquiry.

The failure was philosophical before it was technical.

The old build proved that tables, routes, services, and admin screens could exist. It did not prove that the Institute helped people make better cultural judgments.

This contract prevents the rebuild from repeating that mistake.

## 2. What WAKILISHA Institute Is

The Institute is WAKILISHA’s method for turning cultural questions into durable, evidence-backed, human-readable, and machine-readable memory.

The question is the main object.

Everything else exists to help the question mature:

- Evidence makes the question safer.
- Contribution makes the question less solitary.
- Relationships make the question meaningful.
- Review makes the question honest.
- Corrections make the question remember.
- AI can help later, but AI does not approve truth.

The Institute is not:

- a dashboard;
- a library shelf;
- a CRUD admin;
- a blog system;
- a chatbot;
- a music app section;
- a SaaS feature.

## 3. First Build Decision

The first Institute V2 surface must be a protected internal lab route.

Use:

    /admin/lab/inquiry-interface

Do not start with:

    /institute
    /admin/institute
    /library

Reason:

`/institute` creates a public promise. `/admin/institute` creates production admin gravity. `/library` risks becoming a shelf before the Institute has working memory.

The lab route exists to test whether the inquiry experience works before the route becomes permanent.

## 4. Public and Internal Separation

The public doctrine page and the internal working surface must be separate.

Future public page:

    /institute

Purpose:

    Explain what the Institute means to the public.

First internal prototype:

    /admin/lab/inquiry-interface

Purpose:

    Test how the Institute actually works.

Do not combine them.

The public page must not promise tools, contribution flows, public Inquiries, AI, or a Library before those things actually work.

## 5. First Inquiry

The first Inquiry for the rebuild is:

    Inquiry 0005:
    What makes a good cultural inquiry interface for WAKILISHA?

This Inquiry tests the system itself.

It must ask:

- As an editor, does this help me make better judgments?
- As a contributor, does this help me offer memory without feeling like a database row?
- As an inquirer, does this make the question clear?
- As JB, does this make the Institute feel durable enough to build WAKILISHA around?
- As a future AI system, would this produce trusted, cited, reviewable cultural memory?

## 6. Required Questions Every Institute Surface Must Answer

Every Institute surface must answer these before it asks for fields:

1. What are we trying to understand?
2. What do we currently understand?
3. What evidence supports or weakens that understanding?
4. What is still uncertain?
5. What is the next honest move?

Every page must also answer:

1. What is this?
2. Why does it matter?
3. How does it connect?
4. Where should curiosity go next?

If a screen starts with a form, table, stat card, or admin label before it explains the question and the state of understanding, it is probably wrong.

## 7. Core State Language

Do not use one overloaded status field for everything.

Question maturity states:

- Raw
- Needs Refinement
- Ready for Inquiry
- Paused as Doubt
- Archived with Reason
- Merged into Existing Inquiry
- Rejected with Reason

“Converted to Inquiry” is an event, not a maturity state.

Inquiry lifecycle states:

- Framing
- Gathering Evidence
- Weighing Evidence
- Current Understanding Drafted
- Needs Review
- Ready to Share
- Shared
- Paused
- Closed as Learning

“Branched” is a marker or relationship, not the main lifecycle state.

An Inquiry can be gathering evidence and also have branches.

## 8. Current Understanding

Do not use “current belief” in the UI.

Use:

    Current Understanding

Definition:

    The best answer WAKILISHA can responsibly hold right now, based on available evidence, with visible confidence and uncertainty.

The first version must show:

- what we can safely say;
- what we cannot say yet;
- what changed this understanding;
- confidence level;
- evidence behind it;
- open doubts.

Current Understanding is not final truth. It is not a random note. It is not a thesis pretending to be proven.

## 9. Contributor Entry Point

The smallest useful contributor action is:

    Add a memory or correction

Do not start with:

    Submit evidence
    Add relationship reason
    Create source object

The contributor-facing prompt should use human language:

- What do you know?
- Who or what is this about?
- How do you know?
- Is this a memory, a correction, a source, or a connection?
- Can WAKILISHA use this publicly, internally, or only for review?

Internally, the system can later classify the contribution as:

- Memory
- Correction
- Evidence lead
- Relationship context
- Source link

The contributor must not feel like a database row.

## 10. Review Ownership

In the first workflow:

- JB can review.
- An Editor or Reviewer can review if explicitly allowed.
- Contributors cannot approve trusted memory.
- Anonymous users cannot approve trusted memory.
- AI cannot approve anything.

No evidence enters trusted memory without human review.

No public-safe status exists without a human review reason.

## 11. Unready Questions

Unready questions are not trash.

Do not use “bad” as the user-facing label.

Possible outcomes:

- Needs Refinement
- Paused as Doubt
- Branched into Better Question
- Merged into Existing Inquiry
- Archived with Reason
- Rejected with Reason

The system should preserve why an unready question failed. Weak questions can reveal confusion, bias, missing context, or a better path.

Do not silently delete them.

## 12. Experience Principles

The UI must breathe.

That means:

- It shows state, not just fields.
- It shows uncertainty, not just confidence.
- It shows next moves, not just actions.
- It explains why a decision matters.
- It keeps rejected or disputed material as learning, not trash.
- It makes overclaiming harder.
- It makes cultural relationships meaningful.
- It treats contribution as memory, not engagement.
- It makes the method visible.

## 13. Role Contract

The first design pass must account for:

- Editor
- Contributor
- Inquirer or researcher
- Reviewer
- JB or founder-operator
- Future AI agent
- Future public reader

For each role, the product must answer:

- What are they trying to do?
- What would confuse them?
- What language would make sense to them?
- What does trust look like for them?
- What would make the tool feel alive instead of bureaucratic?

## 14. What Must Not Be Built Yet

Do not build these in PR0 or PR1:

- Supabase migrations
- permanent Institute schema
- `/institute` public route
- `/admin/institute` production route
- `/library` rebuild
- AI execution
- embeddings
- model providers
- prompt registry
- retrieval
- AI run logs
- public Inquiry pages
- release gates
- generic CRUD admin screens

AI may appear only as a locked future concept until the human workflow is clear.

## 15. Provider Flexibility

Provider credentials are not PR1.

Before AI exists, WAKILISHA must define:

- what AI can see;
- what AI can suggest;
- what evidence is trusted enough for retrieval;
- what an AI run log must preserve;
- what prompt version was used;
- who approved the output.

Future architecture must remain flexible for:

- OpenAI
- Anthropic
- open-source models
- future WAKILISHA-trained models

No provider-specific schema should lead the build.

## 16. Old Build Salvage Rule

The old branch is an archive only:

    backup/main-before-institute-reset-20260630

Do not reopen or merge it.

Audit old work only as reference.

Reusable if it supports the inquiry method.

Discard if:

- it is just CRUD with WAKILISHA labels;
- it brings back old route gravity;
- it requires Supabase before the experience is clear;
- it treats contributors like records;
- it treats evidence like storage instead of claim discipline;
- it treats relationships like links instead of meaning judgments;
- it adds AI before the human workflow works.

## 17. Likely Safer Build Order

This is the provisional order.

1. PR0: Institute V2 product contract
2. PR1: Protected playable Inquiry prototype with local data only
3. PR2: Role-based UX pass for editor, contributor, reviewer, JB, future AI, and public reader
4. PR3: Evidence and Current Understanding model in UI
5. PR4: Schema decision
6. PR5: Permanent admin route decision
7. PR6: AI, providers, retrieval, and run logs only after human workflow is proven

## 18. PR0 Scope

PR0 includes:

- this product contract;
- no app route;
- no UI component;
- no service;
- no Supabase migration;
- no Edge Function;
- no AI code;
- no deployment.

PR0 is complete when this contract is reviewed and merged.

## 19. Implementation Gate

Before any code after PR0, the answer must be yes to all five:

1. Can a human understand what the Institute is doing without knowing our internal schema?
2. Can an editor make a better judgment because of this UI?
3. Can a contributor add memory without feeling like a database row?
4. Can JB trust this to become the foundation of WAKILISHA?
5. Can a future AI system consume the output with citations, confidence, and review history?

If the answer is no, do not build it yet.

## 20. Deployment Checklist Standard

Every implementation answer must include:

- SQL migration needed: Yes or No
- Supabase Edge Function deploy needed: Yes or No
- Readdy Finish update needed: Yes or No
- Frontend deploy needed: Yes or No
- PR needed now: Yes, No, or Not yet
- Next test

## 21. Language Rules

Institute copy must be:

- clear;
- human;
- sharp;
- warm;
- not academic fog;
- not corporate;
- not generic SaaS language.

Do not use em dashes.

Do not use public-facing database language like:

    Create contributor submission.
    Entity linked.
    Review status.
    No records found.

Use human language:

    Add a person helping this Inquiry.
    Mejja is now part of this Inquiry.
    Where this stands.
    Nothing has entered this part of the Inquiry yet.
