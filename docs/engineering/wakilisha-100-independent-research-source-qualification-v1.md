# WAKILISHA 100: Independent Research and Source Qualification v1

**Operating decision:** 29 October 2026. **Owner:** WAKILISHA. **Programme:** #1264.
**Status:** research and engineering policy; **not** a legal opinion, provider licence, source-manifest approval, production deployment, or Chart Edition admission.

## Research identity

WAKILISHA 100 is an independently researched, calculated and editorially governed Kenyan music chart. WAKILISHA:

1. observes and reports publicly available chart facts, with precise source attribution and a record of what the source actually measured;
2. conducts its own research and designs its own collection, parsing, verification and replay tools;
3. maintains its own private research evidence archive for integrity, audit, comparison and reproducibility;
4. creates its own original methodology, compiled research record, proprietary ranking calculations and commercial editorial product.

The fact that source observations inform the result does not transfer control of WAKILISHA's editorial or scoring decisions to a provider. Nor does ownership of our original research automatically grant rights over a provider's protected expression, complete compilation, private data, access system or contractual restrictions.

**Researcher-directed public-fact collection is the operative workflow:** WAKILISHA visits publicly accessible sources, downloads publicly offered files such as CSVs where available, and uses its own efficiency tools to record, parse and archive its observations. Do not call this scraping by default, treat private research archiving as platform-controlled editorial work, or create speculative licence/partnership preconditions for observing publicly reported chart facts. If a real and relevant source-specific restriction is established, handle that concrete question separately rather than assuming a blanket prohibition or declaring an unexamined universal permission.

## Distinguish research activity from runtime mechanics

| Activity | What it means | Required judgment |
| --- | --- | --- |
| Human observation | A researcher reads a publicly available chart and records source-attributed factual observations | Check accuracy, source accessibility and any applicable use restrictions; retain bounded evidence and a provenance log |
| Researcher-directed tooling | A researcher deliberately runs WAKILISHA-written code to gather or structure observations | Assess the **actual network and extraction behavior**. Human authorship or manual initiation does not turn a scripted request into a human browser observation under applicable site rules |
| Unattended WK100 collector | Edge code repeatedly calls an exact source endpoint according to a schedule, creating durable capture receipts | Requires a separately reviewed, project-bound source decision and the existing sealed manifest, secrets, slot/lease controls and disabled-by-default activation gate |
| Original commercial chart | WAKILISHA independently calculates and publishes its own rankings from reviewed evidence | Separate editorial, methodological, evidentiary and publication approval; avoid representing external ordinal positions as national streams |

These classifications describe how WAKILISHA performs research; they are **not** labels of scraping, automatic legal verdicts or a reason to demand provider permission by default. A researcher visiting a public site, downloading its offered CSV and using a researcher-authored tool remains researcher-directed work. Record the actual source, data, acquisition and observed period rather than imposing a contested characterization based solely on the existence of code.

## Source Research Qualification record

Keep a dated, private research decision for **each exact source surface and research method**. The record includes:

- **Source:** stable `source_key`, operator/entity, precise source title, HTTPS URL or other authorized delivery path, method, observed format and a source version.
- **Factual observation:** ranking or native view/discovery/list-position metric; country/market evidence, depth, native period when actually documented, observation time and WAKILISHA EAT week as separate clocks.
- **Acquisition and treatment:** whether observation was direct, a publicly offered file download assisted by WAKILISHA's own tool, or a separately configured unattended collector; original public URL, timestamp, documented request/cadence and retained provenance. Record concrete restrictions only when they are established and relevant to the exact operation; do not require a speculative licence reference to log or analyze public chart facts.
- **Evidence:** source citation, dated review, privately retained raw observation or exact-byte digest where retention is supportable, parser/version, errors, missingness and review/replay trace. Keep proprietary source rosters, weights, credentials and raw response bodies out of public GitHub.
- **Decision:** named responsible reviewer, date, scope, expiry/review date, reason and a distinct determination for research observation and for unattended collector operation.

Use these decision outcomes without conflating them:

- `RESEARCH_QUALIFIED`: the specified research observation method and evidence treatment have been reviewed for that scope. **Not** a scheduled collector authorization.
- `RESEARCH_REVIEW_REQUIRED`: a concrete access, provenance, market, period, reuse or retention question remains open.
- `COLLECTOR_ELIGIBLE`: the independently reviewed exact unattended method, endpoint, limits, retention and evidence basis are sufficiently documented for a separately approved candidate activation. **Not** `WK100_CAPTURE_ENABLED=true`.
- `METHOD_DENIED`: a concrete restriction disallows the proposed method. Preserve the rejection and explore only legitimate alternatives; do not evade.
- `UNVERIFIED`: insufficient observation or review evidence.

One source can be research-qualified for limited factual observation while its bulk/scheduled collection method remains blocked. No blanket "all platforms must sign" gate and no "public therefore unrestricted" shortcut.

## Engineering and release separation

The retained source register's previous `ADMITTED` count concerns **unattended WK100 runtime methods**, not the existence or legitimacy of human-led proprietary research. A qualified research note does not seed `wk_chart_capture_contracts_v1`, enable `wk-chart-capture`, set any `WK100_CAPTURE_*` secret, make a provider request or admit an Edition.

For the existing Edge collector, retain every security boundary: exact project binding, independent source decision reference, separately SHA-256-sealed source manifest, host/path/method checks, positive reviewed collector scope, slot/lease/cadence and rate controls, 4 MiB byte cap, hash-bound private Storage, immutable capture receipts, native parser and raw-to-row replay, and `can_publish:false`. No source can be enrolled merely by setting `admission_state='candidate'`.

**Next practical tranche:** qualify the existing shortlisted research surfaces one by one, starting from current documented facts and terms; identify an exact lawful observation method and unresolved access restrictions without making unauthorized requests. Build a source-specific evidence dossier, test parser/period/Registry resolution on legitimately held data where permitted, then propose a **single** bounded prospective candidate capture once its collector method has separately passed review. This work does not depend on securing agreements with all five originally hypothesized providers.

**Open today:** No live source is currently configured for unattended WK100 capture; the Production collector remains disabled and the research archive has no genuine WK100 captured raw receipts. Original publication and methodology approval remain independent future gates.
