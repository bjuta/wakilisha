import {
  describe,
  expect,
  it,
} from "vitest";

import {
  readFileSync,
} from "node:fs";

const migrationPath =
  process.env
    .WK_PLAYLIST_ARTIST_IDENTITY_MIGRATION;

if (!migrationPath) {
  throw new Error(
    "WK_PLAYLIST_ARTIST_IDENTITY_MIGRATION is required",
  );
}

const migration =
  readFileSync(
    migrationPath,
    "utf8",
  );

const model =
  readFileSync(
    "src/services/playlists/playlistPublicModel.ts",
    "utf8",
  );

describe(
  "Phase 5B Playlist artist identity snapshot",
  () => {
    it(
      "requires the migration before first Playlist publication",
      () => {
        expect(migration)
          .toContain(
            "playlist_publication_snapshots",
          );

        expect(migration)
          .toContain(
            "must be applied before the first Playlist publication snapshot",
          );
      },
    );

    it(
      "snapshots every stable Registry artist credit",
      () => {
        for (
          const token
          of [
            "'artists'",
            "'artist_id'",
            "'artist_slug'",
            "'name'",
            "'image_url'",
            "'role'",
            "'is_primary'",
            "'is_featured'",
            "'credit_order'",
            "'display_credit'",
          ]
        ) {
          expect(migration)
            .toContain(
              token,
            );
        }

        expect(migration)
          .toContain(
            "registry_track_artists",
          );
      },
    );

    it(
      "keeps Registry status boundaries",
      () => {
        expect(migration)
          .toContain(
            "credit.status =\n          'active'",
          );

        expect(migration)
          .toContain(
            "artist.status =\n          'active'",
          );
      },
    );

    it(
      "supports publication without a cover asset",
      () => {
        expect(migration)
          .toContain(
            "null::uuid as logical_asset_id",
          );

        expect(migration)
          .toContain(
            "null::text as safe_delivery_url",
          );

        expect(migration)
          .toContain(
            "null::integer as width",
          );

        expect(migration)
          .toContain(
            "null::integer as height",
          );

        expect(migration)
          .toContain(
            "into v_cover;",
          );
      },
    );

    it(
      "preserves the accepted Apple Music publication identity",
      () => {
        expect(migration)
          .toContain(
            "apple_music_catalog_id",
          );

        expect(migration)
          .toContain(
            "registry_track_provider_links",
          );
      },
    );

    it(
      "exposes full artist identity to the public Playlist model",
      () => {
        expect(model)
          .toContain(
            "export interface PublicPlaylistArtist",
          );

        expect(model)
          .toContain(
            "artists: PublicPlaylistArtist[];",
          );

        expect(model)
          .toContain(
            "function decodeArtist(",
          );

        expect(model)
          .toContain(
            "artistId",
          );

        expect(model)
          .toContain(
            "isFeatured",
          );
      },
    );
  },
);
