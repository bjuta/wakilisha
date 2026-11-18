import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// chart-ingest-api retired in the 2026-11-17 Charts reset; runtime-source
// assertions retired with it. Database authority assertions remain.
const migration = readFileSync(
  "supabase/migrations/20260923063254_chart_uuid_identity_authority_v1.sql",
  "utf8",
);
const verifier = readFileSync(
  "scripts/control-plane/verify-registry-chart-materialization-runtime.sql",
  "utf8",
);

function between(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);

  expect(startIndex, `missing start marker: ${start}`).toBeGreaterThanOrEqual(0);
  expect(endIndex, `missing end marker: ${end}`).toBeGreaterThan(startIndex);

  return source.slice(startIndex, endIndex);
}

describe("Chart UUID identity authority", () => {
  it("retires normalized text uniqueness and enforces accepted Track UUID uniqueness per run", () => {
    expect(migration).toContain(
      "drop constraint chart_ingest_candidates_run_id_normalized_key_key",
    );
    expect(migration).toContain(
      "chart_ingest_matches_run_accepted_track_uuid_uidx",
    );
    expect(migration).toContain(
      "where entity_type='track'",
    );
    expect(migration).toContain(
      "and status='accepted'",
    );
    expect(migration).toContain(
      "'canonical_history'::text",
    );
  });

  it("limits Registry admission to explicit review under manage_registry", () => {
    expect(migration).toContain(
      "Current user cannot issue this chart Registry grant.",
    );
    expect(migration).toContain("manage_registry");
    expect(
      between(
        migration,
        "CREATE OR REPLACE FUNCTION public.chart_materialize_candidate_registry_v1",
        "CREATE OR REPLACE FUNCTION public.admin_apply_chart_artist_resolution_decision",
      ),
    ).not.toContain("publish_charts");

    expect(verifier).toContain(
      "Chart materialization regained publish-time Registry mutation authority",
    );
    expect(verifier).toContain(
      "p_required_user_capability_key <> ''manage_registry''",
    );
  });

  it("resolves origin, playback and commit validation through accepted Track UUIDs", () => {
    for (const fn of [
      "chart_get_run_candidate_origin_report",
      "chart_get_run_origin_review_queue",
      "chart_get_run_playback_readiness",
      "chart_get_run_integrity_report",
    ]) {
      const start = migration.indexOf(
        `create or replace function public.${fn}`,
      );
      expect(start, `missing migrated function ${fn}`).toBeGreaterThanOrEqual(0);
    }

    expect(migration).toContain("chart_ingest_matches");
    expect(migration).toContain("canonical_entity_id");
    expect(migration).toContain("registry_track_artists");
    expect(migration).not.toContain("chart_entry_artist_token_slugs");
  });
});


/**
 * Charts 2.0 source collection contracts reuse this retained Chart authority
 * test rather than recreating the removed WK100 test suite. All originals below
 * are synthetic fixtures: no source-provider success or source admission claim.
 */
import { createHash } from "node:crypto";
import {
  decodeCharts2Original,
  listCharts2SourceContracts,
} from "../../supabase/functions/_shared/charts2-original-candidate.mjs";

const charts2ObservedAt = "2026-11-18T12:00:00.000Z";
const charts2Bytes = (text: string) => new TextEncoder().encode(text);
const charts2Sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const charts2Mdundo = (count: number) =>
  Array.from({length: count}, (_, i) =>
    `<div class="md-playlist-song-item" data-playlist-url="/top-charts/ke" data-index="${i + 1}" data-id="song-${i + 1}" data-title="Track ${i + 1}" data-artist="Artist ${i + 1}"></div>`
  ).join("\n");
const charts2Shazam = (count: number) =>
  ["Rank,Artist,Title", ...Array.from({length: count}, (_, i) =>
    `${i + 1},Artist ${i + 1},Title ${i + 1}`)].join("\n");
const charts2AppleUrl =
  "https://music.apple.com/ke/playlist/top-100-kenya/pl.0b36ea82865d4adeb9d1d62207aab172";
