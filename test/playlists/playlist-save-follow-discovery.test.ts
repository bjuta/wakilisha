import {
  describe,
  expect,
  it,
} from "vitest";

import {
  readFileSync,
} from "node:fs";

const page =
  readFileSync(
    "src/pages/playlists/detail/page.tsx",
    "utf8",
  );

const service =
  readFileSync(
    "src/services/community/service.ts",
    "utf8",
  );

const hook =
  readFileSync(
    "src/hooks/useCommunityActions.ts",
    "utf8",
  );

const discovery =
  readFileSync(
    "src/components/design-system/music/MusicArtistDiscovery.tsx",
    "utf8",
  );

describe(
  "Phase 5B Playlist Save, Follow, and artist discovery",
  () => {
    it(
      "uses the M221 desired-state interaction commands",
      () => {
        expect(service)
          .toContain(
            "community_set_follow_state",
          );

        expect(service)
          .toContain(
            "community_set_saved_state",
          );

        expect(hook)
          .toContain(
            "setFollowState",
          );

        expect(hook)
          .toContain(
            "setSavedState",
          );
      },
    );

    it(
      "saves a Playlist through stable Playlist resource identity",
      () => {
        expect(page)
          .toContain(
            "entityId:\n                playlist.resourceId",
          );

        expect(page)
          .toContain(
            '"Save Playlist"',
          );
      },
    );

    it(
      "saves tracks through Registry track identity rather than placement identity",
      () => {
        expect(page)
          .toContain(
            "track.registry\n          ?.trackId",
          );

        expect(page)
          .toContain(
            'entityType:\n                "track"',
          );

        expect(page)
          .toContain(
            "entityId:\n                trackId",
          );
      },
    );

    it(
      "keeps Playlist placement discussion on the placement resource",
      () => {
        expect(page)
          .toContain(
            "contextEntityId:\n          track.playlistItemResourceId",
          );

        expect(page)
          .toContain(
            '"playlist_track"',
          );
      },
    );

    it(
      "follows artists through stable Registry artist identity",
      () => {
        expect(page)
          .toContain(
            "artist.artistId",
          );

        expect(page)
          .toContain(
            'setFollow(\n            "artist"',
          );

        expect(discovery)
          .toContain(
            "selected.followed",
          );
      },
    );

    it(
      "hydrates the current user Save and Follow state",
      () => {
        expect(page)
          .toContain(
            "getUserSaves(",
          );

        expect(page)
          .toContain(
            "getUserFollows(",
          );

        expect(page)
          .toContain(
            "followedArtistIds",
          );

        expect(page)
          .toContain(
            "savedTrackIds",
          );
      },
    );

    it(
      "keeps the raw self-only Follow reader compatible with Playlist artist discovery",
      () => {
        expect(service)
          .toContain(
            "export async function getUserFollows(userId: string): Promise<unknown[]>",
          );

        expect(service)
          .toContain(
            "return data || [];",
          );

        expect(service)
          .toContain(
            "mapCommunityFollowRows(",
          );

        expect(service)
          .toContain(
            "getUserFollowing",
          );

        expect(page)
          .toContain(
            "row.target_type",
          );

        expect(page)
          .toContain(
            "row.target_id",
          );
      },
    );

    it(
      "builds discovery from every credited Playlist artist",
      () => {
        expect(page)
          .toContain(
            "for (\n      const artist\n      of track.artists",
          );

        expect(page)
          .toContain(
            "new Map<",
          );

        expect(page)
          .toContain(
            "artist.artistId",
          );
      },
    );

    it(
      "uses canonical Artist routes and a shared music component",
      () => {
        expect(page)
          .toContain(
            "MusicArtistDiscovery",
          );

        expect(discovery)
          .toContain(
            "`/artists/${selected.slug}`",
          );

        expect(page)
          .not.toContain(
            "ArtistRolodex",
          );
      },
    );

    it(
      "places artist discovery before whole-Playlist Community",
      () => {
        expect(
          page.indexOf(
            "<MusicArtistDiscovery",
          ),
        )
          .toBeGreaterThan(
            -1,
          );

        expect(
          page.indexOf(
            "<MusicArtistDiscovery",
          ),
        )
          .toBeLessThan(
            page.indexOf(
              "<CommunitySection",
            ),
          );
      },
    );
  },
);
