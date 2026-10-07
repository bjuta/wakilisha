export const D11B_ADAPTER_VERSION = "d11b-qualified-sources-v1";
export const D11B_SOURCE_CONSTITUTION_VERSION = "d11b-source-v1";
export const D11B_PROTOCOL_VERSION = "d11b-launch-qualification-v1";

export type QualifiedSource = "youtube" | "audiomack" | "apple";

export interface ParsedResearchRow {
  providerRowKey: string;
  providerTrackId: string | null;
  providerReleaseId: string | null;
  providerArtistIds: string[];
  isrc: string | null;
  rank: number;
  chartDepth: number;
  metricName: string | null;
  metricValue: number | null;
  metricUnit: string | null;
  rawPayloadRef: Record<string, unknown>;
}

export interface ParsedSourcePayload {
  source: QualifiedSource;
  providerMarket: string;
  sourceSurface: string;
  chartDepth: number;
  censoringType: "top_n";
  rows: ParsedResearchRow[];
  receipt: Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
function positiveInt(value: unknown): number | null {
  const n = typeof value === "number"
    ? value
    : typeof value === "string"
    ? Number(value.replace(/,/g, "").trim())
    : Number.NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}
function nonNegativeNumber(value: unknown): number | null {
  const n = typeof value === "number"
    ? value
    : typeof value === "string"
    ? Number(value.replace(/,/g, "").trim())
    : Number.NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function datePart(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function validateCanonicalD11BWindow(
  trackingStartIso: string,
  trackingEndIso: string,
): { start: Date; end: Date } {
  const start = new Date(trackingStartIso);
  const end = new Date(trackingEndIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("invalid_tracking_window");
  }
  if (
    start.getUTCDay() !== 5 ||
    start.getUTCHours() !== 0 ||
    start.getUTCMinutes() !== 0 ||
    start.getUTCSeconds() !== 0 ||
    start.getUTCMilliseconds() !== 0
  ) {
    throw new Error("tracking_start_must_be_friday_utc_midnight");
  }
  if (end.getTime() - start.getTime() !== 7 * 24 * 60 * 60 * 1000) {
    throw new Error("tracking_window_must_be_exactly_seven_days");
  }
  return { start, end };
}

export function youtubeTargetPeriodKey(
  trackingStartIso: string,
  trackingEndIso: string,
): string {
  const { start, end } = validateCanonicalD11BWindow(
    trackingStartIso,
    trackingEndIso,
  );
  const inclusiveEnd = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return `weekly:${datePart(start).replace(/-/g, "")}:${
    datePart(inclusiveEnd).replace(/-/g, "")
  }:ke`;
}

export function expectedSourceKeys(
  trackingStartIso: string,
  trackingEndIso: string,
): string[] {
  const { start } = validateCanonicalD11BWindow(
    trackingStartIso,
    trackingEndIso,
  );
  const keys = ["youtube_weekly_ke", "audiomack_weekly100_ke"];
  for (let day = 0; day < 7; day++) {
    const checkpoint = new Date(start.getTime() + day * 86400000);
    keys.push(`apple_top100_ke:${datePart(checkpoint)}`);
  }
  return keys;
}

export function appleSourceKey(checkpointDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkpointDate)) {
    throw new Error("invalid_apple_checkpoint_date");
  }
  return `apple_top100_ke:${checkpointDate}`;
}

function collectTrackViews(value: unknown, found: unknown[][]): void {
  if (Array.isArray(value)) {
    value.forEach((item) => collectTrackViews(item, found));
    return;
  }
  const record = asRecord(value);
  if (!record) return;
  for (const [key, child] of Object.entries(record)) {
    if (key === "trackViews" && Array.isArray(child)) found.push(child);
    collectTrackViews(child, found);
  }
}

export function buildYouTubeWeeklyRequest(
  trackingStartIso: string,
  trackingEndIso: string,
): Record<string, unknown> {
  const period = youtubeTargetPeriodKey(trackingStartIso, trackingEndIso);
  return {
    browseId: "FEmusic_analytics_charts_home",
    context: {
      capabilities: {},
      client: {
        clientName: "WEB_MUSIC_ANALYTICS",
        clientVersion: "0.2",
        experimentIds: [],
        experimentsToken: "",
        gl: "US",
        hl: "en",
        theme: "MUSIC",
      },
      request: { internalExperimentFlags: [] },
    },
    query:
      "chart_params_type=WEEK&perspective=CHART&flags=viral_video_chart&selected_chart=TRACKS&chart_params_id=" +
      period,
  };
}

export function parseYouTubeWeeklyChart(
  payload: unknown,
  trackingStartIso: string,
  trackingEndIso: string,
): ParsedSourcePayload {
  const targetPeriod = youtubeTargetPeriodKey(
    trackingStartIso,
    trackingEndIso,
  );
  if (!JSON.stringify(payload).includes(targetPeriod)) {
    throw new Error("youtube_target_period_unavailable");
  }

  const lists: unknown[][] = [];
  collectTrackViews(payload, lists);
  const rowsRaw = lists.sort((a, b) => b.length - a.length)[0] ?? [];
  if (rowsRaw.length === 0) throw new Error("youtube_track_views_missing");

  const seen = new Set<number>();
  const rows: ParsedResearchRow[] = [];
  for (const item of rowsRaw) {
    const row = asRecord(item);
    if (!row) continue;
    const metadata = asRecord(row.chartEntryMetadata) ?? {};
    const rank = positiveInt(metadata.currentPosition);
    if (!rank || seen.has(rank)) continue;
    seen.add(rank);
    const videoId =
      typeof row.encryptedVideoId === "string" && row.encryptedVideoId.trim()
        ? row.encryptedVideoId.trim()
        : null;
    const viewCount = nonNegativeNumber(row.viewCount);
    const artists = asArray(row.artists)
      .map(asRecord)
      .filter((artist): artist is Record<string, unknown> => Boolean(artist))
      .map((artist) =>
        typeof artist.name === "string" ? artist.name.trim() : ""
      )
      .filter(Boolean);

    rows.push({
      providerRowKey: videoId ? `youtube:${videoId}` : `youtube:rank:${rank}`,
      providerTrackId: videoId,
      providerReleaseId: null,
      providerArtistIds: [],
      isrc: null,
      rank,
      chartDepth: rowsRaw.length,
      metricName: viewCount === null ? null : "viewCount",
      metricValue: viewCount,
      metricUnit: viewCount === null ? null : "views",
      rawPayloadRef: {
        title: typeof row.name === "string" ? row.name : null,
        artist_display: artists,
        video_id: videoId,
        previous_rank: positiveInt(metadata.previousPosition),
        periods_on_chart: positiveInt(metadata.periodsOnChart),
        target_period: targetPeriod,
      },
    });
  }
  rows.sort((a, b) => a.rank - b.rank);
  if (rows.length === 0) throw new Error("youtube_no_ranked_rows");

  return {
    source: "youtube",
    providerMarket: "KE",
    sourceSurface: "youtube_charts_weekly_tracks_ke",
    chartDepth: rowsRaw.length,
    censoringType: "top_n",
    rows,
    receipt: {
      target_period: targetPeriod,
      requested_chart: "TRACKS",
      period_semantics: "provider_explicit_friday_thursday",
      cardinal_metric_authority: "preserved_not_direct_model_authority",
    },
  };
}

function htmlDecode(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function parseAudiomackWeekly100(html: string): ParsedSourcePayload {
  const countMatch = html.match(/"track_count"\s*:\s*(\d+)/i);
  const declaredDepth = countMatch ? Number(countMatch[1]) : null;
  const urls: string[] = [];
  for (
    const match of html.matchAll(
      /<meta\s+property=["']music:song["']\s+content=["']([^"']+)["']/gi,
    )
  ) {
    const url = htmlDecode(match[1]).trim();
    if (url && !urls.includes(url)) urls.push(url);
  }
  if (urls.length === 0) throw new Error("audiomack_ranked_song_urls_missing");

  const chartDepth = declaredDepth && declaredDepth > 0
    ? declaredDepth
    : urls.length;
  const rows = urls.map((songUrl, index): ParsedResearchRow => {
    let providerTrackId: string | null = null;
    try {
      providerTrackId = new URL(songUrl).pathname.replace(/^\/+|\/+$/g, "") || null;
    } catch {
      providerTrackId = songUrl;
    }
    return {
      providerRowKey: `audiomack:${providerTrackId ?? index + 1}`,
      providerTrackId,
      providerReleaseId: null,
      providerArtistIds: [],
      isrc: null,
      rank: index + 1,
      chartDepth,
      metricName: null,
      metricValue: null,
      metricUnit: null,
      rawPayloadRef: {
        song_url: songUrl,
        provider_native_period: "weekly_surface_without_explicit_range",
      },
    };
  });

  return {
    source: "audiomack",
    providerMarket: "KE",
    sourceSurface: "audiomack_weekly100_kenya",
    chartDepth,
    censoringType: "top_n",
    rows,
    receipt: {
      declared_depth: declaredDepth,
      parsed_ranked_rows: urls.length,
      period_semantics: "weekly_provider_surface_exact_range_unknown",
      fixed_collection_checkpoint_utc: "Wednesday 18:00",
    },
  };
}

export function parseAppleTop100(
  payload: unknown,
  checkpointDate: string,
): ParsedSourcePayload {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkpointDate)) {
    throw new Error("invalid_apple_checkpoint_date");
  }
  const feed = asRecord(asRecord(payload)?.feed);
  const results = asArray(feed?.results);
  if (!feed || results.length === 0) throw new Error("apple_top100_results_missing");

  const rows: ParsedResearchRow[] = [];
  for (const [index, item] of results.entries()) {
    const row = asRecord(item);
    if (!row) continue;
    const trackId =
      typeof row.id === "string" && row.id.trim() ? row.id.trim() : null;
    if (!trackId) continue;
    const artistId =
      typeof row.artistId === "string" && row.artistId.trim()
        ? row.artistId.trim()
        : null;
    rows.push({
      providerRowKey: `apple_music:${trackId}`,
      providerTrackId: trackId,
      providerReleaseId: null,
      providerArtistIds: artistId ? [artistId] : [],
      isrc: null,
      rank: index + 1,
      chartDepth: results.length,
      metricName: null,
      metricValue: null,
      metricUnit: null,
      rawPayloadRef: {
        title: typeof row.name === "string" ? row.name : null,
        artist_display: typeof row.artistName === "string" ? row.artistName : null,
        provider_url: typeof row.url === "string" ? row.url : null,
        checkpoint_date: checkpointDate,
      },
    });
  }
  if (rows.length === 0) throw new Error("apple_top100_ranked_rows_missing");

  return {
    source: "apple",
    providerMarket:
      typeof feed.country === "string" && feed.country.trim()
        ? feed.country.toUpperCase()
        : "KE",
    sourceSurface: "apple_music_top100_kenya",
    chartDepth: results.length,
    censoringType: "top_n",
    rows,
    receipt: {
      provider_updated: typeof feed.updated === "string" ? feed.updated : null,
      checkpoint_date: checkpointDate,
      fixed_collection_checkpoint_utc: "18:00",
      period_semantics: "daily_chart_snapshot_provider_window_unspecified",
      weekly_aggregation_authority: "blocked_until_L034",
    },
  };
}
