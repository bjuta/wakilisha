import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  analyzeChartIdentity,
  analyzeReleaseIdentity,
  analyzeTrackIdentity,
  slugifyIdentity,
  stripFeatureCreditNoise,
  stripReleasePackagingSuffix,
} from "../../scripts/registry/agents/mizizi/core";

describe("MIZIZI Cultural Data Steward", () => {
  it("uses minimal route-safe slug grammar", () => {
    expect(
      slugifyIdentity("Chai & Maziwa"),
    ).toBe("chai-maziwa");

    expect(
      slugifyIdentity("  Ki Di'ng  "),
    ).toBe("ki-di-ng");
  });

  it("separates featured credits from Track identity", () => {
    const cleaned =
      stripFeatureCreditNoise(
        "FICHA WHITE (feat. Jovie Jovv, Shappaman & KXOBIE)",
      );

    expect(cleaned.coreTitle).toBe(
      "FICHA WHITE",
    );
    expect(
      slugifyIdentity(
        cleaned.coreTitle,
      ),
    ).toBe("ficha-white");
    expect(
      cleaned.removedFragments,
    ).toEqual([
      "(feat. Jovie Jovv, Shappaman & KXOBIE)",
    ]);
  });

  it("preserves version identity while removing featured credits", () => {
    const cleaned =
      stripFeatureCreditNoise(
        "Jipe Shughuli Nani (feat. BenaiA, OVR2) [Remix]",
      );

    expect(cleaned.coreTitle).toBe(
      "Jipe Shughuli Nani [Remix]",
    );
    expect(
      slugifyIdentity(
        cleaned.coreTitle,
      ),
    ).toBe(
      "jipe-shughuli-nani-remix",
    );
  });

  it("proposes a clean Track slug but keeps title cleanup under review", () => {
    const findings =
      analyzeTrackIdentity({
        id: "0672f196-59b6-4099-bb92-0ef41d37c78b",
        slug: "agent-mgumbe--ficha-white-feat-jovie-jovv-shappaman-kxobie",
        title:
          "FICHA WHITE (feat. Jovie Jovv, Shappaman & KXOBIE)",
        primaryArtistSlug:
          "agent-mgumbe",
        primaryArtistName:
          "Agent Mgumbe",
        featuredArtists: [
          {
            slug: "jovie-jovv",
            name: "Jovie Jovv",
          },
          {
            slug: "shappaman",
            name: "Shappaman",
          },
          {
            slug: "kxobie",
            name: "KXOBIE",
          },
        ],
      });

    const slugFinding =
      findings.find(
        (finding) =>
          finding.ruleId ===
          "track_slug_identity_noise",
      );
    const titleFinding =
      findings.find(
        (finding) =>
          finding.ruleId ===
          "track_title_credit_noise",
      );

    expect(slugFinding).toMatchObject({
      fieldName: "slug",
      proposedValue: "ficha-white",
      disposition:
        "auto_fix_candidate",
      severity: "high",
    });
    expect(
      slugFinding?.reason,
    ).toContain(
      "primary_artist_repeated_inside_slug",
    );
    expect(
      slugFinding?.reason,
    ).toContain(
      "feature_credit_marker_in_slug",
    );

    expect(titleFinding).toMatchObject({
      fieldName: "title",
      proposedValue: "FICHA WHITE",
      disposition: "review",
    });
  });

  it("keeps an unexplained slug mismatch under review", () => {
    const findings =
      analyzeTrackIdentity({
        id: "track-review-1",
        slug: "song-legacy",
        title: "Song",
        primaryArtistSlug:
          "lead-artist",
        primaryArtistName:
          "Lead Artist",
        featuredArtists: [],
      });

    expect(findings).toEqual([
      expect.objectContaining({
        ruleId:
          "track_slug_identity_mismatch",
        fieldName: "slug",
        proposedValue: "song",
        disposition: "review",
        confidence: 0.6,
      }),
    ]);
    expect(
      findings.some(
        (finding) =>
          finding.disposition ===
          "auto_fix_candidate",
      ),
    ).toBe(false);
  });

  it("treats exact provider Release packaging as reviewable metadata", () => {
    expect(
      stripReleasePackagingSuffix(
        "Balance - Single",
        "single",
      ),
    ).toEqual({
      coreTitle: "Balance",
      removedSuffix: "- Single",
    });

    const findings =
      analyzeReleaseIdentity({
        id: "release-1",
        slug: "balance-single",
        title: "Balance - Single",
        releaseType: "single",
      });

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId:
            "release_title_provider_packaging",
          proposedValue: "Balance",
          disposition: "review",
        }),
        expect.objectContaining({
          ruleId:
            "release_slug_provider_packaging",
          proposedValue: "balance",
          disposition: "review",
        }),
      ]),
    );
  });

  it("does not strip cultural wording that merely contains a Release type", () => {
    expect(
      stripReleasePackagingSuffix(
        "Wanavokali: The Album",
        "album",
      ),
    ).toEqual({
      coreTitle:
        "Wanavokali: The Album",
      removedSuffix: "",
    });

    expect(
      analyzeReleaseIdentity({
        id: "release-2",
        slug: "wanavokali-the-album",
        title:
          "Wanavokali: The Album",
        releaseType: "album",
      }),
    ).toEqual([]);
  });

  it("treats a canonical Track ID as authority for chart Track slug drift", () => {
    const findings =
      analyzeChartIdentity({
        id: "chart-entry-1",
        trackSlug:
          "ficha-white-feat-jovie-jovv",
        artistSlug:
          "agent-mgumbe",
        canonicalTrackId:
          "0672f196-59b6-4099-bb92-0ef41d37c78b",
        canonicalTrackSlug:
          "ficha-white",
        canonicalPrimaryArtistSlug:
          "agent-mgumbe",
      });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      ruleId:
        "chart_track_slug_drift",
      proposedValue:
        "ficha-white",
      disposition:
        "auto_fix_candidate",
      confidence: 1,
    });
  });

  it("keeps chart artist disagreement under review", () => {
    const findings =
      analyzeChartIdentity({
        id: "chart-entry-2",
        trackSlug: "ficha-white",
        artistSlug:
          "agent-mgumbe-and-friends",
        canonicalTrackId:
          "0672f196-59b6-4099-bb92-0ef41d37c78b",
        canonicalTrackSlug:
          "ficha-white",
        canonicalPrimaryArtistSlug:
          "agent-mgumbe",
      });

    expect(findings).toEqual([
      expect.objectContaining({
        ruleId:
          "chart_artist_slug_drift",
        proposedValue:
          "agent-mgumbe",
        disposition: "review",
      }),
    ]);
  });

  it("produces deterministic finding fingerprints", () => {
    const input = {
      id: "track-1",
      slug:
        "song-feat-artist",
      title:
        "Song (feat. Artist)",
      primaryArtistSlug:
        "lead-artist",
      featuredArtists: [
        {
          slug: "artist",
          name: "Artist",
        },
      ],
    };

    const first =
      analyzeTrackIdentity(
        input,
      );
    const second =
      analyzeTrackIdentity(
        input,
      );

    expect(
      first.map(
        (finding) =>
          finding.fingerprint,
      ),
    ).toEqual(
      second.map(
        (finding) =>
          finding.fingerprint,
      ),
    );
  });

  it("keeps the runtime bounded, review-aware, and provenance-preserving", () => {
    const runner =
      readFileSync(
        "scripts/registry/agents/mizizi/run.ts",
        "utf8",
      );

    expect(runner).toContain(
      "MAX_SAMPLE_FINDINGS = 30",
    );
    expect(runner).not.toContain(
      "const allFindings",
    );
    expect(runner).not.toMatch(
      /\boffset\b/i,
    );
    expect(runner).toContain(
      "hashtextextended(",
    );
    expect(runner).toContain(
      "ta.is_primary is true",
    );
    expect(runner).toContain(
      "registry_review_items",
    );
    expect(runner).toContain(
      "registry_canonical_write_events",
    );
    expect(runner).toContain(
      "wk_slug_redirects",
    );
    expect(runner).toContain(
      "--confirm=MIZIZI_APPLY",
    );
    expect(runner).toContain(
      "pg_advisory_xact_lock(",
    );
    expect(runner).toContain(
      "repairCurrentTrackPointers",
    );
    expect(runner).toContain(
      "communityThreadOwnershipConflict",
    );
    expect(runner).toContain(
      "community_saves",
    );
    expect(runner).toContain(
      "community_threads",
    );
    expect(runner).not.toContain(
      "community_activity",
    );
    expect(runner).not.toContain(
      "analytics_events",
    );
  });
});
