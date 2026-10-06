import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relative: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relative), "utf8");

describe("Provider Identity reviewed candidate promotion", () => {
  it("keeps reviewed promotion behind existing manage_registry authority", () => {
    const page = read("src/pages/admin/charts/edition-detail/page.tsx");

    expect(page).toContain('useAdminUser');
    expect(page).toContain('adminUser.can("manage_registry")');
    expect(page).toContain('upsertTrackProviderLink');
    expect(page).toContain('matchMethod: "manual"');
    expect(page).toContain('matchStatus: "matched"');
    expect(page).toContain('status: "matched"');
    expect(page).toContain('provider_identity_review');
    expect(page).toContain(
      'authority: "admin_admit_registry_track_provider_link_v1"',
    );

    expect(page).not.toContain('"chart_admit_track_provider_link_v1"');
    expect(page).not.toContain('.from("registry_track_provider_links")');
  });

  it("reuses the accepted generic Registry provider-link broker", () => {
    const client = read("src/services/registry/providerLinks.ts");

    expect(client).toContain(
      '"admin_admit_registry_track_provider_link_v1"',
    );
    expect(client).not.toContain(
      '.from("registry_track_provider_links").insert',
    );
    expect(client).not.toContain(
      '.from("registry_track_provider_links").upsert',
    );
  });

  it("stages a fail-closed automatic-admission guard without a second canonical writer", () => {
    const wip = read(
      "supabase/migrations/20261006175212_provider_identity_chart_playback_strong_evidence_guard_v1.sql",
    );
    const verifier = read(
      "scripts/control-plane/verify-provider-identity-chart-playback-strong-evidence.sql",
    );

    expect(wip).toContain(
      "require_registry_chart_playback_provider_strong_identity_v1",
    );
    expect(wip).toContain("match_method,''))<>'isrc'");
    expect(wip).toContain("auto_accept");
    expect(wip).toContain("^[A-Z0-9]{12}$");
    expect(wip).toContain("v_input_isrc<>v_provider_isrc");
    expect(wip).toContain(
      "perform\n    platform_private.require_registry_chart_playback_provider_strong_identity_v1",
    );

    expect(verifier).toContain(
      "PROVIDER_IDENTITY_CHART_PLAYBACK_STRONG_EVIDENCE_GUARD=PASS",
    );
    expect(verifier).toContain(
      "require_registry_chart_playback_provider_strong_identity_v1",
    );

    expect(wip).not.toMatch(
      /insert\s+into\s+public\.registry_track_provider_links/i,
    );
    expect(wip).not.toMatch(
      /update\s+public\.registry_track_provider_links/i,
    );
    expect(wip).not.toMatch(
      /delete\s+from\s+public\.registry_track_provider_links/i,
    );
  });

  it("keeps chart-only operators out of reviewed canonical promotion", () => {
    const roles = read("src/services/userRoles.ts");

    expect(roles).toContain(
      'chart_editor_global: ["view_dashboard", "view_charts_admin", "manage_charts"',
    );
    expect(roles).toContain(
      'registry_editor: ["view_dashboard", "view_registry", "manage_registry"',
    );
  });
  it("retires the legacy Phase 9 direct provider-link write road", () => {
    const packageJson = read("package.json");
    const ingestRunPage = read(
      "src/pages/admin/charts/ingest-run-detail/page.tsx",
    );
    const legacyScript = path.resolve(
      process.cwd(),
      "scripts/registry/phase9-apple-music-chart-enrichment.ts",
    );

    expect(packageJson).not.toContain(
      '"registry:phase9:apple-music-chart-enrichment"',
    );
    expect(fs.existsSync(legacyScript)).toBe(false);
    expect(ingestRunPage).not.toContain(
      "registry:phase9:apple-music-chart-enrichment",
    );
    expect(ingestRunPage).toContain("Apple Music Playback Enrichment");
    expect(ingestRunPage).toContain("Return to the chart edition");
  });

});
