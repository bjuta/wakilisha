import { describe, expect, it } from "vitest";
import {
  appleSourceKey,
  buildYouTubeWeeklyRequest,
  expectedSourceKeys,
  parseAppleTop100,
  parseAudiomackWeekly100,
  parseYouTubeWeeklyChart,
  validateCanonicalD11BWindow,
  youtubeTargetPeriodKey,
} from "../../supabase/functions/chart-research-collect/adapters";

const START = "2026-09-04T00:00:00.000Z";
const END = "2026-09-11T00:00:00.000Z";

describe("D11B qualified source adapters", () => {
  it("freezes Friday-through-Thursday source keys", () => {
    expect(validateCanonicalD11BWindow(START, END).start.getUTCDay()).toBe(5);
    expect(youtubeTargetPeriodKey(START, END)).toBe(
      "weekly:20260904:20260910:ke",
    );
    expect(expectedSourceKeys(START, END)).toEqual([
      "youtube_weekly_ke",
      "audiomack_weekly100_ke",
      "apple_top100_ke:2026-09-04",
      "apple_top100_ke:2026-09-05",
      "apple_top100_ke:2026-09-06",
      "apple_top100_ke:2026-09-07",
      "apple_top100_ke:2026-09-08",
      "apple_top100_ke:2026-09-09",
      "apple_top100_ke:2026-09-10",
    ]);
    expect(appleSourceKey("2026-09-04")).toBe(
      "apple_top100_ke:2026-09-04",
    );
  });

  it("rejects a non-Friday research window", () => {
    expect(() =>
      validateCanonicalD11BWindow(
        "2026-09-05T00:00:00.000Z",
        "2026-09-12T00:00:00.000Z",
      )
    ).toThrow("tracking_start_must_be_friday_utc_midnight");
  });

  it("builds YouTube request for the exact target period", () => {
    const request = buildYouTubeWeeklyRequest(START, END);
    expect(String(request.query)).toContain(
      "chart_params_id=weekly:20260904:20260910:ke",
    );
  });

  it("parses YouTube rank and preserves viewCount without promoting it", () => {
    const period = youtubeTargetPeriodKey(START, END);
    const parsed = parseYouTubeWeeklyChart({
      periods: [{ id: period }],
      payload: {
        trackViews: [
          {
            name: "Track A",
            encryptedVideoId: "vid-a",
            viewCount: "12,345",
            artists: [{ name: "Artist A" }],
            chartEntryMetadata: {
              currentPosition: 1,
              previousPosition: 2,
              periodsOnChart: 4,
            },
          },
          {
            name: "Track B",
            encryptedVideoId: "vid-b",
            viewCount: 9000,
            artists: [{ name: "Artist B" }],
            chartEntryMetadata: {
              currentPosition: 2,
              previousPosition: 1,
              periodsOnChart: 7,
            },
          },
        ],
      },
    }, START, END);

    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toMatchObject({
      rank: 1,
      providerTrackId: "vid-a",
      metricName: "viewCount",
      metricValue: 12345,
      metricUnit: "views",
    });
    expect(parsed.receipt.cardinal_metric_authority).toBe(
      "preserved_not_direct_model_authority",
    );
  });

  it("fails YouTube closed when the exact weekly period is unavailable", () => {
    expect(() =>
      parseYouTubeWeeklyChart({
        periods: [{ id: "weekly:20260828:20260903:ke" }],
        payload: { trackViews: [] },
      }, START, END)
    ).toThrow("youtube_target_period_unavailable");
  });

  it("parses Audiomack ordering without inventing counts", () => {
    const parsed = parseAudiomackWeekly100(
      '<script>{"track_count":3}</script>' +
        '<meta property="music:song" content="https://audiomack.com/a/song/one">' +
        '<meta property="music:song" content="https://audiomack.com/b/song/two">' +
        '<meta property="music:song" content="https://audiomack.com/c/song/three">',
    );

    expect(parsed.chartDepth).toBe(3);
    expect(parsed.rows.map((row) => row.rank)).toEqual([1, 2, 3]);
    expect(parsed.rows.every((row) => row.metricValue === null)).toBe(true);
    expect(parsed.receipt.period_semantics).toBe(
      "weekly_provider_surface_exact_range_unknown",
    );
  });

  it("parses Apple daily Top 100 as rank-only observations", () => {
    const parsed = parseAppleTop100({
      feed: {
        country: "ke",
        updated: "Fri, 4 Sep 2026 18:00:03 +0000",
        results: [
          {
            id: "1001",
            name: "Track A",
            artistId: "2001",
            artistName: "Artist A",
            url: "https://music.apple.com/ke/song/1001",
          },
          {
            id: "1002",
            name: "Track B",
            artistId: "2002",
            artistName: "Artist B",
            url: "https://music.apple.com/ke/song/1002",
          },
        ],
      },
    }, "2026-09-04");

    expect(parsed.providerMarket).toBe("KE");
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toMatchObject({
      rank: 1,
      providerTrackId: "1001",
      providerArtistIds: ["2001"],
      metricValue: null,
    });
    expect(parsed.receipt.weekly_aggregation_authority).toBe(
      "blocked_until_L034",
    );
  });
});
