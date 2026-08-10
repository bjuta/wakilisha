import {
  describe,
  expect,
  it,
} from "vitest";

import {
  publicPlaylistTrackArtistLabel,
  publicPlaylistTrackArtistNames,
  toPlayerTrack,
  type PublicPlaylistArtist,
  type PublicPlaylistTrack,
} from "../../src/services/playlists/playlistPublicModel";

function artist(
  name: string,
  index: number,
): PublicPlaylistArtist {
  return {
    artistId:
      `artist-${index}`,
    artistSlug:
      name
        .toLowerCase()
        .replace(
          /[^a-z0-9]+/g,
          "-",
        )
        .replace(
          /^-|-$/g,
          "",
        ),
    name,
    imageUrl:
      null,
    role:
      index === 0
        ? "primary_artist"
        : "featured_artist",
    isPrimary:
      index === 0,
    isFeatured:
      index > 0,
    creditOrder:
      index + 1,
    displayCredit:
      name,
  };
}

function track(
  values: Partial<PublicPlaylistTrack> = {},
): PublicPlaylistTrack {
  return {
    playlistItemResourceId:
      "playlist-item-resource",
    playlistItemId:
      "playlist-item",
    position:
      1,
    title:
      "Test track",
    artistNames:
      [],
    artists:
      [],
    releaseTitle:
      null,
    artworkUrl:
      null,
    durationMs:
      180000,
    notes:
      null,
    matchStatus:
      "matched",
    registry: {
      trackId:
        "registry-track",
      trackSlug:
        "test-track",
      trackPath:
        "/tracks/test-track",
      releaseId:
        null,
      releaseSlug:
        null,
      releasePath:
        null,
      primaryArtistId:
        "primary-artist",
      primaryArtistSlug:
        "primary-artist",
      primaryArtistName:
        "Registry Primary",
    },
    playback: {
      playable:
        true,
      engine:
        "apple_music",
      providerKey:
        "apple_music",
      providerObjectId:
        "123",
      providerUrl:
        null,
      embedUrl:
        null,
      previewUrl:
        null,
      fallbackPreviewUrl:
        null,
      appleMusicCatalogId:
        "123",
    },
    ...values,
  };
}

describe(
  "public Playlist canonical artist presentation",
  () => {
    it(
      "prefers canonical linked Registry artists over stale raw snapshot spellings",
      () => {
        const value =
          track({
            artistNames: [
              "Wakadinali",
              "Abbas Kubaf",
              "Wakuu",
              "Pepela",
              "Masterpiece King",
            ],
            artists: [
              "Wakadinali",
              "Abbas Kubaff",
              "Wakuu",
              "Pepela",
              "Masterpiece King",
            ].map(
              artist,
            ),
          });

        expect(
          publicPlaylistTrackArtistNames(
            value,
          ),
        ).toEqual([
          "Wakadinali",
          "Abbas Kubaff",
          "Wakuu",
          "Pepela",
          "Masterpiece King",
        ]);

        expect(
          publicPlaylistTrackArtistLabel(
            value,
          ),
        ).toBe(
          "Wakadinali, Abbas Kubaff, Wakuu, Pepela, Masterpiece King",
        );

        expect(
          toPlayerTrack(
            value,
          ).artist,
        ).toBe(
          "Wakadinali, Abbas Kubaff, Wakuu, Pepela, Masterpiece King",
        );
      },
    );

    it(
      "uses linked canonical artists when the raw snapshot artist list is empty",
      () => {
        const value =
          track({
            artistNames:
              [],
            artists: [
              artist(
                "Toxic Lyrikali",
                0,
              ),
            ],
          });

        expect(
          publicPlaylistTrackArtistLabel(
            value,
          ),
        ).toBe(
          "Toxic Lyrikali",
        );
      },
    );

    it(
      "preserves raw artist names as fallback when no Registry artist links exist",
      () => {
        const value =
          track({
            artistNames: [
              "Legacy Artist",
            ],
            artists:
              [],
          });

        expect(
          publicPlaylistTrackArtistLabel(
            value,
          ),
        ).toBe(
          "Legacy Artist",
        );
      },
    );

    it(
      "falls back to the Registry primary artist only when neither linked nor raw names exist",
      () => {
        const value =
          track({
            artistNames:
              [],
            artists:
              [],
          });

        expect(
          publicPlaylistTrackArtistLabel(
            value,
          ),
        ).toBe(
          "Registry Primary",
        );
      },
    );
  },
);
