/**
 * WAKILISHA — Edition Fixture Exporter
 * Brief §3 Gate A procedure step 1:
 *   "Export the raw ingested evidence (not the final positions — the INPUTS:
 *   source rows, occurrence counts, source URLs seen, release dates,
 *   airplay detections for the week, previous edition) for the last 4
 *   published editions from the live WordPress plugin"
 *
 * USAGE:
 *   DATABASE_URL="postgresql://..." \
 *   npx tsx scripts/charts/export-edition-fixture.ts \
 *     --edition 2026-05-18 \
 *     --program top-songs-kenya \
 *     --output test/fixtures/edition-2026-05-18.json
 *
 * Or with source-chart-specific parameters:
 *   DATABASE_URL="postgresql://..." \
 *   npx tsx scripts/charts/export-edition-fixture.ts \
 *     --last 4 \
 *     --program top-songs-kenya \
 *     --output-dir test/fixtures
 *
 * OUTPUT:
 *   One JSON fixture file per edition, compatible with test/fixtures/ format.
 *   Each fixture includes:
 *   - source_evidence: raw track evidence from wk_chart_entries_v2 (or legacy tables)
 *   - previous_edition: positions from the edition immediately before
 *   - airplay_detections: from airplay_evidence_weekly for that edition's week
 *   - expected_positions: the PUBLISHED chart positions (the ground truth)
 *
 * NOTES:
 *   - This script reads from the Supabase DB (wk_chart_entries_v2, chart_editions, etc.)
 *   - It does NOT write to the DB — read-only
 *   - Fixtures are saved with _provenance metadata showing when/where they came from
 *   - The fixture format is exactly what golden-file-migration.test.ts expects
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// CLI helpers
// ─────────────────────────────────────────────────────────────────────────────

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function fatal(message: string, code = 1): never {
  process.stderr.write(`\n[export-fixture] FATAL: ${message}\n`);
  process.exit(code);
}

function required(value: string | undefined, label: string): string {
  if (!value) fatal(`${label} is required`);
  return value!;
}

// ─────────────────────────────────────────────────────────────────────────────
// Supabase client
// ─────────────────────────────────────────────────────────────────────────────

function createSupabase() {
  const url = process.env.VITE_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    fatal('Missing VITE_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY (or VITE_PUBLIC_SUPABASE_ANON_KEY)');
  }
  return createClient(url!, key!, { auth: { persistSession: false } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface EditionRow {
  id: string;
  program_id: string;
  edition_slug: string;
  edition_date: string;
  period_start: string | null;
  period_end: string | null;
  chart_size: number | null;
  status: string;
  scoring_policy_version: string | null;
  methodology_version: string | null;
}

interface ChartEntryRow {
  rank: number;
  previous_rank: number | null;
  normalized_key: string | null;
  track_title: string | null;
  artist_name: string | null;
  source_count: number;
  occurrence_count: number;
  source_urls_seen: string[];
  release_date: string | null;
  carry_forward_only: boolean;
  airplay_candidate_only: boolean;
  airplay_detections: number | null;
  airplay_station_count: number | null;
  airplay_total_duration: number | null;
  airplay_weighted_score: number | null;
}

interface AirplayWeeklyRow {
  canonical_track_id: string;
  normalized_key: string | null;
  station_id: string;
  station_weight: number;
  week_start: string;
  detection_count: number;
  total_played_duration: number;
  weighted_score: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixture builder
// ─────────────────────────────────────────────────────────────────────────────

async function exportEditionFixture(
  supabase: ReturnType<typeof createSupabase>,
  programSlug: string,
  editionDate: string,
  outputPath: string,
): Promise<void> {
  process.stderr.write(`[export-fixture] Exporting ${programSlug} / ${editionDate}...\n`);

  // 1. Find the program
  const { data: programs, error: progError } = await supabase
    .from('wk_chart_programs_v2')
    .select('id, public_slug, public_label, chart_size')
    .eq('public_slug', programSlug)
    .limit(1);

  if (progError || !programs || programs.length === 0) {
    fatal(`Program not found: ${programSlug} (error: ${progError?.message ?? 'none found'})`);
  }

  const program = programs[0];
  process.stderr.write(`[export-fixture] Program: ${program.public_label} (id: ${program.id})\n`);

  // 2. Find the target edition
  const { data: editions, error: edError } = await supabase
    .from('wk_chart_editions_v2')
    .select('id, program_id, edition_slug, edition_date, period_start, period_end, chart_size, status, scoring_policy_version, methodology_version')
    .eq('program_id', program.id)
    .eq('edition_date', editionDate)
    .limit(1);

  if (edError || !editions || editions.length === 0) {
    fatal(`Edition not found: ${editionDate} for program ${programSlug}`);
  }

  const edition = editions[0] as EditionRow;
  process.stderr.write(`[export-fixture] Edition: ${edition.edition_slug} (status: ${edition.status})\n`);

  // 3. Get chart entries for this edition (the expected positions)
  const { data: entries, error: entryError } = await supabase
    .from('wk_chart_entries_v2')
    .select([
      'rank', 'previous_rank', 'normalized_key', 'track_title', 'artist_name',
      'source_count', 'occurrence_count', 'source_urls_seen', 'release_date',
      'carry_forward_only', 'airplay_candidate_only',
      'airplay_detections', 'airplay_station_count', 'airplay_total_duration', 'airplay_weighted_score',
    ].join(', '))
    .eq('edition_id', edition.id)
    .order('rank', { ascending: true });

  if (entryError || !entries) {
    fatal(`Failed to load entries for edition ${edition.id}: ${entryError?.message}`);
  }

  process.stderr.write(`[export-fixture] Loaded ${entries.length} entries\n`);

  const typedEntries = entries as ChartEntryRow[];

  // 4. Find the previous published edition
  const { data: prevEditions, error: prevError } = await supabase
    .from('wk_chart_editions_v2')
    .select('id, edition_date, edition_slug')
    .eq('program_id', program.id)
    .eq('status', 'published')
    .lt('edition_date', editionDate)
    .order('edition_date', { ascending: false })
    .limit(1);

  let previousEdition: Array<{ normalized_key: string; position: number }> = [];

  if (!prevError && prevEditions && prevEditions.length > 0) {
    const prevEd = prevEditions[0];
    const { data: prevEntries, error: prevEntryError } = await supabase
      .from('wk_chart_entries_v2')
      .select('rank, normalized_key')
      .eq('edition_id', prevEd.id)
      .order('rank', { ascending: true });

    if (!prevEntryError && prevEntries) {
      previousEdition = prevEntries
        .filter((e) => e.normalized_key)
        .map((e) => ({ normalized_key: e.normalized_key as string, position: e.rank }));
      process.stderr.write(`[export-fixture] Previous edition: ${prevEd.edition_slug} (${previousEdition.length} entries)\n`);
    }
  } else {
    process.stderr.write(`[export-fixture] No previous edition found (first edition or error)\n`);
  }

  // 5. Get airplay evidence for this edition's week
  // Week start = Monday of edition week
  const edDate = new Date(editionDate);
  const day = edDate.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  edDate.setUTCDate(edDate.getUTCDate() - diff);
  const weekStart = edDate.toISOString().slice(0, 10);

  let airplayDetections: AirplayWeeklyRow[] = [];

  const { data: airplay, error: airplayError } = await supabase
    .from('airplay_evidence_weekly')
    .select('canonical_track_id, normalized_key, source_id, station_weight, week_start, detection_count, total_played_duration_seconds, weighted_score')
    .eq('week_start', weekStart);

  if (!airplayError && airplay) {
    airplayDetections = airplay.map((r) => ({
      canonical_track_id: r.canonical_track_id as string,
      normalized_key: r.normalized_key as string | null,
      station_id: r.source_id as string,
      station_weight: Number(r.station_weight ?? 1.0),
      week_start: r.week_start as string,
      detection_count: Number(r.detection_count ?? 0),
      total_played_duration: Number(r.total_played_duration_seconds ?? 0),
      weighted_score: Number(r.weighted_score ?? 0),
    }));
    process.stderr.write(`[export-fixture] Airplay evidence: ${airplayDetections.length} buckets for week ${weekStart}\n`);
  } else {
    process.stderr.write(`[export-fixture] No airplay evidence found for week ${weekStart} (or not configured)\n`);
  }

  // 6. Build source_evidence (reconstruct from stored source_urls_seen)
  const sourceEvidence = typedEntries
    .filter((e) => !e.carry_forward_only && e.normalized_key)
    .map((e) => ({
      track_title: e.track_title ?? '',
      artist_name: e.artist_name ?? '',
      source_urls: e.source_urls_seen ?? [],
      release_date: e.release_date,
      occurrence_count: e.occurrence_count,
    }));

  // 7. Build expected_positions (the ground truth)
  const expectedPositions = typedEntries
    .filter((e) => e.normalized_key)
    .map((e) => ({
      rank: e.rank,
      normalized_key: e.normalized_key!,
      track_title: e.track_title ?? '',
      artist_name: e.artist_name ?? '',
    }));

  // 8. Assemble fixture
  const fixture = {
    _provenance: `Exported from Supabase (wk_chart_entries_v2) — program: ${programSlug}, edition: ${edition.edition_slug}`,
    _generated_at: new Date().toISOString(),
    _generator: 'scripts/charts/export-edition-fixture.ts',
    _source_edition_id: edition.id,
    edition_date: edition.edition_date,
    chart_program: programSlug,
    chart_size: edition.chart_size ?? program.chart_size ?? 20,
    methodology_notes: `Policy: ${edition.scoring_policy_version ?? 'unknown'}, Methodology: ${edition.methodology_version ?? 'unknown'}`,
    scoring_policy_version: edition.scoring_policy_version ?? '1.0',
    corrections_applied: [],
    source_evidence: sourceEvidence,
    previous_edition: previousEdition,
    airplay_detections: airplayDetections,
    expected_positions: expectedPositions,
  };

  // 9. Write fixture
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(fixture, null, 2) + '\n');
  process.stderr.write(`[export-fixture] ✅ Written to: ${outputPath}\n`);
  process.stderr.write(`[export-fixture]    Edition: ${edition.edition_date} — ${expectedPositions.length} positions\n`);
  process.stderr.write(`[export-fixture]    Evidence: ${sourceEvidence.length} tracks, ${airplayDetections.length} airplay buckets\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const programSlug = arg('--program') ?? 'top-songs-kenya';
  const editionDate = arg('--edition');
  const lastN = arg('--last') ? Number(arg('--last')) : null;
  const outputDir = arg('--output-dir');
  const outputFile = arg('--output');

  const supabase = createSupabase();

  if (lastN !== null) {
    // Export last N published editions
    const { data: editions, error } = await supabase
      .from('wk_chart_editions_v2')
      .select('edition_date, program_id')
      .eq('status', 'published')
      .order('edition_date', { ascending: false })
      .limit(lastN);

    if (error || !editions || editions.length === 0) {
      fatal(`Failed to load recent editions: ${error?.message ?? 'none found'}`);
    }

    const outDir = outputDir ?? 'test/fixtures';

    for (const ed of editions) {
      const date = ed.edition_date as string;
      const outPath = path.join(outDir, `edition-${date}.json`);
      await exportEditionFixture(supabase, programSlug, date, outPath);
    }

    process.stderr.write(`\n[export-fixture] Exported ${editions.length} editions to ${outDir}/\n`);
    return;
  }

  if (!editionDate) {
    process.stderr.write(
      'Usage:\n' +
      '  npx tsx scripts/charts/export-edition-fixture.ts --edition YYYY-MM-DD [--program SLUG] [--output PATH]\n' +
      '  npx tsx scripts/charts/export-edition-fixture.ts --last 4 [--program SLUG] [--output-dir PATH]\n',
    );
    fatal('--edition or --last required');
  }

  const outPath = outputFile ?? (outputDir
    ? path.join(outputDir, `edition-${editionDate}.json`)
    : `test/fixtures/edition-${editionDate}.json`);

  await exportEditionFixture(supabase, programSlug, editionDate, outPath);
}

main().catch((err) => {
  process.stderr.write(`[export-fixture] Unhandled error: ${err?.message ?? err}\n`);
  process.exit(1);
});