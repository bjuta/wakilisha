import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(
    path.join(root, relativePath),
    "utf8",
  );
}

const migration = read(
  "supabase/migrations/20260814193000_artist_music_submission_registry_review.sql",
);
const triggerBoundaryMigration = read(
  "supabase/migrations/20260814201000_artist_music_submission_playlist_trigger_boundary.sql",
);
const verifier = read(
  "scripts/control-plane/verify-artist-music-submission-registry-review.sql",
);
const managePage = read(
  "src/pages/artists/manage/page.tsx",
);
const adminIntakePage = read(
  "src/pages/admin/registry/tracks/intake/page.tsx",
);
const service = read(
  "src/services/artists/artistMusicSubmissions.ts",
);
const providerApi = read(
  "supabase/functions/provider-intake-api/index.ts",
);
const packageJson = read("package.json");

describe("Artist music submission + Registry review SLA", () => {
  it("extends the existing Track Intake queue instead of creating a second review system", () => {
    expect(migration).toContain(
      "alter table public.registry_provider_track_suggestions",
    );
    expect(migration).toContain(
      "'artist_submission'",
    );
    expect(migration).not.toContain(
      "create table public.artist_music_submissions",
    );
    expect(migration).toContain(
      "source_playlist_id drop not null",
    );
  });

  it("keeps Playlist synchronization exclusive to Playlist editor intake", () => {
    expect(triggerBoundaryMigration).toContain(
      "sync_playlist_registry_intake_item_artists",
    );
    expect(triggerBoundaryMigration).toContain(
      "v_intake_origin <> 'playlist_editor'",
    );
    expect(triggerBoundaryMigration).toContain(
      "ensure_playlist_registry_intake_item",
    );
    expect(triggerBoundaryMigration).not.toContain(
      "v_intake_origin = 'public_contribution'",
    );
  });

  it("uses can_submit_releases as the only Artist-side write authority", () => {
    expect(migration).toContain(
      "community_submit_artist_music",
    );
    expect(migration).toContain(
      "can_submit_releases",
    );
    expect(migration).toContain(
      "editorial.current_artist_representation",
    );
    expect(migration).not.toMatch(
      /(insert\s+into|update|delete\s+from)\s+public\.(registry_tracks|registry_releases|registry_artists)\b/i,
    );
  });

  it("keeps provider evidence server-side and separate from Registry identity", () => {
    expect(providerApi).toContain(
      '"artist-submission-search"',
    );
    expect(providerApi).toContain(
      '"artist-submission-inspect"',
    );
    expect(providerApi).toContain(
      '.eq("can_submit_releases", true)',
    );
    expect(providerApi).toContain(
      '"record_artist_music_submission_validation"',
    );
    expect(providerApi).toContain(
      'body.entityType = "track"',
    );
    expect(providerApi).toContain(
      'body.providerEntityType = "track"',
    );
    expect(providerApi).toContain(
      'rCap(auth.id, "manage_registry")',
    );
    expect(service).toContain(
      "validationId",
    );
  });

  it("records a real three-business-day Registry review target", () => {
    expect(migration).toContain(
      "artist_music_submission_review_due_at",
    );
    expect(migration).toContain(
      "while v_business_days < 3",
    );
    expect(migration).toContain(
      "review_due_at",
    );
    expect(managePage).toContain(
      "3 business days",
    );
    expect(adminIntakePage).toContain(
      "Review target",
    );
    expect(adminIntakePage).toContain(
      "Overdue",
    );
  });

  it("keeps the claimed Artist canonical while carrying collaborator credits into review", () => {
    expect(migration).toContain(
      "'primary'",
    );
    expect(migration).toContain(
      "'existing_artist'",
    );
    expect(migration).toContain(
      "p_artist_credits",
    );
    expect(migration).toContain(
      "'unresolved'",
    );
    expect(managePage).toContain(
      "Other Artists",
    );
    expect(managePage).toContain(
      "Primary",
    );
    expect(managePage).toContain(
      "Featured",
    );
  });

  it("activates Add Music in Artist Management and keeps submission history visible", () => {
    expect(managePage).toContain(
      'id="artist-music-submission"',
    );
    expect(managePage).not.toContain(
      "Music submissions are not open here yet.",
    );
    expect(managePage).toContain(
      "Submit to Registry Review",
    );
    expect(managePage).toContain(
      "Review History",
    );
    expect(service).toContain(
      "community_get_artist_music_submissions",
    );
  });

  it("makes Artist submissions visible inside the existing admin Track Intake review surface", () => {
    expect(adminIntakePage).toContain(
      '"artist_submission"',
    );
    expect(adminIntakePage).toContain(
      "Artist submission",
    );
    expect(adminIntakePage).toContain(
      "submitted_for_artist_id",
    );
    expect(adminIntakePage).toContain(
      "review_due_at",
    );
    expect(migration).toContain(
      "v_suggestion.intake_origin not in",
    );
    expect(migration).toContain(
      "'artist_submission'",
    );
  });

  it("keeps the verifier and critical suite wired to M5", () => {
    expect(verifier).toContain("M5_VERIFY");
    expect(packageJson).toContain(
      "test/artists/artist-music-submission-registry-review.test.ts",
    );

    for (const source of [
      managePage,
      service,
    ]) {
      expect(source).not.toContain("—");
    }
  });
});
