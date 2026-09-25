import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("Public Music Identity Slice 3 review read-authority fix", () => {
  it("grants only the review columns and rows required by the Release Single control plane", () => {
    const migration = readFileSync(
      "supabase/migrations/20260925110250_public_music_identity_slice3_review_read_authority_fix.sql",
      "utf8",
    );
    const verifier = readFileSync(
      "scripts/control-plane/verify-public-music-identity-slice3-review-read-authority-fix.sql",
      "utf8",
    );

    expect(migration).toContain(
      "review read-authority repair requires MIZIZI zero at rest",
    );
    expect(migration).toContain("grant select (");
    expect(migration).toContain("review_type");
    expect(migration).toContain("entity_type");
    expect(migration).toContain("source_id");
    expect(migration).toContain("source_payload");
    expect(migration).toContain(
      "mizizi_executor_release_single_review_read",
    );
    expect(migration).toContain(
      "release_single_identity_conflict",
    );
    expect(migration).toContain("'1.4.0'");
    expect(migration).not.toMatch(
      /grant\s+select\s+on\s+public\.registry_review_items/i,
    );
    expect(migration).not.toMatch(
      /grant\s+(insert|update|delete)/i,
    );

    expect(verifier).toContain(
      "PUBLIC_MUSIC_IDENTITY_SLICE3_REVIEW_READ_AUTHORITY_FIX_PASS",
    );
    expect(verifier).toContain(
      "forbidden whole-table review SELECT",
    );
    expect(verifier).toContain(
      "Release Single identity review read columns drifted",
    );
    expect(verifier).toContain(
      "Release Single identity review RLS authority drifted",
    );
    expect(verifier).toContain("direct mutation rights");
  });
});
