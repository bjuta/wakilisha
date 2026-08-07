# WordPress runtime retirement blueprint

Date: 6 August 2026

## Decision

WordPress is retired.

WAKILISHA will not retain WordPress as a runtime, migration path, source
connector, fallback, administrative surface, or future dependency.

This decision does not erase WAKILISHA content or rewrite applied migrations
and Git history.

## This checkpoint removes

- the administrative import studio
- the Media migration page
- WordPress connection and mapping services
- dedicated WordPress import package commands
- dedicated WordPress audit and migration tools
- dedicated WordPress Edge Function source
- twelve completed staging and promotion functions
- the empty raw WordPress item table
- WordPress-specific broken-route classification in analytics

## Production actions after repository acceptance

- apply migration `20260806162000_retire_wordpress_runtime.sql`
- delete the dedicated live WordPress and one-time backfill Edge Functions
- deploy the frontend without the retired routes
- verify the retired routes are absent
- verify the accepted Media graph is unchanged

## Deliberately separate data-preservation checkpoint

Thirty-seven WordPress-named columns and four matching indexes remain in the
current production schema. Some may carry historical identifiers or status
values used by canonical WAKILISHA content.

They are not a future integration contract.

They will be removed or neutralized only after exact row counts, code
dependencies, uniqueness requirements, and preservation mappings are proved.
No new WordPress-aware code may be added while that proof is prepared.

## End state

The final retirement acceptance requires:

- no live WordPress Edge Function
- no WordPress admin route or package command
- no WordPress connector or import service
- no WordPress staging or promotion function
- no WordPress raw staging table
- no WordPress-specific production schema contract
- no ordinary Media compatibility-table write
- canonical WAKILISHA content and public URLs preserved

## Completion record - 7 August 2026

The retirement is complete.

Repository closure:

- PR #579 retired the WordPress runtime and Media URL compatibility surfaces
- PR #580 removed the final stale Admin Import navigation references
- final production main is `f6800cb5`

Production completion:

- migration `20260806162000_retire_wordpress_runtime.sql` is applied
- migration `20260806184500_hard_delete_unrecoverable_guides.sql` is applied
- migration `20260806192259_media_url_cutover.sql` is applied
- all twelve retired staging and promotion database functions are absent
- the raw WordPress item table is absent
- thirteen dedicated WordPress or one-time backfill Edge Functions are absent
- retired Admin Import routes and navigation are absent from the live frontend
- frontend WordPress Media rewrite compatibility is absent
- active legacy Media URL rows are zero
- the migration ledger is current
- generated database types match production
- the final frontend is deployed from `f6800cb5`
- core public production smoke passed

Historical WordPress-named provenance columns and indexes remain intentionally
preserved under the data-preservation checkpoint described above.

They are not an active WordPress runtime contract.

Any later neutralization must be evidence-led and must not reopen WordPress as a
runtime, connector, fallback, migration path, or administrative surface.

Phase 4A closure is recorded in:

`docs/engineering/phase-4a-media-authority-closure-record.md`

## Infrastructure completion addendum - 7 August 2026

The first PR 4B infrastructure audit found two host-managed retirement residues:

- Media-origin fallback into the copied local `wp-content/uploads` tree
- an unused `/__legacy-wp-media/` proxy to the former WordPress host

Production release
`phase4a-nginx-media-retirement-20260807T091124Z` promoted 4,822 Media files
and 407,479,887 bytes into canonical `/uploads`, verified all promoted bytes by
SHA-256, overwrote zero canonical files, and preserved all canonical
collisions.

The old host proxy and Media-origin `wp-content` fallback are now removed.

The historical main-site `/wp-content/uploads/*` redirect remains because it
protects old links while resolving to canonical Media without consulting
WordPress.

The 5,717-file local mirror remains rollback evidence only.

See
`docs/engineering/phase-4a-nginx-media-runtime-retirement-acceptance-record.md`.
