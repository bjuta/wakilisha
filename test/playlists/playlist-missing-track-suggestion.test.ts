import {
  describe,
  expect,
  it,
} from "vitest";

import {
  readFileSync,
} from "node:fs";

const sheet =
  readFileSync(
    "src/components/feature/community/ContributionSheet.tsx",
    "utf8",
  );

const badges =
  readFileSync(
    "src/components/feature/community/ContributionBadges.tsx",
    "utf8",
  );

const page =
  readFileSync(
    "src/pages/playlists/detail/page.tsx",
    "utf8",
  );

const m221 =
  readFileSync(
    "docs/engineering/replay-baseline/legacy-migrations/20260809114136_phase_5b_community_interaction_authority.sql",
    "utf8",
  );

describe(
  "Phase 5B public Playlist missing-track suggestions",
  () => {
    it(
      "uses the existing Community contribution command",
      () => {
        expect(sheet)
          .toContain(
            "createContribution({",
          );

        expect(m221)
          .toContain(
            "community_create_contribution",
          );

        expect(m221)
          .not.toContain(
            "v_contribution_type not in",
          );
      },
    );

    it(
      "defines Missing Track without exposing it to existing default callers",
      () => {
        expect(sheet)
          .toContain(
            'value: "missing_track"',
          );

        expect(sheet)
          .toContain(
            'type.value !== "missing_track"',
          );

        expect(sheet)
          .toContain(
            "allowedTypes",
          );
      },
    );

    it(
      "supports caller-specific contribution language",
      () => {
        expect(sheet)
          .toContain(
            'title = "Suggest a Correction"',
          );

        expect(sheet)
          .toContain(
            'submitLabel = "Submit Correction"',
          );

        expect(sheet)
          .toContain(
            "descriptionLabel",
          );

        expect(sheet)
          .toContain(
            "descriptionPlaceholder",
          );
      },
    );

    it(
      "uses public-facing Playlist identity language",
      () => {
        expect(sheet)
          .toContain(
            'entity.type === "playlist" ? "Playlist"',
          );
      },
    );

    it(
      "uses accurate review language for missing-track suggestions",
      () => {
        expect(sheet)
          .toContain(
            "reviewNote",
          );

        expect(page)
          .toContain(
            'reviewNote="Suggestions are reviewed by our editorial team."',
          );
      },
    );

    it(
      "records Playlist contribution analytics as Playlist activity",
      () => {
        expect(sheet)
          .toContain(
            'entity.type === "playlist"',
          );

        expect(sheet)
          .toContain(
            '? "playlist"',
          );
      },
    );

    it(
      "gives Missing Track its own contribution badge",
      () => {
        expect(badges)
          .toContain(
            "missing_track:",
          );

        expect(badges)
          .toContain(
            'label: "Track suggestion"',
          );
      },
    );

    it(
      "exposes a first-class missing-track action after the Playlist tracklist",
      () => {
        const actionIndex =
          page.indexOf(
            "Suggest a missing track",
          );

        const discoveryIndex =
          page.indexOf(
            "<MusicArtistDiscovery",
          );

        expect(
          actionIndex,
        )
          .toBeGreaterThan(
            -1,
          );

        expect(
          actionIndex,
        )
          .toBeLessThan(
            discoveryIndex,
          );
      },
    );

    it(
      "captures structured track title and artist evidence",
      () => {
        expect(sheet)
          .toContain(
            "Track title",
          );

        expect(sheet)
          .toContain(
            "Artist(s)",
          );

        expect(sheet)
          .toContain(
            "Add artist",
          );

        expect(sheet)
          .toContain(
            "trackTitle",
          );

        expect(sheet)
          .toContain(
            "artistNames",
          );
      },
    );

    it(
      "uses pasted provider links to fill editable track context",
      () => {
        expect(sheet)
          .toContain(
            "resolvePublicTrackMetadata",
          );

        expect(sheet)
          .toContain(
            "Paste a supported track link",
          );

        expect(sheet)
          .toContain(
            "setTrackTitle(",
          );

        expect(sheet)
          .toContain(
            "setArtistNames(",
          );
      },
    );

    it(
      "submits structured Missing Track evidence through the Playlist intake service",
      () => {
        expect(sheet)
          .toContain(
            "submitPublicMissingTrack({",
          );

        expect(sheet)
          .toContain(
            "playlistSubmission.playlistId",
          );

        expect(sheet)
          .toContain(
            "playlistSubmission.playlistSlug",
          );

        expect(page)
          .toContain(
            "playlistSubmission={{",
          );
      },
    );

    it(
      "uses whole-Playlist identity and restricts the sheet to Missing Track",
      () => {
        expect(page)
          .toContain(
            "entity={\n            communityEntity",
          );

        expect(page)
          .toContain(
            'initialType="missing_track"',
          );

        expect(page)
          .toContain(
            '"missing_track",',
          );

        expect(page)
          .toContain(
            'submitLabel="Submit suggestion"',
          );
      },
    );

    it(
      "preserves authentication and verification boundaries before opening the sheet",
      () => {
        const handlerIndex =
          page.indexOf(
            "const openMissingTrackSuggestion",
          );

        const authIndex =
          page.indexOf(
            "buildCommunityAuthUrl()",
            handlerIndex,
          );

        const verifyIndex =
          page.indexOf(
            "buildVerifyEmailUrl(",
            handlerIndex,
          );

        const openIndex =
          page.indexOf(
            "setMissingTrackSuggestionOpen(",
            handlerIndex,
          );

        expect(handlerIndex)
          .toBeGreaterThan(
            -1,
          );

        expect(authIndex)
          .toBeGreaterThan(
            handlerIndex,
          );

        expect(verifyIndex)
          .toBeGreaterThan(
            authIndex,
          );

        expect(openIndex)
          .toBeGreaterThan(
            verifyIndex,
          );
      },
    );
  },
);
