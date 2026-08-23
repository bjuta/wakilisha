import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260823164330_track_lyrics_contribution_authority.sql",
  "utf8",
);
const verifier = readFileSync(
  "scripts/control-plane/verify-track-lyrics-contribution-authority.sql",
  "utf8",
);

describe("Track Lyrics contribution authority", () => {
  it("stores listener submissions separately from published Lyrics versions", () => {
    expect(migration).toContain(
      "create table editorial.track_lyrics_contributions",
    );
    expect(migration).toContain(
      "create or replace function public.submit_track_lyrics_contribution",
    );
    expect(migration).toContain("p_timing_mode text");
    expect(migration).toContain("status in ('submitted', 'promoted', 'rejected')");
  });

  it("keeps publication explicit by promoting a contribution only to working draft", () => {
    expect(migration).toContain(
      "create or replace function public.promote_track_lyrics_contribution_to_draft",
    );
    expect(migration).toContain("current_working_version_id = v_version_id");
    expect(migration).not.toContain("current_published_version_id = v_version_id");
    expect(migration).toContain("'contributor'");
  });

  it("keeps browser roles behind RPC authority", () => {
    expect(migration).toContain(
      "revoke all on table editorial.track_lyrics_contributions from public, anon, authenticated",
    );
    expect(migration).toContain(
      "grant execute on function public.submit_track_lyrics_contribution(uuid, text, text, jsonb, text) to authenticated",
    );
    expect(verifier).toContain("TRACK_LYRICS_CONTRIBUTION_AUTHORITY_PASS");
    expect(verifier).toContain("Anonymous Lyrics contribution execute grant must remain revoked");
  });
});
