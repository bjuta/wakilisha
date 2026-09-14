# WAKILISHA Charts Public-Source Accessibility Soak — Final Decision

Date: 14 September 2026

Status: **FINAL DURABILITY DECISION — GREEN WITH SOURCE-SPECIFIC QUALIFICATION**

Base authority: `88d0184304bf60f418dbf56dbd4bb0fbaf0df07c`

Source WIP record: `docs/engineering/charts-public-source-accessibility-soak-wip.md`

This record closes the seven-day public-source durability question without rewriting the WIP history. The WIP remains the chronology of the earlier invalid/local attempts and the research context. This document records the completed cloud soak and the source constitution that should govern subsequent chart-source implementation.

## 1. Research question

Can WAKILISHA operate a long-lived, Kenya-first, corroboratable music chart using ordinary public/developer-accessible evidence sources without making any one provider a hard dependency or granting provider data canonical authority?

The durability proof needed to establish that:

- source collection survives unattended operation over a full seven-day window;
- failure of one source degrades evidence rather than stopping the portfolio;
- raw observations remain replayable and auditable;
- source reliability can be graded independently;
- provider observations remain evidence rather than Registry or methodology authority.

## 2. Authoritative cloud soak

The Production scheduler authority is `private.chart_source_soak_v3_scheduler_control`.

Attempt 3 ran on a six-hour UTC cadence.

Observed authority:

- state: `closed`;
- started at: `2026-09-05 18:00:00+00`;
- seven-day boundary: `2026-09-12 18:00:00+00`;
- last scheduled slot: `2026-09-12 12:00:00+00`;
- closed at: `2026-09-12 18:00:00.532658+00`;
- collector finalization: approximately five minutes later;
- intended observations: 28 scheduled slots in `[start, start + 7 days)`;
- actual soak runs: 28;
- run status: 28 `complete`, zero incomplete soak runs.

This satisfies the scheduler contract: the exact seven-day boundary was excluded and the jobs self-closed after the final collection window.

## 3. Source durability results

### Audiomack

- 28/28 soak observations returned HTTP 200;
- zero timeouts;
- zero recorded errors;
- HTML response shape remained reachable throughout the window;
- 28 distinct body hashes were observed.

Decision: **GREEN — CORE CONSUMPTION EVIDENCE SOURCE**.

Audiomack is qualified as a durable source input. Qualification means it may contribute source evidence and source-health signals. It does not mean Audiomack identity, genre, origin, or popularity metadata becomes canonical WAKILISHA authority.

### Boomplay

- 28/28 soak observations returned HTTP 200;
- zero timeouts;
- zero recorded errors;
- HTML response shape remained reachable throughout the window;
- 18 distinct body hashes were observed.

Decision: **GREEN — CORE CONSUMPTION EVIDENCE SOURCE**.

The earlier local 403 did not persist in the cloud soak. The correct conclusion is therefore not “Boomplay is blocked,” but that access behavior can depend on environment and must remain observable.

### Mdundo

- 28/28 soak observations returned HTTP 200;
- zero timeouts;
- zero recorded errors;
- HTML response shape remained reachable throughout the window;
- 28 distinct body hashes were observed.

Decision: **GREEN — CORE KENYA CONSUMPTION EVIDENCE SOURCE**.

Mdundo remains particularly useful because it contributes a locally relevant platform perspective distinct from global DSP surfaces.

### Shazam

- 28/28 soak observations returned HTTP 200;
- zero timeouts;
- zero recorded errors;
- CSV response shape remained reachable throughout the window;
- 17 distinct body hashes were observed.

Decision: **GREEN — CORE DISCOVERY / IDENTIFICATION-INTENT SOURCE**.

Shazam should not be interpreted as consumption volume equivalent to Audiomack, Boomplay, or Mdundo. Its distinct behavioral meaning is valuable precisely because the methodology can treat it as discovery/identification evidence rather than collapse all sources into one semantic class.

### YouTube

- 28/28 soak observations returned HTTP 200;
- zero timeouts;
- zero recorded errors;
- JSON response shape remained reachable throughout the window;
- 28 distinct body hashes were observed.

Decision: **GREEN — CORE VIDEO / UGC CONSUMPTION EVIDENCE SOURCE**.

YouTube adds an independently operated consumption surface and should remain semantically distinct from audio DSP measurements.

### Apple

- 12/28 soak observations returned HTTP 200;
- 16/28 timed out at approximately the 30-second request boundary;
- successful responses remained JSON and were otherwise usable;
- no alternate HTTP failure class dominated; the observed problem was availability/latency from the soak environment.

Successful-fetch rate: approximately **42.9%**.

Timeout rate: approximately **57.1%**.

Decision: **AMBER — SUPPLEMENTARY ONLY UNTIL ACCESS PATH IS MADE DURABLE**.

