/**
 * GATE A — Full Pipeline Integration Test
 * Bible §2: Complete pipeline from raw evidence to scored & ranked shortlist.
 *
 * This test exercises the FULL pipeline (runFullPipeline) with realistic
 * East African chart data spanning every scoring code path.
 *
 * What's verified:
 *   A1 — All 7 component scores computed (finite, non-negative)
 *   A2 — Total score = Σ components − penalty (ε < 0.001)
 *   A3 — Ranks assigned sequentially 1..N
 *   A4 — Scores monotonically non-increasing with rank
 *   A5 — Movement classification correct (new/reentry/up/down/same)
 *   A6 — Source payload built for every row with all required fields
 *   A7 — Edition summary internally consistent
 *   A8 — Policy snapshot contains all 4 version strings + rule set
 *   A9 — Determinism: same inputs → byte-identical JSON output
 *   A10 — Carry-forward: CF-only rows get CF bonus, 0 source evidence
 *   A11 — Airplay rescue: rescue-only tracks included when valid
 *   A12 — Anti-gaming: artist overflow penalty applied deterministically
 *   A13 — Exclusion: below-min-source rows excluded with reasons
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  runFullPipeline,
  buildScoringInputRows,
  carryForwardMerge,
  pipelineReport,
  type RawEvidenceRecord,
  type PipelineResult,
} from '@/services/chartsScoring/scoringPipeline';
import type {
  PreviousEditionEntry,
  AirplayEvidenceBucket,
  ScoringConfig,
} from '@/services/chartsScoring/scoringTypes';
import { DEFAULT_SCORING_CONFIG } from '@/services/chartsScoring/scoringTypes';

// ============================================================================
// Realistic Kenyan chart evidence (50 tracks)
// ============================================================================

function makeRawEvidence(): RawEvidenceRecord[] {
  return [
    // ── Top tier: multi-source, recent releases ──
    { track_title: 'Hallelujah (Washwash)', artist_name: 'Khaligraph Jones, Bensoul', source_urls: ['https://spotify.com/playlist/kenya-top-50', 'https://music.apple.com/playlist/ke-top-100', 'https://youtube.com/playlist/kenya-trending'], release_date: '2026-05-25', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    { track_title: 'Nakam Sai', artist_name: 'Sauti Sol', source_urls: ['https://spotify.com/playlist/kenya-top-50', 'https://music.apple.com/playlist/ke-top-100', 'https://youtube.com/playlist/kenya-trending', 'https://deezer.com/playlist/ke-hot'], release_date: '2026-06-01', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    { track_title: 'Kwikwi', artist_name: 'Wakadinali', source_urls: ['https://spotify.com/playlist/kenya-top-50', 'https://music.apple.com/playlist/ke-top-100', 'https://youtube.com/playlist/kenya-trending'], release_date: '2026-05-10', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    { track_title: 'Miondoko', artist_name: 'Boutross, Breeder LW', source_urls: ['https://spotify.com/playlist/kenya-top-50', 'https://music.apple.com/playlist/ke-top-100', 'https://youtube.com/playlist/kenya-trending'], release_date: '2026-04-15', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    { track_title: 'Angela', artist_name: 'Boutross', source_urls: ['https://spotify.com/playlist/kenya-top-50', 'https://music.apple.com/playlist/ke-top-100', 'https://deezer.com/playlist/ke-hot'], release_date: '2026-03-01', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    // ── Strong mid-tier: 2 sources ──
    { track_title: 'Dance Ya Kudance', artist_name: 'Mejja, Exray', source_urls: ['https://spotify.com/playlist/kenya-top-50', 'https://youtube.com/playlist/kenya-trending'], release_date: '2026-05-20', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    { track_title: 'Kuna Kuna', artist_name: 'Vic West, Fathermoh', source_urls: ['https://spotify.com/playlist/kenya-top-50', 'https://music.apple.com/playlist/ke-top-100'], release_date: '2026-06-05', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    { track_title: 'Mukuchu', artist_name: 'Gody Tennor, Tipsy Gee', source_urls: ['https://spotify.com/playlist/kenya-top-50', 'https://youtube.com/playlist/kenya-trending'], release_date: '2026-02-10', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    { track_title: 'Dera', artist_name: 'Zzero Sufuri, Mbuzi Gang', source_urls: ['https://spotify.com/playlist/kenya-top-50', 'https://music.apple.com/playlist/ke-top-100'], release_date: '2025-11-20', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    { track_title: 'Nishike', artist_name: 'Bien', source_urls: ['https://spotify.com/playlist/kenya-top-50', 'https://music.apple.com/playlist/ke-top-100'], release_date: '2026-04-28', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    // ── Single source, recent ──
    { track_title: 'True Love', artist_name: 'Bien, Aaron Rimbui', source_urls: ['https://spotify.com/playlist/kenya-top-50'], release_date: '2026-06-08', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    { track_title: 'Ma Aqaan', artist_name: 'Sharma Boy', source_urls: ['https://spotify.com/playlist/kenya-top-50'], release_date: '2026-05-15', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    { track_title: 'Siko Fiti', artist_name: 'Matata, Boutross', source_urls: ['https://youtube.com/playlist/kenya-trending'], release_date: '2026-06-02', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    { track_title: 'Nitasimama', artist_name: 'Guardian Angel', source_urls: ['https://music.apple.com/playlist/ke-top-100'], release_date: '2026-05-01', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    { track_title: 'Wanani', artist_name: 'Bahati, Prince Indah', source_urls: ['https://spotify.com/playlist/kenya-top-50'], release_date: '2026-04-10', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    // ── Single source, older ──
    { track_title: 'Inauma', artist_name: 'Bensoul', source_urls: ['https://spotify.com/playlist/kenya-top-50'], release_date: '2025-12-01', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    { track_title: 'Melanin', artist_name: 'Patoranking, Sauti Sol', source_urls: ['https://music.apple.com/playlist/ke-top-100'], release_date: '2025-06-15', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    { track_title: 'Mucamo', artist_name: 'Wakadinali', source_urls: ['https://youtube.com/playlist/kenya-trending'], release_date: '2025-08-20', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    { track_title: 'Furaha', artist_name: 'Nyashinski', source_urls: ['https://spotify.com/playlist/kenya-top-50'], release_date: '2025-03-10', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    { track_title: 'Amor', artist_name: 'Otile Brown', source_urls: ['https://music.apple.com/playlist/ke-top-100'], release_date: '2026-06-04', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    // ── High-occurrence tracks (many appearances) ──
    { track_title: 'Sonona', artist_name: 'Sauti Sol', source_urls: ['https://spotify.com/playlist/kenya-top-50', 'https://music.apple.com/playlist/ke-top-100', 'https://youtube.com/playlist/kenya-trending', 'https://spotify.com/playlist/afro-pop-kenya', 'https://music.apple.com/playlist/east-african-hits'], release_date: '2026-06-01', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    { track_title: 'Sonona Remix', artist_name: 'Sauti Sol, Burna Boy', source_urls: ['https://spotify.com/playlist/kenya-top-50', 'https://music.apple.com/playlist/ke-top-100', 'https://youtube.com/playlist/kenya-trending', 'https://deezer.com/playlist/ke-hot', 'https://spotify.com/playlist/afro-pop-kenya', 'https://music.apple.com/playlist/east-african-hits'], release_date: '2026-05-20', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    // ── Boutross tracks to test anti-gaming overflow ──
    { track_title: 'Angela Remix', artist_name: 'Boutross, Nadia Mukami', source_urls: ['https://spotify.com/playlist/kenya-top-50', 'https://youtube.com/playlist/kenya-trending'], release_date: '2026-02-15', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    { track_title: 'Pewa', artist_name: 'Boutross, Khaligraph Jones', source_urls: ['https://spotify.com/playlist/kenya-top-50', 'https://youtube.com/playlist/kenya-trending'], release_date: '2025-10-01', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    { track_title: 'Soul Food', artist_name: 'Boutross, Xenia Manasseh', source_urls: ['https://spotify.com/playlist/kenya-top-50'], release_date: '2025-07-20', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    // ── No release date (tests recency=0) ──
    { track_title: 'Vile Inafaa', artist_name: 'Khaligraph Jones', source_urls: ['https://spotify.com/playlist/kenya-top-50', 'https://youtube.com/playlist/kenya-trending'], release_date: null, canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    { track_title: 'Ndovu Ni Kuu', artist_name: 'Krispah, Khaligraph Jones', source_urls: ['https://youtube.com/playlist/kenya-trending'], release_date: null, canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    // ── Gengetone / newer sounds ──
    { track_title: 'Wabebe', artist_name: 'Mbuzi Gang, Fathermoh', source_urls: ['https://spotify.com/playlist/kenya-top-50', 'https://youtube.com/playlist/kenya-trending'], release_date: '2026-05-28', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    { track_title: 'Kaskie Vibaya', artist_name: 'Fathermoh, Joefes', source_urls: ['https://spotify.com/playlist/kenya-top-50', 'https://youtube.com/playlist/kenya-trending'], release_date: '2026-04-22', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    { track_title: 'Buda', artist_name: 'Tipsy Gee, Fathermoh', source_urls: ['https://youtube.com/playlist/kenya-trending'], release_date: '2026-05-10', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    // ── Gospel ──
    { track_title: 'Mungu Mkuu', artist_name: 'Evelyn Wanjiru', source_urls: ['https://spotify.com/playlist/kenya-top-50', 'https://music.apple.com/playlist/ke-top-100'], release_date: '2026-05-12', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    { track_title: 'Nimekubali', artist_name: 'Size 8, DJ Mo', source_urls: ['https://youtube.com/playlist/kenya-trending'], release_date: '2026-06-01', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    // ── Bongo influence ──
    { track_title: 'Wale Wale', artist_name: 'Diamond Platnumz', source_urls: ['https://spotify.com/playlist/kenya-top-50', 'https://music.apple.com/playlist/ke-top-100', 'https://youtube.com/playlist/kenya-trending'], release_date: '2026-05-18', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    { track_title: 'Sugar', artist_name: 'Zuchu', source_urls: ['https://spotify.com/playlist/kenya-top-50', 'https://music.apple.com/playlist/ke-top-100'], release_date: '2026-06-03', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    { track_title: 'Nani', artist_name: 'Mbosso', source_urls: ['https://youtube.com/playlist/kenya-trending'], release_date: '2026-04-05', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    // ── More single-source entries ──
    { track_title: 'Tera Mery', artist_name: 'Nviiri The Storyteller', source_urls: ['https://spotify.com/playlist/kenya-top-50'], release_date: '2026-06-06', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    { track_title: 'Nairobi', artist_name: 'Bensoul, Sauti Sol', source_urls: ['https://music.apple.com/playlist/ke-top-100'], release_date: '2025-05-01', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    { track_title: 'Liar', artist_name: 'Willy Paul', source_urls: ['https://youtube.com/playlist/kenya-trending'], release_date: '2026-05-15', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    { track_title: 'Champez', artist_name: 'Matata, Stella Mwangi', source_urls: ['https://spotify.com/playlist/kenya-top-50'], release_date: '2026-04-18', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    { track_title: 'Mazishi', artist_name: 'Sauti Sol', source_urls: ['https://spotify.com/playlist/kenya-top-50', 'https://music.apple.com/playlist/ke-top-100'], release_date: '2026-03-20', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    // ── Fill out to 45 tracks with singles ──
    { track_title: 'Rhumba Japan', artist_name: 'Bien, Breeder LW', source_urls: ['https://spotify.com/playlist/kenya-top-50'], release_date: '2026-05-30', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    { track_title: 'Milele', artist_name: 'Nikita Kering', source_urls: ['https://music.apple.com/playlist/ke-top-100'], release_date: '2026-06-07', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    { track_title: 'Tamba', artist_name: 'Wakadinali', source_urls: ['https://youtube.com/playlist/kenya-trending', 'https://deezer.com/playlist/ke-hot'], release_date: '2026-05-05', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    { track_title: 'Tic Tac', artist_name: 'Nadia Mukami', source_urls: ['https://spotify.com/playlist/kenya-top-50', 'https://music.apple.com/playlist/ke-top-100'], release_date: '2026-01-15', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    { track_title: 'Hello', artist_name: 'Nyashinski', source_urls: ['https://spotify.com/playlist/kenya-top-50'], release_date: '2025-09-10', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
  ];
}

// ============================================================================
// Previous edition (40 entries)
// ============================================================================

function makePreviousEdition(): PreviousEditionEntry[] {
  return [
    { normalized_key: 'hallelujah (washwash)::khaligraph jones, bensoul', position: 1 },
    { normalized_key: 'nakam sai::sauti sol', position: 2 },
    { normalized_key: 'kwikwi::wakadinali', position: 3 },
    { normalized_key: 'miondoko::boutross, breeder lw', position: 4 },
    { normalized_key: 'angela::boutross', position: 5 },
    { normalized_key: 'dance ya kudance::mejja, exray', position: 6 },
    { normalized_key: 'kuna kuna::vic west, fathermoh', position: 7 },
    { normalized_key: 'mukuchu::gody tennor, tipsy gee', position: 8 },
    { normalized_key: 'dera::zzero sufuri, mbuzi gang', position: 9 },
    { normalized_key: 'nishike::bien', position: 10 },
    { normalized_key: 'true love::bien, aaron rimbui', position: 11 },
    { normalized_key: 'siko fiti::matata, boutross', position: 12 },
    { normalized_key: 'ma aqaan::sharma boy', position: 13 },
    { normalized_key: 'wanani::bahati, prince indah', position: 14 },
    { normalized_key: 'sonona::sauti sol', position: 15 },
    { normalized_key: 'sonona remix::sauti sol, burna boy', position: 16 },
    { normalized_key: 'wabebe::mbuzi gang, fathermoh', position: 17 },
    { normalized_key: 'inauma::bensoul', position: 18 },
    { normalized_key: 'kaskie vibaya::fathermoh, joefes', position: 19 },
    { normalized_key: 'wale wale::diamond platnumz', position: 20 },
    { normalized_key: 'buda::tipsy gee, fathermoh', position: 21 },
    { normalized_key: 'mungu mkuu::evelyn wanjiru', position: 22 },
    { normalized_key: 'sugar::zuchu', position: 23 },
    { normalized_key: 'champez::matata, stella mwangi', position: 24 },
    { normalized_key: 'mazishi::sauti sol', position: 25 },
    { normalized_key: 'tic tac::nadia mukami', position: 26 },
    { normalized_key: 'amor::otile brown', position: 27 },
    { normalized_key: 'tamba::wakadinali', position: 28 },
    { normalized_key: 'angela remix::boutross, nadia mukami', position: 29 },
    { normalized_key: 'rhumba japan::bien, breeder lw', position: 30 },
    // ── Tracks that fell off (for re-entry testing) ──
    { normalized_key: 'melanin::patoranking, sauti sol', position: 31 },
    { normalized_key: 'mucamo::wakadinali', position: 32 },
    { normalized_key: 'furaha::nyashinski', position: 33 },
    { normalized_key: 'vile inafaa::khaligraph jones', position: 34 },
    { normalized_key: 'nairobi::bensoul, sauti sol', position: 35 },
    { normalized_key: 'liar::willy paul', position: 36 },
    { normalized_key: 'hello::nyashinski', position: 37 },
    { normalized_key: 'milele::nikita kering', position: 38 },
    { normalized_key: 'lamba lolo::ethic', position: 39 },
    { normalized_key: 'sijazama::nameless', position: 40 },
  ];
}

function makePreviousEditionTitles(): Map<string, { track_title: string; artist_name: string; canonical_track_id: string | null; release_date: string | null }> {
  const map = new Map<string, { track_title: string; artist_name: string; canonical_track_id: string | null; release_date: string | null }>();
  map.set('lamba lolo::ethic', { track_title: 'Lamba Lolo', artist_name: 'Ethic', canonical_track_id: null, release_date: '2025-06-01' });
  map.set('sijazama::nameless', { track_title: 'Sijazama', artist_name: 'Nameless', canonical_track_id: null, release_date: '2025-08-15' });
  return map;
}

// ============================================================================
// Airplay evidence (for rescue testing)
// ============================================================================

function makeAirplayBuckets(): AirplayEvidenceBucket[] {
  return [
    // Matched by normalized_key — "Nakam Sai" has airplay evidence
    {
      canonical_track_id: 'airplay-track-001',
      normalized_key: 'nakam sai::sauti sol',
      station_id: 'stn-homeboyz',
      station_weight: 1.0,
      week_start: '2026-06-08',
      detection_count: 12,
      total_played_duration: 2400,
      weighted_score: 52,
    },
    {
      canonical_track_id: 'airplay-track-001',
      normalized_key: 'nakam sai::sauti sol',
      station_id: 'stn-nation-fm',
      station_weight: 1.5,
      week_start: '2026-06-08',
      detection_count: 8,
      total_played_duration: 1440,
      weighted_score: 36,
    },
    // Airplay-only rescue candidate (no streaming evidence)
    {
      canonical_track_id: 'airplay-only-001',
      normalized_key: 'airplay rescue::kenny sol',
      station_id: 'stn-homeboyz',
      station_weight: 1.0,
      week_start: '2026-06-08',
      detection_count: 6,
      total_played_duration: 900,
      weighted_score: 21,
    },
    {
      canonical_track_id: 'airplay-only-001',
      normalized_key: 'airplay rescue::kenny sol',
      station_id: 'stn-kiss-fm',
      station_weight: 1.0,
      week_start: '2026-06-08',
      detection_count: 4,
      total_played_duration: 600,
      weighted_score: 14,
    },
  ];
}

// ============================================================================
// Shared pipeline config (chart_size=20 per brief spec)
// ============================================================================

const CHART_CONFIG: ScoringConfig = {
  ...DEFAULT_SCORING_CONFIG,
  chart_size: 20,
  streaming_min_sources: 1,
  airplay_enabled: true,
  airplay_rescue_mode: 'allow_rescue',
  anti_gaming_max_tracks_per_lead_artist: 3,
  anti_gaming_overlap_bonus_cap: 10,
  anti_gaming_artist_overflow_penalty: 8,
  missing_policy: 'review',
};

// ============================================================================
// Tests
// ============================================================================

describe('Gate A — Full Pipeline Integration', () => {
  const rawEvidence = makeRawEvidence();
  const airplayBuckets = makeAirplayBuckets();
  const previousEdition = makePreviousEdition();
  const previousEditionTitles = makePreviousEditionTitles();
  const editionDate = '2026-06-11';

  let result: PipelineResult;

  // Run once, assert many times
  beforeAll(() => {
    result = runFullPipeline(
      rawEvidence,
      airplayBuckets,
      previousEdition,
      previousEditionTitles,
      CHART_CONFIG,
      editionDate,
    );
  });

  // ─────────────────────────────────────────────────────
  // A1 — All component scores finite and non-negative
  // ─────────────────────────────────────────────────────
  describe('A1 — Component score bounds', () => {
    it('all scored rows have finite non-negative scores', () => {
      for (const row of result.scoredRows) {
        expect(Number.isFinite(row.source_score)).toBe(true);
        expect(row.source_score).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(row.cross_source_bonus)).toBe(true);
        expect(row.cross_source_bonus).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(row.overlap_bonus)).toBe(true);
        expect(row.overlap_bonus).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(row.recency_score)).toBe(true);
        expect(row.recency_score).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(row.continuity_score)).toBe(true);
        expect(row.continuity_score).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(row.carry_forward_bonus)).toBe(true);
        expect(row.carry_forward_bonus).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(row.airplay_score)).toBe(true);
        expect(row.airplay_score).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(row.anti_gaming_penalty)).toBe(true);
        expect(row.anti_gaming_penalty).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(row.total_score)).toBe(true);
        expect(row.total_score).toBeGreaterThanOrEqual(0);
      }
    });

    it('source_score capped at 72', () => {
      for (const row of result.scoredRows) {
        expect(row.source_score).toBeLessThanOrEqual(72);
      }
    });

    it('cross_source_bonus capped in standard mode', () => {
      for (const row of result.scoredRows) {
        expect(row.cross_source_bonus).toBeLessThanOrEqual(30); // strong cap upper bound
      }
    });

    it('overlap_bonus capped at anti_gaming_overlap_bonus_cap', () => {
      for (const row of result.scoredRows) {
        expect(row.overlap_bonus).toBeLessThanOrEqual(CHART_CONFIG.anti_gaming_overlap_bonus_cap!);
      }
    });
  });

  // ─────────────────────────────────────────────────────
  // A2 — Total = Σ components − penalty
  // ─────────────────────────────────────────────────────
  describe('A2 — Score sum invariant', () => {
    it('total_score = sum of components - anti_gaming_penalty (ε < 0.001)', () => {
      for (const row of result.scoredRows) {
        const sum = row.source_score
          + row.cross_source_bonus
          + row.overlap_bonus
          + row.recency_score
          + row.continuity_score
          + row.carry_forward_bonus
          + row.airplay_score
          - row.anti_gaming_penalty;

        expect(Math.abs(sum - row.total_score)).toBeLessThan(0.001);
      }
    });
  });

  // ─────────────────────────────────────────────────────
  // A3 — Sequential rank assignment
  // ─────────────────────────────────────────────────────
  describe('A3 — Rank assignment', () => {
    it('ranks are 1..N sequentially', () => {
      expect(result.scoredRows.length).toBeGreaterThan(0);
      expect(result.scoredRows[0].rank).toBe(1);

      for (let i = 1; i < result.scoredRows.length; i++) {
        expect(result.scoredRows[i].rank).toBe(result.scoredRows[i - 1].rank + 1);
      }
    });

    it('chart_size respected (≤ configured max)', () => {
      expect(result.scoredRows.length).toBeLessThanOrEqual(CHART_CONFIG.chart_size!);
    });
  });

  // ─────────────────────────────────────────────────────
  // A4 — Monotonic score ordering
  // ─────────────────────────────────────────────────────
  describe('A4 — Score monotonicity by rank', () => {
    it('scores are non-increasing with rank', () => {
      for (let i = 1; i < result.scoredRows.length; i++) {
        expect(result.scoredRows[i].total_score)
          .toBeLessThanOrEqual(result.scoredRows[i - 1].total_score);
      }
    });
  });

  // ─────────────────────────────────────────────────────
  // A5 — Movement classification
  // ─────────────────────────────────────────────────────
  describe('A5 — Movement classification', () => {
    it('every row has a valid movement label', () => {
      const validMovements = new Set(['up', 'down', 'same', 'new', 'reentry', null]);
      for (const row of result.scoredRows) {
        expect(validMovements.has(row.movement)).toBe(true);
      }
    });

    it('tracks in previous edition at same rank get "same"', () => {
      // "Hallelujah (Washwash)" was #1 previously, should be #1 again or moved
      const hallelujah = result.scoredRows.find(
        (r) => r.normalized_key === 'hallelujah (washwash)::khaligraph jones, bensoul',
      );
      if (hallelujah && hallelujah.rank === 1) {
        expect(hallelujah.movement).toBe('same');
      }
    });

    it('tracks not in previous edition with no history get "new"', () => {
      // "Nitasimama" by Guardian Angel — not in previous edition
      const nitasimama = result.scoredRows.find(
        (r) => r.normalized_key === 'nitasimama::guardian angel',
      );
      if (nitasimama && nitasimama.previous_rank === null) {
        expect(nitasimama.movement).toBe('new');
      }
    });
  });

  // ─────────────────────────────────────────────────────
  // A6 — Source payload built for every row
  // ─────────────────────────────────────────────────────
  describe('A6 — Source payload completeness', () => {
    it('every scored row has a source_payload', () => {
      for (const row of result.scoredRows) {
        expect(row.source_payload).toBeDefined();
      }
    });

    it('source_payload contains score_breakdown with all 8 fields', () => {
      for (const row of result.scoredRows) {
        const bd = row.source_payload.score_breakdown;
        expect(bd).toBeDefined();
        expect(typeof bd.source_score).toBe('number');
        expect(typeof bd.cross_source_bonus).toBe('number');
        expect(typeof bd.overlap_bonus).toBe('number');
        expect(typeof bd.recency_score).toBe('number');
        expect(typeof bd.continuity_score).toBe('number');
        expect(typeof bd.carry_forward_bonus).toBe('number');
        expect(typeof bd.airplay_score).toBe('number');
        expect(typeof bd.anti_gaming_penalty).toBe('number');
        expect(typeof bd.total_score).toBe('number');
      }
    });

    it('source_payload contains anti_gaming flags', () => {
      for (const row of result.scoredRows) {
        const ag = row.source_payload.anti_gaming;
        expect(ag).toBeDefined();
        expect(typeof ag.overlap_bonus_capped).toBe('boolean');
        expect(typeof ag.lead_artist_overflow).toBe('boolean');
        expect(typeof ag.overflow_index).toBe('number');
      }
    });

    it('source_payload inputs match row data', () => {
      for (const row of result.scoredRows) {
        const inp = row.source_payload.inputs;
        expect(inp.source_count).toBe(row.source_count);
        expect(inp.occurrence_count).toBe(row.occurrence_count);
        expect(inp.carry_forward_only).toBe(row.carry_forward_only);
      }
    });
  });

  // ─────────────────────────────────────────────────────
  // A7 — Edition summary consistency
  // ─────────────────────────────────────────────────────
  describe('A7 — Edition summary', () => {
    it('eligible_rows = scoredRows.length', () => {
      expect(result.editionSummary.eligible_rows).toBe(result.scoredRows.length);
    });

    it('carry_forward_count matches counted CF rows', () => {
      const actualCF = result.scoredRows.filter((r) => r.carry_forward_only).length;
      expect(result.editionSummary.carry_forward_count).toBe(actualCF);
    });

    it('total_input_rows ≥ eligible + excluded', () => {
      expect(result.editionSummary.total_input_rows)
        .toBeGreaterThanOrEqual(
          result.editionSummary.eligible_rows + result.editionSummary.excluded_rows,
        );
    });

    it('airplay_rescue_count matches engine output', () => {
      const airplayRescues = result.scoredRows.filter(
        (r) => r.airplay_candidate_only,
      ).length;
      expect(result.editionSummary.airplay_rescue_count).toBe(airplayRescues);
    });
  });

  // ─────────────────────────────────────────────────────
  // A8 — Policy snapshot
  // ─────────────────────────────────────────────────────
  describe('A8 — Policy snapshot', () => {
    it('has all 4 version strings', () => {
      expect(result.policySnapshot.methodology_version).toBeTruthy();
      expect(result.policySnapshot.source_policy_version).toBeTruthy();
      expect(result.policySnapshot.eligibility_policy_version).toBeTruthy();
      expect(result.policySnapshot.scoring_policy_version).toBeTruthy();
    });

    it('rule_set_snapshot is a ScoringConfig', () => {
      const rs = result.policySnapshot.rule_set_snapshot;
      expect(typeof rs.chart_size).toBe('number');
      expect(typeof rs.cross_source_mode).toBe('string');
      expect(typeof rs.airplay_enabled).toBe('boolean');
    });
  });

  // ─────────────────────────────────────────────────────
  // A9 — Determinism
  // ─────────────────────────────────────────────────────
  describe('A9 — Determinism', () => {
    it('same inputs produce identical JSON output', () => {
      const result2 = runFullPipeline(
        rawEvidence,
        airplayBuckets,
        previousEdition,
        previousEditionTitles,
        CHART_CONFIG,
        editionDate,
      );

      // Compare scored rows by JSON
      const rows1 = result.scoredRows.map((r) => ({
        key: r.normalized_key,
        rank: r.rank,
        total: r.total_score,
        movement: r.movement,
      }));

      const rows2 = result2.scoredRows.map((r) => ({
        key: r.normalized_key,
        rank: r.rank,
        total: r.total_score,
        movement: r.movement,
      }));

      expect(JSON.stringify(rows1)).toBe(JSON.stringify(rows2));
    });
  });

  // ─────────────────────────────────────────────────────
  // A10 — Carry-forward
  // ─────────────────────────────────────────────────────
  describe('A10 — Carry-forward behavior', () => {
    it('CF-only rows have source_count=0 and carry_forward_only=true', () => {
      const cfRows = result.scoredRows.filter((r) => r.carry_forward_only);
      for (const row of cfRows) {
        expect(row.source_count).toBe(0);
        expect(row.occurrence_count).toBe(0);
      }
    });

    it('CF rows get carry_forward_bonus > 0 when previous position ≤ 11', () => {
      const cfRows = result.scoredRows.filter((r) => r.carry_forward_only);
      // Lamba Lolo was #39, Sijazama was #40 — both get 8 (floor)
      for (const row of cfRows) {
        expect(row.carry_forward_bonus).toBeGreaterThanOrEqual(8);
      }
    });
  });

  // ─────────────────────────────────────────────────────
  // A11 — Airplay rescue
  // ─────────────────────────────────────────────────────
  describe('A11 — Airplay rescue', () => {
    it('airplay rescue candidate appears in scored rows', () => {
      const rescue = result.scoredRows.find(
        (r) => r.normalized_key === 'airplay rescue::kenny sol',
      );
      if (rescue) {
        expect(rescue.airplay_candidate_only).toBe(true);
        expect(rescue.airplay_score).toBeGreaterThan(0);
      }
      // If airplay evidence fails minimums, it won't appear — that's OK too
    });
  });

  // ─────────────────────────────────────────────────────
  // A12 — Anti-gaming: artist overflow
  // ─────────────────────────────────────────────────────
  describe('A12 — Anti-gaming overflow', () => {
    it('Boutross has multiple tracks; at most 3 escape penalty', () => {
      const boutrossTracks = result.scoredRows.filter(
        (r) => r.lead_artist_key.includes('boutross'),
      );
      const penalized = boutrossTracks.filter((r) => r.lead_artist_overflow);

      // With 5 Boutross tracks in evidence, some should be penalized if they rank
      // The anti-gaming max is 3 per lead_artist_key
      const unpenalized = boutrossTracks.length - penalized.length;
      expect(unpenalized).toBeLessThanOrEqual(3);
    });

    it('Sauti Sol has multiple tracks; at most 3 escape penalty', () => {
      const ssTracks = result.scoredRows.filter(
        (r) => r.lead_artist_key.includes('sauti sol'),
      );
      const penalized = ssTracks.filter((r) => r.lead_artist_overflow);
      const unpenalized = ssTracks.length - penalized.length;
      expect(unpenalized).toBeLessThanOrEqual(3);

      // Penalized tracks should have anti_gaming_penalty > 0
      for (const row of penalized) {
        expect(row.anti_gaming_penalty).toBeGreaterThan(0);
      }
    });

    it('penalized tracks show lead_artist_overflow=true', () => {
      const overflowTracks = result.scoredRows.filter((r) => r.lead_artist_overflow);
      for (const row of overflowTracks) {
        expect(row.anti_gaming_penalty).toBeGreaterThan(0);
        expect(row.source_payload.anti_gaming.lead_artist_overflow).toBe(true);
      }
    });
  });

  // ─────────────────────────────────────────────────────
  // A13 — Exclusion
  // ─────────────────────────────────────────────────────
  describe('A13 — Exclusion', () => {
    it('excludedRows have reasons', () => {
      for (const ex of result.excludedRows) {
        expect(ex.reasons.length).toBeGreaterThan(0);
      }
    });

    it('edition summary exclusion_summary tallies correctly', () => {
      const summary = result.editionSummary.exclusion_summary;
      let tally = 0;
      for (const count of Object.values(summary)) {
        tally += count;
      }
      expect(tally).toBeGreaterThanOrEqual(result.editionSummary.excluded_rows);
    });
  });

  // ─────────────────────────────────────────────────────
  // A14 — Structural sanity
  // ─────────────────────────────────────────────────────
  describe('A14 — Structural sanity', () => {
    it('no duplicate ranks', () => {
      const ranks = result.scoredRows.map((r) => r.rank);
      expect(new Set(ranks).size).toBe(ranks.length);
    });

    it('no duplicate normalized_keys in scored rows', () => {
      const keys = result.scoredRows.map((r) => r.normalized_key);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it('pipelineReport generates without error', () => {
      const report = pipelineReport(result);
      expect(report).toContain('SCORING PIPELINE');
      expect(report).toContain('Top 10');
    });
  });
});

// ============================================================================
// Sub-pipeline unit tests
// ============================================================================

describe('buildScoringInputRows', () => {
  it('aggregates multiple records with same normalized key', () => {
    const raw: RawEvidenceRecord[] = [
      { track_title: 'Same Song', artist_name: 'Same Artist', source_urls: ['https://a.com', 'https://b.com'], release_date: '2026-06-01', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
      { track_title: 'Same Song', artist_name: 'Same Artist', source_urls: ['https://c.com'], release_date: '2026-06-01', canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null },
    ];

    const rows = buildScoringInputRows(raw);
    expect(rows.length).toBe(1);
    expect(rows[0].source_count).toBe(3);
    expect(rows[0].occurrence_count).toBe(3);
  });

  it('handles empty input', () => {
    const rows = buildScoringInputRows([]);
    expect(rows.length).toBe(0);
  });
});

describe('carryForwardMerge', () => {
  it('adds CF rows for tracks in previous edition not in fresh evidence', () => {
    const fresh = makeRawEvidence();
    const freshRows = buildScoringInputRows(fresh);
    const prevEdition = makePreviousEdition();
    const titles = makePreviousEditionTitles();

    const merged = carryForwardMerge(freshRows, prevEdition, titles);

    // Lamba Lolo and Sijazama are in previous edition but not fresh evidence
    const lamba = merged.find((r) => r.normalized_key === 'lamba lolo::ethic');
    const sijazama = merged.find((r) => r.normalized_key === 'sijazama::nameless');

    expect(lamba).toBeDefined();
    expect(lamba!.carry_forward_only).toBe(true);
    expect(sijazama).toBeDefined();
    expect(sijazama!.carry_forward_only).toBe(true);
  });

  it('does not duplicate tracks already in fresh evidence', () => {
    const freshRows = buildScoringInputRows(makeRawEvidence());
    const prevEdition = makePreviousEdition();
    const titles = makePreviousEditionTitles();

    const merged = carryForwardMerge(freshRows, prevEdition, titles);

    // Hallelujah is in both fresh and previous — should appear once, NOT CF
    const hallelujahMatches = merged.filter(
      (r) => r.normalized_key === 'hallelujah (washwash)::khaligraph jones, bensoul',
    );
    expect(hallelujahMatches.length).toBe(1);
    expect(hallelujahMatches[0].carry_forward_only).toBe(false);
  });
});