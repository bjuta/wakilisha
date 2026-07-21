# Phase 3A existing trust-surface audit

Date: 21 July 2026

## Status

Decision audit draft.

This is still audit work. It does not authorize implementation yet.

## Branch

`audit/phase-3a-trust-infrastructure`

## Phase 3A target

PR 3A builds Sources, citations, and credits once.

Required build scope:

- reusable sources
- typed source locators
- citations
- source versions
- source withdrawals
- credits
- external contributors
- Registry entity links
- inline Article citations
- public notes and source presentation

## Audit method

The first raw scan produced thousands of broad keyword hits.

That raw scan confirmed that trust-like language already appears across the repo, but most hits are not authority candidates. This reduced audit excludes generated types, CSS, build output, dependency directories, and broad documentation noise.

## Focused hit summary

- registry links: 2839 focused hit lines
- sources and citations: 1979 focused hit lines
- credits and contributors: 1506 focused hit lines
- corrections and provenance: 620 focused hit lines

## Top focused code files

- `src/pages/admin/institute/inquiry-interface/NativeInstituteInquiryInterface.tsx`: 215 focused hit lines
- `supabase/migrations/20260714230000_consolidate_final_numbered_tracks.sql`: 132 focused hit lines
- `supabase/functions/public-content-read/index.ts`: 125 focused hit lines
- `src/pages/authors/detail/page.tsx`: 106 focused hit lines
- `src/pages/admin/registry/artist-aliases/decouple/page.tsx`: 102 focused hit lines
- `src/pages/admin/institute/inquiry-interface/useWakilishaRecordSearch.ts`: 97 focused hit lines
- `src/services/publicContent/client.ts`: 92 focused hit lines
- `src/components/design-system/editorial/RichTextEditor.tsx`: 87 focused hit lines
- `src/pages/admin/institute/inquiry-interface/RelationshipsScreen.tsx`: 74 focused hit lines
- `supabase/functions/wakilisha-public-api/index.ts`: 65 focused hit lines
- `supabase/migrations/202606250001_artist_credit_decouple.sql`: 62 focused hit lines
- `src/pages/admin/registry/artist-aliases/page.tsx`: 58 focused hit lines
- `supabase/migrations/20260714220000_repair_85_track_artist_relationships.sql`: 58 focused hit lines
- `src/pages/admin/institute/inquiry-interface/WakilishaRecordWorkspace.tsx`: 55 focused hit lines
- `supabase/functions/admin-analytics-api/index.ts`: 55 focused hit lines
- `scripts/imports/resolve-wordpress-artists.ts`: 54 focused hit lines
- `supabase/functions/ingest-artist-discography/index.ts`: 52 focused hit lines
- `scripts/audit/wordpress-author-static-cutover-policy.mjs`: 52 focused hit lines
- `supabase/functions/seo-sitemap-admin/index.ts`: 51 focused hit lines
- `scripts/charts/export-wordpress-fixture.ts`: 48 focused hit lines
- `src/services/institute/inquiryService.ts`: 47 focused hit lines
- `supabase/functions/scrape-artist-data/index.ts`: 45 focused hit lines
- `supabase/migrations/_archived_duplicate_versions_20260710/202606260003_track_duplicate_repair_preview_apply.sql`: 45 focused hit lines
- `scripts/registry/phase1-shadow-schema.ts`: 43 focused hit lines
- `src/pages/admin/registry/page.tsx`: 42 focused hit lines
- `src/pages/admin/registry/authors/page.tsx`: 42 focused hit lines
- `supabase/functions/enrich-artist-discography/index.ts`: 41 focused hit lines
- `src/services/chartsScoring/scoringEngine.ts`: 38 focused hit lines
- `src/components/admin/registry/RegistryEntityEditorDrawer.tsx`: 37 focused hit lines
- `scripts/imports/stage-wordpress-database-records-clean.mjs`: 37 focused hit lines
- `scripts/imports/stage-wordpress-database-records.mjs`: 37 focused hit lines
- `scripts/audit/wordpress-cutover-decision-register.mjs`: 37 focused hit lines
- `src/components/admin/editor/FloatingImageToolbar.tsx`: 36 focused hit lines
- `supabase/migrations/202607020001_institute_inquiry_assistant_foundation.sql`: 36 focused hit lines
- `supabase/migrations/20260713203000_remove_broken_benga_blues_import.sql`: 36 focused hit lines

