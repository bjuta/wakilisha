import {
  readFileSync,
  readdirSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

const migrationName =
  readdirSync(
    "supabase/migrations",
  ).find(
    (name) =>
      name.endsWith(
        "_phase_5b_playlist_registry_apple_playback_identity.sql",
      ),
  );

if (!migrationName) {
  throw new Error(
    "M219 Playlist Apple playback migration is missing",
  );
}

const migration =
  readFileSync(
    `supabase/migrations/${migrationName}`,
    "utf8",
  );

const model =
  readFileSync(
    "src/services/playlists/playlistPublicModel.ts",
    "utf8",
  );

const player =
  readFileSync(
    "src/context/PlayerContext.tsx",
    "utf8",
  );

describe(
  "Phase 5B Playlist Registry Apple playback identity",
  () => {
    it(
      "materializes Apple Music identity independently of the primary engine",
      () => {
        expect(migration)
          .toContain(
            "'apple_music_catalog_id'",
          );

        expect(migration)
          .toContain(
            "registry_track_provider_links",
          );

        expect(migration)
          .toContain(
            "apple_music_track_id",
          );
      },
    );

    it(
      "carries the alternate Apple identity into PlayerTrack",
      () => {
        expect(model)
          .toContain(
            "appleMusicCatalogId",
          );

        expect(model)
          .toContain(
            "track.playback.appleMusicCatalogId",
          );

        expect(model)
          .not.toContain(
            `appleMusicCatalogId:
      track.playback.engine ===`,
          );
      },
    );

    it(
      "keeps Apple full playback ahead of preview fallback for ordinary audio tracks",
      () => {
        expect(player)
          .toContain(
            "track.appleMusicCatalogId ||",
          );

        expect(player)
          .toContain(
            "playbackPrefs.appleMusicConnected",
          );

        expect(player)
          .toContain(
            "playAppleMusicCatalogSong(",
          );

        expect(player)
          .toContain(
            "playViaHtmlAudio(",
          );
      },
    );

  },
);
