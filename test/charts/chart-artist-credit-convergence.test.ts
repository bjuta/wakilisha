import { describe, expect, it } from "vitest";

import { parseChartArtistCredits } from "../../supabase/functions/chart-ingest-api/artistCredit";

describe("Chart Artist credit convergence", () => {
  it("keeps explicit collaborators primary", () => {
    expect(
      parseChartArtistCredits("Joefes, TheLuchi & Unspoken Salaton"),
    ).toEqual({
      status: "resolved",
      reason: null,
      credits: [
        {
          displayName: "Joefes",
          displayCredit: "Joefes",
          role: "primary_artist",
          creditOrder: 1,
        },
        {
          displayName: "TheLuchi",
          displayCredit: "TheLuchi",
          role: "primary_artist",
          creditOrder: 2,
        },
        {
          displayName: "Unspoken Salaton",
          displayCredit: "Unspoken Salaton",
          role: "primary_artist",
          creditOrder: 3,
        },
      ],
    });
  });

  it("assigns featured only from explicit feature grammar", () => {
    expect(
      parseChartArtistCredits("Joefes, TheLuchi & Unspoken Salaton feat. Iphoolish"),
    ).toEqual({
      status: "resolved",
      reason: null,
      credits: [
        {
          displayName: "Joefes",
          displayCredit: "Joefes",
          role: "primary_artist",
          creditOrder: 1,
        },
        {
          displayName: "TheLuchi",
          displayCredit: "TheLuchi",
          role: "primary_artist",
          creditOrder: 2,
        },
        {
          displayName: "Unspoken Salaton",
          displayCredit: "Unspoken Salaton",
          role: "primary_artist",
          creditOrder: 3,
        },
        {
          displayName: "Iphoolish",
          displayCredit: "Iphoolish",
          role: "featured_artist",
          creditOrder: 4,
        },
      ],
    });
  });

  it("fails closed on conflicting or malformed feature grammar", () => {
    expect(
      parseChartArtistCredits("Artist A feat. Artist B feat. Artist C"),
    ).toMatchObject({
      status: "ambiguous",
      reason: "multiple_feature_markers",
    });

    expect(
      parseChartArtistCredits("Artist A feat. Artist A"),
    ).toMatchObject({
      status: "ambiguous",
      reason: "artist_role_conflict",
    });

    expect(parseChartArtistCredits("   ")).toMatchObject({
      status: "ambiguous",
      reason: "artist_display_empty",
    });
  });

  it("never infers featured role from ordinal position alone", () => {
    const result = parseChartArtistCredits("Artist A x Artist B + Artist C");
    expect(result.status).toBe("resolved");

    if (result.status !== "resolved") return;

    expect(result.credits.map((credit) => credit.role)).toEqual([
      "primary_artist",
      "primary_artist",
      "primary_artist",
    ]);
  });
});
