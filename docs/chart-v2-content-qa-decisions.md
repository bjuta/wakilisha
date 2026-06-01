# WAKILISHA Chart V2 Content QA Decisions

This file records the content QA decisions required before WAKILISHA moves from V2 preview/dry-run planning into any real database insert or API cutover.

The goal is to protect existing chart history. The current chart dataset is valid for migration from an infrastructure perspective, but it has editorial/content warnings that should be explicitly reviewed rather than silently ignored.

## Current migration state

Latest verified state:

- Migration readiness: `ready_with_warnings`
- Blockers: `0`
- Warnings: `2`
- Families: `4`
- Series: `4`
- Markets: `1`
- Programs: `4`
- Editions: `78`
- Entries: `6,332`
- Aliases: `10`

Current warnings:

1. One empty edition.
2. Repeated top-10 signatures across some editions.

These are not migration blockers. They are content QA decisions.

## Decision principles

1. Do not mutate source content during infrastructure migration.
2. Preserve imported chart history exactly unless there is a documented correction.
3. Treat suspicious chart data as a review item, not an automatic deletion.
4. Keep public routes and public JSON stable until the V2 API is proven equivalent.
5. Any exclusion from public display must be reversible and documented.
6. Any correction after publication must use correction records, not silent edits.

## QA-001: Empty edition

### Finding

The V2 preview flags one empty edition:

- Family: `gengetone`
- Edition: `gengetone-2026-03-28`
- Edition ID: `10`
- Entry count: `0`

### Risk

An empty edition can create confusing public archive behavior if displayed like a normal chart edition. It can also distort edition counts if it is treated as a published historical chart.

### Decision

Keep the edition in source/V2 migration data for provenance, but do not treat it as a normal published chart edition in public archive UI unless editorial review confirms it was intentionally published empty.

### V2 migration handling

- Migrate the edition into V2 as a preserved edition record.
- Preserve source edition ID, slug, family, and date.
- Set/keep entry count as `0`.
- Mark it for content QA review.
- Do not generate fake entries.
- Do not delete it from source JSON or source CSV history.

### Public display handling

Until editorial review is complete:

- Exclude it from prominent public archive cards where possible.
- If it must appear, display an explicit empty-state message such as: `No chart entries are available for this edition.`
- Do not show it as a normal chart with missing rows.

### Recommended future field

When V2 status semantics are expanded, classify this as one of:

- `draft`
- `placeholder`
- `archived_empty`
- `needs_review`

Final status should be decided after checking the original WordPress/source context.

## QA-002: Repeated top-10 signatures

### Finding

The verifier and V2 preview flag repeated top-10 signatures across several editions. Current known pairs include:

- `2026`: `2026-2026-02-02` and `2026-2026-01-26`
- `2026`: `2026-2026-03-23` and `2026-2026-03-30`
- `gengetone`: `gengetone-2026-01-12` and `gengetone-2026-01-19`
- `gengetone`: `gengetone-2026-02-09` and `gengetone-2026-02-16`
- `kenya`: `kenya-2026-01-05` and `kenya-2026-01-12`
- `kenya`: `kenya-2026-04-20` and `kenya-2026-04-27`

The preview also reports this as 12 affected repeated-edition instances.

### Risk

Repeated top-10 signatures can mean either:

- the source data is genuinely stable across editions, or
- an edition was duplicated/stale during ingestion, or
- a chart was republished without updated source data.

It should not be treated as a schema failure.

### Decision

Do not block migration. Preserve repeated top-10 editions exactly as imported, but flag them for editorial/source review before any public claim that the V2 system is the authoritative historical record.

### V2 migration handling

- Migrate affected editions and entries unchanged.
- Preserve source provenance and source file paths.
- Do not deduplicate or collapse editions automatically.
- Do not alter rank order.
- Do not infer a correction without human review.

### Public display handling

- Continue showing the editions if they have entries.
- Do not show a public warning by default.
- Keep the repeated-signature warning internal until confirmed as an error.

### Editorial review checklist

For each repeated pair:

1. Check whether both editions existed in the original WordPress/source data.
2. Confirm whether publication dates and edition slugs are distinct.
3. Confirm whether the lower chart positions differ even if top 10 is identical.
4. Confirm whether the chart category is slow-moving enough for repetition to be plausible.
5. If duplication is confirmed, create a correction record rather than deleting history.

## Migration readiness decision

The dataset is allowed to proceed to the next backend step because there are no migration blockers.

Approved next step:

- Build a real insert executor only after adding an explicit operator confirmation gate.

Not yet approved:

- Running actual database inserts automatically.
- Replacing public JSON with V2 API responses.
- Deleting or mutating the empty edition.
- Deduplicating repeated top-10 editions.

## Next backend step

The next non-UI patch should be a guarded V2 insert executor scaffold.

It should:

- require an explicit environment flag such as `WAKILISHA_ALLOW_V2_DB_WRITES=1`
- default to dry-run mode
- verify the latest preview has `blockerCount: 0`
- verify the insert plan counts match expected counts
- write an execution report
- support transaction rollback on failure
- avoid running in production unless explicitly configured

## Current decision summary

| Finding | Severity | Migration decision | Public decision | Follow-up |
| --- | --- | --- | --- | --- |
| Empty `gengetone-2026-03-28` edition | Warning | Preserve in V2 | Hide or show explicit empty state until reviewed | Check source context |
| Repeated top-10 signatures | Warning | Preserve unchanged | No public warning by default | Editorial/source review |

## Final note

The purpose of V2 is to make WAKILISHA's chart history more durable, explainable, and scalable. The migration must improve infrastructure without damaging cultural memory. Content preservation comes before schema cleanliness.