const charts2AudiomackUrl = "https://audiomack.com/geo-charts/playlist/kenya";
const charts2YoutubeUrl = "https://charts.youtube.com/youtubei/v1/browse?alt=json";

describe("Charts 2.0 original-byte source adapters (candidate only)", () => {
  it("selects exactly five Kenya first-party families and their native depths", () => {
    const rows = listCharts2SourceContracts();
    expect(rows.map((r: any) => [r.source_key, r.market, r.depth])).toEqual([
      ["apple_ke", "KE", 100],
      ["shazam_ke", "KE", 200],
      ["mdundo_ke", "KE", 100],
      ["youtube_ke", "KE", 100],
      ["audiomack_ke", "KE", 100],
    ]);
    expect(rows.every((r: any) => r.endpoint_state.length > 0)).toBe(true);
  });

  it("preserves an authentic 99/100 Mdundo-style rank sequence as partial, not full-depth", async () => {
    const raw = charts2Bytes(charts2Mdundo(99));
    const result = await decodeCharts2Original({
      source_key: "mdundo_ke", endpoint: "https://mdundo.com/top-charts/ke",
      observed_at: charts2ObservedAt, original_bytes: raw,
    });
    expect(result.declared_depth).toBe(100);
    expect(result.observed_depth).toBe(99);
    expect(result.status).toBe("partial_depth");
    expect(result.payload_sha256).toBe(charts2Sha(raw));
    expect(result.can_score).toBe(false);
    expect(result.can_publish).toBe(false);
    expect(result.source_access_authorized).toBe(false);
    expect(result.original_storage_verified).toBe(false);
  });

  it("keeps Shazam recognition at native Top 200 with no invented IDs", async () => {
    const original = charts2Bytes(charts2Shazam(200));
    const result = await decodeCharts2Original({
      source_key: "shazam_ke", endpoint: "https://www.shazam.com/charts/top-200/kenya",
      observed_at: charts2ObservedAt, original_bytes: original,
    });
    expect(result.declared_depth).toBe(200);
    expect(result.observed_depth).toBe(200);
    expect(result.unresolved_identity_count).toBe(200);
    expect(result.rows[199].rank).toBe(200);
    expect(result.status).toBe("succeeded");
    expect(result.can_score).toBe(false);
  });

  it("verifies Apple Kenya Top 100 URL-bound rank and JSON-LD cross-check", async () => {
    const urls = Array.from({length: 100}, (_, i) =>
      `https://music.apple.com/ke/song/title-${i + 1}/${10000000 + i}`);
    const metas = urls.map(u => `<meta property="music:song" content="${u}">`).join("");
    const ranks = urls.map((_, i) =>
      `<meta property="music:song:track" content="${i + 1}">`).join("");
    const jsonld = JSON.stringify({
      "@type": "MusicPlaylist", numTracks: 100,
      track: urls.map((url, i) => ({
        "@type": "MusicRecording", name: `Song ${i + 1}`,
        duration: "PT3M20S", url,
      })),
    });
    const html = `<html><head><meta property="music:song_count" content="100">${metas}${ranks}<script type="application/ld+json">${jsonld}</script></head></html>`;
    const result = await decodeCharts2Original({
      source_key: "apple_ke", endpoint: charts2AppleUrl,
      observed_at: charts2ObservedAt, original_bytes: charts2Bytes(html),
    });
    expect(result.status).toBe("succeeded");
    expect(result.unresolved_identity_count).toBe(0);
    expect(result.rows[0].rank).toBe(1);
    expect(result.rows[99].rank).toBe(100);
    expect(result.native_period).toBe("unknown");
  });

  it("holds Audiomack title-only chart metadata as unresolved, never as validated identities", async () => {
    const tags = Array.from({length:100}, (_,i) =>
      `<meta property="music:song" content="Track ${i + 1}">`).join("");
    const html = `<html><head><title>Weekly 100: Kenya</title>${tags}</head><body><script>{"track_count":100}</script></body></html>`;
    const result = await decodeCharts2Original({
      source_key: "audiomack_ke", endpoint: charts2AudiomackUrl,
      observed_at: charts2ObservedAt, original_bytes: charts2Bytes(html),
    });
    expect(result.observed_depth).toBe(100);
    expect(result.unresolved_identity_count).toBe(100);
    expect(result.can_score).toBe(false);
    expect(result.can_publish).toBe(false);
  });

  it("retains YouTube native view counts while quarantining one missing video ID", async () => {
    const tracks = Array.from({length:100}, (_,i) => ({
      id: `opaque-row-${i + 1}`,
      ...(i===88 ? {} : {encryptedVideoId: `a${String(i + 1).padStart(10,"0")}`}),
      chartEntryMetadata: {currentPosition:i+1},
      name: `Song ${i+1}`, artists:[{name:"Artist"}], viewCount:String(10000-i),
    }));
    const payload = {
      contents:{sectionListRenderer:{contents:[{
        musicAnalyticsSectionRenderer:{content:{trackTypes:[{
          listType:"TOP_VIEWS_CHART",chartPeriodType:"CHART_PERIOD_TYPE_WEEKLY",
          endDate:"2026-11-05",trackViews:tracks,
        }]}}
      }]}}
    };
    const result = await decodeCharts2Original({
      source_key:"youtube_ke", endpoint:charts2YoutubeUrl,
      target_period_key:"weekly:20261030:20261105:ke",
      observed_at:charts2ObservedAt,
      original_bytes:charts2Bytes(JSON.stringify(payload)),
    });
    expect(result.status).toBe("succeeded");
    expect(result.unresolved_identity_count).toBe(1);
    expect(result.rows[88].provider_track_id).toBe(null);
    expect(result.rows[88].view_count).toBe(10000-88);
    expect(result.provider_week_ending_date).toBe("2026-11-05");
  });

  it("fails closed for excluded providers, forged origin, missing period or false time", async () => {
    const raw = charts2Bytes(charts2Mdundo(2));
    const baseInput = {
      source_key:"mdundo_ke", endpoint:"https://mdundo.com/top-charts/ke",
      original_bytes:raw,observed_at:charts2ObservedAt,
    };
    await expect(decodeCharts2Original({...baseInput,source_key:"boomplay_ke"}))
      .rejects.toThrow("charts2_source_not_selected");
    await expect(decodeCharts2Original({...baseInput,endpoint:"https://evil.example/charts"}))
      .rejects.toThrow("charts2_source_endpoint_unreviewed");
    await expect(decodeCharts2Original({...baseInput,observed_at:"2026-11-18"}))
      .rejects.toThrow("charts2_observed_time_invalid");
    await expect(decodeCharts2Original({
      ...baseInput,source_key:"youtube_ke",endpoint:charts2YoutubeUrl,
    })).rejects.toThrow("charts2_youtube_target_period_missing");
  });

  it("rejects malformed original bodies and invented rank depth", async () => {
    const baseInput = {
      source_key:"mdundo_ke",endpoint:"https://mdundo.com/top-charts/ke",
      observed_at:charts2ObservedAt,
    };
    await expect(decodeCharts2Original({...baseInput,original_bytes:new Uint8Array(0)}))
      .rejects.toThrow("charts2_original_bytes_invalid");
    await expect(decodeCharts2Original({
      ...baseInput,original_bytes:new Uint8Array([255,254]),
    })).rejects.toThrow("charts2_original_utf8_invalid");
    await expect(decodeCharts2Original({
      ...baseInput,original_bytes:charts2Bytes(charts2Mdundo(101)),
    })).rejects.toThrow("mdundo_ke_invalid_rows");
    const gap = charts2Mdundo(3).replace('data-index="2"', 'data-index="7"');
    await expect(decodeCharts2Original({...baseInput,original_bytes:charts2Bytes(gap)}))
      .rejects.toThrow("mdundo_ke_noncontiguous_rank");
  });
});
