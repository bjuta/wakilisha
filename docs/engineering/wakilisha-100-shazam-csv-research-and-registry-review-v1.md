# WK100 Shazam Kenya — Research CSV, Private Archive and Registry Review v1

**Date:** 29 October 2026. **Programme:** #1264. **Status:** source-only offline acceptance candidate, **not** a live-data acquisition, Registry identity admission, Edge release or Chart Edition publication.

## Operating model — applies to the other public-data research sources

WAKILISHA researchers visit openly available source charts, download offered files such as a Shazam Kenya Top 200 CSV, and use WAKILISHA-authored tools for reliable processing and archival. This is WAKILISHA's independent, proprietary factual research workflow. Do **not** describe it as scraping by default or impose conjectural provider licensing or partnership gates. This implementation does not decide any concrete contractual dispute; it only processes CSV bytes the researcher **already acquired**, without making network requests.

**Public source used:** `https://www.shazam.com/services/charts/csv/top-200/kenya` (use the exact observed public download URL, not an invented substitute). The CLI supports this URL and the public `https://www.shazam.com/charts/top-200/kenya` page as recorded provenance. It **never** contacts either. Researchers do not need to transcribe every row manually.

## Exact CSV acquisition and retention contract

1. The researcher visits the public Shazam Kenya chart and downloads the offered CSV in their normal workflow. Record the **actual observed UTC timestamp** (not the file modification time, current clock guessed by the system, or an assumed Shazam chart week) and an internal researcher reference.
2. Pass that original local file to the offline intake below. It accepts only the documented Kenya chart/source URLs and a 4 MiB maximum byte size; calls the existing `parseShazamKenya` parser with fatal UTF-8 decoding; preserves native source ranks, title and artist as observations, **without** inventing a Shazam provider Track ID, ISRC, stream count or canonical Registry identity.
3. The tool retains the **original exact CSV bytes**, keyed by SHA-256, in a dedicated private `0700` local directory. It writes `0600` observation metadata and a private review queue. Immutable create-only writes verify byte equality on a repeated digest; a changed body is a different raw record. Reusing unchanged source bytes at different observation times keeps **one raw payload but two distinct observation receipts**; an unchanged chart is never represented as additional Shazam recognitions.
4. Every row's evidence identity is `<original_csv_sha256>:<source_rank>`. The independently observed timestamp belongs to the receipt; the provider-native start/end period remains explicitly **unknown** until supplied as independent evidence. We never relabel WAKILISHA's Monday EAT research week as the Shazam native period.
5. **Retention:** research-led, private and operator-controlled. No automatic expiry, remote upload, deletion or external publication is created. The owner retains source bytes, receipts and reviewer packets as an independent research archive; any future retention/deletion procedure requires a separate deliberate decision. No raw CSV, Registry IDs, reviewers or proprietary evidence enter public GitHub.

### Run the offline archive after an ordinary download

```bash
node scripts/charts/wk100-shazam-research-intake.mjs \
  --csv "$HOME/Downloads/<actual-downloaded-shazam-file>.csv" \
  --archive-dir "$HOME/PrivateResearch/WK100/ShazamKenya" \
  --source-url 'https://www.shazam.com/services/charts/csv/top-200/kenya' \
  --observed-at '<actual-UTC-ISO-8601-timestamp>' \
  --operator-ref '<private-researcher-reference>'
```

Replace placeholders with observed values. This is an example, **not** an instruction to use a fabricated timestamp or invent a downloaded file. No data or provider request exists just because the command is documented. The stdout receipt contains only digest/count/nonpublishing state, not song titles or archive paths.

## Non-fuzzy Shazam row -> Registry Track decision path

The public `Rank,Artist,Title` CSV lacks an immutable recording identifier, and title/artist similarity cannot prove an exact recording, remix, edit, live take or release variant. The source reader currently returns `provider_track_id: null`. **Do not fabricate Shazam track IDs**, create a parallel provider identity table, force `registry_track_provider_links` from an invented key, or write a canonical match from this intake.

The `prepareShazamRegistryReview` function instead creates **private, read-only, review proposals**. A proposed match needs all of the following, with every missing row remaining `review_required`:

- The original CSV bytes and byte-for-byte recomputed parser output; exact source SHA and row rank/title/artist, not a fuzzy match or retyped observation.
- An independently SHA-256-pinned **complete active-ISRC Registry snapshot** (`registry_tracks.id/status/isrc`), with a dated UTC snapshot time. **Only a genuine trusted read-only Registry export may receive this seal.** Supplying a file and a digest computed by the same untrusted submitter does **not** establish independent trust or completeness. Snapshot collisions on an active ISRC, missing/non-active Track, noncanonical ISRC or conflicting ISRC fail closed.
- A **separately SHA-256-pinned reviewed decision manifest** for individual source ranks, containing the exact observed title and artist, an existing canonical Track UUID and matching ISRC, one source-specific evidence reference, a distinct independently obtained recording-identity evidence reference, and two **different** named reviewers. Merely supplying strings in the manifest is **not** independent authentication; those evidence references and reviewers must be validated by WAKILISHA's accepted Registry governance before promotion.
- No two rows in one observation may claim the same canonical Track. An unreviewed row remains unresolved. The packet exposes `proposed_track_id` only as a **noncanonical proposal**, explicitly `canonical_identity_admitted:false` and `can_publish:false`.

Existing Registry authorities stay decisive: `registry_external_identifier_assertions` for identifier assertions, `platform_private.registry_review_cases` for durable ambiguity review, and governed Track/provider-link and lineage operations for canonical decisions. WAKILISHA Charts is a consumer, **not** a new Registry identity writer. Every packet must be checked again against **live Registry state and lineage** on actual approval, not blindly promoted from a stale snapshot.

The function takes `{csvBytes,evidence,registrySnapshotBytes,expectedRegistrySha256,reviewManifestBytes,expectedReviewSha256}`. Exact schemas are enforced by the implementation. This release intentionally does **not** add an API endpoint or UI that could claim an approval without authenticated Registry authority. The private snapshots, proof manifests and original bytes have not been supplied, so **zero real Shazam recording identities are admitted by this change**.

## Audit and next gates

The positive and negative tests are in `test/charts/wk100-shazam-research-evidence.test.mjs`. They cover public-source URL bounds, native parse, body size, immutable private archive, repeated same-body observations, symlink and permissions denial, exact row-hash binding, registry/reviewer seal mismatch, edited titles, ISRC conflicts, inactive Tracks, duplicate candidates and nonpublishing review-only status. These use **synthetic CSV rows and synthetic Registry IDs**, not provider data.

1. Accept this offline code with exact-head Node tests and consolidated critical-core (no hosted Actions minutes required).
2. In a separate owner-operated research session, process a **real** publicly offered CSV. Verify the private raw file, receipt, native rows and recorded provenance. No scheduled collector is needed for this.
3. Obtain a trusted Registry snapshot and governed review evidence for specific Shazam rows. Route adjudications to accepted Registry review; do **not** score unresolved rows.
4. Establish provider-native chart-period evidence when available; until then retain the unknown interval explicitly and do not claim a period-perfect national ranking.
5. Consider private candidate scoring only after real source observation, authenticated identity acceptance, independent source/period evidence, method approval and review. Edition publication remains a separate release.

**No Supabase migration, new identity table, secrets, provider polling, network fetch, Edge deployment, scheduled job, scoring activation, Chart Edition or Production mutation is part of this slice.**
