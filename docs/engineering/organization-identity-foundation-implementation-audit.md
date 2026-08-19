# Organization Identity Foundation + WAKILISHA Institutional Article Attribution

Date: 19 August 2026

## Status

Implementation boundary for the first Organization slice.

## Product decisions

- `/organizations/:slug` is the canonical institutional public identity namespace.
- Organization is durable identity authority, not the organization-type taxonomy.
- Institutional types remain explicit and many-to-many.
- Domain authorities remain typed and separate.
- `registry_labels` remains Registry Label authority.
- Organization may pair to Registry Label through a typed link without replacing the label row.
- WAKILISHA is the first canonical Organization.
- `Wakilisha Staff` remains the Article byline/display snapshot, not an Organization name and not a Person.
- The 73 exact current public Staff Articles receive Author Credit to WAKILISHA.
- Historical Article byline snapshots remain unchanged.
- The accepted 134 named-human Article Person paths remain unchanged.

## Production boundary

- Current public Staff Articles: 73.
- All 73 current published Article versions carry `author_display = Wakilisha Staff`.
- Existing Staff Author Credits: 0.
- Existing Staff Credit attachments: 0.
- Locked current Staff manifest SHA-256:
  `eda3b2b8708a10416004bc12bdef28c42a0944e9a5f848305aa8c7b7c78f7067`.
- Existing Registry Labels: 232.
- No Organization or Institution table exists before this migration.
- Shared Credit currently supports human parties only.

## Foundation schema

- Resource kind `organization`.
- Typed `editorial.organizations`.
- Controlled `editorial.organization_types`.
- Many-to-many `editorial.organization_type_assignments`.
- Typed Registry Label pairing via `editorial.organization_registry_label_links`.
- Shared Credit gains typed `organization_resource_id`.
- Existing exactly-one-party invariant expands from three human paths to four typed credited-party paths.

## First canonical Organization

WAKILISHA:
- canonical route `/organizations/wakilisha`;
- primary type `cultural_platform`;
- secondary type `publication`;
- public website `https://wakilisha.africa`.

No description, logo, cover, or location copy is invented by the migration.

## Staff Article attribution

One public-safe Author Credit is attached to the exact current published version of each of the 73 locked Staff Articles.

Credit identity:
- credited Organization: WAKILISHA;
- credit role: Author;
- Credit display snapshot: `WAKILISHA`;
- Article legacy/display byline: `Wakilisha Staff`.

The migration does not rewrite `wk_articles.author` or `article_versions.author_display`.

## Public reads

- `public.get_public_organization(text)`
- `public.list_public_article_author_organization_paths(text)`
- `public.list_public_organization_work(uuid, integer, timestamptz, uuid)`

The public Article Edge/frontend wiring is intentionally deferred until preview authority is proven.

## Explicit non-goals

- no Registry Label backfill;
- no Festival/Country domain table;
- no Organization merge command yet;
- no Organization Follow yet;
- no Organization claim flow;
- no Person changes;
- no historical Article rewrite;
- no frontend deployment in the foundation candidate.

