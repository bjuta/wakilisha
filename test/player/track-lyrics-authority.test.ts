import {
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260823133531_track_lyrics_authority.sql",
  "utf8",
);
const verifier = readFileSync(
  "scripts/control-plane/verify-track-lyrics-authority.sql",
  "utf8",
);
const service = readFileSync(
  "src/services/player/trackLyricsService.ts",
  "utf8",
);
const admin = readFileSync(
  "src/pages/admin/content/lyrics/page.tsx",
  "utf8",
);
const player = readFileSync(
  "src/components/design-system/player/PlayerFullSurface.tsx",
  "utf8",
);

describe(
  "governed Track Lyrics authority",
  () => {
    it("stores immutable versions and exposes only a published public read", () => {
      expect(migration).toContain("editorial.track_lyrics_versions");
      expect(migration).toContain("editorial.track_lyrics_documents");
      expect(migration).toContain("Track Lyrics versions are immutable");
      expect(migration).toContain("get_public_track_lyrics");
      expect(migration).toContain("current_published_version_id");
      expect(migration).toContain(
        "revoke all on table editorial.track_lyrics_versions",
      );
    });

    it("retires the in-memory fake moderation surface", () => {
      expect(admin).not.toContain("TIMED_LYRICS");
      expect(admin).not.toContain("upvotes");
      expect(admin).not.toContain("Rejected lyrics");
      expect(admin).toContain("saveTrackLyricsDraft");
      expect(admin).toContain("publishTrackLyrics");
      expect(service).toContain("fetchPublicTrackLyrics");
      expect(player).toContain("fetchPublicTrackLyrics");
    });

    it("keeps a permanent verifier", () => {
      expect(verifier).toContain("TRACK_LYRICS_AUTHORITY_PASS");
    });
  },
);