## Category leaders

### Sources And Citations
- `src/pages/admin/institute/inquiry-interface/NativeInstituteInquiryInterface.tsx`: 60 hit lines
- `scripts/imports/resolve-wordpress-artists.ts`: 53 hit lines
- `src/pages/admin/registry/artist-aliases/decouple/page.tsx`: 43 hit lines
- `src/pages/admin/charts/ingest/detail/components/SourcesStep.tsx`: 35 hit lines
- `src/services/chartsIngestion/api.ts`: 24 hit lines
- `supabase/functions/seo-sitemap-admin/index.ts`: 24 hit lines
- `src/services/institute/inquiryService.ts`: 22 hit lines
- `src/services/chartsScoring/scoringEngine.ts`: 22 hit lines
- `src/services/chartsIngestion/realLegacyAdapter.ts`: 22 hit lines
- `supabase/migrations/202607020001_institute_inquiry_assistant_foundation.sql`: 22 hit lines
- `src/pages/admin/registry/page.tsx`: 21 hit lines
- `src/pages/admin/registry/artist-aliases/page.tsx`: 21 hit lines

### Credits And Contributors
- `src/pages/authors/detail/page.tsx`: 106 hit lines
- `src/components/design-system/editorial/RichTextEditor.tsx`: 86 hit lines
- `src/pages/admin/institute/inquiry-interface/NativeInstituteInquiryInterface.tsx`: 44 hit lines
- `src/pages/admin/institute/inquiry-interface/useWakilishaRecordSearch.ts`: 44 hit lines
- `src/components/admin/editor/FloatingImageToolbar.tsx`: 36 hit lines
- `src/pages/admin/registry/authors/page.tsx`: 35 hit lines
- `scripts/audit/wordpress-author-static-cutover-policy.mjs`: 35 hit lines
- `src/pages/authors/detail/components/AuthorOwnerBar.tsx`: 33 hit lines
- `src/pages/about/page.tsx`: 27 hit lines
- `supabase/functions/wakilisha-public-api/index.ts`: 26 hit lines
- `src/pages/admin/content/articles/detail/ArticleEditorWorkspace.tsx`: 25 hit lines
- `supabase/functions/public-content-read/index.ts`: 25 hit lines

### Corrections And Provenance
- `src/pages/admin/institute/inquiry-interface/NativeInstituteInquiryInterface.tsx`: 87 hit lines
- `supabase/functions/admin-analytics-api/index.ts`: 21 hit lines
- `src/pages/admin/institute/inquiry-interface/RelationshipsScreen.tsx`: 17 hit lines
- `src/pages/admin/institute/inquiry-interface/InstituteClaimsWorkspace.tsx`: 16 hit lines
- `src/pages/admin/institute/inquiry-interface/WakilishaRecordWorkspace.tsx`: 16 hit lines
- `supabase/functions/institute-assistant/jobs.ts`: 16 hit lines
- `src/services/institute/inquiryService.ts`: 15 hit lines
- `src/services/chartsScoring/scoringEngine.ts`: 15 hit lines
- `src/services/chartsScoring/airplayEngine.ts`: 15 hit lines
- `scripts/audit/wordpress-cutover-readiness-gate.mjs`: 13 hit lines
- `src/pages/admin/relationships/viewer/RelationshipReviewDrawer.tsx`: 12 hit lines
- `src/services/chartsScoring/scoringPipeline.ts`: 12 hit lines

