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
