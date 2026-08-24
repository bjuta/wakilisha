# WAKILISHA Charts Public-Source Accessibility Soak

Status: **WIP / PENDING 7-DAY DURABILITY PROOF**

Status date: 24 August 2026

This record preserves the current state of the Kenya-first public-source chart research so later work does not accidentally restart the investigation from first principles.

This is adjacent engineering/product research. It is **not** a Phase 6B M3 contract and does not advance the numbered programme.

## Research question

Can WAKILISHA operate a long-lived, corroboratable Kenya music chart without privileged DSP data relationships by using ordinary public or developer-accessible evidence sources, while surviving the loss of any one source?

The required system properties are:

- Kenya-specific evidence first
- no commercial data-sharing relationship required for core operation
- multiple independent source operators
- source failure must degrade coverage rather than stop publication
- raw observations must be replayable and auditable
- provider genre labels must not become WAKILISHA genre authority
- existing WAKILISHA Charts, Registry, ingestion, scoring, matching, audit, and publication infrastructure should be reused rather than rebuilt

## Current conclusion

**Feasibility is strongly positive. Durability is still under test.**

Two empirical access probes from a normal Kenyan connection established that multiple first-party Kenya-specific music surfaces can be fetched without privileged commercial access.

The remaining gate before a final source-qualification decision is a seven-day unattended soak measuring source reliability, schema stability, depth stability, response changes, and access failures over time.

Do not treat a one-off successful fetch as final source qualification.

## Empirical source-access evidence

### Probe 1: broad accessibility probe

Run date: 24 August 2026

Report bundle SHA-256:

`ecc2d95c72539b171189ed7eb07faf265a7731b2ceef0dfabcca94edbee0fc9e`

Important findings:

- Apple Marketing Tools Kenya Top 100 returned 100 rows repeatedly with HTTP 200 and required no local developer credential.
- YouTube Charts Kenya public web surface returned HTTP 200 repeatedly.
- Mdundo Kenya chart surfaces returned HTTP 200 repeatedly.
- Audiomack Weekly 100 Kenya returned HTTP 200 repeatedly.
- Boomplay public chart routes were reachable and exposed Kenya chart identities.
- Radio Browser returned Kenyan station candidates and public radio streams were technically reachable.
- Radio ICY metadata alone was not reliable enough to become WAKILISHA airplay authority. A future airplay leg should use a curated station registry plus fingerprinting and/or station-specific now-playing adapters.
- Spotify and Apple developer credentials were not present in the local shell during this probe. That was recorded as a local credential absence, not as proof that production credentials do not exist.

### Probe 2: gap-closure probe

Run date: 24 August 2026

Report bundle SHA-256:

`47001f3487b0768bd4c241cc848acecd24e1badd9a0fc2d852b008ceb776af7d`

Corrected findings:

- Apple: 100 Kenya rows, first-party, no auth.
- YouTube: keyless public Charts backend returned 100 Kenya tracks with structured chart data.
- Mdundo: first-party Kenya chart exposed 100 structured rows.
- Audiomack: first-party Weekly 100 Kenya page embedded 100 song objects.
- Boomplay: first-party Kenya chart playlist surfaces returned Top 100, Daily 100, Top New Songs, Daily Rising, and Monthly 100 data surfaces.
- Shazam: Kenya Top 200 CSV returned successfully when using the public mobile-client header profile expected by the service. The returned chart contained 200 ranked rows.
- Spotify `regional-ke-weekly/latest.csv` returned an HTML shell rather than a proved public CSV dataset. Spotify therefore remains optional/non-core until a sustainable measurement surface is independently proved.
- No privileged WAKILISHA commercial source relationship was required for the successful Apple, YouTube, Mdundo, Audiomack, Boomplay, or Shazam probes.

## Current source picture

### On-demand / platform consumption

Currently promising or proved-access sources:

- Apple
- Mdundo
- Audiomack
- Boomplay

### Active discovery / identification intent

Currently promising or proved-access source:

- Shazam

### Video / UGC consumption

Currently promising or proved-access source:

- YouTube Charts

### Optional redundancy

- Spotify remains useful where ordinary access remains available, but the design must not require it.

### Future airplay leg

Transport feasibility is proved, but song identification quality is not.

Preferred direction:

1. curate a trusted Kenyan station registry,
2. observe public internet streams and, later, terrestrial FM where useful,
3. fingerprint audio or use trusted station-specific now-playing feeds,
4. write evidence into the existing `wk_chart_airplay_stations` and `wk_chart_airplay_evidence` authority.

Do not treat Radio Browser geography or raw ICY metadata as sufficient measurement authority by itself.

## Existing WAKILISHA infrastructure that should be reused

Production already contains the major chart-ingestion primitives required for this work.

Read-only production audit on 24 August 2026 found:

- 21 chart ingest runs
- 35 run-source rows
- 10,216 raw source observations
- 9,579 candidates
- 7,799 candidate-score rows
- 3,203 exclusions
- 39 audit events
- 441 stage events

The existing ingestion authority already stores source-level operational evidence including:

- provider
- source type and URL
- storefront/market
- provider source identity
- fetch status
- HTTP status
- `Retry-After`
- rate-limit bucket
- raw response hash
- raw payload reference
- fetched, normalized, and dropped counts
- warnings and error details

The existing candidate/scoring authority already stores:

- normalized identity
- provider IDs
- ISRC / UPC where available
- source count
- occurrence count
- source URLs seen
- source score
- cross-source bonus
- overlap bonus
- recency score
- continuity score
- carry-forward bonus
- airplay score
- anti-gaming penalty
- final score
- score-integrity evidence

The existing scoring runner uses scoring policy `1.0.1` and already models cross-source corroboration, repeated occurrence, recency, continuity, carry-forward, airplay, and anti-gaming.

The architecture should therefore be extended with qualified source adapters and corrected evidence plumbing rather than replaced with a new chart engine.

## Known scoring-plumbing defect to repair after source qualification

A read-only production audit found that raw observations can show the same recording across several source records, including cases where the same ISRC appears across Spotify and Apple, while downstream candidates still report `source_count = 1`.

This prevents the existing cross-source corroboration formula from receiving the evidence count it was designed to score.

The likely repair is to preserve independent observation-source identity through normalization/candidate aggregation instead of deriving corroboration only from track/external URLs.

Do not redesign the scoring formula to work around this defect. Repair the evidence plumbing first, then replay the existing policy against the richer source network before considering a methodology version change.

## Genre authority

Provider genre classifications remain non-authoritative source metadata.

Production Registry currently contains:

- 45 canonical genres
- 36 genre aliases
- 476 artist-genre relationships

Track/release genre authority can be extended where needed, but Spotify, Apple, Boomplay, Mdundo, Audiomack, YouTube, or Shazam genre labels must not silently decide WAKILISHA chart eligibility.

## Seven-day durability soak

### Status

**RUNNING**

Started:

- UTC: `2026-08-24T13:52:43Z`
- Africa/Nairobi: 24 August 2026 at 16:52:43 EAT

Local LaunchAgent label:

`africa.wakilisha.chart-source-soak`

Cadence:

- every 6 hours
- target window: 7 days
- expected ideal capture count: at least 28 observations per source

Sources under soak:

- Apple
- YouTube
- Mdundo
- Audiomack
- Boomplay
- Shazam

First captured observation:

| Source | HTTP | Parse | Depth |
| --- | ---: | --- | ---: |
| Apple | 200 | pass | 100 |
| YouTube | 200 | pass | 100 |
| Mdundo | 200 | pass | 100 |
| Audiomack | 200 | pass | 100 |
| Boomplay | 200 | pass | 100 |
| Shazam | 200 | pass | 200 |

The first run wrote one local capture successfully, returned launchd exit code `0`, and produced no stderr output.

### Expected completion window

The seven-day window should complete after approximately:

- UTC: `2026-08-31T13:52:43Z`
- Africa/Nairobi: 31 August 2026 after 16:52:43 EAT

The local runner is configured to package a final `wakilisha-chart-source-soak-<timestamp>.zip` report after the seven-day window and then stop making source requests.

A Mac shutdown or prolonged unavailability may reduce the ideal 28-run count. Final qualification should judge calendar coverage and observed reliability, not treat 28 as an arbitrary magic threshold.

## Final soak audit questions

When the seven-day bundle is available, the next analysis must answer at minimum:

1. What was each source's successful-fetch and successful-parse rate?
2. Did any source return 401, 403, 405, 429, or meaningful `Retry-After` behavior?
3. Did chart depth remain stable enough for weekly national-chart use?
4. Did response schema remain stable?
5. Did payload hashes and chart content change when the underlying charts updated?
6. Which sources qualify as core, supplementary, discovery-only, or rejected?
7. Which sources are genuinely independent measurements versus mirrors or correlated views of the same underlying behavior?
8. Does the source portfolio still support a credible chart when any one source is removed?
9. Does it still support publication when Spotify is absent?
10. What existing ingestion adapters/tables can be reused unchanged, and what adapter work is actually required?
11. What exact repair is required so `source_count` represents independent observations correctly?
12. How should source-health and source-coverage evidence be surfaced in immutable Chart Editions and public methodology records?

## Do not forget / do not prematurely close

Until the seven-day evidence bundle is analyzed:

- keep this work item **WIP**
- do not call Apple, YouTube, Mdundo, Audiomack, Boomplay, or Shazam permanently qualified core sources from a one-day probe alone
- do not redesign the chart scoring formula
- do not replace WAKILISHA genre authority with provider genres
- do not rebuild chart ingestion infrastructure that already exists
- do not make Spotify a required dependency
- do not promote raw radio metadata into airplay authority

## Closure condition

This WIP can close only when the seven-day soak report has been analyzed and a final source-accessibility decision records:

- source qualification grades
- single-source-loss degradation behavior
- required evidence-plumbing repairs
- reusable existing infrastructure
- remaining adapter work
- any source explicitly rejected as too brittle or too privileged
- the recommended Kenya chart source constitution for the next implementation slice

At that point the result should be recorded as a Green / Amber / Red viability decision rather than left as informal research.