### Registry Links
- `supabase/migrations/20260714230000_consolidate_final_numbered_tracks.sql`: 127 hit lines
- `supabase/functions/public-content-read/index.ts`: 100 hit lines
- `src/services/publicContent/client.ts`: 85 hit lines
- `supabase/migrations/202606250001_artist_credit_decouple.sql`: 56 hit lines
- `supabase/migrations/20260714220000_repair_85_track_artist_relationships.sql`: 51 hit lines
- `supabase/migrations/_archived_duplicate_versions_20260710/202606260003_track_duplicate_repair_preview_apply.sql`: 45 hit lines
- `src/pages/admin/institute/inquiry-interface/RelationshipsScreen.tsx`: 41 hit lines
- `supabase/functions/wakilisha-public-api/index.ts`: 39 hit lines
- `supabase/functions/ingest-artist-discography/index.ts`: 38 hit lines
- `scripts/charts/export-wordpress-fixture.ts`: 37 hit lines
- `src/pages/admin/registry/artist-aliases/decouple/page.tsx`: 36 hit lines
- `scripts/registry/phase1-shadow-schema.ts`: 35 hit lines


## Existing focused surfaces

### Article authority surfaces

Evidence:

- `src/pages/admin/content/articles/detail/ArticleEditorWorkspace.tsx`: 35 focused hit lines
- `src/pages/admin/content/articles/detail/components/ArticleMetaPanel.tsx`: 28 focused hit lines
- `src/services/articles/articleAdminService.ts`: 24 focused hit lines

Initial classification:

- Article is the first adoption target for PR 3A.
- Article lifecycle is closed and must not be reopened.
- Inline Article citations should attach to Article resource identity and immutable versions.
- Existing Article author, byline, and review data should be treated as migration input, not the final shared credit authority.

Phase 3A action:

- Design trust attachment around Article resources and Article versions.
- Preserve public snapshot stability.
- Do not add a second Article evidence authority.

### Author, byline, and contributor surfaces

Evidence:

- `src/pages/authors/detail/page.tsx`: 106 focused hit lines
- `src/pages/authors/detail/components/AuthorOwnerBar.tsx`: 33 focused hit lines
- `src/pages/admin/registry/authors/page.tsx`: 42 focused hit lines

Initial classification:

- Existing author and byline concepts are public and administrative presentation surfaces.
- They are not enough to model all credits.
- PR 3A needs a credit model that can represent authenticated users, Registry authors, and named external contributors.

Phase 3A action:

- Inventory author profile fields before migration.
- Keep display byline separate from structured credit authority.
- Avoid collapsing user, Registry author, and external contributor into one premature person table.

### Chart source-like surfaces

Evidence:

- `src/pages/admin/charts/ingest/detail/components/SourcesStep.tsx`: 35 focused hit lines

Initial classification:

- Chart ingestion already has source-like workflow language.
- This is useful evidence for PR 3A design.
- It should not become the global source authority by itself.

Phase 3A action:

- Treat chart source intake as an adopter of shared Sources later.
- Preserve Chart authority over chart methodology and ingestion.
- Do not move Chart work into Article-specific source tables.

### Legacy Institute and inquiry surfaces

Evidence:

- `src/pages/admin/institute/inquiry-interface/NativeInstituteInquiryInterface.tsx`: 215 focused hit lines
- `src/pages/admin/institute/inquiry-interface/RelationshipsScreen.tsx`: 74 focused hit lines
- `src/pages/admin/institute/inquiry-interface/useWakilishaRecordSearch.ts`: 97 focused hit lines

Initial classification:

- Legacy Institute surfaces contain evidence-like and relationship-like concepts.
- Phase 3A must not rebuild the Institute or make it the trust authority.
- Useful interaction patterns can inform later Inquiry Mode, but not PR 3A schema ownership.

Phase 3A action:

- Mark legacy Institute evidence concepts as reference only.
- Do not migrate Institute-specific evidence into shared trust without a reviewed mapping.
- Keep PR 3A anchored in shared resource identity.