Apple must not be a required core source in the current constitution. Its successful observations remain useful evidence, but the portfolio must publish correctly when Apple contributes nothing for a period.

Do not paper over the result by increasing a timeout until it passes. A future adapter change may test a better endpoint, conditional retrieval, cache path, or bounded retry policy, but that is a separate evidence-backed change.

### Spotify UGC panel

The soak observed a fixed panel of 20 public Spotify UGC playlists across all 28 runs:

- 560 observations total;
- 556 HTTP 2xx and parseable observations;
- 4 HTTP 504 observations across 3 playlists;
- zero request timeouts recorded by the collector;
- 557 distinct body hashes;
- maximum observed parsed track count: 100.

Successful/parse rate: approximately **99.3%**.

Decision: **GREEN AS OPTIONAL REDUNDANCY / UGC EVIDENCE; NOT CORE NATIONAL-CHART AUTHORITY**.

The panel is technically durable enough to contribute supplementary evidence, but it is user-generated playlist evidence, not an official Spotify Kenya chart and not a substitute for independent national measurement. The methodology must label it honestly.

## 4. Portfolio decision

Overall viability: **GREEN**.

WAKILISHA can operate a resilient Kenya-first public-source evidence network without privileged DSP relationships and without making Spotify or Apple mandatory.

The current core source constitution is:

- Audiomack — platform consumption;
- Boomplay — platform consumption;
- Mdundo — Kenya-focused platform consumption;
- Shazam — discovery / identification intent;
- YouTube — video / UGC consumption.

Supplementary sources:

- Apple — supplementary while durability remains amber;
- Spotify UGC panel — optional redundancy / UGC signal.

Future airplay remains a separate measurement leg requiring a curated station registry and trustworthy song-identification authority. Radio Browser geography or raw ICY metadata remains insufficient by itself.

## 5. Single-source-loss behavior

The soak directly proves the important degradation property: the portfolio continued to collect useful evidence while Apple failed more than half of its scheduled observations.

Therefore source availability must be represented as evidence coverage, not as a binary pipeline-success condition.

A Chart Edition should be able to say, in effect:

- which qualified sources were expected;
- which actually contributed observations;
- which were unavailable or degraded;
- how many independent source classes supported each candidate;
- whether minimum methodology coverage remained satisfied.

One source outage must not silently redistribute weight as though the missing source had participated.

## 6. Evidence is not authority

The soak strengthens, rather than weakens, the Registry governance rule:

**Provider/chart observations are evidence. They are never direct canonical authority.**

Even a 28/28 source can later fail, change schema, expose bad metadata, merge identities incorrectly, or produce a market signal that is not equivalent to a canonical cultural fact.

Accordingly:

- provider artist names do not create canonical Artists by themselves;
- provider country/market signals do not directly set Artist origin;
- provider genre labels do not become WAKILISHA genre authority;
- source reliability does not turn source confidence into canonical confidence `1`;
- chart evidence must enter Registry mutations through typed evidence/admission primitives.

This is directly relevant to MIZIZI Slice 2 issue #939.

## 7. Source-count plumbing remains a known defect

The WIP audit already established that the current pipeline can observe the same recording independently across multiple sources while downstream candidates still report `source_count = 1`.

The soak does not justify changing the scoring formula to compensate.

Required direction remains:

1. preserve independent observation-source identity through normalization;
2. aggregate candidate corroboration from independent observations rather than only URLs or collapsed track identity;
3. replay the existing scoring policy against corrected evidence;
4. consider methodology changes only after evidence plumbing is correct.

This repair is orthogonal to Registry Artist creation/origin governance. Do not mix scoring-policy changes into #939 merely because the soak is now closed.

## 8. Source-health authority

Future production chart runs should persist source-health evidence sufficient to explain:

- expected source set;
- observed source set;
- HTTP/transport failures;
- parse failures;
- stale/repeated payload behavior;
- coverage depth;
- source class;
- adapter/ruleset version.

Source health belongs in chart evidence/provenance, not in Registry Artist metadata.

## 9. Relation to Artist creation and origin admission

The completed soak makes one design point non-negotiable.

A chart resolver may use qualified sources to support an identity/origin proposal, but source qualification does not authorize canonical mutation.

For an unresolved Artist token, the intended governed composition is:

`chart observations -> chart evidence assertion -> registry.artist.create/v1 -> optional registry.artist_origin.admit/v1 -> later lifecycle promotion if independently justified`

For an existing Artist with missing origin:

`chart observations/review -> chart evidence assertion -> registry.artist_origin.admit/v1`

No source may bypass those boundaries through service-role `INSERT`/`UPDATE` authority.

## 10. Closure

The seven-day public-source durability gate is closed.

Final decision:

**GREEN portfolio viability, with Apple AMBER and Spotify UGC supplementary.**

This closes the durability research question only. It does not itself change the chart scoring policy, deploy source adapters, alter Registry authority, or authorize autonomous MIZIZI mutation.
