import {
  describe,
  expect,
  it,
} from "vitest";

import {
  readFileSync,
} from "node:fs";

const intake =
  readFileSync(
    "src/pages/admin/registry/tracks/intake/page.tsx",
    "utf8",
  );

const m224 =
  readFileSync(
    "docs/engineering/replay-baseline/legacy-migrations/20260809184158_phase_5b_public_registry_intake_bridge.sql",
    "utf8",
  );

describe(
  "Phase 5B public Track Intake review",
  () => {
    it(
      "types public contribution origin separately from provider evidence",
      () => {
        expect(intake)
          .toContain(
            'intake_origin: "playlist_editor" | "public_contribution"',
          );

        expect(intake)
          .toContain(
            "submitted_track_title: string | null",
          );

        expect(intake)
          .toContain(
            "provider_key: string | null",
          );
      },
    );

    it(
      "shows contributor title and context for public submissions",
      () => {
        expect(intake)
          .toContain(
            "Community suggestion",
          );

        expect(intake)
          .toContain(
            "Suggested for Playlist",
          );

        expect(intake)
          .toContain(
            "Contributor context",
          );

        expect(intake)
          .toContain(
            "row.submitted_track_title",
          );
      },
    );

    it(
      "keeps editor-origin Playlist context intact",
      () => {
        expect(intake)
          .toContain(
            "Originating Playlist",
          );

        expect(intake)
          .toContain(
            "Playlist curator note",
          );

        expect(intake)
          .toContain(
            'row.intake_origin ===',
          );
      },
    );

    it(
      "searches only active Registry artists for identity review",
      () => {
        expect(intake)
          .toContain(
            '.from("registry_artists")',
          );

        expect(intake)
          .toContain(
            '"id,display_name,slug,public_image_url,status"',
          );

        expect(intake)
          .toContain(
            '.eq(\n            "status",\n            "active",',
          );
      },
    );

    it(
      "uses the governed M224 artist-credit command",
      () => {
        expect(intake)
          .toContain(
            '"admin_update_registry_track_intake_artist_credit"',
          );

        expect(m224)
          .toContain(
            "create or replace function public.admin_update_registry_track_intake_artist_credit",
          );
      },
    );

    it(
      "requires editorial to confirm Primary or Featured without inferring from order",
      () => {
        expect(intake)
          .toContain(
            '<option value="">',
          );

        expect(intake)
          .toContain(
            "Choose role",
          );

        expect(intake)
          .toContain(
            '<option value="primary">',
          );

        expect(intake)
          .toContain(
            '<option value="featured">',
          );

        expect(intake)
          .not.toContain(
            'credit.credit_order === 1',
          );

        expect(intake)
          .toContain(
            "Choose whether this artist is Primary or Featured.",
          );

        expect(intake)
          .toContain(
            '"existing_artist"',
          );

        expect(intake)
          .toContain(
            '"new_artist"',
          );

        expect(intake)
          .toMatch(
            /p_registry_artist_id:\s*mode ===\s*"existing_artist"\s*\?\s*artist\?\.id\s*\?\?\s*null\s*:\s*null/,
          );
      },
    );

    it(
      "uses contributor title to seed Registry and provider review",
      () => {
        expect(intake)
          .toContain(
            "row.submitted_track_title ??",
          );

        expect(intake)
          .toContain(
            "preferredObservedTrackTitle(",
          );

        expect(intake)
          .toContain(
            "row.provider_title",
          );
      },
    );

    it(
      "keeps canonical track creation blocked until artist identities are resolved",
      () => {
        expect(intake)
          .toContain(
            "allArtistCreditsResolved",
          );

        expect(intake)
          .toContain(
            "Resolve every artist credit to an existing Registry artist before creating a canonical track.",
          );
      },
    );
  },
);
