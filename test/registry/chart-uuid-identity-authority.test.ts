import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { transpileModule, ScriptTarget, ModuleKind, DiagnosticCategory } from "typescript";

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
  charts2YouTubeNativeWeeklyPost,
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
  it("reuses the exact Kenya Top Songs native POST with a checked provider week", () => {
    const request = charts2YouTubeNativeWeeklyPost(
      "youtube_ke", charts2YoutubeUrl, "weekly:20261030:20261105:ke");
    expect(request.method).toBe("POST");
    const data = JSON.parse(request.body);
    expect(data.context.client.clientName).toBe("WEB_MUSIC_ANALYTICS");
    expect(data.context.client.gl).toBe("KE");
    expect(data.browseId).toBe("FEmusic_analytics_charts_home");
    expect(data.query).toContain("chart_params_country_code=ke");
    expect(data.query).toContain("chart_params_chart_type=TRACKS");
    expect(data.query).toContain("chart_params_period_type=WEEKLY");
    expect(data.query).toContain("chart_params_end_date=20261105");
    expect(() => charts2YouTubeNativeWeeklyPost(
      "apple_ke", charts2YoutubeUrl, "weekly:20261030:20261105:ke"))
      .toThrow("charts2_youtube_post_source_unqualified");
    expect(() => charts2YouTubeNativeWeeklyPost(
      "youtube_ke", "https://www.youtube.com/results", "weekly:20261030:20261105:ke"))
      .toThrow("charts2_youtube_post_source_unqualified");
    for (const period of [
      "weekly:20261030:20261112:ke", // requested period is not exactly seven days
      "weekly:20261031:20261105:ke",
      "weekly:20261101:20261106:ke", // YouTube native week must end Thursday
      "weekly:20260225:20260230:ke", // invalid calendar date
      "weekly:20261030:20261105:us",
      "20261105",
    ]) {
      expect(() => charts2YouTubeNativeWeeklyPost(
        "youtube_ke", charts2YoutubeUrl, period))
        .toThrow("charts2_youtube_post_period_unqualified");
    }
  });

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
    expect(rows.find((r: any) => r.source_key === "mdundo_ke")?.first_party_endpoint)
      .toBe("https://play.mdundo.com/top-charts/ke");
    expect(rows.find((r: any) => r.source_key === "shazam_ke")?.first_party_endpoint)
      .toBe("https://www.shazam.com/services/charts/csv/top-200/kenya");
  });

  it("preserves an authentic 99/100 Mdundo-style rank sequence as partial, not full-depth", async () => {
    const raw = charts2Bytes(charts2Mdundo(99));
    const result = await decodeCharts2Original({
      source_key: "mdundo_ke", endpoint: "https://play.mdundo.com/top-charts/ke",
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
      source_key: "shazam_ke", endpoint: "https://www.shazam.com/services/charts/csv/top-200/kenya",
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
      source_key:"mdundo_ke", endpoint:"https://play.mdundo.com/top-charts/ke",
      original_bytes:raw,observed_at:charts2ObservedAt,
    };
    await expect(decodeCharts2Original({...baseInput,source_key:"boomplay_ke"}))
      .rejects.toThrow("charts2_source_not_selected");
    await expect(decodeCharts2Original({...baseInput,endpoint:"https://evil.example/charts"}))
      .rejects.toThrow("charts2_source_endpoint_unreviewed");
    await expect(decodeCharts2Original({
      ...baseInput, endpoint:"https://mdundo.com/top-charts/ke",
    })).rejects.toThrow("charts2_source_endpoint_unreviewed");
    await expect(decodeCharts2Original({
      ...baseInput, source_key:"shazam_ke",
      endpoint:"https://www.shazam.com/charts/top-200/kenya",
    })).rejects.toThrow("charts2_source_endpoint_unreviewed");
    await expect(decodeCharts2Original({...baseInput,observed_at:"2026-11-18"}))
      .rejects.toThrow("charts2_observed_time_invalid");
    await expect(decodeCharts2Original({
      ...baseInput,source_key:"youtube_ke",endpoint:charts2YoutubeUrl,
    })).rejects.toThrow("charts2_youtube_target_period_missing");
  });

  it("rejects malformed original bodies and invented rank depth", async () => {
    const baseInput = {
      source_key:"mdundo_ke",endpoint:"https://play.mdundo.com/top-charts/ke",
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


describe("Charts 2.0 private evidence migration authority", () => {
  const charts2Sql = readFileSync(
    "supabase/migrations/20261118152352_charts2_source_evidence_v1.sql",
    "utf8",
  );

  it("uses the exact pinned Supabase CLI-generated migration path and limits scope", () => {
    expect(charts2Sql).toContain("GitHub run 44335133638");
    expect(charts2Sql).toContain("begin;");
    expect(charts2Sql.trimEnd().endsWith("commit;")).toBe(true);
    expect(charts2Sql).not.toContain("update public.wk_chart_programs_v2");
    expect(charts2Sql).not.toContain("create extension");
    expect(charts2Sql).not.toContain("wk100_");
  });

  it("seeds only the five approved Kenya sources without granting admission", () => {
    for (const key of ["apple_ke","shazam_ke","mdundo_ke","youtube_ke","audiomack_ke"]) {
      expect(charts2Sql).toContain(`('${key}',${key === "shazam_ke" ? "200" : "100"})`);
    }
    expect(charts2Sql).toContain("default 'held'");
    expect(charts2Sql).toContain("constraint charts2_method_admission_complete");
    expect(charts2Sql).toContain("reviewed_by is not null");
    expect(charts2Sql).toContain("authorization_expires_at > reviewed_at");
  });

  it("keeps private evidence immutable and nonpublishing, with no public grants", () => {
    expect(charts2Sql).toContain("create trigger charts2_receipt_immutable_v1");
    expect(charts2Sql).toContain("create trigger charts2_guard_receipt_rows_v1");
    expect(charts2Sql).toContain("candidate_only boolean not null default true");
    expect(charts2Sql).toContain("can_score boolean not null default false");
    expect(charts2Sql).toContain("can_publish boolean not null default false");
    expect(charts2Sql).toContain("alter table platform_private.charts2_capture_receipts_v1 enable row level security");
    expect(charts2Sql).toContain("revoke all on platform_private.charts2_capture_receipts_v1 from public,anon,authenticated");
    expect(charts2Sql).not.toMatch(/grant (select|insert|update|delete|all) on platform_private\.charts2_/i);
  });

  it("uses a nonpublic 4 MiB Storage bucket and both native chart depths", () => {
    expect(charts2Sql).toContain("'charts2-evidence-private-v1'");
    expect(charts2Sql).toContain("false,4000000");
    expect(charts2Sql).toContain("source_key = 'shazam_ke' and expected_depth = 200");
    expect(charts2Sql).toContain("source_key <> 'shazam_ke' and expected_depth = 100");
    expect(charts2Sql).toContain("charts2_capture_rank_sequence_invalid");
    expect(charts2Sql).toContain("charts2_capture_duplicate_provider_identity");
  });
});


describe("Charts 2.0 restricted capture gateway v1", () => {
  const migrationSql = readFileSync(
    "supabase/migrations/20261118164450_charts2_private_capture_gateway_v1.sql",
    "utf8",
  );
  const nativePostSql = readFileSync(
    "supabase/migrations/20261118185142_charts2_youtube_native_post_v1.sql",
    "utf8",
  );
  const edge = readFileSync("supabase/functions/charts2-capture/index.ts", "utf8");
  const config = readFileSync("supabase/config.toml", "utf8");

  it("exposes only service-role method read and candidate-receipt persistence", () => {
    expect(migrationSql).toContain("security definer");
    expect(migrationSql).toContain("set search_path = ''");
    expect(migrationSql).toContain("public.charts2_get_collector_method_v1");
    expect(migrationSql).toContain("public.charts2_commit_verified_original_v1");
    expect(migrationSql).toContain("to service_role");
    expect(migrationSql).toContain("from public, anon, authenticated");
    expect(migrationSql).toContain("authorization_expires_at > now()");
    expect(migrationSql).toContain("m.reviewed_method = 'GET'");
    expect(migrationSql).toContain("review_state = 'collector_admitted'");
    expect(migrationSql).toContain("charts2_source_method_not_admitted");
    expect(migrationSql).toContain("charts2_private_original_missing");
    expect(migrationSql).toContain("charts2_duplicate_original_provenance_conflict");
    expect(migrationSql).not.toContain("update public.wk_chart_programs_v2");
  });

  it("changes exactly the two service-only SQL method gates for native YouTube POST", () => {
    expect(nativePostSql).toContain("GitHub Actions run 44374242383");
    expect(nativePostSql.split("create or replace function public.charts2_").length - 1).toBe(2);
    expect(nativePostSql.split("m.reviewed_method = 'POST'").length - 1).toBe(2);
    expect(nativePostSql.split("m.source_key <> 'youtube_ke' and m.reviewed_method = 'GET'").length - 1).toBe(2);
    expect(nativePostSql.split("https://charts.youtube.com/youtubei/v1/browse?alt=json").length - 1).toBe(2);
    expect(nativePostSql).toContain("authorization_expires_at > now()");
    expect(nativePostSql).toContain("from public, anon, authenticated");
    expect(nativePostSql).toContain("to service_role");
    expect(nativePostSql).not.toContain("update public.wk_chart_programs_v2");
    expect(nativePostSql).not.toContain("create table ");
    expect(nativePostSql).not.toContain("create trigger ");
  });

  it("transpiles the actual Edge worker as TypeScript without syntax errors", () => {
    const result = transpileModule(edge, {
      fileName: "charts2-capture/index.ts",
      compilerOptions: {
        target: ScriptTarget.ES2022,
        module: ModuleKind.ESNext,
      },
      reportDiagnostics: true,
    });
    expect(result.diagnostics?.filter(
      diagnostic => diagnostic.category === DiagnosticCategory.Error,
    ) ?? []).toEqual([]);
    expect(result.outputText).toContain("server_sha256_storage_readback");
  });

  it("keeps all captures evidence-only and server-rehashed", () => {
    expect(edge).toContain('required_capability:"manage_charts"');
    expect(edge).toContain('server_sha256_storage_readback');
    expect(edge).toContain('upsert:false');
    expect(edge).toContain('reread.data.arrayBuffer()');
    expect(edge).toContain('crypto.subtle.digest("SHA-256",original)');
    expect(edge).toContain('candidate.can_score!==false');
    expect(edge).toContain('candidate.can_publish!==false');
    expect(edge).toContain('source_method_held');
    expect(edge).toContain('charts2YouTubeNativeWeeklyPost');
    expect(edge).toContain('key==="youtube_ke"&&method.reviewed_method==="POST"');
    expect(edge).toContain('key!=="youtube_ke"&&method.reviewed_method==="GET"');
    expect(edge).toContain('charts2_youtube_period_unqualified');
    expect(edge).toContain('credentials:"omit"');
    expect(edge).toContain('redirect:"error"');
    expect(edge).not.toContain("publish_charts");
    expect(edge).not.toContain("chart_assert_publishable_edition");
    expect(config).toContain(["[functions.charts2-capture]", "verify_jwt = true"].join(String.fromCharCode(10)));
  });
});
