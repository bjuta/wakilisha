# WK100 and MIZIZI: Existing-recording candidate convergence

**Week motivating the fix:** 9–15 November 2026 EAT. **Scope:** one W4/W5 read-only integration and the shared W8 provider-namespace mapping. No source, Registry, migration, scoring or publication mutation.

## Root defect

WK100 W4 recognizes only accepted provider-object links to ACTIVE Registry Tracks, correctly protecting recording identity. It previously normalized only `apple_ke` to `apple_music`, even though Registry/Provider Identity uses `audiomack`, `mdundo`, `shazam` and `youtube`. W8 imports the same W4 mapper.

This obscured existing names without proving they were missing from the Registry. Example: **Mboka**, Audiomack #18 and YouTube #17, already has an active WAKILISHA Registry Track `4a610192-c5bf-483c-9e4b-bf715836d640` with ISRC `QZQAY2651792` and a Mejja credit. YouTube's `Mejja Genge` is a **potential credit variation**, not a verified alias or provider-to-ISRC association. Similar existing-title cases include Siaka, LAST DANCE and AYAYAAH. False-positive negative control: Freestyle by Lil Baby versus the Registry's Freestyle by Wakadinali.

## Implemented contract

- Source namespaces: explicit fail-closed five-family map: `apple_ke → apple_music`, `audiomack_ke → audiomack`, `mdundo_ke → mdundo`, `shazam_ke → shazam`, `youtube_ke → youtube`. W4 and W8 share this implementation; no invented provider IDs.
- MIZIZI candidate projection is **read-only**, scoped to exact already-selected historical receipt and currently active Registry Tracks. It considers normalized title, active canonical Artist credits and **already accepted** aliases. Full-credit, listed Artist and one-word artist-name variation are classified separately. No candidate is interpreted as an accepted provider identifier, ISRC, recording version or human-approved equivalence.
- W4/W5 Admin rows may display bounded existing-Track hints. They **do not alter** `canonicalTrackId`, `identityState`, `registryFactsSha256`, W5 eligibility, W7 scoring, W8 original-blob verification, or publisher authority. W8 itself continues to resolve only accepted exact provider links; it does not consume candidate metadata as fact.
- Queries use existing Registry tables; bounded title scope and capped result sets. Absence of artist credit, ambiguous version, missing ISRC or unrecognized artist do not create a match. Current internet/provider search APIs remain under existing approved MIZIZI intake/research governance and are not called by this request. No background research job, new secret, custom web crawler, competing identity store or separate review queue.
- A named candidate is a prompt to inspect Registry evidence and, where appropriate, use the existing signed-in `registry.track.provider_link.admit/v1` or other typed governance. It does **not** authorize any of those operations. Existing archived receipt rows remain immutable.

## Verification and launch gates

Run `node --test test/charts/wk100-identify-observations.test.mjs test/charts/wk100-eligibility-preview.test.mjs` and existing WK100 UI/type build and regression gates. Test legitimate Mboka/Siaka leads, missing source IDs, false title match, unaccepted aliases, inactive identities, all five provider namespaces, and the exact no-write/no-score/no-publish flags.

Before claiming Production completion: protected exact-head CI, review, separately managed `wk100-source-admin-read` Edge deployment, real super-admin W4+W5 browser checks on pinned 9 Nov receipts, and source/Registry postconditions. A GitHub merge alone does not deploy the Edge Function or the frontend. The founder's one-week five-original-evidence exception changes neither canonical identity admission nor ordinary subsequent-week ranking requirements. Issue #1338 remains open until the real inaugural Edition is admitted, staged and published.
