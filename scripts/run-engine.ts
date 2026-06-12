/**
 * WAKILISHA Chart Scoring Engine — CLI Runner
 * Brief §8 reviewer verification command:
 *
 *   node scripts/run-engine.js test/fixtures/edition-2026-05-18.json > /tmp/a.json
 *   node scripts/run-engine.js test/fixtures/edition-2026-05-18.json > /tmp/b.json
 *   diff /tmp/a.json /tmp/b.json  # Expect: identical (determinism)
 *
 * USAGE:
 *   npx tsx scripts/run-engine.ts <fixture-path> [--verbose] [--edition-date YYYY-MM-DD]
 *
 * OUTPUT:
 *   JSON to stdout — scored chart rows, policy snapshot, edition summary
 *   Errors to stderr
 *
 * EXIT CODES:
 *   0 — success
 *   1 — fixture not found or invalid
 *   2 — scoring engine error
 *   3 — score integrity failure (sum invariant violated)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// CLI scripts use relative imports (not @ alias) since they run outside of vite
import { runFullPipeline } from '../src/services/chartsScoring/scoringPipeline.ts';
import type {
  PreviousEditionEntry,
  AirplayEvidenceBucket,
  ScoringConfig,
} from '../src/services/chartsScoring/scoringTypes.ts';
import {
  DEFAULT_SCORING_CONFIG,
  CURRENT_SCORING_POLICY_VERSION,
  CURRENT_METHODOLOGY_VERSION,
} from '../src/services/chartsScoring/scoringTypes.ts';
import { gateCReport } from '../src/services/chartsScoring/scoringEngine.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Types (mirror test/fixtures/ format)
// ─────────────────────────────────────────────────────────────────────────────

interface SourceEvidenceRecord {
  track_title: string;
  artist_name: string;
  source_urls: string[];
  release_date: string | null;
  occurrence_count: number;
}

interface EditionFixture {
  _provenance?: string;
  edition_date: string;
  chart_program: string;
  chart_size: number;
  scoring_policy_version?: string;
  source_evidence: SourceEvidenceRecord[];
  previous_edition: PreviousEditionEntry[];
  airplay_detections: AirplayEvidenceBucket[];
  expected_positions?: Array<{ rank: number; normalized_key: string; track_title: string; artist_name: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

function printUsage() {
  process.stderr.write(
    'Usage: npx tsx scripts/run-engine.ts <fixture-path> [--verbose] [--gate-c]\n' +
    '\n' +
    'Options:\n' +
    '  --verbose      Print scoring details to stderr in addition to JSON stdout\n' +
    '  --gate-c       Run Gate C verification and exit (no fixture needed)\n' +
    '\n' +
    'Examples:\n' +
    '  npx tsx scripts/run-engine.ts test/fixtures/synthetic-gate-a-smoke.json\n' +
    '  npx tsx scripts/run-engine.ts test/fixtures/edition-2026-05-18.json --verbose\n' +
    '  diff <(npx tsx scripts/run-engine.ts fixture.json) <(npx tsx scripts/run-engine.ts fixture.json)\n',
  );
}

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function fatal(message: string, code: number = 1): never {
  process.stderr.write(`\n[run-engine] FATAL: ${message}\n`);
  process.exit(code);
}

// ─────────────────────────────────────────────────────────────────────────────
// Gate C verification mode
// ─────────────────────────────────────────────────────────────────────────────

if (hasFlag('--gate-c')) {
  const report = gateCReport();
  process.stderr.write(report + '\n');
  process.exit(report.includes('YES') ? 0 : 2);
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixture loading
// ─────────────────────────────────────────────────────────────────────────────

const fixturePath = process.argv[2];

if (!fixturePath || fixturePath.startsWith('--')) {
  printUsage();
  fatal('Missing fixture path argument', 1);
}

const resolvedPath = path.isAbsolute(fixturePath)
  ? fixturePath
  : path.resolve(process.cwd(), fixturePath);

if (!fs.existsSync(resolvedPath)) {
  fatal(`Fixture not found: ${resolvedPath}`, 1);
}

let fixture: EditionFixture;
try {
  fixture = JSON.parse(fs.readFileSync(resolvedPath, 'utf8')) as EditionFixture;
} catch (err) {
  fatal(`Failed to parse fixture JSON: ${err instanceof Error ? err.message : String(err)}`, 1);
}

const verbose = hasFlag('--verbose');

// ─────────────────────────────────────────────────────────────────────────────
// Build raw evidence records from fixture format
// ─────────────────────────────────────────────────────────────────────────────

const rawRecords = fixture.source_evidence.flatMap((ev) =>
  ev.source_urls.map((url) => ({
    track_title: ev.track_title,
    artist_name: ev.artist_name,
    source_urls: [url],
    release_date: ev.release_date,
    canonical_track_id: null,
    canonical_release_id: null,
    canonical_artist_id: null,
    artwork_url: null,
    track_slug: null,
    artist_slug: null,
  })),
);

// ─────────────────────────────────────────────────────────────────────────────
// Run the scoring pipeline
// ─────────────────────────────────────────────────────────────────────────────

const config: ScoringConfig = {
  ...DEFAULT_SCORING_CONFIG,
  chart_size: fixture.chart_size,
  airplay_enabled: fixture.airplay_detections.length > 0,
  airplay_rescue_mode: 'allow_rescue',
};

const editionDate = fixture.edition_date;

let result: ReturnType<typeof runFullPipeline>;

try {
  result = runFullPipeline(
    rawRecords,
    fixture.airplay_detections,
    fixture.previous_edition,
    new Map(),
    config,
    editionDate,
  );
} catch (err) {
  fatal(
    `Scoring engine error: ${err instanceof Error ? err.message : String(err)}\n` +
    (err instanceof Error && err.stack ? err.stack : ''),
    2,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Verify score sum invariant on every row
// ─────────────────────────────────────────────────────────────────────────────

const integrityFailures: string[] = [];

for (const row of result.scoredRows) {
  const expectedSum =
    row.source_score +
    row.cross_source_bonus +
    row.overlap_bonus +
    row.recency_score +
    row.continuity_score +
    row.carry_forward_bonus +
    row.airplay_score -
    row.anti_gaming_penalty;

  if (Math.abs(expectedSum - row.total_score) > 0.001) {
    integrityFailures.push(
      `Score integrity FAILED for "${row.track_title}": ` +
      `sum=${expectedSum.toFixed(4)}, stored=${row.total_score.toFixed(4)}, ` +
      `delta=${Math.abs(expectedSum - row.total_score).toFixed(6)}`,
    );
  }
}

if (integrityFailures.length > 0) {
  for (const msg of integrityFailures) {
    process.stderr.write(`[run-engine] ${msg}\n`);
  }
  fatal(`Score integrity check failed (${integrityFailures.length} rows)`, 3);
}

// ─────────────────────────────────────────────────────────────────────────────
// Position parity check (if fixture has expected_positions)
// ─────────────────────────────────────────────────────────────────────────────

const positionMismatches: Array<{
  rank: number;
  expected_key: string;
  actual_key: string;
}> = [];

if (fixture.expected_positions && fixture.expected_positions.length > 0) {
  for (const expected of fixture.expected_positions) {
    const actual = result.scoredRows.find((r) => r.rank === expected.rank);
    if (!actual || actual.normalized_key !== expected.normalized_key) {
      positionMismatches.push({
        rank: expected.rank,
        expected_key: expected.normalized_key,
        actual_key: actual?.normalized_key ?? '(not in chart)',
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Verbose stderr output
// ─────────────────────────────────────────────────────────────────────────────

if (verbose) {
  process.stderr.write('\n═══════════════════════════════════════════\n');
  process.stderr.write('  WAKILISHA Chart Scoring Engine — Run Report\n');
  process.stderr.write('═══════════════════════════════════════════\n');
  process.stderr.write(`  Fixture:         ${path.basename(resolvedPath)}\n`);
  process.stderr.write(`  Edition date:    ${editionDate}\n`);
  process.stderr.write(`  Chart program:   ${fixture.chart_program}\n`);
  process.stderr.write(`  Chart size:      ${config.chart_size}\n`);
  process.stderr.write(`  Policy:          ${CURRENT_SCORING_POLICY_VERSION}\n`);
  process.stderr.write(`  Methodology:     ${CURRENT_METHODOLOGY_VERSION}\n`);
  process.stderr.write('\n  ── Inputs ──\n');
  process.stderr.write(`  Raw evidence:    ${rawRecords.length} records\n`);
  process.stderr.write(`  Airplay buckets: ${fixture.airplay_detections.length}\n`);
  process.stderr.write(`  Previous edition: ${fixture.previous_edition.length} entries\n`);
  process.stderr.write('\n  ── Results ──\n');
  process.stderr.write(`  Scored rows:     ${result.scoredRows.length}\n`);
  process.stderr.write(`  Excluded rows:   ${result.excludedRows.length}\n`);
  process.stderr.write(`  Carry-forward:   ${result.editionSummary.carry_forward_count}\n`);
  process.stderr.write(`  Airplay rescues: ${result.editionSummary.airplay_rescue_count}\n`);
  process.stderr.write(`  Score integrity: ${integrityFailures.length === 0 ? 'PASS' : 'FAIL'}\n`);

  if (fixture.expected_positions && fixture.expected_positions.length > 0) {
    process.stderr.write(
      `  Position parity: ${positionMismatches.length === 0 ? `PASS (${fixture.expected_positions.length}/${fixture.expected_positions.length})` : `FAIL (${positionMismatches.length} mismatches)`}\n`,
    );
  }

  process.stderr.write('\n  ── Top 10 ──\n');
  for (const row of result.scoredRows.slice(0, 10)) {
    const mv = row.movement ? `[${row.movement}]` : '[new]';
    process.stderr.write(
      `  #${String(row.rank).padStart(2)}  ${row.total_score.toFixed(2).padStart(7)}  ` +
      `${row.track_title} — ${row.artist_name}  ${mv}\n`,
    );
  }

  if (positionMismatches.length > 0) {
    process.stderr.write('\n  ── Position Mismatches ──\n');
    for (const m of positionMismatches) {
      process.stderr.write(`  Rank ${m.rank}: expected "${m.expected_key}", got "${m.actual_key}"\n`);
    }
  }

  process.stderr.write('═══════════════════════════════════════════\n\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON output to stdout (determinism-testable via diff)
// ─────────────────────────────────────────────────────────────────────────────

const output = {
  _engine: 'wakilisha-chart-scoring',
  _version: CURRENT_SCORING_POLICY_VERSION,
  _methodology: CURRENT_METHODOLOGY_VERSION,
  _run_at: null, // explicitly null — not wall-clock (would break determinism)
  fixture: path.basename(resolvedPath),
  edition_date: editionDate,
  chart_program: fixture.chart_program,
  policy_snapshot: result.policySnapshot,
  edition_summary: result.editionSummary,
  score_integrity: {
    pass: integrityFailures.length === 0,
    failures: integrityFailures.length,
  },
  position_parity: fixture.expected_positions
    ? {
        expected: fixture.expected_positions.length,
        matched: fixture.expected_positions.length - positionMismatches.length,
        mismatches: positionMismatches.length,
        pass: positionMismatches.length === 0,
      }
    : null,
  scored_rows: result.scoredRows.map((row) => ({
    rank: row.rank,
    previous_rank: row.previous_rank,
    movement: row.movement,
    normalized_key: row.normalized_key,
    track_title: row.track_title,
    artist_name: row.artist_name,
    source_count: row.source_count,
    occurrence_count: row.occurrence_count,
    total_score: row.total_score,
    source_score: row.source_score,
    cross_source_bonus: row.cross_source_bonus,
    overlap_bonus: row.overlap_bonus,
    recency_score: row.recency_score,
    continuity_score: row.continuity_score,
    carry_forward_bonus: row.carry_forward_bonus,
    airplay_score: row.airplay_score,
    anti_gaming_penalty: row.anti_gaming_penalty,
    carry_forward_only: row.carry_forward_only,
    airplay_candidate_only: row.airplay_candidate_only,
    lead_artist_overflow: row.lead_artist_overflow,
    eligibility_status: row.eligibility_status,
  })),
  excluded_rows: result.excludedRows,
};

// Output deterministic JSON (sorted keys, no wall-clock values)
process.stdout.write(JSON.stringify(output, null, 2) + '\n');

if (positionMismatches.length > 0) {
  process.exit(4); // position parity failure
}

process.exit(0);