### Registry relationship surfaces

Evidence:

- `src/pages/admin/registry/artist-aliases/page.tsx`: 58 focused hit lines
- `src/pages/admin/registry/artist-aliases/decouple/page.tsx`: 102 focused hit lines
- `src/pages/admin/registry/artists/page.tsx`: 26 focused hit lines
- `src/pages/admin/registry/page.tsx`: 42 focused hit lines

Initial classification:

- Registry records and relationships are domain facts.
- Some Registry links will become trust relationships when they support a source, citation, credit, correction, or provenance claim.
- Ordinary related entities should remain content relationships.

Phase 3A action:

- Separate ordinary Registry relationship from trust relationship.
- Add source and credit links to Registry entities only when they support a trust claim.
- Keep Registry authoritative for Registry facts.

### Public read and API presentation surfaces

Evidence:

- `supabase/functions/public-content-read/index.ts`: 125 focused hit lines
- `supabase/functions/wakilisha-public-api/index.ts`: 65 focused hit lines

Initial classification:

- Public functions are consumers and presenters.
- They should not become the source, citation, or credit authority.
- Public notes and source presentation need a stable read contract once trust authority exists.

Phase 3A action:

- Define read output after write authority is clear.
- Keep sensitive or private source material out of public read responses by default.
- Expose only reviewed and public-safe trust data.

## Migration evidence

Focused migration files with trust-like terms:

- `supabase/migrations/20260714230000_consolidate_final_numbered_tracks.sql`: 132 focused terms
- `supabase/migrations/202606250001_artist_credit_decouple.sql`: 74 focused terms
- `supabase/migrations/20260714220000_repair_85_track_artist_relationships.sql`: 72 focused terms
- `supabase/migrations/202606060001_auth_phase1_roles_scopes.sql`: 65 focused terms
- `supabase/migrations/20260714190000_canonicalize_remaining_numbered_tracks.sql`: 41 focused terms
- `supabase/migrations/20260713203000_remove_broken_benga_blues_import.sql`: 39 focused terms
- `supabase/migrations/202607020001_institute_inquiry_assistant_foundation.sql`: 37 focused terms
- `supabase/migrations/20260714173000_consolidate_wanavokali_tequila.sql`: 37 focused terms
- `supabase/migrations/202607040001_curated_genre_source_of_truth.sql`: 34 focused terms
- `supabase/migrations/202606250007_safe_artist_alias_merge_preview.sql`: 33 focused terms
- `supabase/migrations/202606250013_align_decouple_preview_source_links.sql`: 27 focused terms
- `supabase/migrations/20260715173634_phase_2a_durable_article_versions.sql`: 25 focused terms
- `supabase/migrations/202606250006_apply_chart_artist_resolution_decisions.sql`: 24 focused terms
- `supabase/migrations/202606260002_track_duplicate_audit.sql`: 22 focused terms
- `supabase/migrations/202607040003_backfill_curated_artist_genres.sql`: 22 focused terms
- `supabase/migrations/20260715054810_phase_1a_resource_identity_foundation.sql`: 21 focused terms
- `supabase/migrations/202606250011_allow_archived_decouple_preview_sources.sql`: 21 focused terms
- `supabase/migrations/20260714203000_delete_rhumba_mali_safi_for_reingest.sql`: 21 focused terms
- `supabase/migrations/20260711150836_registry_accept_missing_artist_intake_rpc.sql`: 20 focused terms
- `supabase/migrations/20260716194500_phase_2b_article_lifecycle.sql`: 20 focused terms
- `supabase/migrations/202606240019_registry_artist_manual_merge.sql`: 20 focused terms
- `supabase/migrations/202606250010_artist_decouple_decisions.sql`: 19 focused terms
- `supabase/migrations/20260711133829_registry_entity_relationship_creation_rpc.sql`: 17 focused terms
- `supabase/migrations/202606240004_provider_link_schema.sql`: 16 focused terms
- `supabase/migrations/202607040002_canonical_genre_aliases.sql`: 15 focused terms
- `supabase/migrations/20260711120640_registry_relationship_foundation.sql`: 14 focused terms
- `supabase/migrations/20260711134904_resolve_registry_relationship_endpoint_rpc.sql`: 14 focused terms
- `supabase/migrations/202606250008_fix_safe_artist_merge_alias_timestamp.sql`: 14 focused terms
- `supabase/migrations/20260711170303_registry_complete_relationship_review_compact.sql`: 12 focused terms
- `supabase/migrations/20260712223000_fix_safe_numbered_track_slugs.sql`: 12 focused terms

