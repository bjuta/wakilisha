import {
  describe,
  expect,
  it,
} from "vitest";

import {
  readFileSync,
} from "node:fs";

const edge =
  readFileSync(
    "supabase/functions/playlist-product-api/index.ts",
    "utf8",
  );

const m224 =
  readFileSync(
    "supabase/migrations/20260809184158_phase_5b_public_registry_intake_bridge.sql",
    "utf8",
  );

const service =
  readFileSync(
    "src/services/playlists/playlistContributionService.ts",
    "utf8",
  );

describe(
  "Phase 5B public Registry intake Edge authority",
  () => {
    it(
      "keeps public metadata resolution separate from playback validation",
      () => {
        expect(edge)
          .toContain(
            "resolvePublicTrackMetadataUrl",
          );

        expect(edge)
          .toContain(
            '"resolve_public_track"',
          );

        expect(edge)
          .toContain(
            "validatePlaybackUrl",
          );
      },
    );

    it(
      "allows authenticated public metadata resolution before Playlist edit authority",
      () => {
        const resolveIndex =
          edge.indexOf(
            '"resolve_public_track"',
          );

        const editIndex =
          edge.indexOf(
            "await requirePlaylistEdit(client, playlistId);",
          );

        expect(resolveIndex)
          .toBeGreaterThan(
            -1,
          );

        expect(editIndex)
          .toBeGreaterThan(
            resolveIndex,
          );
      },
    );

    it(
      "re-resolves provider evidence on the server during submission",
      () => {
        const submitIndex =
          edge.indexOf(
            '"submit_public_missing_track"',
          );

        const resolverIndex =
          edge.indexOf(
            "resolvePublicTrackMetadataUrl(",
            submitIndex,
          );

        const rpcIndex =
          edge.indexOf(
            '"create_public_playlist_missing_track_submission"',
            submitIndex,
          );

        expect(resolverIndex)
          .toBeGreaterThan(
            submitIndex,
          );

        expect(rpcIndex)
          .toBeGreaterThan(
            resolverIndex,
          );
      },
    );

    it(
      "keeps the SQL bridge service-only",
      () => {
        expect(m224)
          .toContain(
            "to service_role;",
          );

        expect(m224)
          .toContain(
            "from public, anon, authenticated;",
          );
      },
    );

    it(
      "uses the Playlist product Edge Function from the public service",
      () => {
        expect(service)
          .toContain(
            '"playlist-product-api"',
          );

        expect(service)
          .toContain(
            '"resolve_public_track"',
          );

        expect(service)
          .toContain(
            '"submit_public_missing_track"',
          );
      },
    );
  },
);
