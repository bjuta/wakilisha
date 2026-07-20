# Phase 2C: Article Editor Workbench

## Goal

Turn the article editor from a sidebar-heavy form into a real editorial workbench.

The technical systems now exist: governed review, revision history, approval, publishing, archive, restore, preview, SEO, media, registry search, internal links, and lifecycle events. The UI must stop treating these as stacked widgets and start treating them as primary editorial work modes.

## Product diagnosis

The current editor places too much meaningful work in the right sidebar.

This makes rich systems feel smaller than they are:

- Revision history becomes a narrow receipt column.
- Lifecycle history becomes a passive log.
- Archive and restore feel like timeline consequences instead of primary article powers.
- Publish, review, preview, and draft state compete for space.
- SEO, social preview, categories, tags, and internal links are useful, but they are not all equal at every moment.
- The technical side is ahead of the interface.

Phase 2C fixes the editorial interface without changing the core data model first.

## Scope

### In scope

- Article editor layout architecture.
- Primary workbench modes.
- Top action hierarchy.
- Full-width history and revision comparison surface.
- Archive and restore as primary lifecycle actions.
- Publishing surface cleanup.
- Review surface cleanup.
- Sidebar reduction.
- Copy cleanup for shipped editor strings, including no em dashes.
- Desktop editor quality.
- Mobile and narrow viewport sanity checks where practical.

### Out of scope for the first PR

- SQL schema changes.
- RLS changes.
- Supabase Edge Function changes.
- Publish RPC changes.
- Revision storage redesign.
- Public article page redesign.
- Institute rebuild work outside article editor.
- Media library rebuild.
- SEO scoring algorithm changes.

## Workbench model

The editor should organize work by mode, not by widget.

Primary modes:

1. Write
2. Media
3. SEO and Social
4. Review
5. Publishing
6. History
7. Recovery

## Target information architecture

### Top bar

The top bar should answer:

- What article am I editing?
- What state is it in?
- What can I safely do next?

Primary actions belong here:

- Preview
- Save Draft
- Submit for Review
- Request Changes
- Approve
- Publish
- Archive
- Restore

Actions should appear based on article state and user permission.

### Main work area

The main work area should be the place where the editor is doing the current job.

Examples:

- Write mode shows title, excerpt, body, and basic editorial context.
- Media mode shows hero image, media library, embeds, and image metadata.
- SEO and Social mode shows SEO metadata, social preview, and scoring.
- Review mode shows submitted version, approval state, review notes, and requested changes.
- Publishing mode shows visibility, schedule, permalink, checklist, and final publish confirmation.
- History mode shows revision history, lifecycle timeline, compare controls, and restore actions.
- Recovery mode shows archive state, restore controls, and audit context.

### Right rail

The right rail should not carry primary workflows.

It should carry contextual guidance only:

- Current state summary.
- Small warnings.
- Helpful next step.
- Links to related surfaces.
- Lightweight metadata that does not deserve a full mode.

## PR plan

### PR 1: Workbench Shell and Navigation

Goal: create the workbench structure without changing backend behavior.

Expected changes:

- Introduce article editor workbench mode navigation.
- Move existing panels into clearer mode containers.
- Keep current publish, review, archive, restore, and revision behavior intact.
- Reduce right rail to contextual status where possible.
- Clean obvious copy issues in touched strings.

Success criteria:

- Existing save, preview, submit, approve, publish, archive, and restore actions still work.
- No SQL changes.
- No Supabase function changes.
- Build passes.
- Critical tests pass.
- Editor still loads on the test article.

### PR 2: History and Lifecycle Promotion

Goal: make history, archive, and restore feel like primary editorial powers.

Expected changes:

- Promote revision history into a full workbench surface.
- Promote lifecycle timeline into a readable editorial audit surface.
- Give archive and restore clear primary actions.
- Make compare and restore flows easier to understand.
- Add empty states and state-specific guidance.

Success criteria:

- Editors can understand what changed, who acted, and what can be restored.
- Archive and restore are easy to find.
- Revision comparison remains accurate.
- Public article stability is preserved.
- Build passes.
- Critical tests pass.

## Exit criteria

Phase 2C is complete when:

- The article editor no longer depends on the right sidebar for primary editorial work.
- Publish, review, archive, restore, revision history, and lifecycle history are visible as core workbench capabilities.
- Existing Phase 2B governance behavior still works.
- No user-facing string introduced in this phase contains an em dash.
- The test article can be edited, previewed, reviewed, published, archived, restored, and compared without console errors.

## Deployment notes

SQL migration needed: No for PR 1
Supabase Edge Function deploy needed: No
Readdy Finish update needed: Yes after frontend merge
Frontend deploy needed: Yes after frontend merge