Initial classification:

- Existing migrations prove related concepts exist in resource, relationship, Article, Registry, and lifecycle work.
- They do not yet prove a complete shared source, citation, and credit authority.
- PR 3A likely needs new schema, but only after final model review.

## Authority decisions for PR 3A

### Decision 1: Source authority

A Source should be a reusable trust record, not a field inside Article, Chart, Registry, or Institute.

Working direction:

- source records live in the shared trust layer
- source versions preserve important source metadata over time
- source withdrawal is recorded without deleting historical citations
- public visibility is explicit and reviewed

Open review question:

- exact schema name and table names

### Decision 2: Citation authority

A Citation should attach a resource or resource version to a source version and a typed locator.

Working direction:

- locators support page, paragraph, quote, timestamp, chapter, frame, row, cell, transcript range, section heading, and whole source
- citation display can change without changing citation identity
- citations can target Article text first and later Playlist notes, Registry changes, Chart methodology, Audio transcripts, Video transcripts, and Inquiry Findings

Open review question:

- whether inline Article citations need span anchors in PR 3A or can start with block-level anchors

### Decision 3: Credit authority

A Credit should be a structured role assignment on a resource or resource version.

Working direction:

- a credit can point to an authenticated user
- a credit can point to a Registry author
- a credit can store a named external contributor
- display byline remains a presentation choice
- structured credits should survive public design changes

Open review question:

- which credit roles are required in PR 3A versus later phases

### Decision 4: Registry links

Registry links become trust links only when they support a trust claim.

Working direction:

- ordinary related artists, tracks, releases, labels, genres, and authors remain domain relationships
- trust links connect sources, citations, credits, corrections, and provenance to Registry entities
- Registry remains authoritative for Registry facts

Open review question:

- whether PR 3A needs a general trust-to-Registry join table or specific joins per trust object

### Decision 5: Public presentation

Public notes, citations, sources, and credits should expose only reviewed public-safe data.

Working direction:

- private sources can support internal review without appearing publicly
- source notes can be public while full source material remains private
- public pages should distinguish source list, citation locator, credit, and provenance

Open review question:

- first Article public presentation pattern for inline citations and source notes

## PR 3A acceptance path

The narrow proof path should be:

1. create one reusable Source
2. attach one citation to an Article
3. attach structured credits to the same Article
4. reuse the same Source for a Registry change or Registry review note
5. prove the model can later target a Playlist note without schema replacement
6. render reviewed public notes and credits safely on one Article page
7. prove citation identity remains stable if display formatting changes

## What PR 3A must not do

- do not rebuild Article lifecycle
- do not build Playlist authority
- do not build Audio authority
- do not build Video authority
- do not redesign Media authority
- do not start Field Capture
- do not start Inquiry Mode
- do not replace public-content-read
- do not create an Institute-only evidence system
- do not expose private source material publicly by default

## Required next step

Prepare the PR 3A implementation design from this audit.

The design must define:

1. schema ownership
2. source tables
3. citation tables
4. credit tables
5. source visibility and withdrawal rules
6. citation locator contract
7. credit role contract
8. permission boundary
9. public-safe read contract
10. one Article proof path
11. one Registry reuse proof path
12. migration strategy for useful existing author and byline data
