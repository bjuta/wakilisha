import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("MIZIZI Slice 2 Gate A-final Registry authority convergence", () => {
  it("binds Artist intake to the signed-in caller JWT", () => {
    const page = read("src/pages/admin/registry/artists/intake/page.tsx");
    const config = read("supabase/config.toml");

    expect(page).toContain("supabase.auth.getSession()");
    expect(page).toContain("session?.access_token");
    expect(page).not.toContain("VITE_PUBLIC_SUPABASE_ANON_KEY");
    expect(config).toMatch(
      /\[functions\.artist-registry-intake\]\s*\nverify_jwt = true/,
    );
  });

  it("keeps the Artist intake Edge function out of canonical Artist DML", () => {
    const edge = read("supabase/functions/artist-registry-intake/index.ts");

    expect(edge).toContain("SUPABASE_ANON_KEY");
    expect(edge).toContain("current_user_has_capability");
    expect(edge).toContain("admin_review_registry_artist_intake_v1");
    expect(edge).toContain("admin_create_registry_artist_intake_shell_v1");
    expect(edge).toContain("admin_execute_registry_artist_origin_admission");
    expect(edge).toContain("admin_execute_registry_artist_enrichment_evidence_admission");
    expect(edge).toContain("admin_mark_registry_artist_intake_applied_v1");
    expect(edge).not.toMatch(/from\(["']registry_artists["']\)\s*\.\s*(insert|update|delete)/s);
    expect(edge).not.toMatch(/\bactor\s*[:=].*body/s);
  });

  it("freezes reviewed CSV authority before canonical Artist mutation", () => {
    const migration = read(
      "supabase/migrations/20260916120000_registry_artist_intake_authority_v1.sql",
    );

    expect(migration).toContain("review_fingerprint");
    expect(migration).toContain("applied_registry_artist_id");
    expect(migration).toContain("registry_artist_intake_admin");
    expect(migration).toContain("registry.artist.create");
    expect(migration).toContain("csv_manual_upload");
    expect(migration).toContain("admin_create_registry_artist_intake_shell_v1");
  });

  it("removes direct browser canonical Track mutation", () => {
    const track = read("src/pages/admin/registry/tracks/detail/page.tsx");

    expect(track).toContain("saveRegistryEntityPatch");
    expect(track).toContain('deleteRegistryEntity("track"');
    expect(track).not.toMatch(/from\(["']registry_tracks["']\)\s*\.\s*update/s);
  });

  it("removes direct browser canonical Release mutation while preserving precision and label", () => {
    const release = read("src/pages/admin/registry/releases/detail/page.tsx");
    const client = read("src/services/registry/admin/releaseDetailClient.ts");
    const migration = read(
      "supabase/migrations/20260916120100_registry_release_detail_admin_authority_v1.sql",
    );

    expect(release).toContain("saveRegistryReleaseDetail");
    expect(release).toContain('deleteRegistryEntity("release"');
    expect(release).not.toMatch(/from\(["']registry_releases["']\)\s*\.\s*update/s);
    expect(client).toContain("admin_patch_registry_release_detail_v1");
    expect(client).toContain("p_release_date_precision");
    expect(client).toContain("p_label_id");
    expect(migration).toContain("p_expected_updated_at");
    expect(migration).toContain("release_date_precision");
    expect(migration).toContain("label_id");
    expect(migration).toContain("registry_canonical_write_events");
  });
});
