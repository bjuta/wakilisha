# WAKILISHA React Parity Canon

This document freezes the canon for the React rebuild.

## Purpose

- HTML `WAKILISHA-architecture-parity.html` is the canonical source for features and dispositions.
- WordPress plugin `wakilisha-v2.0.199` is the verification source.
- React repo `bjuta/wakilisha` is the current implementation source.

## Principles

1. **Registry Brain is Sacred**: Chart ingestion, entity enrichment, 77-table registry, registry search/API, user graph, auth flows, quality/governance/provenance/snapshots/stats, jobs/cron/email.
2. **Presentation & Editorial Scaffolding is Disposable**: Content Studio, `/play`, magazine/editorial templates, methodology/about/FAQ hard-coded PHP templates, surface CPTs.
3. **Unified Settings**: One structured settings framework, consolidate all fragments from WP.
4. **Phase-gated execution**: No coding before master parity matrix is built.

## Source References

- HTML bible: `WAKILISHA-architecture-parity.html` fileciteturn0file0
- WordPress plugin: `wakilisha-v2.0.199.zip` fileciteturn0file1
- Current React repo: `bjuta/wakilisha` (Vite + React + local API) fileciteturn4file0

## Next Steps

- Extract all features from HTML into a spreadsheet/table with:
  - Feature / Domain / HTML Disposition / WP Verified / React Status / Action
- Verify HTML claims against the WordPress plugin.
- Audit current React app for existing parity, missing features, template artifacts.
- Produce `master-parity-matrix.md` before any feature coding.