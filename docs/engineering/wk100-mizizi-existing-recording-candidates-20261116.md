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


## African-first Registry; all-origin Kenyan chart (16 November 2026)

**Founder decision:** A Kenyan audience chart measures observed listening and
discovery irrespective of the performer's origin. It must never become a mass
Registry import. Retiring an origin filter for chart participation is **not**
authority to create an Artist, Track, Release, ISRC assertion or provider link.

The canonical Registry prioritizes African musical and cultural participation.
A non-African performer can be relevant to the Registry through a documented
collaboration with an African performer, including either lead/featured
direction. Inclusion is limited to the evidenced work, relationships and
contributor identity necessary to describe it correctly. It does not authorize
importing an entire unrelated international discography. Nationality, country
of residence, artist name similarity or a Kenya chart position alone is never
sufficient evidence. Unknown origin or collaboration is a review state, not
automatic exclusion from chart observation or automatic canonical inclusion.

### Existing source and identity lanes

- **WK100 source evidence:** Immutable rank/metric, exact bytes,
  provider-native identifier when present, Kenya period and source admission.
  All origins remain observable.
- **Chart-scoped reference:** An exact provider namespace/native-ID hash,
  with prefix wk100:source:v1:, stable across that provider's repeated daily
  observations. This is an opaque source observation key, not a canonical
  recording UUID. Two providers' matching titles or Artist labels cannot
  be conflated. If a native ID is genuinely missing, the existing exact
  receipt-local wk100:obs:v1: reference survives and cannot claim independent
  provider corroboration.
- **Registry identity:** Only reviewed exact links to current active canonical
  Tracks, plus typed MIZIZI human-granted operations. Existing international
  records, if any, are not implicitly deleted or rewritten.
- **Chart participation:** Requires source period/depth and method
  qualification, frozen chart eligibility, independently reviewed recording
  equivalence where cross-provider grouping is claimed, and governed
  publication authority. No source-scoped ref alone authorizes a public entry.

### Inert source-only implementation under this issue

The pure W4 reference helper and private W8 mathematical kernel now recognize
source-scoped and receipt-scoped references. The kernel validates namespace,
receipt SHA for local observation refs, rank continuity and repeated Apple
daily identity without manufacturing a cross-provider match. Existing source
tests exercise stable native IDs, mixed canonical/noncanonical scoring,
cross-provider forgery rejection and private nonpublication.

**Private W8 attestation now integrates the chart-only lane:** After exact
original-byte replay, current source-method authorization and authenticated
saved W5 configuration are verified, a separate fail-closed predicate checks
whether the frozen policy is genuinely origin-unrestricted and imposes no
unverifiable metadata restrictions. The existing W5 Registry review verdict
is preserved; chart-only participation uses a verified native or receipt-local
reference instead of manufacturing a Registry UUID. Known EXCLUDED,
CONFLICTED or inactive identities remain held. The default released W8 bridge
does not stage or publish anything. A focused synthetic integration test
proves private scoring under the 9 Nov all-origin profile shape while the
narrower prior profile remains restrictive.

**Not implemented by this slice:** Independent human-reviewed equivalence
for the *same recording across different providers* remains required before
one published ranking aggregates those providers. A shared title or Artist
label must never count as matching evidence. The governed publisher's current
identity contract and public display projection must be reviewed for nullable
canonical Track IDs and chart-scoped references, without rewriting historical
observations, reweighting absent sources or bypassing source authorization.
Existing W5 Registry policy outcome remains intact; the new chart-only
predicate is private W8 scoring input only. No automatic Registry admission,
SQL migration, Production Edge deployment or public WK100 Edition is
authorized by this source branch.

**Future integrated acceptance:** An international-only hit contributes to
a private ranked candidate while canonical_track_id stays null. African-led
and international-led collaborations preserve exact credited Artists and
evidence-based Registry context. Ambiguous or conflicting identities remain
unresolved without false corroboration. Protected CI and real signed-in
readback are necessary before any proposed Edition publication.
