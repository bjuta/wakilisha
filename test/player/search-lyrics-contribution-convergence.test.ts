import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

const search = read("src/components/search/GlobalSearchSurface.tsx");
const player = read("src/components/design-system/player/PlayerFullSurface.tsx");
const timedText = read("src/components/design-system/player/PlayerTimedTextPanel.tsx");
const contribution = read("src/pages/tracks/lyrics/contribute/page.tsx");
const detailLyrics = read("src/pages/tracks/detail/components/TrackLyricsSection.tsx");
const adminLyrics = read("src/pages/admin/content/lyrics/page.tsx");
const adminLyricsReview = read(
  "src/pages/admin/content/lyrics/components/LyricsContributionReviewWorkspace.tsx",
);
const adminLyricsService = read(
  "src/services/player/trackLyricsAdminService.ts",
);
const service = read("src/services/player/trackLyricsService.ts");

describe("Search and Lyrics contribution convergence", () => {
  it("starts global Search as a search field instead of an explanatory empty state", () => {
    expect(search).not.toContain(
      "Search WAKILISHA without leaving what you are listening to.",
    );
    expect(search).toContain("{normalized ? (");
    expect(search).toContain("See All Results");
    expect(search).toContain("No quick matches.");
  });

  it("keeps missing Lyrics actionable in the Player", () => {
    expect(player).toContain("lyricsContributionPath");
    expect(player).toContain("Contribute Lyrics");
    expect(player).toContain(
      "Read published Lyrics or contribute them if they are missing.",
    );
    expect(player).not.toContain(
      "!experience.capabilities.lyrics ||\n                      !currentTrack.registryTrackId",
    );
    expect(timedText).toContain("emptyAction?: ReactNode");
  });

  it("reuses active Player Track identity before falling back to the public Edge reader", () => {
    expect(contribution).toContain("currentTrack?.registryTrackId");
    expect(contribution).toContain("activeTrackSlug === trackSlug");
    expect(contribution).toContain(
      "registryTrackId: currentTrack.registryTrackId",
    );
    expect(contribution).toContain(
      "const request = releaseSlug",
    );

    const playerIdentity = contribution.indexOf(
      "currentTrack?.registryTrackId",
    );
    const edgeFallback = contribution.indexOf(
      "const request = releaseSlug",
    );

    expect(playerIdentity).toBeGreaterThan(-1);
    expect(edgeFallback).toBeGreaterThan(playerIdentity);
  });

  it("makes public contribution plain-text-first and durable", () => {
    expect(contribution).toContain("Paste or type the lyrics below.");
    expect(contribution).toContain("You do not need to time them.");
    expect(contribution).toContain("submitTrackLyricsContribution");
    expect(contribution).toContain('parseLyricsEditorText(lyricsText, "plain")');
    expect(contribution).not.toContain("Contribute timed lyrics");
    expect(contribution).not.toContain("Add at least 2 timed lines");
    expect(contribution).not.toContain("community voting");
    expect(service).toContain(
      '"submit_track_lyrics_contribution"',
    );
  });

  it("removes timed-Lyrics pressure from Track empty state", () => {
    expect(detailLyrics).toContain("Timing is not required.");
    expect(detailLyrics).not.toContain("Be the first to add timed lyrics");
  });

  it("gives Admin Lyrics a governed path from contribution to immutable working version", () => {
    expect(adminLyrics).toContain("fetchTrackLyricsContributionInbox");
    expect(adminLyrics).toContain("LyricsContributionReviewWorkspace");
    expect(adminLyricsReview).toContain("acceptTrackLyricsContribution");
    expect(adminLyricsReview).toContain("rejectTrackLyricsContributionWithNote");
    expect(adminLyricsReview).toContain("Accept as submitted");
    expect(adminLyricsReview).toContain("Accept WAKILISHA revision");
    expect(adminLyricsService).toContain("review_track_lyrics_contribution");
    expect(adminLyricsService).toContain("reject_track_lyrics_contribution");
    expect(adminLyrics).not.toContain("No fake submissions queue");
  });
});
