# WAKILISHA Charts Public-Source Accessibility Soak

Status: **WIP / PENDING 7-DAY DURABILITY PROOF**

Status date: 3 September 2026

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

The first soak attempt was invalidated on 3 September 2026 after a controller time-unit defect was proved. That attempt captured only two observations across 6.77 hours before falsely finalizing. A clean, separately named second attempt is now running from a repaired and preflighted controller.

Do not treat a one-off successful fetch, the invalid first soak attempt, or the first observation of attempt 2 as final source qualification.

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

**ATTEMPT 2 RUNNING / ATTEMPT 1 INVALIDATED**

### Attempt 1: invalid durability proof

Attempt 1 started at:

- UTC: `2026-08-24T13:52:43Z`
- Africa/Nairobi: 24 August 2026 at 16:52:43 EAT

It used LaunchAgent label:

`africa.wakilisha.chart-source-soak`

The intended cadence was every 6 hours for 7 days. The controller captured only two runs:

- first capture: `2026-08-24T13:52:43Z`
- second capture: `2026-08-24T20:38:56Z`
- observed elapsed time at second capture: 6.77 hours
- observed run count: 2

Both runs produced HTTP 200 and successful parses for Apple, YouTube, Mdundo, Audiomack, Boomplay, and Shazam, with depths of 100, 100, 100, 100, 100, and 200 respectively.

The second wake then incorrectly emitted:

```text
SOAK_ELAPSED_HOURS=6.77
SOAK_RUN_COUNT=2
SOAK_WINDOW_COMPLETE=YES
SOAK_REPORT_READY=YES
RUN_COUNT=2
SOAK_AUTO_FINALIZED=YES
```

The durability proof is therefore invalid. The two individual observations remain valid short-term accessibility evidence.

#### Exact controller defect

The runner calculated elapsed time in seconds:

```python
elapsed=(now-start).total_seconds()
```

It then compared that value with:

```python
elapsed >= 7*24
```

That threshold is 168 seconds, not seven days. Because the LaunchAgent woke every six hours, the second wake was the first opportunity to observe the false completion.

The correct seven-day threshold is:

```text
604800 seconds
```

and the repaired comparison is:

```python
elapsed >= 7*24*60*60
```

The failed attempt was preserved before repair. Its original raw captures remain auditable with SHA-256 values:

- `20260824T135243Z.json`: `1f024bb765afb22c19b140065502650a7ecee01a3b1180e246c81594e92ff883`
- `20260824T203856Z.json`: `d394bd450ba1f71a3155dfb8668734aec199454ab52f1855038b77d65d34ae59`

The failed controller also logged a two-run report bundle:

- path at generation time: `~/Downloads/wakilisha-chart-source-soak-20260824T203907Z.zip`
- logged SHA-256: `bac6af587d8270ffa5fffc5f6689d4172440c5bea0655fb913440cfdd4612aa4`

The generated ZIP was no longer present when the failure was diagnosed. The preserved raw captures, state, logs, runner files, and LaunchAgent definition remain the authoritative failed-attempt evidence.

### Repair preflight

Before attempt 2 was allowed to contact any source, the repaired controller passed:

- Bash syntax validation
- Python static compilation
- LaunchAgent plist validation
- empty attempt-2 data and state proof
- explicit proof that attempt 2 was not loaded
- synthetic completion-boundary tests at 6 hours, 24 hours, 72 hours, 167 hours, 167:59:59, 168 hours, and 169 hours

The boundary matrix proved:

- 167:59:59 does not complete
- exactly 168 hours completes
- `WINDOW_SECONDS=604800`

Attempt-2 preflight artifact SHA-256 values:

- `runner.sh`: `dc69b56aa10323acbb69c7384b0c3703f0f2f93895912100c62ec879f43de791`
- `run_once.py`: `444379cf326d58d1527ea0b94e9a5a18ddaa62dc94d5d874bb98631fbec8aad7`
- `finalize.py`: `6aaf12c911b52814cc81c76ef8609f551ce67acc17577ba026f25d52ca5d313e`
- LaunchAgent plist: `21f0d3405991c9fb2884921999cae332e10043fd99a6a7ddf139d7beb022dc1a`

No source request was made during repair or preflight.

### Attempt 2: authoritative running soak

Attempt 2 uses a separate local authority:

- root: `~/Library/Application Support/WAKILISHA/chart-source-soak-v2`
- LaunchAgent label: `africa.wakilisha.chart-source-soak-v2`
- cadence: every 6 hours
- cadence seconds: `21600`
- durability window seconds: `604800`

Authoritative start:

- UTC: `2026-09-03T12:29:31Z`
- Africa/Nairobi: 3 September 2026 at 15:29:31 EAT

Seven-day boundary:

- UTC: `2026-09-10T12:29:31Z`
- Africa/Nairobi: 10 September 2026 at 15:29:31 EAT

The first attempt-2 capture was:

| Source | HTTP | Parse | Depth |
| --- | ---: | --- | ---: |
| Apple | 200 | pass | 100 |
| YouTube | 200 | pass | 100 |
| Mdundo | 200 | pass | 100 |
| Audiomack | 200 | pass | 100 |
| Boomplay | 403 | fail | n/a |
| Shazam | 200 | pass | 200 |

Controller state immediately after the first attempt-2 capture proved:

```text
SOAK_ELAPSED_HOURS=0.01
SOAK_RUN_COUNT=1
SOAK_WINDOW_COMPLETE=NO
STDERR_EMPTY=PASS
COMPLETE_MARKER_ABSENT=PASS
SOAK_V2_STARTED=PASS
```

Boomplay's first-run HTTP 403 is evidence, not a reason to modify the experiment. The source must remain in the soak unchanged so the final audit can determine whether that access failure persists, recovers, or oscillates.

The first capture also proves the portfolio continues collecting usable evidence when one source fails. That is an observed degradation property, not yet a final source-qualification decision.

### Attempt-2 operating rule

Until the seven-day boundary is reached:

- do not restart the LaunchAgent unless it is proved stopped unexpectedly
- do not manually trigger additional captures
- do not delete or rewrite state
- do not edit the runner or parser set
- do not remove Boomplay because it returned 403
- do not redesign scoring during the soak
- do not treat any source as permanently qualified or rejected
- preserve all captures and logs exactly as observed

The target remains approximately 28 observations per source. Final qualification must judge actual calendar coverage and observed reliability rather than use 28 as an arbitrary pass/fail number.

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